// ============================================================================
// mollie-webhook
// ============================================================================
// Mollie roept dit endpoint aan bij elke status-verandering van een payment.
// Wij fetchen verse status via Mollie API en verwerken deze:
//   - payments row bijwerken
//   - payment_requests bijwerken bij terminale status
//   - Bij paid: signed PDF genereren, opslaan, mailen naar lid, notificatie
//     voor alle org admins
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'

const SUPABASE_URL   = Deno.env.get('SUPABASE_URL') || ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL')     || 'noreply@buuur.nl'
const FROM_NAME      = Deno.env.get('FROM_NAME')      || 'Buuur'
const _explicitSecret = Deno.env.get('SB_SECRET_KEY') || ''
const SERVICE_ROLE_KEY =
  (Deno.env.get('SUPABASE_SECRET_KEYS') || '').match(/sb_secret_[A-Za-z0-9_-]+/)?.[0] ||
  (_explicitSecret.startsWith('sb_secret_') ? _explicitSecret : '') ||
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const MOLLIE_API = 'https://api.mollie.com'

const STATUS_MAP: Record<string, string> = {
  open: 'open', pending: 'pending', authorized: 'authorized',
  paid: 'paid', failed: 'failed', canceled: 'canceled', expired: 'expired',
}

function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })
}
function formatDateNL(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}
function renderPlaceholders(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) { if (cur) lines.push(cur); cur = w }
    else { cur = cur ? cur + ' ' + w : w }
  }
  if (cur) lines.push(cur)
  return lines
}
function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60) || 'overeenkomst'
}
function base64FromBytes(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

type SigPdfInput = {
  orgName: string
  orgLogoUrl: string | null
  projectName: string
  requestTitle: string
  recipientName: string
  recipientEmail: string
  amountCents: number
  reference: string | null
  agreementText: string
  agreedAt: string
  ip: string | null
  molliePaymentId: string
  paymentMethod: string | null
}

async function renderSignedPdf(input: SigPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  let page = doc.addPage([595, 842])
  const font  = await doc.embedFont(StandardFonts.Helvetica)
  const bold  = await doc.embedFont(StandardFonts.HelveticaBold)
  const margin = 56
  let y = 800
  const newPageIfNeeded = (m: number) => { if (y < m) { page = doc.addPage([595, 842]); y = 800 } }

  if (input.orgLogoUrl) {
    try {
      const res = await fetch(input.orgLogoUrl)
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer())
        const ct = res.headers.get('content-type') || ''
        const img = ct.includes('png') ? await doc.embedPng(buf) : await doc.embedJpg(buf).catch(() => null)
        if (img) {
          const maxH = 48, scale = maxH / img.height
          page.drawImage(img, { x: margin, y: y - maxH, width: img.width * scale, height: img.height * scale })
        }
      }
    } catch { /* logo optioneel */ }
    y -= 64
  }

  page.drawText(input.orgName, { x: margin, y, size: 11, font, color: rgb(0.4,0.4,0.4) })
  y -= 30
  page.drawText(input.requestTitle, { x: margin, y, size: 20, font: bold, color: rgb(0.1,0.1,0.1) })
  y -= 26

  page.drawRectangle({ x: margin, y: y - 40, width: 483, height: 44, color: rgb(0.97,0.97,0.98) })
  page.drawText('Bedrag', { x: margin + 16, y: y - 14, size: 10, font, color: rgb(0.4,0.4,0.4) })
  page.drawText(formatEuro(input.amountCents), { x: margin + 16, y: y - 32, size: 18, font: bold, color: rgb(0.1,0.1,0.1) })
  if (input.reference) {
    page.drawText('Referentie', { x: margin + 240, y: y - 14, size: 10, font, color: rgb(0.4,0.4,0.4) })
    page.drawText(input.reference, { x: margin + 240, y: y - 32, size: 12, font: bold, color: rgb(0.1,0.1,0.1) })
  }
  y -= 64

  const rows: Array<[string,string]> = [
    ['Ontvanger', `${input.recipientName} (${input.recipientEmail})`],
    ['Project', input.projectName],
    ['Datum', formatDateNL(input.agreedAt)],
  ]
  for (const [k,v] of rows) {
    page.drawText(k, { x: margin, y, size: 10, font, color: rgb(0.4,0.4,0.4) })
    page.drawText(v, { x: margin + 90, y, size: 11, font })
    y -= 18
  }
  y -= 12

  const paras = input.agreementText.split(/\n\s*\n/)
  for (const p of paras) {
    newPageIfNeeded(160)
    const lines = wrapText(p.replace(/\n/g,' '), 88)
    for (const line of lines) {
      newPageIfNeeded(100)
      page.drawText(line, { x: margin, y, size: 11, font, color: rgb(0.1,0.1,0.1) })
      y -= 15
    }
    y -= 8
  }

  newPageIfNeeded(120)
  y -= 8
  page.drawRectangle({ x: margin, y: y - 90, width: 483, height: 94, borderColor: rgb(0.85,0.85,0.85), borderWidth: 0.5 })
  page.drawText('Digitaal getekend', { x: margin + 12, y: y - 16, size: 11, font: bold, color: rgb(0.1,0.5,0.2) })
  let sy = y - 34
  const sigRows: Array<[string,string]> = [
    ['Naam', input.recipientName],
    ['Akkoord op', new Date(input.agreedAt).toLocaleString('nl-NL')],
    ['Betaal-id', input.molliePaymentId],
  ]
  if (input.paymentMethod) sigRows.push(['Betaalmethode', input.paymentMethod])
  if (input.ip)            sigRows.push(['IP-adres', input.ip])
  for (const [k,v] of sigRows) {
    page.drawText(`${k}:`, { x: margin + 12, y: sy, size: 9, font, color: rgb(0.4,0.4,0.4) })
    page.drawText(v, { x: margin + 110, y: sy, size: 10, font })
    sy -= 13
  }
  return await doc.save()
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return new Response('misconfigured', { status: 500 })

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

  let molliePaymentId: string | null = null
  try {
    const body = await req.text()
    const params = new URLSearchParams(body)
    molliePaymentId = params.get('id')
  } catch { try { const j = await req.json(); molliePaymentId = j?.id || null } catch { /* leeg */ } }

  if (!molliePaymentId || !molliePaymentId.startsWith('tr_')) return new Response('ok', { status: 200 })

  const { data: payment } = await admin
    .from('payments')
    .select(`
      id, payment_request_id, status,
      payment_request:payment_requests(
        id, project_id, status, amount_cents, currency, title, reference,
        recipient_name, recipient_email, recipient_profile_id, agreed_at, agreed_ip, agreement_template_id,
        project:projects(id, name, slug, logo_url, organization_id,
                          organization:organizations(id, name, slug, logo_url))
      )
    `)
    .eq('provider_payment_id', molliePaymentId)
    .maybeSingle()

  if (!payment) return new Response('ok', { status: 200 })

  const pr = payment.payment_request as any
  const project = pr?.project
  const org = project?.organization
  const orgId = project?.organization_id
  if (!orgId) return new Response('ok', { status: 200 })

  const { data: account } = await admin
    .from('org_payment_accounts')
    .select('access_token_secret_id')
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!account?.access_token_secret_id) return new Response('ok', { status: 200 })

  const { data: accessToken } = await admin.rpc('vault_read_secret', { p_secret_id: account.access_token_secret_id })
  if (!accessToken) return new Response('ok', { status: 200 })

  const mollieRes = await fetch(`${MOLLIE_API}/v2/payments/${molliePaymentId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })
  if (!mollieRes.ok) return new Response('mollie fetch failed', { status: 500 })

  const mp = await mollieRes.json()
  const mappedStatus = STATUS_MAP[mp.status] || null
  if (!mappedStatus) return new Response('ok', { status: 200 })
  if (payment.status === mappedStatus) return new Response('ok', { status: 200 })

  const now = new Date().toISOString()
  const paymentUpdate: Record<string, unknown> = {
    status: mappedStatus,
    webhook_received_at: now,
    payment_method: mp.method || null,
  }
  if (mappedStatus === 'paid')   paymentUpdate.paid_at = mp.paidAt || now
  if (mappedStatus === 'failed') paymentUpdate.failed_at = mp.failedAt || now

  const historyEntry = { at: now, status: mp.status, method: mp.method || null }
  const { data: current } = await admin.from('payments').select('raw_status_history').eq('id', payment.id).single()
  paymentUpdate.raw_status_history = [...((current?.raw_status_history as any[]) || []), historyEntry].slice(-50)

  await admin.from('payments').update(paymentUpdate).eq('id', payment.id)

  // ---- Bij paid: signed PDF + notificatie + mail ----------------------------
  if (mappedStatus === 'paid' && pr?.status !== 'paid') {
    await admin
      .from('payment_requests')
      .update({ status: 'paid', paid_at: now })
      .eq('id', pr.id)
      .neq('status', 'paid')

    try {
      const { data: tpl } = await admin
        .from('agreement_templates')
        .select('content_markdown')
        .eq('id', pr.agreement_template_id)
        .maybeSingle()

      if (tpl) {
        const vars: Record<string,string> = {
          naam: pr.recipient_name,
          email: pr.recipient_email,
          bedrag: formatEuro(pr.amount_cents).replace('€','').trim(),
          referentie: pr.reference || '',
          datum: formatDateNL(pr.agreed_at || now),
          project: project?.name || '',
          organisatie: org?.name || '',
        }
        const agreementText = renderPlaceholders(tpl.content_markdown, vars)

        const pdfBytes = await renderSignedPdf({
          orgName: org?.name || '',
          orgLogoUrl: org?.logo_url || null,
          projectName: project?.name || '',
          requestTitle: pr.title,
          recipientName: pr.recipient_name,
          recipientEmail: pr.recipient_email,
          amountCents: pr.amount_cents,
          reference: pr.reference,
          agreementText,
          agreedAt: pr.agreed_at || now,
          ip: pr.agreed_ip || null,
          molliePaymentId,
          paymentMethod: mp.method || null,
        })

        const signedPath = `signed/${pr.project_id}/${pr.id}.pdf`
        const { error: upErr } = await admin.storage
          .from('payment-requests')
          .upload(signedPath, pdfBytes, { contentType: 'application/pdf', upsert: true })
        if (!upErr) {
          await admin.from('payment_requests').update({ signed_pdf_path: signedPath }).eq('id', pr.id)
        }

        if (RESEND_API_KEY && !upErr) {
          const attachment = { filename: `${slugify(pr.title)}-getekend.pdf`, content: base64FromBytes(pdfBytes) }
          const html = `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;padding:24px;">
              <h1 style="font-size:20px;margin:0 0 16px;">Betaling ontvangen</h1>
              <p style="font-size:15px;line-height:1.55;margin:0 0 12px;">Beste ${escapeHtml(pr.recipient_name)},</p>
              <p style="font-size:15px;line-height:1.55;margin:0 0 12px;">
                We hebben je betaling van <strong>${escapeHtml(formatEuro(pr.amount_cents))}</strong> voor
                <em>${escapeHtml(pr.title)}</em> ontvangen. In de bijlage vind je de definitieve overeenkomst met bevestiging.
              </p>
              <p style="font-size:13px;color:#666;line-height:1.5;margin:20px 0 0;">
                Bedankt — ${escapeHtml(org?.name || 'de organisatie')}
              </p>
            </div>
          `
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: `${FROM_NAME} <${FROM_EMAIL}>`,
              to: [pr.recipient_email],
              subject: `Betaling ontvangen: ${pr.title}`,
              html,
              attachments: [attachment],
            }),
          }).catch((e) => console.error('[mollie-webhook] resend failed', e))
        }
      }
    } catch (e) {
      console.error('[mollie-webhook] signed pdf flow failed', e)
    }

    // Notificaties voor org admins
    try {
      const { data: orgAdmins } = await admin
        .from('org_members')
        .select('profile_id')
        .eq('organization_id', orgId)
        .eq('role', 'admin')

      if (orgAdmins && orgAdmins.length > 0) {
        const notifs = orgAdmins.map((a: any) => ({
          recipient_id: a.profile_id,
          type: 'payment_request_paid',
          title: `Betaling ontvangen: ${formatEuro(pr.amount_cents)}`,
          body: `${pr.recipient_name} heeft "${pr.title}" betaald.`,
          related_id: pr.id,
          related_type: 'payment_request',
          project_id: pr.project_id,
          is_read: false,
        }))
        await admin.from('notifications').insert(notifs)
      }
    } catch (e) {
      console.error('[mollie-webhook] notification insert failed', e)
    }
  }

  return new Response('ok', { status: 200 })
})
