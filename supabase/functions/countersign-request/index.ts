// countersign-request
// Zet de handtekening van de organisatie ("tegentekening") op een voltooid
// tekenverzoek en mailt elke ondertekenaar de volledig getekende versie.
//
// Aangeroepen door:
//   * DB-trigger sig_countersign_on_complete (pg_net, geen JWT) zodra een
//     verzoek 'completed' wordt en countersign_enabled aan staat;
//   * het CMS (buuur-admin) met de JWT van de beheerder, voor verzoeken die
//     al voltooid waren of waar de automatische ronde is mislukt.
//
// Body: { request_id, dry_run?: boolean }
//   dry_run = alleen renderen en de PDF teruggeven (vereist JWT van een
//   org-admin); niets opslaan of mailen. Voor de voorvertoning in het CMS.
//
// Gedeployed met --no-verify-jwt (pg_net stuurt geen JWT). Autorisatie zit in
// RLS: alleen org-admins kunnen de countersign_*-velden zetten. Deze function
// voert alleen uit wat de DB zegt dat moet gebeuren (status = completed,
// enabled, nog niet bevestigd) en is daarmee idempotent — een ongewenste
// aanroep doet hooguit wat de trigger toch al zou doen.
//
// Opbouw van countersigned.pdf: origineel + per ondertekenaar het
// handtekening-blok opnieuw getekend uit de audit-snapshot (naam, NAW, plaats,
// datum) + het org-blok + één gezamenlijke certificaat-pagina. De losse
// signed-<signer>.pdf's blijven bestaan als bewijs per ondertekenaar.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'https://esm.sh/pdf-lib@1.17.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SERVICE_ROLE_KEY =
  (Deno.env.get('SUPABASE_SECRET_KEYS') || '').match(/sb_secret_[A-Za-z0-9_-]+/)?.[0] ||
  Deno.env.get('SB_SECRET_KEY') ||
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@buuur.nl'
const FROM_NAME = Deno.env.get('FROM_NAME') || 'Buuur'
const MAIN_DOMAIN = Deno.env.get('MAIN_DOMAIN') || 'buuur.nl'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ---------------------------------------------------------------------------
// Tekst-hulpjes
// ---------------------------------------------------------------------------

// De standaard-fonts van pdf-lib kennen alleen WinAnsi. Alles daarbuiten
// (emoji, exotische tekens) zou de render laten crashen; vervangen door '?'.
function clean(s: unknown): string {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”…€]/g, '?')
}

const TZ = 'Europe/Amsterdam'
function fmtDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ })
}
function fmtDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ,
  }) + ' (NL)'
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120)
}

// ---------------------------------------------------------------------------
// PDF-rendering
// ---------------------------------------------------------------------------

type Block = {
  page: number
  x: number
  y: number
  width: number
  height: number
  krabbel: string          // de "handgeschreven" regel (naam) — fallback als er geen PNG is
  image?: PDFImage | null  // echte krabbel (getekend of geüpload)
  header?: string          // kleine regel boven de krabbel (bv. "Namens CommonCity")
  lines: { text: string; size: number; muted: boolean }[]
}

type Annotation = { page: number; x: number; y: number; text: string; size?: number }

// Zelfde layout als render-signed-pdf.js in de community-app, zodat het
// org-blok en de opnieuw getekende lid-blokken er identiek uitzien.
function drawBlock(page: PDFPage, block: Block, handFont: PDFFont, regular: PDFFont) {
  const { width, height } = page.getSize()
  const blockW = width * block.width
  const blockH = height * block.height
  const blockX = width * block.x - blockW / 2
  const blockY = height * (1 - block.y) - blockH / 2

  page.drawRectangle({
    x: blockX, y: blockY, width: blockW, height: blockH,
    color: rgb(0.97, 0.97, 1), opacity: 0.4,
  })

  const headerH = block.header ? 9 : 0
  const totalLinesHeight = block.lines.reduce((sum, l) => sum + l.size + 2, 0)
  const availableForKrabbel = Math.max(blockH - totalLinesHeight - headerH - 8, 12)

  let top = blockY + blockH
  if (block.header) {
    page.drawText(clean(block.header), {
      x: blockX + 6, y: top - 8, size: 6.5, font: regular, color: rgb(0.45, 0.45, 0.45),
    })
    top -= headerH
  }

  let krabbelBottom: number
  if (block.image) {
    // Echte krabbel: zo groot mogelijk in de beschikbare ruimte, verhouding behouden.
    const maxW = blockW - 12
    const scale = Math.min(maxW / block.image.width, availableForKrabbel / block.image.height)
    const w = block.image.width * scale
    const h = block.image.height * scale
    page.drawImage(block.image, { x: blockX + 6, y: top - h - 4, width: w, height: h })
    krabbelBottom = top - h - 4
  } else {
    const krabbelSize = Math.min(20, availableForKrabbel)
    page.drawText(clean(block.krabbel), {
      x: blockX + 6, y: top - krabbelSize - 4, size: krabbelSize, font: handFont, color: rgb(0.1, 0.1, 0.4),
    })
    krabbelBottom = top - krabbelSize - 4
  }

  let lineY = krabbelBottom - 8
  for (const l of block.lines) {
    page.drawText(clean(l.text), {
      x: blockX + 6, y: lineY, size: l.size, font: regular,
      color: l.muted ? rgb(0.35, 0.35, 0.35) : rgb(0.15, 0.15, 0.15),
    })
    lineY -= l.size + 2
  }
}

function signerBlock(s: Row, image: PDFImage | null): Block | null {
  if (!s.placement_page) return null
  const naw = (s.signed_naw_snapshot ?? {}) as Row
  const name = s.signed_full_name ?? s.profile?.full_name ?? '—'
  const lines: Block['lines'] = [{ text: name, size: 8, muted: true }]
  if (naw.street_address) lines.push({ text: naw.street_address, size: 8, muted: true })
  const pc = [naw.postal_code, naw.city].filter(Boolean).join(' ')
  if (pc) lines.push({ text: pc, size: 8, muted: true })
  if (naw.date_of_birth) {
    const dob = new Date(naw.date_of_birth)
    if (!isNaN(dob.getTime())) lines.push({ text: `Geboren ${fmtDate(dob)}`, size: 7, muted: true })
  }
  if (naw.phone) lines.push({ text: naw.phone, size: 7, muted: true })
  lines.push({ text: `${s.signed_place ?? '—'}, ${fmtDate(s.signed_at)}`, size: 8, muted: false })
  return {
    page: s.placement_page,
    x: Number(s.placement_x_norm),
    y: Number(s.placement_y_norm),
    width: Number(s.placement_width_norm ?? 0.25),
    height: Number(s.placement_height_norm ?? 0.14),
    krabbel: name,
    image,
    lines,
  }
}

type Countersign = { name: string; role: string | null; place: string; page: number; x: number; y: number; width: number; height: number; signaturePath: string | null }

function orgBlock(orgName: string, cs: Countersign, at: Date, image: PDFImage | null): Block {
  const lines: Block['lines'] = [{ text: cs.name, size: 8, muted: true }]
  if (cs.role) lines.push({ text: cs.role, size: 8, muted: true })
  lines.push({ text: `${cs.place}, ${fmtDate(at)}`, size: 8, muted: false })
  return {
    page: cs.page, x: cs.x, y: cs.y, width: cs.width, height: cs.height,
    header: `Namens ${orgName}`,
    krabbel: cs.name,
    image,
    lines,
  }
}

// Invulregels van een ondertekenaar (NAW op stippellijnen e.d.) opnieuw
// tekenen, precies zoals in render-signed-pdf.js van de community-app.
function drawAnnotations(pdf: PDFDocument, annotations: Annotation[] | null, font: PDFFont) {
  const pageCount = pdf.getPageCount()
  for (const a of annotations ?? []) {
    if (!a?.text || !a.page || a.page < 1 || a.page > pageCount) continue
    const page = pdf.getPage(a.page - 1)
    const { width, height } = page.getSize()
    const size = Number(a.size) || 10
    page.drawText(clean(a.text), {
      x: width * Number(a.x), y: height * (1 - Number(a.y)) - size, size, font, color: rgb(0.1, 0.1, 0.1),
    })
  }
}

async function renderCountersignedPdf(args: {
  originalPdf: Uint8Array
  request: Row
  signers: Row[]
  orgName: string
  countersign: Countersign
  countersignedAt: Date
  countersignedByName: string | null
  signerImages: Map<string, Uint8Array>   // signer.id → PNG van de krabbel
  orgSignaturePng: Uint8Array | null
}): Promise<Uint8Array> {
  const { originalPdf, request, signers, orgName, countersign, countersignedAt, countersignedByName, signerImages, orgSignaturePng } = args
  const pdf = await PDFDocument.load(originalPdf)
  const handFont = await pdf.embedFont(StandardFonts.HelveticaOblique)
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const pageCount = pdf.getPageCount()

  async function embed(png: Uint8Array | null | undefined): Promise<PDFImage | null> {
    if (!png) return null
    try { return await pdf.embedPng(png) } catch (e) { console.warn('[countersign] png embed', e); return null }
  }

  // 1. Invulregels van de ondertekenaars, dan hun blokken (uit de snapshot),
  //    dan het org-blok.
  for (const s of signers) drawAnnotations(pdf, s.signed_annotations as Annotation[] | null, regular)
  const blocks: Block[] = []
  for (const s of signers) {
    const b = signerBlock(s, await embed(signerImages.get(s.id)))
    if (b) blocks.push(b)
  }
  const orgImage = await embed(orgSignaturePng)
  blocks.push(orgBlock(orgName, countersign, countersignedAt, orgImage))
  for (const b of blocks) {
    if (b.page < 1 || b.page > pageCount) continue
    drawBlock(pdf.getPage(b.page - 1), b, handFont, regular)
  }

  // 2. Certificaat-pagina (met doorloop naar extra pagina's bij veel signers).
  const margin = 50
  const lineGap = 16
  const small = 10
  let page = pdf.addPage()
  let y = page.getSize().height - margin

  function ensureSpace(needed: number) {
    if (y - needed < margin) {
      page = pdf.addPage()
      y = page.getSize().height - margin
    }
  }
  function heading(text: string, size = 13) {
    ensureSpace(size + 12)
    page.drawText(clean(text), { x: margin, y, size, font: bold, color: rgb(0.1, 0.1, 0.3) })
    y -= size + 10
  }
  function line(label: string, value: unknown, valueSize = small) {
    ensureSpace(lineGap)
    page.drawText(clean(label), { x: margin, y, size: small, font: regular, color: rgb(0.4, 0.4, 0.4) })
    const v = clean(value == null || value === '' ? '—' : String(value))
    page.drawText(v.length > 95 ? v.slice(0, 95) + '…' : v, {
      x: margin + 130, y, size: valueSize, font: regular, color: rgb(0.1, 0.1, 0.1),
    })
    y -= lineGap
  }
  function gap(n = 8) { y -= n }

  page.drawText('Certificaat van ondertekening', { x: margin, y, size: 18, font: bold, color: rgb(0.1, 0.1, 0.3) })
  y -= 30
  line('Document:', request.title)
  line('Bestand:', request.file_name)
  line('SHA-256 origineel:', request.file_sha256, 8)
  gap(12)

  signers.forEach((s, i) => {
    const naw = (s.signed_naw_snapshot ?? {}) as Row
    heading(signers.length > 1 ? `Ondertekenaar ${i + 1}` : 'Ondertekenaar')
    line('Naam:', s.signed_full_name ?? s.profile?.full_name)
    line('E-mail:', s.signed_email ?? s.profile?.email)
    if (naw.street_address) line('Adres:', naw.street_address)
    if (naw.postal_code || naw.city) line('Postcode/plaats:', [naw.postal_code, naw.city].filter(Boolean).join(' '))
    if (naw.date_of_birth) {
      const dob = new Date(naw.date_of_birth)
      if (!isNaN(dob.getTime())) line('Geboortedatum:', fmtDate(dob))
    }
    if (naw.phone) line('Telefoon:', naw.phone)
    line('Plaats:', s.signed_place)
    line('Datum/tijd:', s.signed_at ? fmtDateTime(s.signed_at) : null)
    line('IP-adres:', s.signed_ip)
    if (s.signed_user_agent) line('Apparaat:', s.signed_user_agent, 8)
    line('Handtekening:', signerImages.has(s.id) ? 'eigenhandig gezet (getekend of geüpload)' : 'naam in schuinschrift')
    const n = Array.isArray(s.signed_annotations) ? s.signed_annotations.length : 0
    if (n > 0) line('Ingevuld:', `${n} tekstregel(s) door ondertekenaar`)
    gap(12)
  })

  heading(`Tegengetekend namens ${orgName}`)
  line('Naam:', countersign.name)
  if (countersign.role) line('Functie:', countersign.role)
  line('Plaats:', countersign.place)
  line('Datum/tijd:', fmtDateTime(countersignedAt))
  line('Handtekening:', orgImage ? 'eigenhandig gezet (getekend of geüpload)' : 'naam in schuinschrift')
  line('Wijze:', countersignedByName
    ? `Bevestigd in het beheer door ${countersignedByName}`
    : 'Automatisch bevestigd zodra alle ondertekenaars getekend hadden, zoals ingesteld bij het aanmaken van het verzoek')
  gap(16)

  ensureSpace(40)
  page.drawText('Deze ondertekeningen zijn rechtsgeldig onder eIDAS als eenvoudige', {
    x: margin, y, size: 9, font: regular, color: rgb(0.4, 0.4, 0.4),
  })
  y -= 12
  page.drawText('elektronische handtekening (SES). De handtekening-bewijzen per ondertekenaar zijn apart bewaard.', {
    x: margin, y, size: 9, font: regular, color: rgb(0.4, 0.4, 0.4),
  })

  return await pdf.save()
}

// ---------------------------------------------------------------------------
// E-mail
// ---------------------------------------------------------------------------

function projectBaseUrl(project: Row | null): string {
  if (project?.custom_domain) return `https://${project.custom_domain}`
  if (project?.slug) return `https://${project.slug}.${MAIN_DOMAIN}`
  return `https://${MAIN_DOMAIN}`
}

function renderEmail(args: { recipientName: string | null; orgName: string; project: Row | null; title: string; linkUrl: string }): string {
  const { recipientName, orgName, project, title, linkUrl } = args
  const greeting = recipientName ? `Hoi ${esc(recipientName.split(' ')[0])}` : 'Hoi'
  const projectName = project?.name ?? orgName
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a2e;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td style="padding:24px 32px 16px;border-bottom:1px solid #f0f0f4;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            ${project?.logo_url ? `<td width="40" style="vertical-align:middle;"><img src="${esc(project.logo_url)}" alt="${esc(projectName)}" width="32" height="32" style="border-radius:8px;display:block;"></td>` : ''}
            <td style="vertical-align:middle;padding-left:${project?.logo_url ? '12px' : '0'};"><span style="font-size:14px;color:#6b7280;font-weight:500;">${esc(projectName)}</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:15px;color:#4a4a6a;">${greeting},</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a4a6a;">${esc(orgName)} heeft jouw getekende document ook ondertekend. Daarmee is het rond.</p>
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#1a1a2e;font-weight:600;">${esc(title)}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a4a6a;">De volledig getekende versie zit als PDF bij deze mail. Je vindt hem ook terug onder <strong>Mijn documenten</strong>, met het certificaat van ondertekening als laatste pagina.</p>
          <p style="margin:32px 0 0;"><a href="${esc(linkUrl)}" style="display:inline-block;background:#4A90D9;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Bekijk in ${esc(projectName)}</a></p>
        </td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid #f0f0f4;background:#fafafc;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#9ba1b0;">Je ontvangt deze mail omdat je dit document hebt ondertekend via <strong>${esc(projectName)}</strong> op Buuur. Bewaar hem goed.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

async function sendEmail(args: {
  to: string
  replyTo: string | null
  subject: string
  html: string
  attachment: { filename: string; base64: string }
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY ontbreekt' }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [args.to],
      ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      subject: args.subject,
      html: args.html,
      attachments: [{ filename: args.attachment.filename, content: args.attachment.base64 }],
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: body?.message ?? `Resend ${res.status}` }
  return { ok: true, id: body?.id }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'Server misconfigured' }, 500)

  let body: Row = {}
  try { body = await req.json() } catch { /* leeg */ }
  const requestId: string | null = body?.request_id ?? body?.record?.id ?? null
  const dryRun = body?.dry_run === true
  if (!requestId) return json({ error: 'request_id required' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

  // Wie roept aan? Bij een JWT (CMS) weten we de beheerder; bij pg_net niet.
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  let callerId: string | null = null
  let callerName: string | null = null
  if (jwt && jwt !== SUPABASE_ANON_KEY && jwt !== SERVICE_ROLE_KEY) {
    const { data } = await admin.auth.getUser(jwt)
    callerId = data?.user?.id ?? null
  }

  const { data: request, error: reqErr } = await admin
    .from('signature_requests')
    .select(`
      *,
      org:organizations!org_id(id, name, reply_to_email),
      project:projects!project_id(id, name, slug, custom_domain, logo_url),
      signers:signature_request_signers(*, profile:profiles!profile_id(full_name, email))
    `)
    .eq('id', requestId)
    .maybeSingle()
  if (reqErr) return json({ error: reqErr.message }, 500)
  if (!request) return json({ error: 'not found' }, 404)

  if (callerId) {
    const { data: member } = await admin
      .from('org_members').select('role, profile:profiles!profile_id(full_name)')
      .eq('organization_id', request.org_id).eq('profile_id', callerId).maybeSingle()
    const { data: plat } = await admin.from('profiles').select('is_platform_admin, full_name').eq('id', callerId).maybeSingle()
    const isOrgAdmin = member?.role === 'admin' || plat?.is_platform_admin === true
    if (!isOrgAdmin) callerId = null
    else callerName = (member?.profile as Row | null)?.full_name ?? plat?.full_name ?? null
  }

  // Voorvertoning: alleen voor een org-admin, en met de (nog niet opgeslagen)
  // instellingen uit de body.
  if (dryRun) {
    if (!callerId) return json({ error: 'forbidden' }, 403)
  } else {
    if (request.status !== 'completed') return json({ ok: true, skipped: 'not completed' })
    if (!request.countersign_enabled) return json({ ok: true, skipped: 'countersign not enabled' })
    if (request.countersigned_at) return json({ ok: true, skipped: 'already countersigned', file_path: request.countersigned_file_path })
  }

  const cs: Countersign = dryRun
    ? {
        name: String(body.name ?? request.countersign_name ?? ''),
        role: body.role ?? request.countersign_role ?? null,
        place: String(body.place ?? request.countersign_place ?? ''),
        page: Number(body.page ?? request.countersign_page),
        x: Number(body.x ?? request.countersign_x_norm),
        y: Number(body.y ?? request.countersign_y_norm),
        width: Number(body.width ?? request.countersign_width_norm ?? 0.25),
        height: Number(body.height ?? request.countersign_height_norm ?? 0.14),
        signaturePath: (body.signature_path ?? request.countersign_signature_path ?? null) || null,
      }
    : {
        name: request.countersign_name ?? '',
        role: request.countersign_role ?? null,
        place: request.countersign_place ?? '',
        page: Number(request.countersign_page),
        x: Number(request.countersign_x_norm),
        y: Number(request.countersign_y_norm),
        width: Number(request.countersign_width_norm ?? 0.25),
        height: Number(request.countersign_height_norm ?? 0.14),
        signaturePath: request.countersign_signature_path ?? null,
      }

  const signers: Row[] = (request.signers ?? []).filter((s: Row) => s.status === 'signed')
  const orgName: string = request.org?.name ?? 'de organisatie'

  async function fail(msg: string, status = 500) {
    console.error('[countersign]', requestId, msg)
    if (!dryRun) {
      await admin.from('signature_requests').update({ countersign_error: msg.slice(0, 500) }).eq('id', requestId)
    }
    return json({ error: msg }, status)
  }

  if (!cs.name.trim()) return fail('Geen naam van de ondertekenaar namens de organisatie ingesteld', 400)
  if (!cs.place.trim()) return fail('Geen plaats van ondertekening ingesteld', 400)
  if (!cs.page || isNaN(cs.x) || isNaN(cs.y)) return fail('Geen plek op de PDF gekozen voor de tegentekening', 400)
  if (signers.length === 0) return fail('Geen getekende ondertekenaars', 400)

  // Origineel ophalen en renderen.
  const { data: blob, error: dlErr } = await admin.storage.from('signatures').download(request.file_path)
  if (dlErr || !blob) return fail(`Origineel niet gevonden: ${dlErr?.message ?? 'leeg'}`)
  const originalPdf = new Uint8Array(await blob.arrayBuffer())

  // Krabbel-PNG's: per ondertekenaar (signed-<id>.png) en die van de org.
  // Ontbreekt er een, dan valt dat blok terug op de naam in schuinschrift.
  async function downloadPng(path: string | null): Promise<Uint8Array | null> {
    if (!path) return null
    const { data, error } = await admin.storage.from('signatures').download(path)
    if (error || !data) { console.warn('[countersign] png ontbreekt', path, error?.message); return null }
    return new Uint8Array(await data.arrayBuffer())
  }
  const signerImages = new Map<string, Uint8Array>()
  for (const s of signers) {
    const png = await downloadPng(s.signed_signature_path ?? null)
    if (png) signerImages.set(s.id, png)
  }
  const orgSignaturePng = await downloadPng(cs.signaturePath)

  const countersignedAt = new Date()
  let pdfBytes: Uint8Array
  try {
    pdfBytes = await renderCountersignedPdf({
      originalPdf, request, signers, orgName, countersign: cs, countersignedAt,
      countersignedByName: callerName, signerImages, orgSignaturePng,
    })
  } catch (err) {
    return fail(`Renderen mislukt: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (dryRun) {
    return new Response(pdfBytes, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' },
    })
  }

  // Opslaan + verzoek bijwerken. De update is conditioneel op "nog niet
  // bevestigd", zodat twee gelijktijdige aanroepen niet allebei mailen.
  const filePath = `${request.org_id}/${request.id}/countersigned.pdf`
  const { error: upErr } = await admin.storage
    .from('signatures')
    .upload(filePath, pdfBytes, { contentType: 'application/pdf', upsert: true })
  if (upErr) return fail(`Upload mislukt: ${upErr.message}`)

  const sha = await sha256Hex(pdfBytes)
  const { data: claimed, error: updErr } = await admin
    .from('signature_requests')
    .update({
      countersigned_at: countersignedAt.toISOString(),
      countersigned_file_path: filePath,
      countersigned_sha256: sha,
      countersigned_by: callerId,
      countersign_error: null,
    })
    .eq('id', request.id)
    .is('countersigned_at', null)
    .select('id')
  if (updErr) return fail(`Bijwerken mislukt: ${updErr.message}`)
  if (!claimed || claimed.length === 0) return json({ ok: true, skipped: 'already countersigned (race)' })

  // Mailen naar elke ondertekenaar, met de PDF als bijlage.
  const attachment = {
    filename: `Getekend - ${safeFileName(request.title)}.pdf`,
    base64: toBase64(pdfBytes),
  }
  const linkUrl = `${projectBaseUrl(request.project)}/mijn-documenten`
  const mailErrors: string[] = []
  let sent = 0
  for (const s of signers) {
    const to = s.signed_email ?? s.profile?.email
    if (!to) { mailErrors.push(`geen e-mail voor ${s.signed_full_name ?? s.id}`); continue }
    const result = await sendEmail({
      to,
      replyTo: request.org?.reply_to_email ?? null,
      subject: `Bevestigd: ${request.title}`,
      html: renderEmail({
        recipientName: s.signed_full_name ?? s.profile?.full_name ?? null,
        orgName, project: request.project, title: request.title, linkUrl,
      }),
      attachment,
    })
    if (result.ok) {
      sent++
      await admin.from('notification_log').insert({
        user_id: s.profile_id,
        project_id: request.project_id,
        notification_type: 'signature_countersigned',
        reference_id: request.id,
        channel: 'email',
        email: to,
        resend_message_id: result.id ?? null,
        status: 'sent',
      }).then(({ error }) => { if (error) console.warn('[countersign] log insert', error.message) })
    } else {
      mailErrors.push(`${to}: ${result.error}`)
    }
  }

  await admin.from('signature_requests').update({
    countersign_mailed_at: sent > 0 ? new Date().toISOString() : null,
    countersign_error: mailErrors.length ? `Mail: ${mailErrors.join('; ')}`.slice(0, 500) : null,
  }).eq('id', request.id)

  return json({ ok: true, file_path: filePath, sha256: sha, mailed: sent, mail_errors: mailErrors })
})
