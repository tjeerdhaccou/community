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
// Weekdag voor de wekelijkse groepsdigest: 0=zo … 1=ma (standaard maandag).
const DIGEST_WEEKDAY = Number(Deno.env.get('CHAT_DIGEST_WEEKDAY') || '1')
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

function groupDirectEmail(name: string | null, from: string, group: string, body: string, project: string, link: string, unsub: string | null): string {
  const hi = name ? `Hoi ${escapeHtml(name.split(' ')[0])},` : 'Hoi,'
  return shell(`<p style="font-size:16px;margin:0 0 12px">${hi}</p><p style="font-size:15px;color:#5A5F72;margin:0 0 16px">Nieuw bericht van <b style="color:#1A1A2E">${escapeHtml(from)}</b> in <b style="color:#1A1A2E">${escapeHtml(group)}</b> (${escapeHtml(project)}):</p><div style="background:#F3F1ED;border-radius:10px;padding:14px 16px;font-size:15px;line-height:1.5;margin:0 0 22px">${escapeHtml(snippet(body))}</div>${button(link, 'Open de groep')}`, unsub)
}

function digestEmail(name: string | null, project: string, groups: { title: string; emoji: string | null; unread: number; last: string }[], link: string, unsub: string | null, periode: string): string {
  const hi = name ? `Hoi ${escapeHtml(name.split(' ')[0])},` : 'Hoi,'
  const total = groups.reduce((n, g) => n + g.unread, 0)
  const rows = groups.map((g) => `
    <div style="border-top:1px solid #ECE8E1;padding:12px 0;display:flex">
      <div style="font-size:14px;font-weight:600">${g.emoji ? escapeHtml(g.emoji) + ' ' : ''}${escapeHtml(g.title)} <span style="color:#9BA1B0;font-weight:400">· ${g.unread} ${g.unread === 1 ? 'nieuw bericht' : 'nieuwe berichten'}</span></div>
      <div style="font-size:14px;color:#5A5F72;margin-top:3px;line-height:1.5">${escapeHtml(snippet(g.last, 140))}</div>
    </div>`).join('')
  return shell(`<p style="font-size:16px;margin:0 0 4px">${hi}</p><p style="font-size:15px;color:#5A5F72;margin:0 0 10px">${periode} ${total} ${total === 1 ? 'nieuw bericht' : 'nieuwe berichten'} in je groepen bij ${escapeHtml(project)}.</p>${rows}<div style="margin-top:22px">${button(link, 'Open de chat')}</div>`, unsub)
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
async function unsubLink(userId: string, prefCol = 'pref_chat'): Promise<string | null> {
  if (!UNSUBSCRIBE_SECRET) return null
  const payloadStr = JSON.stringify({ uid: userId, t: prefCol, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 })
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

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function amsterdamNow(): { date: string; minutes: number; weekday: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
    }).formatToParts(new Date()).map((x) => [x.type, x.value]),
  ) as Record<string, string>
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minutes: (Number(p.hour) % 24) * 60 + Number(p.minute),
    weekday: WEEKDAYS[p.weekday] ?? 1,
  }
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
  let dmSent = 0, mentionSent = 0, digestSent = 0, groupDirectSent = 0

  // Voorkeuren in één keer ophalen (weinig rijen; alleen afwijkingen staan erin).
  const { data: prefRows } = await admin.from('notification_preferences').select('profile_id, pref_chat, pref_chat_groups, mute_until')
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
  // Groepsmail staat los van de persoonlijke mail: direct | daily | weekly | never.
  // Zonder rij geldt de standaard (wekelijks); staat de hele chat-mail uit, dan ook groepen.
  function groupPref(userId: string): string {
    if (!mailAllowed(userId)) return 'never'
    return prefs.get(userId)?.pref_chat_groups || 'weekly'
  }

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

  // ── 3. Groepen: direct / dagelijks / wekelijks ───────────────────────────
  // Kernregel: een mail gaat alleen over wat NIEUW is sinds de vorige mail.
  // Daarvoor is het ijkpunt max(last_read_at, laatste digest). Zonder die regel
  // kreeg een lid dat niets las elke dag dezelfde herinnering.
  const { data: digestLog } = await admin
    .from('notification_log')
    .select('user_id, project_id, sent_at')
    .eq('notification_type', 'chat_digest')
    .order('sent_at', { ascending: false })
    .limit(2000)
  const lastDigest = new Map<string, string>()
  for (const r of (digestLog ?? []) as Row[]) {
    const k = `${r.user_id}:${r.project_id}`
    if (!lastDigest.has(k)) lastDigest.set(k, r.sent_at)
  }
  // Vanaf welk moment telt een bericht als "nieuw" voor deze deelnemer?
  function sinceFor(cp: Row, projectId: string): string {
    const prev = lastDigest.get(`${cp.profile_id}:${projectId}`)
    if (!prev) return cp.last_read_at
    // Vergelijk als tijdstip, niet als tekst: tijdstempels kunnen in notatie
    // verschillen (offset, aantal decimalen) en zouden dan verkeerd sorteren.
    return new Date(prev).getTime() > new Date(cp.last_read_at).getTime() ? prev : cp.last_read_at
  }

  // 3a. 'direct': per groepsgesprek een nudge na X min ongelezen, één per
  //     ongelezen-episode (zelfde ritme als een privébericht).
  for (const cp of parts) {
    const t = cp.thread
    if (!t || t.kind !== 'group' || t.archived_at) continue
    if (groupPref(cp.profile_id) !== 'direct') continue
    if (!cp.profile?.email || !chatEnabled(t.project?.features)) continue
    if (isMuted(cp.muted_until)) continue

    const { data: msgs } = await admin
      .from('chat_messages')
      .select('id, body, created_at, sender:profiles!sender_id(full_name)')
      .eq('thread_id', t.id).neq('sender_id', cp.profile_id).is('deleted_at', null)
      .gt('created_at', cp.last_read_at).lt('created_at', cutoff)
      .order('created_at', { ascending: false }).limit(1)
    const m = (msgs ?? [])[0] as Row | undefined
    if (!m) continue

    const { data: logged } = await admin.from('notification_log').select('id')
      .eq('notification_type', 'chat_group_direct').eq('user_id', cp.profile_id).eq('reference_id', t.id)
      .gt('sent_at', cp.last_read_at).limit(1)
    if (logged && logged.length > 0) continue

    const from = m.sender?.full_name || 'Een lid'
    const ok = await send([cp.profile.email], `Nieuw bericht in ${t.title}`,
      groupDirectEmail(cp.profile.full_name, from, t.title, m.body || '📎 Bijlage', t.project?.name || 'je project',
        threadLink(t.project, t.id), await unsubLink(cp.profile_id, 'pref_chat_groups')))
    if (ok) groupDirectSent++
    await admin.from('notification_log').insert({
      user_id: cp.profile_id, project_id: t.project_id, notification_type: 'chat_group_direct',
      reference_id: t.id, channel: 'email', email: cp.profile.email, status: ok ? 'sent' : 'failed',
    })
  }

  // 3b. 'daily' / 'weekly': één overzicht per project, alleen in het tijdvenster
  //     en (bij weekly) op de ingestelde weekdag.
  const ams = amsterdamNow()
  const [dh, dm] = DIGEST_TIME.split(':').map(Number)
  const diff = ams.minutes - (dh * 60 + dm)
  if (diff >= 0 && diff < DIGEST_WINDOW_MIN) {
    // Per (gebruiker, project): groepen met berichten die nieuw zijn sinds de vorige mail.
    const byUserProject = new Map<string, { cp: Row; pref: string; groups: { title: string; emoji: string | null; unread: number; last: string; threadId: string }[] }>()
    for (const cp of parts) {
      const t = cp.thread
      if (!t || t.kind !== 'group' || t.archived_at || isMuted(cp.muted_until)) continue
      if (!cp.profile?.email || !chatEnabled(t.project?.features)) continue
      const pref = groupPref(cp.profile_id)
      if (pref !== 'daily' && pref !== 'weekly') continue
      if (pref === 'weekly' && ams.weekday !== DIGEST_WEEKDAY) continue

      const since = sinceFor(cp, t.project_id)
      const { data: unreadMsgs, count } = await admin
        .from('chat_messages')
        .select('body', { count: 'exact' })
        .eq('thread_id', t.id).neq('sender_id', cp.profile_id).is('deleted_at', null)
        .gt('created_at', since)
        .order('created_at', { ascending: false }).limit(1)
      if (!count) continue      // niets nieuws sinds de vorige mail → geen mail
      const key = `${cp.profile_id}:${t.project_id}`
      if (!byUserProject.has(key)) byUserProject.set(key, { cp, pref, groups: [] })
      byUserProject.get(key)!.groups.push({ title: t.title, emoji: t.emoji, unread: count, last: (unreadMsgs ?? [])[0]?.body || '📎 Bijlage', threadId: t.id })
    }

    for (const [, { cp, pref, groups }] of byUserProject) {
      const t = cp.thread
      // Extra slot op slot: nooit twee digests binnen hetzelfde venster.
      const guardHours = pref === 'weekly' ? 24 * 6 : 20
      const { data: logged } = await admin.from('notification_log').select('sent_at')
        .eq('notification_type', 'chat_digest').eq('user_id', cp.profile_id).eq('project_id', t.project_id)
        .gt('sent_at', new Date(Date.now() - guardHours * 3600_000).toISOString()).limit(1)
      if (logged && logged.length > 0) continue

      const link = groups.length === 1
        ? threadLink(t.project, groups[0].threadId)
        : threadLink(t.project, '').replace(/\?thread=$/, '')
      const total = groups.reduce((n, g) => n + g.unread, 0)
      const periode = pref === 'weekly' ? 'Deze week' : 'Vandaag'
      const ok = await send([cp.profile.email], `${total} ${total === 1 ? 'nieuw bericht' : 'nieuwe berichten'} in je groepen`,
        digestEmail(cp.profile.full_name, t.project?.name || 'je project', groups, link, await unsubLink(cp.profile_id, 'pref_chat_groups'), periode))
      if (ok) digestSent++
      await admin.from('notification_log').insert({
        user_id: cp.profile_id, project_id: t.project_id, notification_type: 'chat_digest',
        reference_id: null, channel: 'email', email: cp.profile.email, status: ok ? 'sent' : 'failed',
      })
    }
  }

  return new Response(JSON.stringify({ ok: true, dmSent, mentionSent, groupDirectSent, digestSent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
