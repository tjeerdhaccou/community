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

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL') || ''
const APP_BASE_URL       = Deno.env.get('APP_BASE_URL') || 'https://buuur.nl'
const MOLLIE_CLIENT_ID     = Deno.env.get('MOLLIE_CLIENT_ID') || ''
const MOLLIE_CLIENT_SECRET = Deno.env.get('MOLLIE_CLIENT_SECRET') || ''
const _explicit          = Deno.env.get('SB_SECRET_KEY') || ''
const SERVICE_ROLE_KEY =
  (Deno.env.get('SUPABASE_SECRET_KEYS') || '').match(/sb_secret_[A-Za-z0-9_-]+/)?.[0] ||
  (_explicit.startsWith('sb_secret_') ? _explicit : '') ||
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const MOLLIE_API = 'https://api.mollie.com'

// Refresh: Mollie access-tokens verlopen na ~1 uur. We verversen proactief als
// expires_at binnen 60s zit én reactief als Mollie 401 antwoordt.
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
    console.error('[initiate-payment] refresh failed', res.status, tokens)
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

  let body: {
    payment_request_id?: string
    access_token?: string
    return_url?: string
    method?: string
    issuer?: string
  } = {}
  try { body = await req.json() } catch {}
  const requestId    = body.payment_request_id
  const providedToken = body.access_token
  const returnUrl    = body.return_url
  const method       = body.method
  const issuer       = body.issuer

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

  // Autorisatie: token-match, óf ingelogd met matching profile-id, óf ingelogd
  // met matching e-mail. Die laatste is nodig omdat recipient_profile_id
  // nullable is (niet-leden krijgen alleen naam+email), waardoor betalen vanuit
  // de app anders altijd 403 gaf. We gebruiken getUser() ipv getClaims() omdat
  // die met Bearer-only clients (zonder persisted session) betrouwbaar werkt.
  let authorized = false
  if (providedToken && pr.access_token && providedToken === pr.access_token) {
    authorized = true
  } else if (userClient) {
    const { data: userRes } = await userClient.auth.getUser()
    const uid = userRes?.user?.id
    const email = typeof userRes?.user?.email === 'string' ? userRes.user.email.toLowerCase() : null
    const recipientEmail = typeof pr.recipient_email === 'string' ? pr.recipient_email.toLowerCase() : null
    if (uid && pr.recipient_profile_id && uid === pr.recipient_profile_id) {
      authorized = true
    } else if (uid && email && recipientEmail && email === recipientEmail) {
      authorized = true
      // Backfill recipient_profile_id zodat volgende requests via de snelle
      // id-match gaan én RLS-policies (die op recipient_profile_id checken)
      // vanaf nu ook werken voor deze user.
      if (!pr.recipient_profile_id) {
        await admin.from('payment_requests').update({ recipient_profile_id: uid }).eq('id', pr.id)
      }
    }
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
    .select('access_token_secret_id, refresh_token_secret_id, access_token_expires_at, mollie_profile_id, status')
    .eq('organization_id', orgId)
    .maybeSingle()

  if (accErr || !account?.access_token_secret_id || account.status !== 'active') {
    return json(400, { error: 'org_not_connected' })
  }

  // Proactieve refresh: als expires_at binnen 60 seconden verloopt of al voorbij is.
  const expiresAt = account.access_token_expires_at ? new Date(account.access_token_expires_at).getTime() : 0
  const needsRefresh = !expiresAt || expiresAt < Date.now() + 60_000

  let mollieToken: string | null = null
  if (needsRefresh) {
    mollieToken = await refreshMollieAccessToken(
      admin, orgId, account.access_token_secret_id, account.refresh_token_secret_id,
    )
    if (!mollieToken) return json(401, { error: 'token_refresh_failed', hint: 'Mollie opnieuw koppelen in Instellingen.' })
  } else {
    const { data: fresh } = await admin.rpc('vault_read_secret', { p_secret_id: account.access_token_secret_id })
    mollieToken = fresh || null
    if (!mollieToken) return json(500, { error: 'vault_read_failed' })
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

  // Betaalmethode + iDEAL-issuer (bank) inline gekozen op het betaalscherm.
  // Als issuer meegestuurd wordt gaat Mollie direct naar die bank; anders
  // toont Mollie een bank-hub. Als method leeg is toont Mollie de volledige
  // methode-picker (fallback).
  if (method) {
    molliePayload.method = method
    if (issuer) {
      molliePayload.issuer = issuer
    }
  }

  const callMollie = (token: string) => fetch(`${MOLLIE_API}/v2/payments`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(molliePayload),
  })

  let mollieRes = await callMollie(mollieToken)
  // Reactieve retry: als Mollie 401 zegt terwijl wij dachten dat de token OK was
  // (bv. expires_at was misleidend), refresh en probeer opnieuw.
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
