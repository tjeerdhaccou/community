// lead-notify-email
// Aangeroepen door de DB-trigger leads_notify_email (migratie 109) met
// { lead_id }. Mailt het team over een nieuwe aanvraag via buuur.nl/start.
// Gedeployed met --no-verify-jwt (pg_net stuurt geen JWT); daarom:
//   * alleen leads jonger dan 2 minuten worden verwerkt (replay-bescherming);
//   * per lead hooguit één mail: leads.notified_at wordt atomair geclaimd.
// Ontvangers: LEADS_NOTIFY_EMAILS (kommagescheiden), anders alle platformbeheerders.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
function shell(inner: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F3F1ED;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1A1A2E"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border-radius:16px;padding:28px 26px">${inner}</div></div></body></html>`
}
function button(link: string, label: string): string {
  return `<a href="${link}" style="display:inline-block;background:#4A90D9;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:9999px">${label}</a>`
}

// deno-lint-ignore no-explicit-any
function leadEmail(lead: Record<string, any>): string {
  const rows: [string, string | null][] = [
    ['Naam', lead.name],
    ['E-mail', lead.email],
    ['Organisatie', lead.organization],
    ['Rol', lead.role],
    ['Situatie', lead.phase],
    ['Regio', lead.region],
  ]
  const table = rows.filter(([, v]) => v).map(([k, v]) => `
    <tr><td style="padding:6px 16px 6px 0;color:#9BA1B0;font-size:14px;vertical-align:top;white-space:nowrap">${k}</td>
    <td style="padding:6px 0;font-size:15px">${escapeHtml(String(v))}</td></tr>`).join('')
  const message = lead.message
    ? `<div style="background:#F3F1ED;border-radius:10px;padding:14px 16px;font-size:15px;line-height:1.5;margin:18px 0 0;white-space:pre-wrap">${escapeHtml(lead.message)}</div>`
    : ''
  return shell(`<p style="font-size:16px;margin:0 0 4px;font-weight:600">Nieuwe aanvraag via buuur.nl</p>
<p style="font-size:14px;color:#5A5F72;margin:0 0 14px">${escapeHtml(SEGMENT_LABEL[lead.segment] || lead.segment)}</p>
<table style="border-collapse:collapse">${table}</table>${message}
<div style="margin-top:24px">${button(`https://admin.${MAIN_DOMAIN}/platform/leads`, 'Alle aanvragen')}</div>
<p style="font-size:12px;color:#9BA1B0;margin:22px 0 0">Beantwoord deze mail om direct te reageren aan ${escapeHtml(lead.name)}. Je krijgt deze mail als platformbeheerder van Buuur.</p>`)
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
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      reply_to: lead.email,
      subject: `Nieuwe aanvraag: ${who}`,
      html: leadEmail(lead),
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
