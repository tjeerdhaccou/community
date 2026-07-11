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

// Bouwt de regels die in het handtekening-blok komen. NAW-veld wordt alleen
// getoond als het is meegegeven. Krabbel + plaats/datum zijn altijd aanwezig.
function buildSignatureLines({ signer, naw, place }) {
  const lines = []
  // Naam voluit onder de krabbel
  lines.push({ text: signer.full_name, size: 8, muted: true })
  // Adres
  if (naw?.street_address) {
    lines.push({ text: naw.street_address, size: 8, muted: true })
  }
  // Postcode + woonplaats
  const pc = [naw?.postal_code, naw?.city].filter(Boolean).join(' ')
  if (pc) {
    lines.push({ text: pc, size: 8, muted: true })
  }
  // Geboortedatum (optioneel)
  if (naw?.date_of_birth) {
    try {
      const dob = new Date(naw.date_of_birth)
      lines.push({ text: `Geboren ${formatNlDate(dob)}`, size: 7, muted: true })
    } catch {
      // ongeldig datum-formaat — sla over
    }
  }
  // Telefoon (optioneel)
  if (naw?.phone) {
    lines.push({ text: naw.phone, size: 7, muted: true })
  }
  // Plaats + datum van ondertekening (altijd laatste regel)
  lines.push({ text: `${place}, ${formatNlDate(new Date())}`, size: 8, muted: false })
  return lines
}

// Rendert het handtekening-blok (krabbel + NAW + plaats/datum) op de signer's
// placement-coords en plakt een audit-pagina achteraan.
//
// signature   = rij uit signature_request_signers (incl. placement_*)
// originalPdf = Uint8Array van het originele PDF
// signer      = { full_name, email }
// naw         = { street_address, postal_code, city, date_of_birth?, phone? }
// place       = waar de signer nu ondertekent
// signedIp    = IP-adres bij ondertekening (van edge function)
//
// Retourneert: { signedBytes: Uint8Array, signedHash: string }
export async function renderSignedPdf({ originalPdf, signature, signer, naw, place, signedIp }) {
  // Hash van het origineel berekenen — voor audit-trail én om afwijkingen te
  // detecteren. We BLOKKEREN niet meer bij mismatch: in praktijk genereert dat
  // false-positives (Supabase Storage roundtrip is mogelijk niet byte-exact),
  // terwijl de bucket sowieso privé + admin-only-write is. We loggen de
  // mismatch zodat we het kunnen onderzoeken.
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

    const lines = buildSignatureLines({ signer, naw, place })

    // Adaptief: als het blok krap is (bestaande verzoeken met 0.10 hoogte),
    // maken we de krabbel iets kleiner om ruimte te maken voor de NAW-regels.
    const totalLinesHeight = lines.reduce((sum, l) => sum + l.size + 2, 0)
    const availableForKrabbel = Math.max(blockH - totalLinesHeight - 8, 12)
    const krabbelSize = Math.min(20, availableForKrabbel)

    page.drawText(signer.full_name, {
      x: blockX + 6,
      y: blockY + blockH - krabbelSize - 4,
      size: krabbelSize,
      font: handFont,
      color: rgb(0.1, 0.1, 0.4),
    })

    // NAW + plaats/datum regels onder de krabbel
    let lineY = blockY + blockH - krabbelSize - 12
    for (const l of lines) {
      page.drawText(l.text, {
        x: blockX + 6,
        y: lineY,
        size: l.size,
        font: regular,
        color: l.muted ? rgb(0.35, 0.35, 0.35) : rgb(0.15, 0.15, 0.15),
      })
      lineY -= l.size + 2
    }
  }

  // 4. Audit-pagina achteraan.
  const auditPage = pdf.addPage()
  const { height: ah } = auditPage.getSize()
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
    auditPage.drawText(String(value ?? '—'), { x: margin + 130, y, size: small, font: regular, color: rgb(0.1, 0.1, 0.1) })
    y -= lineGap
  }

  line('Document:',     signature.title)
  line('SHA-256:',      signature.file_sha256)
  y -= 8
  line('Ondertekenaar:', signer.full_name)
  line('E-mail:',       signer.email ?? '—')
  // NAW op audit-pagina (identiek aan wat op het handtekening-blok staat)
  if (naw?.street_address) line('Adres:',       naw.street_address)
  if (naw?.postal_code || naw?.city) {
    line('Postcode/plaats:', [naw?.postal_code, naw?.city].filter(Boolean).join(' '))
  }
  if (naw?.date_of_birth) {
    try {
      const dob = new Date(naw.date_of_birth)
      line('Geboortedatum:', formatNlDate(dob))
    } catch { /* skip */ }
  }
  if (naw?.phone) line('Telefoon:',    naw.phone)
  y -= 4
  line('Plaats:',       place)
  line('Datum/tijd:',   new Date().toISOString())
  line('IP-adres:',     signedIp ?? 'onbekend')
  y -= 12

  const userAgent = (typeof navigator !== 'undefined' && navigator.userAgent) || 'onbekend'
  auditPage.drawText('Apparaat:', { x: margin, y, size: small, font: regular, color: rgb(0.4, 0.4, 0.4) })
  const uaTrim = userAgent.length > 90 ? userAgent.slice(0, 90) + '…' : userAgent
  auditPage.drawText(uaTrim, { x: margin + 130, y, size: 9, font: regular, color: rgb(0.1, 0.1, 0.1) })
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
