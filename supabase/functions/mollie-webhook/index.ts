// ============================================================================
// mollie-webhook
// ============================================================================
// Mollie roept dit endpoint aan bij elke status-verandering van een payment.
// Belangrijke Mollie-conventies:
//   - Body is form-urlencoded met alleen `id=tr_xxxxx` (géén status in payload
//     — dat is by design voor security).
//   - Wij MOETEN de payment-status vers ophalen via
//     GET /v2/payments/{id} met het access token van de betreffende org.
//   - Antwoord moet 2xx zijn; anders retryt Mollie later opnieuw.
//   - De webhook-URL is zelf het gedeelde geheim (geen signature-header). We
//     accepteren pas een payment-id als we die kennen in `payments` én de
//     Mollie-API het bevestigt.
//
// Wat we doen bij `paid`:
//   - `payments` row updaten
//   - `payment_requests.status` naar 'paid', `paid_at` zetten
//   - TODO (Fase 2): signed PDF genereren + email versturen. Voor nu loggen we
//     alleen — we hebben nog geen PDF-service of mail-template.
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const _explicitSecret = Deno.env.get('SB_SECRET_KEY') || ''
const SERVICE_ROLE_KEY =
  (Deno.env.get('SUPABASE_SECRET_KEYS') || '').match(/sb_secret_[A-Za-z0-9_-]+/)?.[0] ||
  (_explicitSecret.startsWith('sb_secret_') ? _explicitSecret : '') ||
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const MOLLIE_API = 'https://api.mollie.com'

// Mollie status → onze status (identiek op naam-niveau, maar we mappen expliciet
// zodat onverwachte waarden opvallen ipv stilletjes doorschieten).
const STATUS_MAP: Record<string, string> = {
  open: 'open',
  pending: 'pending',
  authorized: 'authorized',
  paid: 'paid',
  failed: 'failed',
  canceled: 'canceled',
  expired: 'expired',
}

serve(async (req) => {
  if (req.method !== 'POST') {
    // Mollie gebruikt POST; anderen krijgen 405.
    return new Response('Method not allowed', { status: 405 })
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[mollie-webhook] missing supabase env')
    return new Response('Server misconfigured', { status: 500 })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ---- Payment id parsen -------------------------------------------------
  let molliePaymentId: string | null = null
  try {
    const body = await req.text()
    const params = new URLSearchParams(body)
    molliePaymentId = params.get('id')
  } catch (_e) {
    // Val terug op JSON voor het geval Mollie ooit switcht.
    try {
      const j = await req.json()
      molliePaymentId = j?.id || null
    } catch { /* leeg laten */ }
  }

  if (!molliePaymentId || !molliePaymentId.startsWith('tr_')) {
    console.warn('[mollie-webhook] missing or invalid id')
    // 200 terug: Mollie hoeft niet te retryen voor onbekende input.
    return new Response('ok', { status: 200 })
  }

  // ---- Payment + org opzoeken --------------------------------------------
  const { data: payment, error: paymentErr } = await admin
    .from('payments')
    .select(`
      id, payment_request_id, status,
      payment_request:payment_requests(
        id, project_id, status, amount_cents, currency,
        project:projects(organization_id)
      )
    `)
    .eq('provider_payment_id', molliePaymentId)
    .maybeSingle()

  if (paymentErr) {
    console.error('[mollie-webhook] payment lookup failed', paymentErr)
    return new Response('ok', { status: 200 }) // stille no-op, geen retry-storm
  }
  if (!payment) {
    console.warn('[mollie-webhook] unknown payment id', molliePaymentId)
    return new Response('ok', { status: 200 })
  }

  const orgId = (payment.payment_request as any)?.project?.organization_id
  if (!orgId) {
    console.error('[mollie-webhook] cannot resolve org for payment', payment.id)
    return new Response('ok', { status: 200 })
  }

  // ---- Access token uit vault --------------------------------------------
  const { data: account, error: accErr } = await admin
    .from('org_payment_accounts')
    .select('access_token_secret_id, status')
    .eq('organization_id', orgId)
    .maybeSingle()

  if (accErr || !account?.access_token_secret_id) {
    console.error('[mollie-webhook] no active mollie account for org', orgId, accErr)
    return new Response('ok', { status: 200 })
  }

  const { data: accessToken, error: vaultErr } = await admin.rpc('vault_read_secret', {
    p_secret_id: account.access_token_secret_id,
  })
  if (vaultErr || !accessToken) {
    console.error('[mollie-webhook] vault read failed', vaultErr)
    return new Response('ok', { status: 200 })
  }

  // ---- Verse status ophalen bij Mollie -----------------------------------
  const mollieRes = await fetch(`${MOLLIE_API}/v2/payments/${molliePaymentId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })
  if (!mollieRes.ok) {
    console.error('[mollie-webhook] mollie fetch failed', mollieRes.status)
    // 500 zodat Mollie retryt (mogelijk tijdelijke fout / token verlopen)
    return new Response('mollie fetch failed', { status: 500 })
  }
  const mp = await mollieRes.json()
  const mappedStatus = STATUS_MAP[mp.status] || null

  if (!mappedStatus) {
    console.warn('[mollie-webhook] unknown mollie status', mp.status)
    return new Response('ok', { status: 200 })
  }

  // Idempotentie: als we deze status al hebben verwerkt, niets doen.
  if (payment.status === mappedStatus) {
    return new Response('ok', { status: 200 })
  }

  // ---- payments updaten --------------------------------------------------
  const now = new Date().toISOString()
  const paymentUpdate: Record<string, unknown> = {
    status: mappedStatus,
    webhook_received_at: now,
    payment_method: mp.method || null,
  }
  if (mappedStatus === 'paid')   paymentUpdate.paid_at = mp.paidAt || now
  if (mappedStatus === 'failed') paymentUpdate.failed_at = mp.failedAt || now

  // Append aan raw_status_history (kort logje voor forensics)
  const historyEntry = { at: now, status: mp.status, method: mp.method || null }
  const { data: currentHistoryRow } = await admin
    .from('payments')
    .select('raw_status_history')
    .eq('id', payment.id)
    .single()
  const nextHistory = [
    ...((currentHistoryRow?.raw_status_history as any[]) || []),
    historyEntry,
  ].slice(-50) // cap: laatste 50 events per payment
  paymentUpdate.raw_status_history = nextHistory

  const { error: updErr } = await admin
    .from('payments')
    .update(paymentUpdate)
    .eq('id', payment.id)

  if (updErr) {
    console.error('[mollie-webhook] payment update failed', updErr)
    return new Response('db error', { status: 500 }) // retry
  }

  // ---- payment_requests bijwerken bij terminale status -------------------
  const requestId = (payment.payment_request as any)?.id
  if (requestId) {
    if (mappedStatus === 'paid') {
      await admin
        .from('payment_requests')
        .update({ status: 'paid', paid_at: now })
        .eq('id', requestId)
        .neq('status', 'paid') // idempotent

      // TODO (Fase 2): trigger signed-PDF-generatie + email naar lid + org.
      // Voor nu: alleen loggen. De data staat klaar zodra we die stap bouwen.
      console.log('[mollie-webhook] payment paid — PDF+email trigger nog niet geïmplementeerd', {
        payment_request_id: requestId,
      })
    } else if (mappedStatus === 'expired' || mappedStatus === 'canceled') {
      // Verzoek blijft 'sent'/'agreed' — lid kan opnieuw proberen. We markeren
      // het verzoek niet expired, want dat is een aparte deadline op het
      // verzoek zelf, niet op één betaalpoging.
    }
  }

  return new Response('ok', { status: 200 })
})
