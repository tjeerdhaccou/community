// chat-push
// Aangeroepen door de DB-trigger chat_messages_notify_push (migratie 101) met
// { message_id }. Stuurt een Web Push naar alle andere deelnemers van de thread
// die de groep niet gedempt hebben en een push-abonnement hebben. Gedeployed
// met --no-verify-jwt (pg_net stuurt geen JWT); daarom:
//   * alleen berichten jonger dan 2 minuten worden verwerkt (replay-bescherming);
//   * per (bericht, ontvanger) hooguit één push, gelogd in notification_log.
// Verlopen abonnementen (404/410) worden opgeruimd.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY =
  (Deno.env.get('SUPABASE_SECRET_KEYS') || '').match(/sb_secret_[A-Za-z0-9_-]+/)?.[0] ||
  Deno.env.get('SB_SECRET_KEY') ||
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const MAIN_DOMAIN = Deno.env.get('MAIN_DOMAIN') || 'buuur.nl'
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || `mailto:noreply@${MAIN_DOMAIN}`
const MAX_AGE_MS = 2 * 60_000

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>

function threadLink(project: Row | null, threadId: string): string {
  if (project?.custom_domain) return `https://${project.custom_domain}/chat?thread=${threadId}`
  if (project?.slug) return `https://${project.slug}.${MAIN_DOMAIN}/chat?thread=${threadId}`
  return `https://${MAIN_DOMAIN}`
}

function firstName(n: string | null | undefined): string {
  return (n || 'Een lid').split(' ')[0]
}

Deno.serve(async (req) => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return new Response('missing config', { status: 500 })
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return new Response('vapid not configured', { status: 500 })

  let messageId: string | null = null
  try {
    const body = await req.json()
    messageId = body?.message_id ?? body?.record?.id ?? null
  } catch { /* leeg */ }
  if (!messageId) return new Response('message_id required', { status: 400 })

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: msg } = await admin
    .from('chat_messages')
    .select(`
      id, thread_id, sender_id, body, attachment_path, created_at, deleted_at, mentions,
      sender:profiles!sender_id(full_name),
      thread:chat_threads!thread_id(id, kind, title, emoji, archived_at, project_id, project:projects(name, slug, custom_domain, features))
    `)
    .eq('id', messageId).maybeSingle()
  if (!msg || msg.deleted_at) return new Response(JSON.stringify({ ok: true, skipped: 'no message' }), { status: 200 })
  if (Date.now() - new Date(msg.created_at).getTime() > MAX_AGE_MS) {
    return new Response(JSON.stringify({ ok: true, skipped: 'too old' }), { status: 200 })
  }
  const t = msg.thread as Row
  if (!t || t.archived_at || (t.project?.features && t.project.features.chat === false)) {
    return new Response(JSON.stringify({ ok: true, skipped: 'thread' }), { status: 200 })
  }

  // Ontvangers: andere deelnemers, niet gedempt.
  const { data: parts } = await admin
    .from('chat_participants')
    .select('profile_id, muted_until')
    .eq('thread_id', t.id).neq('profile_id', msg.sender_id)
  const now = Date.now()
  const mentioned = new Set<string>((msg.mentions ?? []) as string[])
  const recipients = (parts ?? [])
    .filter((p: Row) => !(p.muted_until && new Date(p.muted_until).getTime() > now) || mentioned.has(p.profile_id))
    .map((p: Row) => p.profile_id as string)
  if (recipients.length === 0) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 })

  // Al gepusht voor dit bericht? (replay)
  const { data: logged } = await admin.from('notification_log').select('user_id')
    .eq('notification_type', 'chat_push').eq('reference_id', msg.id).eq('channel', 'push')
  const done = new Set((logged ?? []).map((l: Row) => l.user_id as string))
  const todo = recipients.filter((r) => !done.has(r))
  if (todo.length === 0) return new Response(JSON.stringify({ ok: true, sent: 0, skipped: 'already' }), { status: 200 })

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, profile_id, endpoint, p256dh, auth')
    .in('profile_id', todo)
  if (!subs || subs.length === 0) return new Response(JSON.stringify({ ok: true, sent: 0, skipped: 'no subs' }), { status: 200 })

  const sender = firstName((msg.sender as Row)?.full_name)
  const text = msg.body?.trim() ? msg.body.trim() : '📎 Bijlage'
  const isGroup = t.kind === 'group'
  const payload = JSON.stringify({
    title: isGroup ? `${t.emoji ? t.emoji + ' ' : ''}${t.title}` : ((msg.sender as Row)?.full_name || 'Nieuw bericht'),
    body: isGroup ? `${sender}: ${text}` : text,
    url: threadLink(t.project, t.id),
    tag: `chat-${t.id}`,
    threadId: t.id,
  })

  let sent = 0
  const stale: string[] = []
  const pushedUsers = new Set<string>()
  await Promise.all(subs.map(async (s: Row) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 60 * 60, urgency: 'high' },
      )
      sent++
      pushedUsers.add(s.profile_id)
    } catch (err) {
      const code = (err as { statusCode?: number })?.statusCode
      if (code === 404 || code === 410) stale.push(s.id)
      else console.error('[chat-push] send failed', code, (err as Error)?.message)
    }
  }))

  if (stale.length > 0) await admin.from('push_subscriptions').delete().in('id', stale)
  if (pushedUsers.size > 0) {
    await admin.from('notification_log').insert([...pushedUsers].map((uid) => ({
      user_id: uid, project_id: t.project_id, notification_type: 'chat_push',
      reference_id: msg.id, channel: 'push', status: 'sent',
    })))
  }

  return new Response(JSON.stringify({ ok: true, sent, stale: stale.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
