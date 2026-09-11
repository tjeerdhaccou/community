// chat-notify-email
// Cron-invoked (elke 5 min, migratie 101). E-mail voor de ledenchat (migratie 099):
//   1. DM: ongelezen bericht van de ander dat na X min nog niet gezien is → één mail
//      per "ongelezen-episode" (niet opnieuw zolang de ontvanger niet gelezen heeft).
//   2. @mention in een groep: na X min ongelezen → mail (één per bericht).
//   3. Dagelijkse groepsdigest om DIGEST_TIME (Europe/Amsterdam): alle groepen met
//      ongelezen berichten in één mail, één per dag.
// Respecteert notification_preferences.pref_chat ('mute' = niets), mute_until,
// gedempte groepen (chat_participants.muted_until) en features.chat per project.
// Idempotent via notification_log. Zelfstandig; raakt dispatch-notification niet.

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
const UNSUBSCRIBE_SECRET = Deno.env.get('UNSUBSCRIBE_SECRET') || ''
const DELAY_MINUTES = Number(Deno.env.get('CHAT_EMAIL_DELAY_MIN') || '10')
const DIGEST_TIME = Deno.env.get('CHAT_DIGEST_TIME') || '17:00'
const DIGEST_WINDOW_MIN = 15

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>

/* ── HTML ─────────────────────────────────────────────────────────────────── */

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
function shell(inner: string, unsubLink: string | null): string {
  const foot = unsubLink
    ? `<p style="font-size:12px;color:#9BA1B0;margin:24px 0 0">Je krijgt deze mail omdat je meedoet aan de chat van je project. <a href="${unsubLink}" style="color:#9BA1B0">Geen chat-mails meer</a>.</p>`
    : ''
  return `<!doctype html><html><body style="margin:0;background:#F3F1ED;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1A1A2E"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border-radius:16px;padding:28px 26px">${inner}${foot}</div></div></body></html>`
}
function button(link: string, label: string): string {
  return `<a href="${link}" style="display:inline-block;background:#4A90D9;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:9999px">${label}</a>`
}
function snippet(s: string, n = 300): string {
  const t = (s || '').trim()
  return t.length > n ? t.slice(0, n) + '…' : t
}

function dmEmail(name: string | null, from: string, body: string, project: string, link: string, unsub: string | null): string {
  const hi = name ? `Hoi ${escapeHtml(name.split(' ')[0])},` : 'Hoi,'
  return shell(`<p style="font-size:16px;margin:0 0 12px">${hi}</p><p style="font-size:15px;color:#5A5F72;margin:0 0 16px"><b style="color:#1A1A2E">${escapeHtml(from)}</b> heeft je een bericht gestuurd in ${escapeHtml(project)}:</p><div style="background:#F3F1ED;border-radius:10px;padding:14px 16px;font-size:15px;line-height:1.5;margin:0 0 22px">${escapeHtml(snippet(body))}</div>${button(link, 'Bekijk en reageer')}`, unsub)
}

function mentionEmail(name: string | null, from: string, group: string, body: string, project: string, link: string, unsub: string | null): string {
  const hi = name ? `Hoi ${escapeHtml(name.split(' ')[0])},` : 'Hoi,'
  return shell(`<p style="font-size:16px;margin:0 0 12px">${hi}</p><p style="font-size:15px;color:#5A5F72;margin:0 0 16px"><b style="color:#1A1A2E">${escapeHtml(from)}</b> noemde je in <b style="color:#1A1A2E">${escapeHtml(group)}</b> (${escapeHtml(project)}):</p><div style="background:#F3F1ED;border-radius:10px;padding:14px 16px;font-size:15px;line-height:1.5;margin:0 0 22px">${escapeHtml(snippet(body))}</div>${button(link, 'Open de groep')}`, unsub)
}

function digestEmail(name: string | null, project: string, groups: { title: string; emoji: string | null; unread: number; last: string }[], link: string, unsub: string | null): string {
  const hi = name ? `Hoi ${escapeHtml(name.split(' ')[0])},` : 'Hoi,'
  const total = groups.reduce((n, g) => n + g.unread, 0)
  const rows = groups.map((g) => `
    <div style="border-top:1px solid #ECE8E1;padding:12px 0;display:flex">
      <div style="font-size:14px;font-weight:600">${g.emoji ? escapeHtml(g.emoji) + ' ' : ''}${escapeHtml(g.title)} <span style="color:#9BA1B0;font-weight:400">· ${g.unread} ${g.unread === 1 ? 'nieuw bericht' : 'nieuwe berichten'}</span></div>
      <div style="font-size:14px;color:#5A5F72;margin-top:3px;line-height:1.5">${escapeHtml(snippet(g.last, 140))}</div>
    </div>`).join('')
  return shell(`<p style="font-size:16px;margin:0 0 4px">${hi}</p><p style="font-size:15px;color:#5A5F72;margin:0 0 10px">Vandaag ${total} ${total === 1 ? 'nieuw bericht' : 'nieuwe berichten'} in je groepen bij ${escapeHtml(project)}.</p>${rows}<div style="margin-top:22px">${button(link, 'Open de chat')}</div>`, unsub)
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

async function send(to: string[], subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY || to.length === 0) return false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to, subject, html }),
  })
  return res.ok
}

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

// Zelfde formaat als dispatch-notification: base64url(payload).base64url(hmac)
async function unsubLink(userId: string): Promise<string | null> {
  if (!UNSUBSCRIBE_SECRET) return null
  const payloadStr = JSON.stringify({ uid: userId, t: 'pref_chat', exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 })
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(UNSUBSCRIBE_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadStr))
  const token = `${b64url(new TextEncoder().encode(payloadStr))}.${b64url(new Uint8Array(sig))}`
  return `https://${MAIN_DOMAIN}/unsubscribe?token=${encodeURIComponent(token)}`
}

function threadLink(project: { slug: string; custom_domain: string | null } | null, threadId: string): string {
  if (project?.custom_domain) return `https://${project.custom_domain}/chat?thread=${threadId}`
  if (project?.slug) return `https://${project.slug}.${MAIN_DOMAIN}/chat?thread=${threadId}`
  return `https://${MAIN_DOMAIN}`
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

function chatEnabled(features: Row | null): boolean {
  return !features || features.chat !== false
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

Deno.serve(async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'missing config' }), { status: 500 })
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const cutoff = new Date(Date.now() - DELAY_MINUTES * 60_000).toISOString()
  let dmSent = 0, mentionSent = 0, digestSent = 0

  // Voorkeuren in één keer ophalen (weinig rijen; alleen afwijkingen staan erin).
  const { data: prefRows } = await admin.from('notification_preferences').select('profile_id, pref_chat, mute_until')
  const prefs = new Map<string, Row>((prefRows ?? []).map((r: Row) => [r.profile_id, r]))
  const now = Date.now()
  function mailAllowed(userId: string): boolean {
    const p = prefs.get(userId)
    if (!p) return true
    if (p.pref_chat === 'mute') return false
    if (p.mute_until && new Date(p.mute_until).getTime() > now) return false
    return true
  }
  const isMuted = (mutedUntil: string | null) => !!mutedUntil && new Date(mutedUntil).getTime() > now

  // Alle deelnemer-rijen met thread + project + profiel: de basis voor 1 en 3.
  const { data: partRows } = await admin
    .from('chat_participants')
    .select(`
      thread_id, profile_id, last_read_at, muted_until,
      profile:profiles!profile_id(email, full_name),
      thread:chat_threads!thread_id(id, kind, title, emoji, archived_at, project_id, project:projects(name, slug, custom_domain, features))
    `)
  const parts = (partRows ?? []) as Row[]

  // ── 1. DM-nudge ──────────────────────────────────────────────────────────
  for (const cp of parts) {
    const t = cp.thread
    if (!t || t.kind !== 'direct' || t.archived_at) continue
    if (!cp.profile?.email || !mailAllowed(cp.profile_id) || !chatEnabled(t.project?.features)) continue

    // Nieuwste ongelezen bericht van de ander, ouder dan de debounce.
    const { data: msgs } = await admin
      .from('chat_messages')
      .select('id, body, created_at, sender:profiles!sender_id(full_name)')
      .eq('thread_id', t.id).neq('sender_id', cp.profile_id).is('deleted_at', null)
      .gt('created_at', cp.last_read_at).lt('created_at', cutoff)
      .order('created_at', { ascending: false }).limit(1)
    const m = (msgs ?? [])[0] as Row | undefined
    if (!m) continue

    // Eén mail per ongelezen-episode: al gemaild sinds de laatste keer lezen?
    const { data: logged } = await admin.from('notification_log').select('id')
      .eq('notification_type', 'chat_dm').eq('user_id', cp.profile_id).eq('reference_id', t.id)
      .gt('sent_at', cp.last_read_at).limit(1)
    if (logged && logged.length > 0) continue

    const from = m.sender?.full_name || 'Een lid'
    const link = threadLink(t.project, t.id)
    const ok = await send([cp.profile.email], `Nieuw bericht van ${from}`,
      dmEmail(cp.profile.full_name, from, m.body || '📎 Bijlage', t.project?.name || 'je project', link, await unsubLink(cp.profile_id)))
    if (ok) dmSent++
    await admin.from('notification_log').insert({
      user_id: cp.profile_id, project_id: t.project_id, notification_type: 'chat_dm',
      reference_id: t.id, channel: 'email', email: cp.profile.email, status: ok ? 'sent' : 'failed',
    })
  }

  // ── 2. @mentions in groepen ──────────────────────────────────────────────
  const { data: mentionMsgs } = await admin
    .from('chat_messages')
    .select('id, body, created_at, mentions, thread_id, sender:profiles!sender_id(full_name), thread:chat_threads!thread_id(id, kind, title, archived_at, project_id, project:projects(name, slug, custom_domain, features))')
    .neq('mentions', '{}').is('deleted_at', null)
    .lt('created_at', cutoff).gt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
    .limit(200)
  for (const m of (mentionMsgs ?? []) as Row[]) {
    const t = m.thread
    if (!t || t.kind !== 'group' || t.archived_at || !chatEnabled(t.project?.features)) continue
    for (const uid of (m.mentions ?? []) as string[]) {
      const cp = parts.find((p) => p.thread_id === t.id && p.profile_id === uid)
      if (!cp || !cp.profile?.email || !mailAllowed(uid)) continue
      if (new Date(cp.last_read_at).getTime() >= new Date(m.created_at).getTime()) continue // al gelezen
      const { data: logged } = await admin.from('notification_log').select('id')
        .eq('notification_type', 'chat_mention').eq('user_id', uid).eq('reference_id', m.id).limit(1)
      if (logged && logged.length > 0) continue

      const from = m.sender?.full_name || 'Een lid'
      const ok = await send([cp.profile.email], `${from} noemde je in ${t.title}`,
        mentionEmail(cp.profile.full_name, from, t.title, m.body || '📎 Bijlage', t.project?.name || 'je project', threadLink(t.project, t.id), await unsubLink(uid)))
      if (ok) mentionSent++
      await admin.from('notification_log').insert({
        user_id: uid, project_id: t.project_id, notification_type: 'chat_mention',
        reference_id: m.id, channel: 'email', email: cp.profile.email, status: ok ? 'sent' : 'failed',
      })
    }
  }

  // ── 3. Dagelijkse groepsdigest ───────────────────────────────────────────
  const ams = amsterdamNow()
  const [dh, dm] = DIGEST_TIME.split(':').map(Number)
  const diff = ams.minutes - (dh * 60 + dm)
  if (diff >= 0 && diff < DIGEST_WINDOW_MIN) {
    // Per (gebruiker, project): groepen met ongelezen berichten (niet gedempt).
    const byUserProject = new Map<string, { cp: Row; groups: { title: string; emoji: string | null; unread: number; last: string; threadId: string }[] }>()
    for (const cp of parts) {
      const t = cp.thread
      if (!t || t.kind !== 'group' || t.archived_at || isMuted(cp.muted_until)) continue
      if (!cp.profile?.email || !mailAllowed(cp.profile_id) || !chatEnabled(t.project?.features)) continue
      const { data: unreadMsgs, count } = await admin
        .from('chat_messages')
        .select('body', { count: 'exact' })
        .eq('thread_id', t.id).neq('sender_id', cp.profile_id).is('deleted_at', null)
        .gt('created_at', cp.last_read_at)
        .order('created_at', { ascending: false }).limit(1)
      if (!count) continue
      const key = `${cp.profile_id}:${t.project_id}`
      if (!byUserProject.has(key)) byUserProject.set(key, { cp, groups: [] })
      byUserProject.get(key)!.groups.push({ title: t.title, emoji: t.emoji, unread: count, last: (unreadMsgs ?? [])[0]?.body || '📎 Bijlage', threadId: t.id })
    }

    for (const [, { cp, groups }] of byUserProject) {
      const t = cp.thread
      // Eén digest per dag per gebruiker per project (sent_at op Amsterdam-datum).
      const { data: logged } = await admin.from('notification_log').select('sent_at')
        .eq('notification_type', 'chat_digest').eq('user_id', cp.profile_id).eq('project_id', t.project_id)
        .gt('sent_at', new Date(Date.now() - 20 * 3600_000).toISOString()).limit(1)
      if (logged && logged.length > 0) continue

      const link = groups.length === 1
        ? threadLink(t.project, groups[0].threadId)
        : threadLink(t.project, '').replace(/\?thread=$/, '')
      const total = groups.reduce((n, g) => n + g.unread, 0)
      const ok = await send([cp.profile.email], `${total} ${total === 1 ? 'nieuw bericht' : 'nieuwe berichten'} in je groepen`,
        digestEmail(cp.profile.full_name, t.project?.name || 'je project', groups, link, await unsubLink(cp.profile_id)))
      if (ok) digestSent++
      await admin.from('notification_log').insert({
        user_id: cp.profile_id, project_id: t.project_id, notification_type: 'chat_digest',
        reference_id: null, channel: 'email', email: cp.profile.email, status: ok ? 'sent' : 'failed',
      })
    }
  }

  return new Response(JSON.stringify({ ok: true, dmSent, mentionSent, digestSent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
