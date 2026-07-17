// ============================================================================
// list-payment-methods
// ============================================================================
// Haalt voor een payment_request de door de org geactiveerde Mollie betaal-
// methodes op — inclusief iDEAL-issuers (banken) met logo-URLs. Response is
// render-klaar zodat de client geen mapping meer hoeft te doen.
//
// Autorisatie: identiek aan initiate-payment — magic-link access_token OF een
// ingelogde recipient. Zonder valide auth kan niemand willekeurig methodes
// enumereren via een org.
//
// Cache: module-level Map keyed by (org_id, profile_id). Warm invocations
// hergebruiken hem. Mollie's methoden/issuers wisselen zelden, dus 30 min TTL.
//
// Body: { payment_request_id: string, access_token?: string }
// Response: { methods: [{ id, name, image, issuers?: [{ id, name, image }] }] }
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') || ''
const MOLLIE_CLIENT_ID     = Deno.env.get('MOLLIE_CLIENT_ID') || ''
const MOLLIE_CLIENT_SECRET = Deno.env.get('MOLLIE_CLIENT_SECRET') || ''
const _explicit            = Deno.env.get('SB_SECRET_KEY') || ''
const SERVICE_ROLE_KEY =
  (Deno.env.get('SUPABASE_SECRET_KEYS') || '').match(/sb_secret_[A-Za-z0-9_-]+/)?.[0] ||
  (_explicit.startsWith('sb_secret_') ? _explicit : '') ||
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const MOLLIE_API    = 'https://api.mollie.com'
const CACHE_TTL_MS  = 30 * 60 * 1000

type SimplifiedIssuer = { id: string; name: string; image: string | null }
type SimplifiedMethod = { id: string; name: string; image: string | null; issuers?: SimplifiedIssuer[] }
type CachedEntry     = { methods: SimplifiedMethod[]; expiresAt: number }

const methodsCache = new Map<string, CachedEntry>()

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Refresh: Mollie access-tokens verlopen na ~1u. Zelfde logica als initiate-payment.
async function refreshMollieAccessToken(
  admin: any,
  orgId: string,
  accessSecretId: string,
  refreshSecretId: string | null,
): Promise<string | null> {
  if (!refreshSecretId || !MOLLIE_CLIENT_ID || !MOLLIE_CLIENT_SECRET) return null

  const { data: refreshToken } = await admin.rpc('vault_read_secret', { p_secret_id: refreshSecretId })
  if (!refreshToken) return null

  const res = await fetch(`${MOLLIE_API}/oauth2/tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(`${MOLLIE_CLIENT_ID}:${MOLLIE_CLIENT_SECRET}`),
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
  })
  const tokens = await res.json().catch(() => ({}))
  if (!res.ok || !tokens.access_token) {
    console.error('[list-payment-methods] refresh failed', res.status, tokens)
    return null
  }

  await admin.rpc('vault_update_secret', { p_secret_id: accessSecretId, p_secret: tokens.access_token })
  if (tokens.refresh_token) {
    await admin.rpc('vault_update_secret', { p_secret_id: refreshSecretId, p_secret: tokens.refresh_token })
  }
  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null
  await admin.from('org_payment_accounts').update({
    access_token_expires_at: expiresAt,
    status: 'active',
    last_error: null,
  }).eq('organization_id', orgId)

  return tokens.access_token
}

function pickImage(img: any): string | null {
  if (!img) return null
  return img.svg || img.size2x || img.size1x || null
}

function simplify(mollieMethods: any[]): SimplifiedMethod[] {
  return mollieMethods.map((m) => {
    const issuersRaw = Array.isArray(m.issuers) ? m.issuers : null
    const out: SimplifiedMethod = {
      id: String(m.id),
      name: String(m.description ?? m.id),
      image: pickImage(m.image),
    }
    if (issuersRaw && issuersRaw.length) {
      out.issuers = issuersRaw.map((i: any) => ({
        id: String(i.id),
        name: String(i.name ?? i.id),
        image: pickImage(i.image),
      }))
    }
    return out
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST')    return json(405, { error: 'method_not_allowed' })

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(500, { error: 'server_misconfigured' })

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const authHeader = req.headers.get('authorization') || ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  const userClient = jwt
    ? createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '', {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null

  let body: { payment_request_id?: string; access_token?: string } = {}
  try { body = await req.json() } catch {}
  const requestId     = body.payment_request_id
  const providedToken = body.access_token

  if (!requestId) return json(400, { error: 'payment_request_id required' })

  const { data: pr, error: prErr } = await admin
    .from('payment_requests')
    .select(`
      id, recipient_profile_id, access_token,
      project:projects(id, organization_id)
    `)
    .eq('id', requestId)
    .maybeSingle()

  if (prErr || !pr) return json(404, { error: 'not_found' })

  // Autorisatie: token-match OR ingelogd als recipient
  let authorized = false
  if (providedToken && pr.access_token && providedToken === pr.access_token) {
    authorized = true
  } else if (userClient) {
    const { data: claims } = await userClient.auth.getClaims()
    const uid = claims?.claims?.sub
    if (uid && uid === pr.recipient_profile_id) authorized = true
  }
  if (!authorized) return json(403, { error: 'forbidden' })

  const orgId = (pr.project as any)?.organization_id
  if (!orgId) return json(500, { error: 'no_org' })

  const { data: account, error: accErr } = await admin
    .from('org_payment_accounts')
    .select('access_token_secret_id, refresh_token_secret_id, access_token_expires_at, mollie_profile_id, status')
    .eq('organization_id', orgId)
    .maybeSingle()

  if (accErr || !account?.access_token_secret_id || account.status !== 'active') {
    return json(400, { error: 'org_not_connected' })
  }

  const cacheKey = `${orgId}::${account.mollie_profile_id || 'default'}`
  const now = Date.now()
  const cached = methodsCache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return json(200, { methods: cached.methods, cached: true })
  }

  // Access token laden (met proactieve refresh)
  const expiresAt = account.access_token_expires_at ? new Date(account.access_token_expires_at).getTime() : 0
  const needsRefresh = !expiresAt || expiresAt < now + 60_000

  let mollieToken: string | null = null
  if (needsRefresh) {
    mollieToken = await refreshMollieAccessToken(
      admin, orgId, account.access_token_secret_id, account.refresh_token_secret_id,
    )
    if (!mollieToken) return json(401, { error: 'token_refresh_failed' })
  } else {
    const { data: fresh } = await admin.rpc('vault_read_secret', { p_secret_id: account.access_token_secret_id })
    mollieToken = fresh || null
    if (!mollieToken) return json(500, { error: 'vault_read_failed' })
  }

  const params = new URLSearchParams({
    include: 'issuers',
    resource: 'payments',
    locale: 'nl_NL',
  })
  if (account.mollie_profile_id) params.set('profileId', account.mollie_profile_id)

  const callMollie = (token: string) => fetch(`${MOLLIE_API}/v2/methods?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  })

  let mollieRes = await callMollie(mollieToken)
  if (mollieRes.status === 401 && !needsRefresh) {
    const fresh = await refreshMollieAccessToken(
      admin, orgId, account.access_token_secret_id, account.refresh_token_secret_id,
    )
    if (fresh) {
      mollieToken = fresh
      mollieRes = await callMollie(fresh)
    }
  }

  const mollieBody = await mollieRes.json().catch(() => ({}))

  if (!mollieRes.ok) {
    console.error('[list-payment-methods] mollie fetch failed', mollieRes.status, mollieBody)
    return json(502, { error: 'mollie_fetch_failed', detail: mollieBody })
  }

  const rawMethods = mollieBody?._embedded?.methods || []
  const methods = simplify(rawMethods)

  methodsCache.set(cacheKey, { methods, expiresAt: now + CACHE_TTL_MS })

  return json(200, { methods, cached: false })
})
