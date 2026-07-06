// support-notify-email
// Cron-invoked (elke paar minuten). Stuurt een e-mail-nudge naar het lid als er
// een agent-antwoord is dat het lid na X minuten nog niet heeft gezien én waar
// nog geen mail voor is verstuurd. Dat is de debounce: wie actief in de app zit
// (en het antwoord leest) krijgt geen mail. Zie SUPPORT_CHAT_SPEC.md §7.
//
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

// Wachttijd voordat we mailen (debounce). Aanpasbaar via env.
const DELAY_MINUTES = Number(Deno.env.get('SUPPORT_EMAIL_DELAY_MIN') || '10')

function projectUrl(row: Record<string, unknown>): string {
  const cid = row.conversation_id as string
  const custom = row.custom_domain as string | null
  const slug = row.slug as string | null
  if (custom) return `https://${custom}/?support=${cid}`
  if (slug) return `https://${MAIN_DOMAIN}/p/${slug}?support=${cid}`
  return `https://${MAIN_DOMAIN}/?support=${cid}`
}

function renderEmail(name: string | null, body: string, link: string): string {
  const hi = name ? `Hoi ${name},` : 'Hoi,'
  const snippet = body.length > 300 ? body.slice(0, 300) + '…' : body
  return `<!doctype html><html><body style="margin:0;background:#F3F1ED;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1A1A2E">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border-radius:16px;padding:28px 26px">
      <p style="font-size:16px;margin:0 0 12px">${hi}</p>
      <p style="font-size:15px;color:#5A5F72;margin:0 0 16px">Je hebt een antwoord van support gekregen:</p>
      <div style="background:#F3F1ED;border-radius:10px;padding:14px 16px;font-size:15px;line-height:1.5;margin:0 0 22px">${escapeHtml(snippet)}</div>
      <a href="${link}" style="display:inline-block;background:#4A90D9;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:9999px">Bekijk en reageer</a>
      <p style="font-size:12px;color:#9BA1B0;margin:24px 0 0">Je krijgt deze mail omdat je een vraag hebt gesteld via de support-chat.</p>
    </div>
  </div></body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

Deno.serve(async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'missing config' }), { status: 500 })
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Kandidaat-berichten: agent-antwoord, ongelezen, ouder dan de debounce-drempel,
  // en nog niet gemaild (geen notification_log-rij).
  const cutoff = new Date(Date.now() - DELAY_MINUTES * 60_000).toISOString()
  const { data: rows, error } = await admin
    .from('support_messages')
    .select(`
      id, body, conversation_id, created_at,
      conversation:support_conversations!inner(
        id, user_id, project_id,
        recipient:profiles!user_id(email, full_name),
        project:projects(slug, custom_domain)
      )
    `)
    .eq('sender_role', 'agent')
    .is('read_at', null)
    .lt('created_at', cutoff)
    .limit(50)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  let sent = 0, skipped = 0
  for (const m of rows ?? []) {
    const conv = (m as any).conversation
    const recip = conv?.recipient
    const proj = conv?.project
    if (!recip?.email) { skipped++; continue }

    // Al gemaild voor dit bericht? → skip (idempotentie/debounce)
    const { data: logged } = await admin
      .from('notification_log')
      .select('id')
      .eq('notification_type', 'new_support_message')
      .eq('reference_id', m.id)
      .eq('channel', 'email')
      .limit(1)
    if (logged && logged.length > 0) { skipped++; continue }

    const link = projectUrl({
      conversation_id: conv.id,
      custom_domain: proj?.custom_domain ?? null,
      slug: proj?.slug ?? null,
    })

    let status = 'failed', resendId: string | null = null
    if (RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: [recip.email],
          subject: 'Je hebt een antwoord van support',
          html: renderEmail(recip.full_name, m.body, link),
        }),
      })
      const result = await res.json().catch(() => ({}))
      if (res.ok && result?.id) { status = 'sent'; resendId = result.id; sent++ }
    }

    await admin.from('notification_log').insert({
      user_id: conv.user_id,
      project_id: conv.project_id,
      notification_type: 'new_support_message',
      reference_id: m.id,
      channel: 'email',
      email: recip.email,
      resend_message_id: resendId,
      status,
    })
  }

  return new Response(JSON.stringify({ ok: true, candidates: rows?.length ?? 0, sent, skipped }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
