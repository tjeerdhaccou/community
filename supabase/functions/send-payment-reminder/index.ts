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
import {
  emailDetails,
  emailLink,
  emailParagraph,
  escapeHtml,
  renderEmailLayout,
  resolveEmailTheme,
  type EmailBrand,
} from '../_shared/email-layout.ts'

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

function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })
}


// ── Wie roept aan? ────────────────────────────────────────────────────────
// verify_jwt laat ook de openbare sleutel en anonieme demosessies door, en deze
// functie werkt met de service-sleutel. Zonder echte, ingelogde gebruiker die
// betaalverzoeken van dit project mag beheren doen we niets. Zelfde regel als
// de policy payment_requests_moderator_all: moderator of beheerder van het
// project, beheerder van de organisatie (voor dit project) of platformbeheerder.
// deno-lint-ignore no-explicit-any
async function callerFromRequest(admin: any, req: Request): Promise<{ id: string } | null> {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return null
  try {
    const { data } = await admin.auth.getUser(jwt)
    const user = data?.user
    if (!user || user.is_anonymous) return null
    return { id: user.id }
  } catch {
    return null
  }
}

// deno-lint-ignore no-explicit-any
async function magBetaalverzoekenBeheren(admin: any, userId: string, projectId: string): Promise<boolean> {
  const { data: prof } = await admin.from('profiles').select('is_platform_admin').eq('id', userId).maybeSingle()
  if (prof?.is_platform_admin === true) return true
  const { count } = await admin.from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId).eq('profile_id', userId).in('role', ['moderator', 'admin'])
  if ((count ?? 0) > 0) return true
  const { data: proj } = await admin.from('projects').select('organization_id').eq('id', projectId).maybeSingle()
  if (!proj?.organization_id) return false
  const { data: om } = await admin.from('org_members')
    .select('role, project_ids').eq('organization_id', proj.organization_id).eq('profile_id', userId).maybeSingle()
  return om?.role === 'admin' && (om.project_ids == null || (om.project_ids as string[]).includes(projectId))
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
    .select(`id, project_id, title, amount_cents, reference, recipient_email, recipient_name, access_token, status,
              project:projects(name, slug, logo_url, app_accent_color, app_structure_color,
                               organization:organizations(name, logo_url, from_display_name, reply_to_email))`)
    .eq('id', body.payment_request_id)
    .maybeSingle()

  if (!pr) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  {
    const caller = await callerFromRequest(admin, req)
    if (!caller || !(await magBetaalverzoekenBeheren(admin, caller.id, pr.project_id))) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
  }
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
  const brand: EmailBrand | null = project
    ? {
        name: project.name || '',
        logoUrl: project.logo_url,
        accentColor: project.app_accent_color,
        structureColor: project.app_structure_color,
      }
    : org?.name ? { name: org.name, logoUrl: org.logo_url } : null
  const theme = resolveEmailTheme(brand)
  const amountText = formatEuro(pr.amount_cents)
  const detailRows = [{ label: 'Bedrag', value: amountText }]
  if (pr.reference) detailRows.push({ label: 'Referentie', value: pr.reference })
  const html = renderEmailLayout(
    {
      subject,
      preheader: `Er staat nog een betaalverzoek van ${amountText} voor je klaar.`,
      brand,
      heading: `Herinnering: ${pr.title}`,
      bodyHtml:
        emailParagraph(`Hoi ${escapeHtml(pr.recipient_name)},`) +
        emailParagraph(
          `Er staat nog een openstaand betaalverzoek van ${escapeHtml(amountText)} van ${escapeHtml(org?.name || 'ons')} klaar. Rond 'm hieronder af:`,
        ) +
        emailDetails(detailRows),
      button: { label: 'Bekijk en betaal', url: memberUrl },
      afterButtonHtml: emailParagraph(
        `Werkt de knop niet? Open dan deze link:<br/>${emailLink(theme, memberUrl)}`,
        { muted: true, small: true },
      ),
    },
    theme,
  )

  const orgDisplay = (org?.from_display_name || '').trim() || org?.name || FROM_NAME
  const fromName = `${orgDisplay} via buuur`
  const mailBody: Record<string, unknown> = {
    from: `${fromName} <${FROM_EMAIL}>`,
    to: [pr.recipient_email],
    subject,
    html,
  }
  if (org?.reply_to_email) mailBody.reply_to = [org.reply_to_email]

  const mailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(mailBody),
  })
  if (!mailRes.ok) {
    const errBody = await mailRes.text().catch(() => '')
    console.error('[send-payment-reminder] resend failed', mailRes.status, errBody)
    return new Response(JSON.stringify({ error: 'mail_failed' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
