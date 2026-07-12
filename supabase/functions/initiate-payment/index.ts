// ============================================================================
// initiate-payment
// ============================================================================
// Aangeroepen vanuit de community-app zodra een lid akkoord heeft gegeven met
// een betaalverzoek. Doet:
//   1. Autoriseer aanroep — via authenticated user OR magic-link access_token
//   2. Load payment_request + org + Mollie access token (uit vault)
//   3. POST /v2/payments naar Mollie (namens de org, met application-fee=0
//      voor nu — hook staat wel klaar via platform_fee_bps)
//   4. Insert row in `payments` met provider_payment_id + checkout_url
//   5. Return { checkout_url }
//
// De webhook (mollie-webhook) verwerkt daarna de payment status changes.
//
// Body: { payment_request_id: string, access_token?: string, return_url?: string }
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL   = Deno.env.get('SUPABASE_URL') || ''
const APP_BASE_URL   = Deno.env.get('APP_BASE_URL') || 'https://buuur.nl'
const _explicit      = Deno.env.get('SB_SECRET_KEY') || ''
const SERVICE_ROLE_KEY =
  (Deno.env.get('SUPABASE_SECRET_KEYS') || '').match(/sb_secret_[A-Za-z0-9_-]+/)?.[0] ||
  (_explicit.startsWith('sb_secret_') ? _explicit : '') ||
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const MOLLIE_API = 'https://api.mollie.com'

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

function euroFromCents(cents: number): string {
  return (cents / 100).toFixed(2)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST')    return json(405, { error: 'method_not_allowed' })

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(500, { error: 'server_misconfigured' })

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Optioneel: user-scoped client (voor auth.uid()-check als caller ingelogd is)
  const authHeader = req.headers.get('authorization') || ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  const userClient = jwt
    ? createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '', {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null

  let body: { payment_request_id?: string; access_token?: string; return_url?: string } = {}
  try { body = await req.json() } catch {}
  const requestId    = body.payment_request_id
  const providedToken = body.access_token
  const returnUrl    = body.return_url

  if (!requestId) return json(400, { error: 'payment_request_id required' })

  const { data: pr, error: prErr } = await admin
    .from('payment_requests')
    .select(`
      id, project_id, recipient_profile_id, recipient_name, recipient_email,
      title, amount_cents, currency, status, access_token, agreed_at,
      platform_fee_bps,
      project:projects(id, name, slug, organization_id)
    `)
    .eq('id', requestId)
    .maybeSingle()

  if (prErr || !pr) return json(404, { error: 'not_found' })

  // Autorisatie: ofwel access_token match, ofwel ingelogd als recipient
  let authorized = false
  if (providedToken && pr.access_token && providedToken === pr.access_token) {
    authorized = true
  } else if (userClient) {
    const { data: claims } = await userClient.auth.getClaims()
    const uid = claims?.claims?.sub
    if (uid && uid === pr.recipient_profile_id) authorized = true
  }
  if (!authorized) return json(403, { error: 'forbidden' })

  // Status check — moet 'agreed' zijn voordat we een payment aanmaken
  if (pr.status !== 'agreed') {
    return json(409, { error: 'invalid_state', status: pr.status })
  }

  const orgId = (pr.project as any)?.organization_id
  if (!orgId) return json(500, { error: 'no_org' })

  // Access token uit vault
  const { data: account, error: accErr } = await admin
    .from('org_payment_accounts')
    .select('access_token_secret_id, mollie_profile_id, status')
    .eq('organization_id', orgId)
    .maybeSingle()

  if (accErr || !account?.access_token_secret_id || account.status !== 'active') {
    return json(400, { error: 'org_not_connected' })
  }

  const { data: mollieToken, error: vaultErr } = await admin.rpc('vault_read_secret', {
    p_secret_id: account.access_token_secret_id,
  })
  if (vaultErr || !mollieToken) {
    console.error('[initiate-payment] vault read failed', vaultErr)
    return json(500, { error: 'vault_read_failed' })
  }

  // Webhook URL — self-referential naar mollie-webhook edge fn
  const webhookUrl = `${SUPABASE_URL}/functions/v1/mollie-webhook`

  // Return URL — waar Mollie de gebruiker na iDEAL naartoe stuurt
  const projectSlug = (pr.project as any)?.slug
  const memberBase = projectSlug ? `https://${projectSlug}.buuur.nl` : APP_BASE_URL
  const finalReturnUrl = returnUrl || `${memberBase}/verzoeken/${pr.id}?paid=1${providedToken ? `&t=${providedToken}` : ''}`

  // Mollie payment aanmaken
  const molliePayload: Record<string, unknown> = {
    amount: {
      currency: pr.currency || 'EUR',
      value: euroFromCents(pr.amount_cents),
    },
    description: pr.title,
    redirectUrl: finalReturnUrl,
    webhookUrl,
    metadata: {
      payment_request_id: pr.id,
      project_id: pr.project_id,
    },
  }

  // Application fee (nu 0 default). Alleen meesturen als > 0 én we hebben een
  // fee-profile geconfigureerd. Voor now overslaan om edge-cases te vermijden.
  // if ((pr.platform_fee_bps ?? 0) > 0) { ... }

  if (account.mollie_profile_id) {
    molliePayload.profileId = account.mollie_profile_id
  }

  const mollieRes = await fetch(`${MOLLIE_API}/v2/payments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${mollieToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(molliePayload),
  })

  const mollieBody = await mollieRes.json().catch(() => ({}))

  if (!mollieRes.ok || !mollieBody.id || !mollieBody?._links?.checkout?.href) {
    console.error('[initiate-payment] mollie create failed', mollieRes.status, mollieBody)
    return json(502, { error: 'mollie_create_failed', detail: mollieBody })
  }

  const checkoutUrl = mollieBody._links.checkout.href as string
  const molliePaymentId = mollieBody.id as string

  // Log de payment
  const { error: insertErr } = await admin.from('payments').insert({
    payment_request_id: pr.id,
    provider: 'mollie',
    provider_payment_id: molliePaymentId,
    amount_cents: pr.amount_cents,
    currency: pr.currency || 'EUR',
    status: 'open',
    checkout_url: checkoutUrl,
    raw_status_history: [{ at: new Date().toISOString(), status: 'open', method: null }],
  })

  if (insertErr) {
    console.error('[initiate-payment] payments insert failed', insertErr)
    // Niet fataal: user kan nog steeds naar checkout, webhook zal payment
    // niet vinden — dan re-init nodig. Log en ga door.
  }

  return json(200, { checkout_url: checkoutUrl, mollie_payment_id: molliePaymentId })
})
