// unsubscribe
// Verifies the HMAC-signed token from a notification email, and zet
// de gevraagde preference-kolom op 'mute' voor de betreffende user.
//
// POST body: { token }
// Response: { success: true, type: 'pref_updates' | ... } | { error: '...' }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const UNSUBSCRIBE_SECRET = Deno.env.get('UNSUBSCRIBE_SECRET') || ''

const VALID_TYPES = new Set(['pref_updates', 'pref_prikbord', 'pref_events', 'pref_documents'])

const TYPE_LABELS: Record<string, string> = {
  pref_updates: 'Updates',
  pref_prikbord: 'Prikbord',
  pref_events: 'Events',
  pref_documents: 'Documenten',
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !UNSUBSCRIBE_SECRET) {
      return json({ error: 'Server misconfigured' }, 500)
    }

    const { token } = await req.json()
    if (!token || typeof token !== 'string') {
      return json({ error: 'Missing token' }, 400)
    }

    const verified = await verifyToken(token)
    if (!verified) return json({ error: 'Invalid or expired token' }, 400)

    if (!VALID_TYPES.has(verified.t)) {
      return json({ error: 'Invalid notification type' }, 400)
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Upsert: zet de gevraagde kolom op 'mute', behoud andere kolommen
    const { data: existing } = await admin
      .from('notification_preferences')
      .select('*')
      .eq('profile_id', verified.uid)
      .maybeSingle()

    const upd: Record<string, any> = {
      profile_id: verified.uid,
      pref_updates: existing?.pref_updates ?? 'all',
      pref_prikbord: existing?.pref_prikbord ?? 'all',
      pref_events: existing?.pref_events ?? 'all',
      pref_documents: existing?.pref_documents ?? 'all',
      mute_until: existing?.mute_until ?? null,
    }
    upd[verified.t] = 'mute'

    const { error } = await admin
      .from('notification_preferences')
      .upsert(upd, { onConflict: 'profile_id' })

    if (error) {
      console.error('[unsubscribe] update error', error)
      return json({ error: 'Failed to update preferences' }, 500)
    }

    return json({
      success: true,
      type: verified.t,
      label: TYPE_LABELS[verified.t] || verified.t,
    })
  } catch (err) {
    console.error('[unsubscribe] error', err)
    return json({ error: (err as Error).message }, 500)
  }
})

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function verifyToken(token: string): Promise<{ uid: string; t: string; exp: number } | null> {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, sigB64] = parts

  let payloadStr: string
  try {
    payloadStr = new TextDecoder().decode(b64urlDecode(payloadB64))
  } catch {
    return null
  }

  // Verify HMAC
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(UNSUBSCRIBE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )

  let sigBytes: Uint8Array
  try {
    sigBytes = b64urlDecode(sigB64)
  } catch {
    return null
  }

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(payloadStr)
  )
  if (!valid) return null

  let payload: any
  try {
    payload = JSON.parse(payloadStr)
  } catch {
    return null
  }

  if (!payload || typeof payload !== 'object') return null
  if (typeof payload.uid !== 'string' || typeof payload.t !== 'string') return null
  if (typeof payload.exp !== 'number') return null
  if (payload.exp * 1000 < Date.now()) return null

  return payload
}

function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replaceAll('-', '+').replaceAll('_', '/') + '=='.slice(0, (4 - (s.length % 4)) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
