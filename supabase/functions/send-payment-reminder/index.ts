// ============================================================================
// send-payment-reminder
// ============================================================================
// Aangeroepen vanuit CMS bij de "Herinner"-knop. Vereist status in
// ('sent','viewed') — verstuurt een compactere herinnering-mail met dezelfde
// magic-link. Update van last_reminder_at gebeurt in de aanroepende server
// action, niet hier.
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL   = Deno.env.get('SUPABASE_URL') || ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL') || 'noreply@buuur.nl'
const FROM_NAME      = Deno.env.get('FROM_NAME') || 'Buuur'
const APP_BASE_URL   = Deno.env.get('APP_BASE_URL') || 'https://buuur.nl'
const _explicit      = Deno.env.get('SB_SECRET_KEY') || ''
const SERVICE_ROLE_KEY =
  (Deno.env.get('SUPABASE_SECRET_KEYS') || '').match(/sb_secret_[A-Za-z0-9_-]+/)?.[0] ||
  (_explicit.startsWith('sb_secret_') ? _explicit : '') ||
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST')     return new Response('method_not_allowed', { status: 405 })
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return new Response('misconfigured', { status: 500 })

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

  let body: { payment_request_id?: string } = {}
  try { body = await req.json() } catch { /* leeg */ }
  if (!body.payment_request_id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const { data: pr } = await admin
    .from('payment_requests')
    .select(`id, title, amount_cents, recipient_email, recipient_name, access_token, status,
              project:projects(name, slug, organization:organizations(name))`)
    .eq('id', body.payment_request_id)
    .maybeSingle()

  if (!pr) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  if (!['sent', 'viewed'].includes(pr.status)) {
    return new Response(JSON.stringify({ error: 'invalid_state' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const project = (pr.project as any)
  const org     = project?.organization
  const projectSlug = project?.slug
  const memberUrl = projectSlug
    ? `https://${projectSlug}.buuur.nl/verzoeken/${pr.id}?t=${pr.access_token || ''}`
    : `${APP_BASE_URL}/verzoeken/${pr.id}?t=${pr.access_token || ''}`

  if (!RESEND_API_KEY) {
    console.log('[send-payment-reminder] no RESEND_API_KEY — zou mail naar', pr.recipient_email, 'sturen')
    return new Response(JSON.stringify({ ok: true, skipped_mail: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const subject = `Herinnering: ${pr.title}`
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;padding:24px;">
      <h1 style="font-size:20px;margin:0 0 16px;">Herinnering: ${escapeHtml(pr.title)}</h1>
      <p style="font-size:15px;line-height:1.55;margin:0 0 12px;">Hoi ${escapeHtml(pr.recipient_name)},</p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 12px;">
        Er staat nog een openstaand betaalverzoek van ${escapeHtml(formatEuro(pr.amount_cents))}
        van ${escapeHtml(org?.name || 'ons')} klaar. Rond 'm hieronder af:
      </p>
      <p style="margin:24px 0;">
        <a href="${memberUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:500;">
          Bekijk en betaal
        </a>
      </p>
      <p style="font-size:13px;color:#666;line-height:1.5;margin:20px 0 0;">
        Werkt de knop niet? Open dan deze link:<br/>
        <a href="${memberUrl}" style="color:#666;word-break:break-all;">${memberUrl}</a>
      </p>
    </div>
  `

  const mailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [pr.recipient_email],
      subject,
      html,
    }),
  })
  if (!mailRes.ok) {
    const errBody = await mailRes.text().catch(() => '')
    console.error('[send-payment-reminder] resend failed', mailRes.status, errBody)
    return new Response(JSON.stringify({ error: 'mail_failed' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
