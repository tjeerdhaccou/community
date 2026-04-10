import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Secrets (set via supabase secrets set)
const TRANSIP_LOGIN = Deno.env.get('TRANSIP_LOGIN') || 'coucha'
const TRANSIP_PRIVATE_KEY = Deno.env.get('TRANSIP_PRIVATE_KEY')
const VERCEL_TOKEN = Deno.env.get('VERCEL_TOKEN')
const VERCEL_PROJECT_ID = Deno.env.get('VERCEL_PROJECT_ID')
const MAIN_DOMAIN = Deno.env.get('MAIN_DOMAIN') || 'buuur.nl'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- TransIP API: get auth token ---
async function getTransIPToken(): Promise<string> {
  // Import the private key
  const pemBody = TRANSIP_PRIVATE_KEY!
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')

  const binaryKey = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
    false, ['sign']
  )

  const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 32)
  const body = JSON.stringify({
    login: TRANSIP_LOGIN,
    nonce,
    read_only: false,
    expiration_time: '30 minutes',
    label: `domain-setup-${Date.now()}`,
    global_key: true,
  })

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(body)
  )
  const sig64 = btoa(String.fromCharCode(...new Uint8Array(signature)))

  const res = await fetch('https://api.transip.nl/v6/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Signature': sig64 },
    body,
  })
  const data = await res.json()
  if (!data.token) throw new Error(`TransIP auth failed: ${JSON.stringify(data)}`)
  return data.token
}

// --- TransIP: add CNAME record ---
async function addTransIPRecord(slug: string): Promise<void> {
  const token = await getTransIPToken()

  // Get existing records
  const getRes = await fetch(`https://api.transip.nl/v6/domains/${MAIN_DOMAIN}/dns`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  const existing = await getRes.json()
  const entries = existing.dnsEntries || []

  // Check if already exists
  if (entries.some((e: any) => e.name === slug && e.type === 'CNAME')) {
    console.log(`DNS record ${slug}.${MAIN_DOMAIN} already exists`)
    return
  }

  // Add new CNAME
  entries.push({ name: slug, expire: 300, type: 'CNAME', content: 'cname.vercel-dns.com.' })

  const putRes = await fetch(`https://api.transip.nl/v6/domains/${MAIN_DOMAIN}/dns`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ dnsEntries: entries }),
  })

  if (!putRes.ok) {
    const err = await putRes.text()
    throw new Error(`TransIP DNS update failed: ${err}`)
  }
  console.log(`DNS record added: ${slug}.${MAIN_DOMAIN}`)
}

// --- Vercel: add domain ---
async function addVercelDomain(slug: string): Promise<void> {
  const domain = `${slug}.${MAIN_DOMAIN}`

  const res = await fetch(`https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: domain }),
  })

  const data = await res.json()

  if (res.status === 409) {
    console.log(`Vercel domain ${domain} already exists`)
    return
  }
  if (!res.ok) {
    throw new Error(`Vercel domain add failed: ${JSON.stringify(data)}`)
  }
  console.log(`Vercel domain added: ${domain}`)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { slug, project_id } = await req.json()

    if (!slug || !project_id) {
      return new Response(JSON.stringify({ error: 'slug and project_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate: only allow lowercase alphanumeric + hyphens
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return new Response(JSON.stringify({ error: 'Invalid slug format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results: Record<string, string> = {}

    // 1. Add TransIP DNS record
    if (TRANSIP_PRIVATE_KEY) {
      try {
        await addTransIPRecord(slug)
        results.dns = 'ok'
      } catch (err) {
        console.error('TransIP error:', err)
        results.dns = `error: ${err.message}`
      }
    } else {
      results.dns = 'skipped (no TRANSIP_PRIVATE_KEY)'
    }

    // 2. Add Vercel domain
    if (VERCEL_TOKEN && VERCEL_PROJECT_ID) {
      try {
        await addVercelDomain(slug)
        results.vercel = 'ok'
      } catch (err) {
        console.error('Vercel error:', err)
        results.vercel = `error: ${err.message}`
      }
    } else {
      results.vercel = 'skipped (no VERCEL_TOKEN or VERCEL_PROJECT_ID)'
    }

    // 3. Update project record with custom domain
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const domain = `${slug}.${MAIN_DOMAIN}`
    await supabase.from('projects').update({ custom_domain: domain }).eq('id', project_id)
    results.database = 'ok'

    return new Response(JSON.stringify({ success: true, domain, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Function error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
