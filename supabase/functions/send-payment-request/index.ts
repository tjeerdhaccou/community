// ============================================================================
// send-payment-request
// ============================================================================
// Aangeroepen vanuit buuur-admin (server action) NAdat een payment_request row
// is aangemaakt met status='draft'. Doet:
//   1. Load request + template + project + org
//   2. Render placeholders in de overeenkomsttekst → contract text
//   3. Genereer PDF met pdf-lib (sober: org-logo bovenaan, contracttekst,
//      bedrag-blok, "Nog niet ondertekend" watermerk-tekst)
//   4. Upload naar Supabase Storage bucket 'payment-requests'
//   5. Genereer access_token (unguessable) voor magic-link
//   6. Mail via Resend: uitlegtekst + link naar /verzoeken/:id?t=<token> +
//      PDF als bijlage
//   7. RPC mark_payment_request_sent
//
// Body: { payment_request_id: string }
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL')     || 'noreply@buuur.nl'
const FROM_NAME      = Deno.env.get('FROM_NAME')      || 'Buuur'
const APP_BASE_URL   = Deno.env.get('APP_BASE_URL')   || 'https://buuur.nl'
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')   || ''

const _explicitSecret = Deno.env.get('SB_SECRET_KEY') || ''
const SERVICE_ROLE_KEY =
  (Deno.env.get('SUPABASE_SECRET_KEYS') || '').match(/sb_secret_[A-Za-z0-9_-]+/)?.[0] ||
  (_explicitSecret.startsWith('sb_secret_') ? _explicitSecret : '') ||
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })
}

function formatDateNL(): string {
  return new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Placeholders → waarden. Onbekende {{...}} wordt niet vervangen.
function renderPlaceholders(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

// ---- PDF rendering ---------------------------------------------------------
type PdfInput = {
  orgName: string
  orgLogoUrl: string | null
  projectName: string
  requestTitle: string
  recipientName: string
  recipientEmail: string
  amountCents: number
  reference: string | null
  agreementText: string
  agreedAt: string | null // ISO — als gegeven: signed variant
  signatureBlock?: {
    ip: string | null
    userAgent: string | null
    molliePaymentId: string | null
    paymentMethod: string | null
  }
}

async function renderContractPdf(input: PdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  let page = doc.addPage([595, 842]) // A4
  const font  = await doc.embedFont(StandardFonts.Helvetica)
  const bold  = await doc.embedFont(StandardFonts.HelveticaBold)

  const margin = 56
  let y = 800

  const newPageIfNeeded = (minRoom: number) => {
    if (y < minRoom) {
      page = doc.addPage([595, 842])
      y = 800
    }
  }

  // Optioneel logo
  if (input.orgLogoUrl) {
    try {
      const res = await fetch(input.orgLogoUrl)
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer())
        const contentType = res.headers.get('content-type') || ''
        const img = contentType.includes('png')
          ? await doc.embedPng(buf)
          : await doc.embedJpg(buf).catch(() => null)
        if (img) {
          const maxH = 48
          const scale = maxH / img.height
          page.drawImage(img, {
            x: margin, y: y - maxH,
            width: img.width * scale, height: img.height * scale,
          })
        }
      }
    } catch (e) {
      console.warn('[pdf] logo fetch failed', e)
    }
    y -= 64
  }

  page.drawText(input.orgName, { x: margin, y, size: 11, font, color: rgb(0.4, 0.4, 0.4) })
  y -= 30
  page.drawText(input.requestTitle, { x: margin, y, size: 20, font: bold, color: rgb(0.1, 0.1, 0.1) })
  y -= 26

  // Bedrag-blok
  page.drawRectangle({ x: margin, y: y - 40, width: 483, height: 44, color: rgb(0.97, 0.97, 0.98) })
  page.drawText('Bedrag', { x: margin + 16, y: y - 14, size: 10, font, color: rgb(0.4, 0.4, 0.4) })
  page.drawText(formatEuro(input.amountCents), { x: margin + 16, y: y - 32, size: 18, font: bold, color: rgb(0.1, 0.1, 0.1) })
  if (input.reference) {
    page.drawText('Referentie', { x: margin + 240, y: y - 14, size: 10, font, color: rgb(0.4, 0.4, 0.4) })
    page.drawText(input.reference, { x: margin + 240, y: y - 32, size: 12, font: bold, color: rgb(0.1, 0.1, 0.1) })
  }
  y -= 64

  // Ontvanger + project
  const infoRows: Array<[string, string]> = [
    ['Ontvanger', `${input.recipientName} (${input.recipientEmail})`],
    ['Project',   input.projectName],
    ['Datum',     input.agreedAt ? new Date(input.agreedAt).toLocaleString('nl-NL') : formatDateNL()],
  ]
  for (const [label, value] of infoRows) {
    page.drawText(label, { x: margin, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) })
    page.drawText(value, { x: margin + 90, y, size: 11, font })
    y -= 18
  }
  y -= 12

  // Overeenkomsttekst — wrap op ~85 chars per regel (Helvetica @ 11pt)
  const paragraphs = input.agreementText.split(/\n\s*\n/) // dubbele newline = alinea
  for (const para of paragraphs) {
    newPageIfNeeded(140)
    const lines = wrapText(para.replace(/\n/g, ' '), 88)
    for (const line of lines) {
      newPageIfNeeded(80)
      page.drawText(line, { x: margin, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) })
      y -= 15
    }
    y -= 8
  }

  // Signature-block (bij signed variant) of "nog niet ondertekend"
  if (input.agreedAt && input.signatureBlock) {
    newPageIfNeeded(120)
    y -= 8
    page.drawRectangle({ x: margin, y: y - 78, width: 483, height: 82, borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.5 })
    page.drawText('Digitaal getekend', { x: margin + 12, y: y - 16, size: 11, font: bold, color: rgb(0.1, 0.5, 0.2) })
    let sy = y - 34
    const rows: Array<[string, string]> = [
      ['Naam',      input.recipientName],
      ['Akkoord op', new Date(input.agreedAt).toLocaleString('nl-NL')],
    ]
    if (input.signatureBlock.ip)              rows.push(['IP-adres',     input.signatureBlock.ip])
    if (input.signatureBlock.molliePaymentId) rows.push(['Betaal-id',    input.signatureBlock.molliePaymentId])
    if (input.signatureBlock.paymentMethod)   rows.push(['Betaalmethode', input.signatureBlock.paymentMethod])
    for (const [k, v] of rows) {
      page.drawText(`${k}:`, { x: margin + 12, y: sy, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
      page.drawText(v, { x: margin + 110, y: sy, size: 10, font })
      sy -= 13
    }
  } else {
    y -= 8
    page.drawText('Deze overeenkomst is nog niet digitaal ondertekend.', {
      x: margin, y, size: 10, font, color: rgb(0.75, 0.5, 0),
    })
  }

  return await doc.save()
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) {
      if (cur) lines.push(cur)
      cur = w
    } else {
      cur = cur ? cur + ' ' + w : w
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function randomToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ---- serve -----------------------------------------------------------------
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST')     return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'server misconfigured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let payload: { payment_request_id?: string } = {}
  try { payload = await req.json() } catch {}
  const requestId = payload.payment_request_id
  if (!requestId) {
    return new Response(JSON.stringify({ error: 'payment_request_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Load bundle
  const { data: req0, error: reqErr } = await admin
    .from('payment_requests')
    .select(`
      id, project_id, recipient_email, recipient_name, title, description,
      amount_cents, currency, reference, status, agreement_template_id,
      project:projects(id, name, slug, logo_url, organization_id,
                        organization:organizations(id, name, slug, logo_url, reply_to_email, from_display_name)),
      template:agreement_templates(id, title, content_markdown, version)
    `)
    .eq('id', requestId)
    .maybeSingle()

  if (reqErr || !req0) {
    console.error('[send-payment-request] not found', reqErr)
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (req0.status !== 'draft') {
    return new Response(JSON.stringify({ error: `already_${req0.status}` }), {
      status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const project = (req0.project as any)
  const org     = project?.organization
  const template = (req0.template as any)

  if (!template) {
    return new Response(JSON.stringify({ error: 'template_missing' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Render placeholders
  const vars: Record<string, string> = {
    naam:        req0.recipient_name,
    email:       req0.recipient_email,
    bedrag:      formatEuro(req0.amount_cents).replace('€', '').trim(),
    referentie:  req0.reference || '',
    datum:       formatDateNL(),
    project:     project?.name || '',
    organisatie: org?.name || '',
  }
  const contractText = renderPlaceholders(template.content_markdown, vars)

  // Access token voor magic-link
  const accessToken = randomToken()

  // Genereer PDF
  const pdfBytes = await renderContractPdf({
    orgName:       org?.name || '',
    orgLogoUrl:    org?.logo_url || null,
    projectName:   project?.name || '',
    requestTitle:  req0.title,
    recipientName: req0.recipient_name,
    recipientEmail: req0.recipient_email,
    amountCents:   req0.amount_cents,
    reference:     req0.reference,
    agreementText: contractText,
    agreedAt:      null, // unsigned versie
  })

  // Upload naar Storage
  const objectPath = `unsigned/${req0.project_id}/${requestId}.pdf`
  const { error: upErr } = await admin.storage
    .from('payment-requests')
    .upload(objectPath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    })
  if (upErr) {
    console.error('[send-payment-request] storage upload failed', upErr)
    return new Response(JSON.stringify({ error: 'storage_failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Bepaal lid-view URL (via projectslug subdomain of hoofddomein)
  const projectSlug = project?.slug
  const baseUrl = projectSlug
    ? `https://${projectSlug}.buuur.nl`
    : APP_BASE_URL
  const memberViewUrl = `${baseUrl}/verzoeken/${req0.id}?t=${accessToken}`

  // Mail via Resend
  const subject = `Betaalverzoek: ${req0.title}`
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;padding:24px;">
      <h1 style="font-size:20px;margin:0 0 16px;">${escapeHtml(req0.title)}</h1>
      <p style="font-size:15px;line-height:1.55;margin:0 0 12px;">Beste ${escapeHtml(req0.recipient_name)},</p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 12px;">
        ${escapeHtml(org?.name || 'Wij')} vraagt je om een betaalverzoek van
        <strong>${escapeHtml(formatEuro(req0.amount_cents))}</strong> te bevestigen en te voldoen
        ${projectSlug ? `voor het project <strong>${escapeHtml(project?.name || '')}</strong>` : ''}.
      </p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 20px;">
        In de bijlage vind je de overeenkomst. Bekijk 'm, ga akkoord en betaal via iDEAL:
      </p>
      <p style="margin:24px 0;">
        <a href="${memberViewUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:500;">
          Bekijk en betaal
        </a>
      </p>
      <p style="font-size:13px;color:#666;line-height:1.5;margin:20px 0 0;">
        Werkt de knop niet? Open dan deze link:<br/>
        <a href="${memberViewUrl}" style="color:#666;word-break:break-all;">${memberViewUrl}</a>
      </p>
      <p style="font-size:12px;color:#999;margin:32px 0 0;">
        Verzonden via buuur.nl — ${escapeHtml(org?.name || '')}
      </p>
    </div>
  `

  const attachment = {
    filename: `${slugify(req0.title)}.pdf`,
    content: base64FromBytes(pdfBytes),
  }

  // Afzendernaam en reply-to per org instelbaar. From-adres blijft altijd het
  // Resend-verified adres (noreply@buuur.nl); de display-name wordt "Org via buuur"
  // en de reply-to = org.reply_to_email zodat antwoorden direct bij de org komen.
  const orgDisplay = org?.from_display_name?.trim() || org?.name || FROM_NAME
  const fromName = `${orgDisplay} via buuur`
  const replyTo = org?.reply_to_email || null

  if (!RESEND_API_KEY) {
    console.log('[send-payment-request] no RESEND_API_KEY — mail zou naar', req0.recipient_email, 'gaan')
  } else {
    const mailBody: Record<string, unknown> = {
      from: `${fromName} <${FROM_EMAIL}>`,
      to: [req0.recipient_email],
      subject,
      html,
      attachments: [attachment],
    }
    if (replyTo) mailBody.reply_to = [replyTo]

    const mailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mailBody),
    })
    if (!mailRes.ok) {
      const errBody = await mailRes.text().catch(() => '')
      console.error('[send-payment-request] resend failed', mailRes.status, errBody)
    }
  }

  // RPC: markeer sent
  const { error: markErr } = await admin.rpc('mark_payment_request_sent', {
    p_request_id: requestId,
    p_unsigned_pdf: objectPath,
    p_access_token: accessToken,
  })
  if (markErr) {
    console.error('[send-payment-request] mark sent failed', markErr)
    return new Response(JSON.stringify({ error: 'mark_sent_failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, access_token: accessToken, member_view_url: memberViewUrl }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'overeenkomst'
}

function base64FromBytes(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
