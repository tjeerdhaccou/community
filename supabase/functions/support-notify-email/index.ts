// support-notify-email
// Cron-invoked (elke 5 min). Twee kanalen:
//   1. LID: agent-antwoord dat het lid na X min nog niet zag → directe mail (debounce).
//   2. TEAM: digest per org op ingestelde tijdstippen (support_settings) met alle
//      openstaande (onbeantwoorde) vragen. Alleen als er vragen zijn. Idempotent
//      per org+slot+dag via support_digest_log.
// Zelfstandig; raakt dispatch-notification niet.

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
const DELAY_MINUTES = Number(Deno.env.get('SUPPORT_EMAIL_DELAY_MIN') || '10')
const DIGEST_WINDOW_MIN = 15 // slot is "due" tot 15 min erna; log voorkomt dubbel

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
function shell(inner: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F3F1ED;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1A1A2E"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border-radius:16px;padding:28px 26px">${inner}</div></div></body></html>`
}
function button(link: string, label: string): string {
  return `<a href="${link}" style="display:inline-block;background:#4A90D9;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:9999px">${label}</a>`
}

function memberEmail(name: string | null, body: string, link: string): string {
  const hi = name ? `Hoi ${name},` : 'Hoi,'
  const snippet = body.length > 300 ? body.slice(0, 300) + '…' : body
  return shell(`<p style="font-size:16px;margin:0 0 12px">${hi}</p><p style="font-size:15px;color:#5A5F72;margin:0 0 16px">Je hebt een antwoord van support gekregen:</p><div style="background:#F3F1ED;border-radius:10px;padding:14px 16px;font-size:15px;line-height:1.5;margin:0 0 22px">${escapeHtml(snippet)}</div>${button(link, 'Bekijk en reageer')}<p style="font-size:12px;color:#9BA1B0;margin:24px 0 0">Je krijgt deze mail omdat je een vraag hebt gesteld via de support-chat.</p>`)
}

function digestEmail(items: { who: string; project: string | null; snippet: string; when: string }[], link: string): string {
  const rows = items.map((it) => `
    <div style="border-top:1px solid #ECE8E1;padding:14px 0">
      <div style="font-size:14px;font-weight:600">${escapeHtml(it.who)}${it.project ? ` <span style="color:#9BA1B0;font-weight:400">· ${escapeHtml(it.project)}</span>` : ''} <span style="color:#9BA1B0;font-weight:400;font-size:12px">· ${escapeHtml(it.when)}</span></div>
      <div style="font-size:15px;color:#3A3656;margin-top:4px;line-height:1.5">${escapeHtml(it.snippet)}</div>
    </div>`).join('')
  const n = items.length
  return shell(`<p style="font-size:16px;margin:0 0 4px;font-weight:600">Openstaande supportvragen</p><p style="font-size:14px;color:#5A5F72;margin:0 0 8px">${n} ${n === 1 ? 'vraag wacht' : 'vragen wachten'} op antwoord.</p>${rows}<div style="margin-top:22px">${button(link, 'Open de support-inbox')}</div><p style="font-size:12px;color:#9BA1B0;margin:22px 0 0">Je krijgt deze digest als beheerder van de organisatie. Instellen kan in de support-inbox onder Instellingen.</p>`)
}

async function send(to: string[], subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY || to.length === 0) return false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to, subject, html }),
  })
  return res.ok
}

function amsterdamNow(): { date: string; minutes: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date()).map((x) => [x.type, x.value]),
  ) as Record<string, string>
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: (Number(p.hour) % 24) * 60 + Number(p.minute) }
}

function shortTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

Deno.serve(async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'missing config' }), { status: 500 })
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

  let memberSent = 0, digestsSent = 0

  // ── 1. LID: agent-antwoord → mail het lid (per bericht, debounce) ──────────
  const cutoff = new Date(Date.now() - DELAY_MINUTES * 60_000).toISOString()
  const { data: agentRows } = await admin
    .from('support_messages')
    .select(`id, body, conversation:support_conversations!inner(id, user_id, project_id, recipient:profiles!user_id(email, full_name), project:projects(slug, custom_domain))`)
    .eq('sender_role', 'agent').is('read_at', null).lt('created_at', cutoff).limit(50)

  for (const m of (agentRows ?? []) as any[]) {
    const conv = m.conversation
    const recip = conv?.recipient
    if (!recip?.email) continue
    const { data: logged } = await admin.from('notification_log').select('id')
      .eq('notification_type', 'new_support_message').eq('reference_id', m.id).eq('channel', 'email').limit(1)
    if (logged && logged.length > 0) continue
    const proj = conv.project
    const link = proj?.custom_domain
      ? `https://${proj.custom_domain}/?support=${conv.id}`
      : proj?.slug ? `https://${MAIN_DOMAIN}/p/${proj.slug}?support=${conv.id}`
      : `https://${MAIN_DOMAIN}/?support=${conv.id}`
    const ok = await send([recip.email], 'Je hebt een antwoord van support', memberEmail(recip.full_name, m.body, link))
    if (ok) memberSent++
    await admin.from('notification_log').insert({
      user_id: conv.user_id, project_id: conv.project_id, notification_type: 'new_support_message',
      reference_id: m.id, channel: 'email', email: recip.email, status: ok ? 'sent' : 'failed',
    })
  }

  // ── 2. TEAM: digest per org op ingestelde tijdstippen ──────────────────────
  const now = amsterdamNow()

  // Alle onbeantwoorde vragen (ongelezen lid-berichten), gegroepeerd per org.
  const { data: openMsgs } = await admin
    .from('support_messages')
    .select(`body, created_at, conversation:support_conversations!inner(id, org_id, sender:profiles!user_id(full_name), project:projects(name), org:organizations(slug))`)
    .eq('sender_role', 'user').is('read_at', null)
    .order('created_at', { ascending: true })

  const byOrg = new Map<string, { slug: string | null; convs: Map<string, { who: string; project: string | null; snippet: string; when: string }> }>()
  for (const m of (openMsgs ?? []) as any[]) {
    const conv = m.conversation
    const orgId = conv?.org_id
    if (!orgId) continue
    if (!byOrg.has(orgId)) byOrg.set(orgId, { slug: conv.org?.slug ?? null, convs: new Map() })
    // per conversatie de laatste vraag tonen
    byOrg.get(orgId)!.convs.set(conv.id, {
      who: conv.sender?.full_name || 'Onbekend lid',
      project: conv.project?.name ?? null,
      snippet: (m.body || '').slice(0, 200),
      when: shortTime(m.created_at),
    })
  }

  for (const [orgId, { slug, convs }] of byOrg) {
    if (convs.size === 0) continue

    // Instellingen (of defaults).
    const { data: settings } = await admin.from('support_settings').select('*').eq('org_id', orgId).maybeSingle()
    const enabled = settings?.digest_enabled ?? true
    if (!enabled) continue
    const times: string[] = settings?.digest_times ?? ['11:30', '16:00']

    // Welk slot is nu "due"?
    let dueSlot: string | null = null
    for (const t of times) {
      const [h, mm] = String(t).split(':').map(Number)
      const slotMin = h * 60 + mm
      const diff = now.minutes - slotMin
      if (diff >= 0 && diff < DIGEST_WINDOW_MIN) { dueSlot = t; break }
    }
    if (!dueSlot) continue

    // Al verstuurd voor dit slot vandaag?
    const { data: already } = await admin.from('support_digest_log').select('id')
      .eq('org_id', orgId).eq('digest_date', now.date).eq('slot', dueSlot).limit(1)
    if (already && already.length > 0) continue

    // Ontvangers: ingesteld, anders val terug op org-admins.
    let recipients: string[] = (settings?.recipient_emails ?? []).filter(Boolean)
    if (recipients.length === 0) {
      const { data: admins } = await admin.from('org_members')
        .select('profile:profiles(email)').eq('organization_id', orgId).eq('role', 'admin')
      recipients = (admins ?? []).map((a: any) => a.profile?.email).filter(Boolean)
    }
    if (recipients.length === 0) continue

    const link = slug ? `https://admin.${MAIN_DOMAIN}/org/${slug}/support` : `https://admin.${MAIN_DOMAIN}`
    const items = [...convs.values()]
    const ok = await send(recipients, `Openstaande supportvragen (${items.length})`, digestEmail(items, link))
    if (ok) digestsSent++

    // Log het slot (ook bij mislukte send, om spam-retries te voorkomen).
    await admin.from('support_digest_log').insert({ org_id: orgId, digest_date: now.date, slot: dueSlot })
  }

  return new Response(JSON.stringify({ ok: true, memberSent, digestsSent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
