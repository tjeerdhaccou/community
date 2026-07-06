// support-notify-email
// Cron-invoked (elke paar minuten). Twee richtingen, beide met debounce (ouder
// dan X min, nog ongelezen, nog niet gemaild — idempotent via notification_log):
//   1. agent-antwoord ongelezen door lid  → mail het lid (deeplink naar widget)
//   2. lid-vraag ongelezen door agents     → mail de org-admins (link naar CMS)
// Zelfstandig gehouden — raakt de bestaande dispatch-notification niet.

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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function shell(inner: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F3F1ED;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1A1A2E"><div style="max-width:520px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border-radius:16px;padding:28px 26px">${inner}</div></div></body></html>`
}

function button(link: string, label: string): string {
  return `<a href="${link}" style="display:inline-block;background:#4A90D9;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:9999px">${label}</a>`
}

function quote(body: string): string {
  const snippet = body.length > 300 ? body.slice(0, 300) + '…' : body
  return `<div style="background:#F3F1ED;border-radius:10px;padding:14px 16px;font-size:15px;line-height:1.5;margin:0 0 22px">${escapeHtml(snippet)}</div>`
}

function memberEmail(name: string | null, body: string, link: string): string {
  const hi = name ? `Hoi ${name},` : 'Hoi,'
  return shell(`<p style="font-size:16px;margin:0 0 12px">${hi}</p><p style="font-size:15px;color:#5A5F72;margin:0 0 16px">Je hebt een antwoord van support gekregen:</p>${quote(body)}${button(link, 'Bekijk en reageer')}<p style="font-size:12px;color:#9BA1B0;margin:24px 0 0">Je krijgt deze mail omdat je een vraag hebt gesteld via de support-chat.</p>`)
}

function teamEmail(fromName: string | null, projectName: string | null, body: string, link: string): string {
  const who = fromName || 'Een lid'
  const proj = projectName ? ` (${projectName})` : ''
  return shell(`<p style="font-size:16px;margin:0 0 12px">Nieuwe supportvraag</p><p style="font-size:15px;color:#5A5F72;margin:0 0 16px">${escapeHtml(who)}${escapeHtml(proj)} wacht op antwoord:</p>${quote(body)}${button(link, 'Open in de CMS')}<p style="font-size:12px;color:#9BA1B0;margin:24px 0 0">Je krijgt deze mail als beheerder van de organisatie.</p>`)
}

async function send(to: string, subject: string, html: string): Promise<{ status: string; id: string | null }> {
  if (!RESEND_API_KEY) return { status: 'skipped', id: null }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [to], subject, html }),
  })
  const result = await res.json().catch(() => ({}))
  return res.ok && result?.id ? { status: 'sent', id: result.id } : { status: 'failed', id: null }
}

Deno.serve(async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'missing config' }), { status: 500 })
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const cutoff = new Date(Date.now() - DELAY_MINUTES * 60_000).toISOString()

  let memberSent = 0, teamSent = 0

  // ── 1. Agent-antwoord → lid ────────────────────────────────────────────────
  const { data: agentRows } = await admin
    .from('support_messages')
    .select(`id, body, created_at, conversation:support_conversations!inner(id, user_id, project_id, recipient:profiles!user_id(email, full_name), project:projects(slug, custom_domain))`)
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
    const r = await send(recip.email, 'Je hebt een antwoord van support', memberEmail(recip.full_name, m.body, link))
    if (r.status === 'sent') memberSent++
    await admin.from('notification_log').insert({
      user_id: conv.user_id, project_id: conv.project_id, notification_type: 'new_support_message',
      reference_id: m.id, channel: 'email', email: recip.email, resend_message_id: r.id, status: r.status,
    })
  }

  // ── 2. Lid-vraag → org-admins ──────────────────────────────────────────────
  const { data: userRows } = await admin
    .from('support_messages')
    .select(`id, body, created_at, conversation:support_conversations!inner(id, org_id, project_id, sender:profiles!user_id(full_name), project:projects(name), org:organizations(slug))`)
    .eq('sender_role', 'user').is('read_at', null).lt('created_at', cutoff).limit(50)

  for (const m of (userRows ?? []) as any[]) {
    const conv = m.conversation
    if (!conv?.org_id) continue
    const { data: logged } = await admin.from('notification_log').select('id')
      .eq('notification_type', 'support_team_email').eq('reference_id', m.id).limit(1)
    if (logged && logged.length > 0) continue

    const { data: admins } = await admin.from('org_members')
      .select('profile_id, profile:profiles(email, full_name)')
      .eq('organization_id', conv.org_id).eq('role', 'admin')
    const recipients = (admins ?? []).filter((a: any) => a.profile?.email)
    if (recipients.length === 0) continue

    const orgSlug = conv.org?.slug
    const link = orgSlug ? `https://admin.${MAIN_DOMAIN}/org/${orgSlug}/support` : `https://admin.${MAIN_DOMAIN}`
    const logRows: any[] = []
    for (const a of recipients as any[]) {
      const r = await send(a.profile.email, 'Nieuwe supportvraag', teamEmail(conv.sender?.full_name, conv.project?.name ?? null, m.body, link))
      if (r.status === 'sent') teamSent++
      logRows.push({
        user_id: a.profile_id, project_id: conv.project_id, notification_type: 'support_team_email',
        reference_id: m.id, channel: 'email', email: a.profile.email, resend_message_id: r.id, status: r.status,
      })
    }
    if (logRows.length > 0) await admin.from('notification_log').insert(logRows)
  }

  return new Response(JSON.stringify({ ok: true, memberSent, teamSent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
