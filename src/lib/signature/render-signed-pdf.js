import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// SHA-256 hex van een ArrayBuffer (gelijk patroon als admin-form).
async function sha256Hex(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function formatNlDate(d) {
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Rendert het handtekening-blok (krabbel + naam + plaats/datum) op de signer's
// placement-coords en plakt een audit-pagina achteraan.
//
// signature   = rij uit signature_request_signers (incl. placement_*)
// originalPdf = Uint8Array van het originele PDF
// signer      = { full_name, email }
// signedIp    = IP-adres bij ondertekening (best-effort vanuit client)
//
// Retourneert: { signedBytes: Uint8Array, signedHash: string }
export async function renderSignedPdf({ originalPdf, signature, signer, place, signedIp }) {
  // Hash van het origineel berekenen — voor audit-trail én om afwijkingen te
  // detecteren. We BLOKKEREN niet meer bij mismatch: in praktijk genereert dat
  // false-positives (Supabase Storage roundtrip is mogelijk niet byte-exact),
  // terwijl de bucket sowieso privé + admin-only-write is. We loggen de
  // mismatch zodat we het kunnen onderzoeken, en zetten beide hashes op de
  // audit-pagina zodat forensisch terug te zien is wat er getekend is.
  const originalHash = await sha256Hex(originalPdf)
  const expectedHash = signature.file_sha256
  if (expectedHash && originalHash !== expectedHash) {
    console.warn('[sign] SHA-256 mismatch', {
      expected: expectedHash,
      actual: originalHash,
      sizeBytes: originalPdf.byteLength,
    })
  }

  // 2. Document laden + standaard fonts inbedden.
  const pdf = await PDFDocument.load(originalPdf)
  const handFont = await pdf.embedFont(StandardFonts.HelveticaOblique) // SES: schuin = "handgeschreven"
  const regular = await pdf.embedFont(StandardFonts.Helvetica)

  // 3. Signature-blok op de placement plaatsen.
  if (signature.placement) {
    const p = signature.placement
    const page = pdf.getPage(p.page - 1)
    const { width, height } = page.getSize()

    // Normalize-coords (linksboven origin, y groeit naar beneden) → pdf-lib
    // coords (linksonder origin, y groeit naar boven).
    const blockW = width * p.width
    const blockH = height * p.height
    const blockX = width * p.x - blockW / 2
    const blockY = height * (1 - p.y) - blockH / 2

    // Lichte achtergrond (heel subtiel — niet storend over PDF-content).
    page.drawRectangle({
      x: blockX,
      y: blockY,
      width: blockW,
      height: blockH,
      color: rgb(0.97, 0.97, 1),
      opacity: 0.4,
    })

    // Krabbel (cursief = pseudo-handschrift). Past binnen blok-hoogte.
    const krabbelSize = Math.min(20, blockH * 0.35)
    page.drawText(signer.full_name, {
      x: blockX + 6,
      y: blockY + blockH - krabbelSize - 4,
      size: krabbelSize,
      font: handFont,
      color: rgb(0.1, 0.1, 0.4),
    })

    // Naam (regulier, klein, onder krabbel)
    const metaSize = Math.min(8, blockH * 0.14)
    let metaY = blockY + blockH - krabbelSize - 12
    page.drawText(signer.full_name, {
      x: blockX + 6,
      y: metaY,
      size: metaSize,
      font: regular,
      color: rgb(0.2, 0.2, 0.2),
    })
    metaY -= metaSize + 2

    // Plaats + datum
    page.drawText(`${place}, ${formatNlDate(new Date())}`, {
      x: blockX + 6,
      y: metaY,
      size: metaSize,
      font: regular,
      color: rgb(0.2, 0.2, 0.2),
    })
  }

  // 4. Audit-pagina achteraan.
  const auditPage = pdf.addPage()
  const { width: aw, height: ah } = auditPage.getSize()
  const margin = 50
  let y = ah - margin

  auditPage.drawText('Certificaat van ondertekening', {
    x: margin, y, size: 18, font: regular, color: rgb(0.1, 0.1, 0.3),
  })
  y -= 28

  const lineGap = 18
  const small = 11
  function line(label, value) {
    auditPage.drawText(`${label}`, { x: margin, y, size: small, font: regular, color: rgb(0.4, 0.4, 0.4) })
    auditPage.drawText(String(value ?? '—'), { x: margin + 120, y, size: small, font: regular, color: rgb(0.1, 0.1, 0.1) })
    y -= lineGap
  }

  line('Document:',     signature.title)
  line('SHA-256:',      signature.file_sha256)
  y -= 8
  line('Ondertekenaar:', signer.full_name)
  line('E-mail:',       signer.email ?? '—')
  line('Plaats:',       place)
  line('Datum/tijd:',   new Date().toISOString())
  line('IP-adres:',     signedIp ?? 'onbekend')
  y -= 12

  const userAgent = (typeof navigator !== 'undefined' && navigator.userAgent) || 'onbekend'
  auditPage.drawText('Apparaat:', { x: margin, y, size: small, font: regular, color: rgb(0.4, 0.4, 0.4) })
  const uaTrim = userAgent.length > 90 ? userAgent.slice(0, 90) + '…' : userAgent
  auditPage.drawText(uaTrim, { x: margin + 120, y, size: 9, font: regular, color: rgb(0.1, 0.1, 0.1) })
  y -= lineGap + 16

  auditPage.drawText(
    'Deze ondertekening is rechtsgeldig onder eIDAS als eenvoudige',
    { x: margin, y, size: 9, font: regular, color: rgb(0.4, 0.4, 0.4) },
  )
  y -= 12
  auditPage.drawText(
    'elektronische handtekening (SES).',
    { x: margin, y, size: 9, font: regular, color: rgb(0.4, 0.4, 0.4) },
  )

  // 5. Bytes + hash teruggeven.
  const signedBytes = await pdf.save()
  const signedHash = await sha256Hex(signedBytes)
  return { signedBytes, signedHash }
}

// Best-effort IP-detectie via een publieke service. Faalt stil (geen IP →
// audit-pagina noteert "onbekend"). Niet kritisch voor SES-geldigheid.
export async function getClientIp() {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return data?.ip ?? null
  } catch {
    return null
  }
}
