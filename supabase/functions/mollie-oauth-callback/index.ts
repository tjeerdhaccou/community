// ============================================================================
// mollie-oauth-callback
// ============================================================================
// Ontvangt de OAuth-callback van Mollie na "Koppel Mollie". Doet:
//   1. State-token verifiëren (voorkomt CSRF; koppelt callback aan de juiste
//      organisatie zonder dat we een authenticated sessie hebben in de redirect)
//   2. Authorization code wisselen voor access + refresh token
//   3. Mollie-organisatie- en profile-id ophalen
//   4. Tokens versleuteld opslaan in Supabase Vault
//   5. org_payment_accounts row bijwerken naar status 'active'
//   6. Terugleiden naar de org-instellingen met succes/fout-melding
//
// Env-secrets:
//   MOLLIE_CLIENT_ID
//   MOLLIE_CLIENT_SECRET
//   MOLLIE_REDIRECT_URI      -- moet exact matchen met wat naar Mollie gestuurd is
//   APP_BASE_URL             -- fallback redirect (default https://buuur.nl)
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MOLLIE_CLIENT_ID     = Deno.env.get('MOLLIE_CLIENT_ID') || ''
const MOLLIE_CLIENT_SECRET = Deno.env.get('MOLLIE_CLIENT_SECRET') || ''
const MOLLIE_REDIRECT_URI  = Deno.env.get('MOLLIE_REDIRECT_URI') || ''
const APP_BASE_URL         = Deno.env.get('APP_BASE_URL') || 'https://buuur.nl'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
// Voorkeur: SUPABASE_SECRET_KEYS (auto-managed sb_secret_…); fallback op legacy.
const _explicitSecret = Deno.env.get('SB_SECRET_KEY') || ''
const SERVICE_ROLE_KEY =
  (Deno.env.get('SUPABASE_SECRET_KEYS') || '').match(/sb_secret_[A-Za-z0-9_-]+/)?.[0] ||
  (_explicitSecret.startsWith('sb_secret_') ? _explicitSecret : '') ||
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const MOLLIE_API = 'https://api.mollie.com'

function redirect(to: string, params: Record<string, string>): Response {
  const url = new URL(to)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return Response.redirect(url.toString(), 302)
}

serve(async (req) => {
  const url = new URL(req.url)
  const code  = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const err   = url.searchParams.get('error')

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[mollie-oauth-callback] missing supabase env')
    return new Response('Server misconfigured', { status: 500 })
  }
  if (!MOLLIE_CLIENT_ID || !MOLLIE_CLIENT_SECRET || !MOLLIE_REDIRECT_URI) {
    console.error('[mollie-oauth-callback] missing mollie env')
    return new Response('Server misconfigured', { status: 500 })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. State validatie ------------------------------------------------------
  if (!state) return redirect(APP_BASE_URL, { mollie_error: 'missing_state' })

  const { data: stateRow, error: stateErr } = await admin
    .from('mollie_oauth_states')
    .select('state, organization_id, created_by, redirect_to, expires_at')
    .eq('state', state)
    .maybeSingle()

  if (stateErr || !stateRow) {
    console.error('[mollie-oauth-callback] state lookup failed', stateErr)
    return redirect(APP_BASE_URL, { mollie_error: 'invalid_state' })
  }
  if (new Date(stateRow.expires_at) < new Date()) {
    await admin.from('mollie_oauth_states').delete().eq('state', state)
    return redirect(stateRow.redirect_to || APP_BASE_URL, { mollie_error: 'expired_state' })
  }
  // Single-use: state direct opruimen
  await admin.from('mollie_oauth_states').delete().eq('state', state)

  const finalRedirect = stateRow.redirect_to || `${APP_BASE_URL}/settings`

  // Gebruiker klikte "Weigeren" bij Mollie
  if (err) {
    return redirect(finalRedirect, { mollie_error: err })
  }
  if (!code) {
    return redirect(finalRedirect, { mollie_error: 'missing_code' })
  }

  // 2. Code → tokens --------------------------------------------------------
  const tokenRes = await fetch(`${MOLLIE_API}/oauth2/tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(`${MOLLIE_CLIENT_ID}:${MOLLIE_CLIENT_SECRET}`),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: MOLLIE_REDIRECT_URI,
    }).toString(),
  })
  const tokens = await tokenRes.json().catch(() => ({}))

  if (!tokenRes.ok || !tokens.access_token) {
    console.error('[mollie-oauth-callback] token exchange failed', tokens)
    await admin.from('org_payment_accounts').upsert({
      organization_id: stateRow.organization_id,
      provider: 'mollie',
      status: 'error',
      last_error: `token_exchange_failed: ${JSON.stringify(tokens).slice(0, 500)}`,
    }, { onConflict: 'organization_id' })
    return redirect(finalRedirect, { mollie_error: 'token_exchange_failed' })
  }

  // 3. Mollie org + profile ophalen -----------------------------------------
  let mollieOrgId: string | null = null
  let mollieProfileId: string | null = null

  try {
    const orgRes = await fetch(`${MOLLIE_API}/v2/organizations/me`, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    })
    if (orgRes.ok) {
      const orgData = await orgRes.json()
      mollieOrgId = orgData?.id || null
    }

    const profilesRes = await fetch(`${MOLLIE_API}/v2/profiles?limit=1`, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    })
    if (profilesRes.ok) {
      const profilesData = await profilesRes.json()
      mollieProfileId = profilesData?._embedded?.profiles?.[0]?.id || null
    }
  } catch (e) {
    console.warn('[mollie-oauth-callback] org/profile fetch soft-fail', e)
    // Niet-fataal: tokens hebben we, org/profile kunnen we later ophalen.
  }

  // 4. Tokens versleuteld opslaan in Vault ----------------------------------
  // Bestaande vault-secrets voor deze org opruimen (reconnect scenario)
  const { data: existing } = await admin
    .from('org_payment_accounts')
    .select('access_token_secret_id, refresh_token_secret_id')
    .eq('organization_id', stateRow.organization_id)
    .maybeSingle()

  if (existing?.access_token_secret_id) {
    await admin.rpc('vault_delete_secret', { p_secret_id: existing.access_token_secret_id })
  }
  if (existing?.refresh_token_secret_id) {
    await admin.rpc('vault_delete_secret', { p_secret_id: existing.refresh_token_secret_id })
  }

  const accessName  = `mollie_access_${stateRow.organization_id}_${Date.now()}`
  const refreshName = `mollie_refresh_${stateRow.organization_id}_${Date.now()}`

  const { data: accessId, error: accessErr } = await admin.rpc('vault_create_secret', {
    p_secret: tokens.access_token,
    p_name: accessName,
  })
  const { data: refreshId, error: refreshErr } = await admin.rpc('vault_create_secret', {
    p_secret: tokens.refresh_token || '',
    p_name: refreshName,
  })

  if (accessErr || !accessId) {
    console.error('[mollie-oauth-callback] vault store failed', accessErr, refreshErr)
    return redirect(finalRedirect, { mollie_error: 'vault_store_failed' })
  }

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null

  // 5. Upsert org_payment_accounts -----------------------------------------
  const { error: upsertErr } = await admin.from('org_payment_accounts').upsert({
    organization_id: stateRow.organization_id,
    provider: 'mollie',
    access_token_secret_id: accessId,
    refresh_token_secret_id: refreshId,
    access_token_expires_at: expiresAt,
    mollie_organization_id: mollieOrgId,
    mollie_profile_id: mollieProfileId,
    status: 'active',
    last_error: null,
    connected_at: new Date().toISOString(),
    connected_by: stateRow.created_by,
    disconnected_at: null,
  }, { onConflict: 'organization_id' })

  if (upsertErr) {
    console.error('[mollie-oauth-callback] db upsert failed', upsertErr)
    return redirect(finalRedirect, { mollie_error: 'db_write_failed' })
  }

  return redirect(finalRedirect, { mollie: 'connected' })
})
