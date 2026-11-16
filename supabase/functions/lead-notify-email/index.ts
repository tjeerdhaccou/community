// lead-notify-email
// Aangeroepen door de DB-trigger leads_notify_email (migratie 109) met
// { lead_id }. Mailt het team over een nieuwe aanvraag via buuur.nl/start.
// Gedeployed met --no-verify-jwt (pg_net stuurt geen JWT); daarom:
//   * alleen leads jonger dan 2 minuten worden verwerkt (replay-bescherming);
//   * per lead hooguit één mail: leads.notified_at wordt atomair geclaimd.
// Ontvangers: LEADS_NOTIFY_EMAILS (kommagescheiden), anders alle platformbeheerders.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  emailDetails,
  emailParagraph,
  emailQuote,
  escapeHtml,
  renderEmailLayout,
  resolveEmailTheme,
} from '../_shared/email-layout.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@buuur.nl'
const FROM_NAME = Deno.env.get('FROM_NAME') || 'Buuur'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY =
  (Deno.env.get('SUPABASE_SECRET_KEYS') || '').match(/sb_secret_[A-Za-z0-9_-]+/)?.[0] ||
  Deno.env.get('SB_SECRET_KEY') ||
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const MAIN_DOMAIN = Deno.env.get('MAIN_DOMAIN') || 'buuur.nl'
const MAX_AGE_MS = 2 * 60_000

const SEGMENT_LABEL: Record<string, string> = {
  professional: 'Ontwikkelaar of procesbegeleider',
  bewoner: 'Bewoner of bewonersgroep',
}

// deno-lint-ignore no-explicit-any
function leadEmail(lead: Record<string, any>, subject: string): string {
  const theme = resolveEmailTheme(null)
  const rows: [string, string | null][] = [
    ['Naam', lead.name],
    ['E-mail', lead.email],
    ['Organisatie', lead.organization],
    ['Rol', lead.role],
    ['Situatie', lead.phase],
    ['Regio', lead.region],
  ]
  const details = emailDetails(rows.filter(([, v]) => v).map(([label, v]) => ({ label, value: String(v) })))
  const segment = SEGMENT_LABEL[lead.segment] || lead.segment
  const message = lead.message ? emailQuote(theme, 'Bericht', String(lead.message)) : ''
  return renderEmailLayout({
    subject,
    preheader: [lead.name, segment].filter(Boolean).join(' · '),
    heading: 'Nieuwe aanvraag via buuur.nl',
    bodyHtml: (segment ? emailParagraph(escapeHtml(String(segment)), { muted: true }) : '') + details + message,
    button: { label: 'Alle aanvragen', url: `https://admin.${MAIN_DOMAIN}/platform/leads` },
    afterButtonHtml: emailParagraph(`Beantwoord deze mail om direct te reageren aan ${escapeHtml(String(lead.name ?? ''))}.`, { muted: true, small: true }),
    footerNote: 'Je krijgt deze mail als platformbeheerder van Buuur.',
  }, theme)
}

Deno.serve(async (req) => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return new Response('missing config', { status: 500 })
  if (!RESEND_API_KEY) return new Response('resend not configured', { status: 500 })

  let leadId: string | undefined
  try { leadId = (await req.json())?.lead_id } catch { /* leeg */ }
  if (!leadId) return new Response('lead_id required', { status: 400 })

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

  // Claim de lead: alleen als hij vers is en nog niet gemeld. Twee gelijktijdige
  // aanroepen kunnen zo nooit allebei mailen.
  const since = new Date(Date.now() - MAX_AGE_MS).toISOString()
  const { data: lead } = await admin.from('leads')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', leadId).is('notified_at', null).gte('created_at', since)
    .select('*').maybeSingle()
  if (!lead) return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { 'Content-Type': 'application/json' } })

  let to = (Deno.env.get('LEADS_NOTIFY_EMAILS') || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (to.length === 0) {
    const { data: admins } = await admin.from('profiles').select('email').eq('is_platform_admin', true)
    to = (admins ?? []).map((a) => a.email).filter(Boolean)
  }
  if (to.length === 0) return new Response('no recipients', { status: 500 })

  const who = lead.organization ? `${lead.name} (${lead.organization})` : lead.name
  const subject = `Nieuwe aanvraag: ${who}`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      reply_to: lead.email,
      subject,
      html: leadEmail(lead, subject),
    }),
  })

  // Mislukt versturen: claim terugdraaien, zodat de lead in het overzicht als
  // "niet gemeld" zichtbaar blijft.
  if (!res.ok) {
    await admin.from('leads').update({ notified_at: null }).eq('id', leadId)
    return new Response(JSON.stringify({ ok: false, status: res.status, error: await res.text() }), { status: 502 })
  }
  return new Response(JSON.stringify({ ok: true, to: to.length }), { headers: { 'Content-Type': 'application/json' } })
})
