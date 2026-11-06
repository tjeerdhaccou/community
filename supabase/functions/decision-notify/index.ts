// decision-notify
// Worker voor notificaties van de besluitvormingsmodule (migratie 112+).
//
// De database zet events in `proposal_events` (publicatie, herinnering, vraag,
// antwoord, bezwaar, uitslag, nieuwe versie) en poked deze functie direct via
// pg_net; daarnaast draait er elke 5 minuten een cron als vangnet.
// verify_jwt = false: de functie vertrouwt geen request-body en verwerkt
// alleen wat in de wachtrij staat (atomair geclaimd, zie migratie 115).
//
// Per event: ontvangers bepalen → in-app notificatie → e-mail via Resend
// (zelfde opmaak, voorkeuren en afmeldlinks als dispatch-notification).
//
//   proposal_published    → alle stemgerechtigden (kiezersbestand)
//   proposal_new_version  → alle stemgerechtigden
//   proposal_reminder     → leden van eenheden die nog niet reageerden
//   proposal_question     → leden van de indienende groep
//   proposal_answered     → de vraagsteller
//   proposal_objection    → leden van de indienende groep
//   proposal_closed       → alle leden (aspirant+)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@buuur.nl'
const FROM_NAME = Deno.env.get('FROM_NAME') || 'Buuur'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const _explicitSecret = Deno.env.get('SB_SECRET_KEY') || ''
const SERVICE_ROLE_KEY =
  (Deno.env.get('SUPABASE_SECRET_KEYS') || '').match(/sb_secret_[A-Za-z0-9_-]+/)?.[0] ||
  (_explicitSecret.startsWith('sb_secret_') ? _explicitSecret : '') ||
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const UNSUBSCRIBE_SECRET = Deno.env.get('UNSUBSCRIBE_SECRET') || ''
const MAIN_DOMAIN = Deno.env.get('MAIN_DOMAIN') || 'buuur.nl'

type EventType =
  | 'proposal_published' | 'proposal_new_version' | 'proposal_reminder'
  | 'proposal_question' | 'proposal_answered' | 'proposal_objection' | 'proposal_closed'

// Persoonlijk gerichte types: ook mailen bij voorkeur 'mentions'.
const DIRECT: Set<EventType> = new Set(['proposal_reminder', 'proposal_question', 'proposal_answered', 'proposal_objection'])
// Besluitvorming valt onder de voorkeur "Projectnieuws".
const PREF_COL = 'pref_updates'

const ROLE_LEVELS: Record<string, number> = {
  guest: 0, professional: 1, aspirant: 2, member: 3, moderator: 4, admin: 5,
}

interface Ctx {
  project: { id: string; name: string; slug: string; custom_domain: string | null; logo_url: string | null }
  subject: string
  intro: string
  heading: string
  body: string
  linkPath: string
  inAppTitle: string
  inAppBody: string | null
}

serve(async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[decision-notify] Missing SUPABASE_URL or SERVICE_ROLE_KEY')
    return json({ error: 'Server misconfigured' }, 500)
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: events, error } = await admin.rpc('claim_proposal_events', { p_limit: 25 })
  if (error) {
    console.error('[decision-notify] claim error', error)
    return json({ error: 'claim failed' }, 500)
  }

  const results: any[] = []
  for (const ev of events || []) {
    try {
      const r = await handleEvent(admin, ev)
      results.push({ id: ev.id, type: ev.type, ...r })
    } catch (err) {
      console.error('[decision-notify] event failed', ev.id, err)
      await admin.rpc('release_proposal_event', { p_id: ev.id, p_error: String((err as Error)?.message || err) })
      results.push({ id: ev.id, type: ev.type, error: String(err) })
    }
  }
  return json({ processed: results.length, results })
})

async function handleEvent(admin: any, ev: any) {
  const type = ev.type as EventType

  const { data: proposal } = await admin
    .from('proposals')
    .select('id, project_id, form, title, summary, deadline, version, workgroup_id, outcome, status')
    .eq('id', ev.proposal_id)
    .single()
  if (!proposal) return { skipped: 'proposal_not_found' }

  const { data: project } = await admin
    .from('projects')
    .select('id, name, slug, custom_domain, logo_url')
    .eq('id', proposal.project_id)
    .single()
  if (!project) return { skipped: 'project_not_found' }

  let groupName = 'De commissie'
  if (proposal.workgroup_id) {
    const { data: wg } = await admin.from('workgroups').select('name').eq('id', proposal.workgroup_id).single()
    if (wg?.name) groupName = wg.name
  }

  const recipients = await resolveRecipients(admin, type, proposal, ev)
  const filtered = [...new Set(recipients)].filter(id => id && id !== ev.actor_id)
  if (filtered.length === 0) return { sent: 0, reason: 'no_recipients' }

  const ctx = await buildContext(admin, type, proposal, project, groupName, ev)
  return await deliver(admin, type, ctx, filtered, ev)
}

// ------------------------------------------------------------
// Ontvangers
// ------------------------------------------------------------

async function resolveRecipients(admin: any, type: EventType, proposal: any, ev: any): Promise<string[]> {
  if (type === 'proposal_published' || type === 'proposal_new_version') {
    const { data } = await admin.from('proposal_electorate').select('member_ids').eq('proposal_id', proposal.id)
    return (data || []).flatMap((r: any) => r.member_ids)
  }

  if (type === 'proposal_reminder') {
    const [{ data: units }, { data: responses }] = await Promise.all([
      admin.from('proposal_electorate').select('unit_id, member_ids').eq('proposal_id', proposal.id),
      admin.from('proposal_responses').select('unit_id').eq('proposal_id', proposal.id),
    ])
    const done = new Set((responses || []).map((r: any) => r.unit_id))
    return (units || []).filter((u: any) => !done.has(u.unit_id)).flatMap((u: any) => u.member_ids)
  }

  if (type === 'proposal_question' || type === 'proposal_objection') {
    return await groupRecipients(admin, proposal)
  }

  if (type === 'proposal_answered') {
    const { data: answer } = await admin.from('proposal_questions').select('parent_id').eq('id', ev.reference_id).single()
    if (!answer?.parent_id) return []
    const { data: q } = await admin.from('proposal_questions').select('author_id').eq('id', answer.parent_id).single()
    return q?.author_id ? [q.author_id] : []
  }

  if (type === 'proposal_closed') {
    const { data } = await admin.from('memberships').select('profile_id, role').eq('project_id', proposal.project_id)
    return (data || [])
      .filter((m: any) => (ROLE_LEVELS[m.role] ?? -1) >= ROLE_LEVELS.aspirant)
      .map((m: any) => m.profile_id)
  }
  return []
}

// Leden van de indienende groep; zonder groepsleden vallen we terug op
// moderators en admins van het project.
async function groupRecipients(admin: any, proposal: any): Promise<string[]> {
  if (proposal.workgroup_id) {
    const { data } = await admin.from('workgroup_members').select('profile_id').eq('workgroup_id', proposal.workgroup_id)
    const ids = (data || []).map((r: any) => r.profile_id)
    if (ids.length > 0) return ids
  }
  const { data } = await admin
    .from('memberships').select('profile_id')
    .eq('project_id', proposal.project_id).in('role', ['moderator', 'admin'])
  return (data || []).map((r: any) => r.profile_id)
}

// ------------------------------------------------------------
// Inhoud
// ------------------------------------------------------------

async function buildContext(admin: any, type: EventType, p: any, project: any, groupName: string, ev: any): Promise<Ctx> {
  const linkPath = `/besluiten/${p.id}`
  const deadline = p.deadline ? formatNlDate(p.deadline) : ''
  const formLabel = p.form === 'vote' ? 'stemming' : 'voorstel'
  const base = { project, linkPath }

  switch (type) {
    case 'proposal_published':
      return {
        ...base,
        subject: `Nieuw ${formLabel}: ${p.title}`,
        intro: `${groupName} vraagt je reactie op een ${formLabel} in ${project.name}.`,
        heading: p.title,
        body: `${truncate(p.summary, 400)}\n\nReageren kan tot ${deadline}.`,
        inAppTitle: `Nieuw ${formLabel}: ${p.title}`,
        inAppBody: `Reageren kan tot ${deadline}`,
      }
    case 'proposal_new_version':
      return {
        ...base,
        subject: `Nieuwe versie: ${p.title}`,
        intro: `${groupName} heeft de bezwaren verwerkt en versie ${p.version} gepubliceerd. Je eerdere reactie telt niet meer mee, dus reageer opnieuw.`,
        heading: p.title,
        body: `${truncate(p.summary, 400)}\n\nReageren kan tot ${deadline}.`,
        inAppTitle: `Nieuwe versie (${p.version}): ${p.title}`,
        inAppBody: 'Reageer opnieuw op de aangepaste versie',
      }
    case 'proposal_reminder':
      return {
        ...base,
        subject: `Herinnering: je reactie op "${p.title}"`,
        intro: `Je hebt nog niet gereageerd op dit ${formLabel} van ${groupName}.`,
        heading: p.title,
        body: `${truncate(p.summary, 300)}\n\nReageren kan nog tot ${deadline}.`,
        inAppTitle: `Herinnering: ${p.title}`,
        inAppBody: `Reageren kan tot ${deadline}`,
      }
    case 'proposal_question': {
      const { data: q } = await admin.from('proposal_questions').select('body, author:profiles!proposal_questions_author_id_fkey(full_name)').eq('id', ev.reference_id).single()
      const who = q?.author?.full_name || 'Een lid'
      return {
        ...base,
        subject: `Nieuwe vraag bij "${p.title}"`,
        intro: `${who} stelde een vraag bij een voorstel van ${groupName}.`,
        heading: p.title,
        body: truncate(q?.body || '', 600),
        inAppTitle: `Vraag bij: ${p.title}`,
        inAppBody: truncate(q?.body || '', 120),
      }
    }
    case 'proposal_answered': {
      const { data: a } = await admin.from('proposal_questions').select('body').eq('id', ev.reference_id).single()
      return {
        ...base,
        subject: `${groupName} beantwoordde je vraag`,
        intro: `Je vraag bij "${p.title}" is beantwoord.`,
        heading: p.title,
        body: truncate(a?.body || '', 600),
        inAppTitle: `Antwoord op je vraag: ${p.title}`,
        inAppBody: truncate(a?.body || '', 120),
      }
    }
    case 'proposal_objection': {
      const { data: log } = await admin
        .from('proposal_response_log')
        .select('motivation')
        .eq('proposal_id', p.id).eq('new_choice', 'objection').eq('profile_id', ev.actor_id)
        .order('created_at', { ascending: false }).limit(1)
      const motivation = log?.[0]?.motivation || ''
      return {
        ...base,
        subject: `Bezwaar op "${p.title}"`,
        intro: `Er is een bezwaar ingediend op het voorstel van ${groupName}.`,
        heading: p.title,
        body: truncate(motivation, 600),
        inAppTitle: `Bezwaar op: ${p.title}`,
        inAppBody: truncate(motivation, 120),
      }
    }
    case 'proposal_closed': {
      const summary = p.outcome?.summary || 'Het voorstel is gesloten.'
      return {
        ...base,
        subject: `Uitslag: ${p.title}`,
        intro: `Het ${formLabel} van ${groupName} is gesloten.`,
        heading: p.title,
        body: summary,
        inAppTitle: `Uitslag: ${p.title}`,
        inAppBody: truncate(summary, 140),
      }
    }
  }
}

// ------------------------------------------------------------
// Bezorgen (in-app + e-mail), zelfde regels als dispatch-notification
// ------------------------------------------------------------

async function deliver(admin: any, type: EventType, ctx: Ctx, recipientIds: string[], ev: any) {
  const [{ data: profiles }, { data: prefs }] = await Promise.all([
    admin.from('profiles').select('id, full_name, email').in('id', recipientIds),
    admin.from('notification_preferences').select(`profile_id, ${PREF_COL}, mute_until`).in('profile_id', recipientIds),
  ])
  const prefsByUser = new Map<string, any>()
  for (const p of prefs || []) prefsByUser.set(p.profile_id, p)

  const now = Date.now()
  const isDirect = DIRECT.has(type)
  const inApp: string[] = []
  const mail: Array<{ id: string; email: string; full_name: string | null }> = []

  for (const profile of profiles || []) {
    const pref = prefsByUser.get(profile.id)
    const value = pref?.[PREF_COL] ?? 'all'
    const muted = pref?.mute_until && new Date(pref.mute_until).getTime() > now
    if (muted) continue
    // Persoonlijk gerichte meldingen tonen we in-app altijd; de rest volgt de voorkeur.
    if (value !== 'mute' || isDirect) inApp.push(profile.id)
    const wantsMail = value === 'all' || (isDirect && value === 'mentions')
    if (wantsMail && profile.email) mail.push({ id: profile.id, email: profile.email, full_name: profile.full_name })
  }

  if (inApp.length > 0) {
    const rows = inApp.map(id => ({
      recipient_id: id,
      actor_id: ev.actor_id,
      project_id: ctx.project.id,
      type,
      title: ctx.inAppTitle,
      body: ctx.inAppBody,
      related_type: 'proposal',
      related_id: ev.proposal_id,
      is_read: false,
    }))
    const { error } = await admin.from('notifications').insert(rows)
    if (error) throw new Error(`in-app insert: ${error.message}`)
  }

  let sent = 0
  let failed = 0
  if (RESEND_API_KEY && mail.length > 0) {
    for (const batch of chunk(mail, 100)) {
      const tokens = await Promise.all(batch.map(r => signUnsubscribeToken(r.id)))
      const emails = batch.map((r, i) => ({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [r.email],
        subject: ctx.subject,
        html: renderEmail(ctx, r.full_name, tokens[i]),
      }))
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(emails),
      })
      const result = await res.json()
      const logRows = batch.map((r, i) => {
        const id = res.ok ? result?.data?.[i]?.id ?? null : null
        if (id) sent++; else failed++
        return {
          user_id: r.id,
          project_id: ctx.project.id,
          notification_type: type,
          reference_id: ev.proposal_id,
          channel: 'email',
          email: r.email,
          resend_message_id: id,
          status: id ? 'sent' : 'failed',
          error_message: id ? null : JSON.stringify(result).slice(0, 500),
        }
      })
      await admin.from('notification_log').insert(logRows)
    }
  } else if (!RESEND_API_KEY && mail.length > 0) {
    console.log(`[decision-notify] No RESEND_API_KEY. Would email ${mail.length} for ${type}`)
  }

  return { in_app: inApp.length, emails_sent: sent, emails_failed: failed }
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return String(s)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}

function truncate(s: string, len: number): string {
  if (!s) return ''
  return s.length > len ? s.slice(0, len) + '…' : s
}

function formatNlDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nl-NL', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Amsterdam',
    })
  } catch {
    return iso
  }
}

function projectBaseUrl(project: { slug: string; custom_domain: string | null }): string {
  if (project.custom_domain) return `https://${project.custom_domain}`
  return `https://${project.slug}.${MAIN_DOMAIN}`
}

async function signUnsubscribeToken(userId: string): Promise<string> {
  if (!UNSUBSCRIBE_SECRET) return ''
  const payloadStr = JSON.stringify({ uid: userId, t: PREF_COL, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 })
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(UNSUBSCRIBE_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadStr))
  return `${b64url(new TextEncoder().encode(payloadStr))}.${b64url(new Uint8Array(sig))}`
}

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function renderEmail(ctx: Ctx, recipientName: string | null, unsubToken: string): string {
  const linkUrl = `${projectBaseUrl(ctx.project)}${ctx.linkPath}`
  const greeting = recipientName ? `Hoi ${esc(recipientName.split(' ')[0])}` : 'Hoi'
  const settingsUrl = `https://${MAIN_DOMAIN}/profile#notif-section`
  const unsubUrl = unsubToken ? `https://${MAIN_DOMAIN}/unsubscribe?token=${encodeURIComponent(unsubToken)}` : settingsUrl
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a2e;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td style="padding:24px 32px 16px;border-bottom:1px solid #f0f0f4;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            ${ctx.project.logo_url ? `<td width="40" style="vertical-align:middle;"><img src="${esc(ctx.project.logo_url)}" alt="${esc(ctx.project.name)}" width="32" height="32" style="border-radius:8px;display:block;"></td>` : ''}
            <td style="vertical-align:middle;padding-left:${ctx.project.logo_url ? '12px' : '0'};"><span style="font-size:14px;color:#6b7280;font-weight:500;">${esc(ctx.project.name)}</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:15px;color:#4a4a6a;">${greeting},</p>
          ${ctx.intro ? `<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a4a6a;">${esc(ctx.intro)}</p>` : ''}
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#1a1a2e;font-weight:600;">${esc(ctx.heading)}</h1>
          ${ctx.body ? `<div style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a4a6a;white-space:pre-wrap;">${esc(ctx.body)}</div>` : ''}
          <p style="margin:32px 0 0;">
            <a href="${esc(linkUrl)}" style="display:inline-block;background:#4A90D9;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Bekijk en reageer</a>
          </p>
        </td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid #f0f0f4;background:#fafafc;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#9ba1b0;">
            Je ontvangt deze mail omdat je lid bent van <strong>${esc(ctx.project.name)}</strong> op Buuur.<br>
            <a href="${esc(settingsUrl)}" style="color:#9ba1b0;text-decoration:underline;">Beheer je notificaties</a> ·
            <a href="${esc(unsubUrl)}" style="color:#9ba1b0;text-decoration:underline;">Uitschrijven van dit type</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
