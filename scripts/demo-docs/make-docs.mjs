// Maakt de voorbeeld-PDF's van het demoproject uit docs.json.
//
//   node scripts/demo-docs/make-docs.mjs <werkmap>
//
// De werkmap bevat de afbeeldingen waarnaar docs.json verwijst (maquette.jpg,
// maquette2.jpg, van Unsplash) en krijgt een map out/ met de PDF's. Uploaden
// naar project-files (documents/<projectId>/… en meetings/<meetingId>/…) gaat
// met de Storage API en de secret key; de rijen in documents en meeting_files
// verwijzen naar die paden.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const DIR = process.argv[2]
const HERE = new URL('.', import.meta.url).pathname
mkdirSync(`${DIR}/out`, { recursive: true })
const BLUE = rgb(0.2, 0.435, 0.722), INK = rgb(0.1, 0.1, 0.18), GREY = rgb(0.42, 0.44, 0.5), LINE = rgb(0.9, 0.89, 0.86), SOFT = rgb(0.95, 0.945, 0.93)
const A4 = [595.28, 841.89], M = 56

async function make(file, { kicker, title, subtitle, blocks }) {
  const pdf = await PDFDocument.create()
  pdf.setTitle(title); pdf.setAuthor('Vereniging Demoproject'); pdf.setCreator('Buuur demo')
  const R = await pdf.embedFont(StandardFonts.Helvetica), B = await pdf.embedFont(StandardFonts.HelveticaBold)
  let page, y
  const W = A4[0] - 2 * M
  function newPage(first) {
    page = pdf.addPage(A4)
    if (first) {
      page.drawRectangle({ x: 0, y: A4[1] - 150, width: A4[0], height: 150, color: BLUE })
      page.drawText(kicker.toUpperCase(), { x: M, y: A4[1] - 52, size: 9, font: B, color: rgb(1, 1, 1), opacity: 0.8 })
      const lines = wrap(title, B, 22, W)
      let ty = A4[1] - 84
      for (const l of lines) { page.drawText(l, { x: M, y: ty, size: 22, font: B, color: rgb(1, 1, 1) }); ty -= 27 }
      if (subtitle) page.drawText(subtitle, { x: M, y: ty - 2, size: 10.5, font: R, color: rgb(1, 1, 1), opacity: 0.85 })
      y = A4[1] - 190
    } else {
      page.drawText(`Demoproject · ${title}`, { x: M, y: A4[1] - 40, size: 8.5, font: R, color: GREY })
      y = A4[1] - 72
    }
  }
  function wrap(text, font, size, width) {
    const out = []
    for (const para of String(text).split('\n')) {
      let line = ''
      for (const w of para.split(' ')) {
        const t = line ? line + ' ' + w : w
        if (font.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = w } else line = t
      }
      out.push(line)
    }
    return out
  }
  function need(h) { if (y - h < 70) newPage(false) }
  function text(t, { font = R, size = 10.5, color = INK, indent = 0, gap = 6, lh = 1.45 } = {}) {
    for (const l of wrap(t, font, size, W - indent)) { need(size * lh); page.drawText(l, { x: M + indent, y, size, font, color }); y -= size * lh }
    y -= gap
  }
  newPage(true)
  for (const b of blocks) {
    if (b.h) { need(40); y -= 8; text(b.h, { font: B, size: 13, gap: 4 }) }
    if (b.p) text(b.p)
    if (b.ul) { for (const it of b.ul) { need(16); page.drawCircle({ x: M + 4, y: y + 3.5, size: 1.8, color: BLUE }); text(it, { indent: 14, gap: 2 }) } y -= 4 }
    if (b.img) {
      const img = await pdf.embedJpg(readFileSync(b.img))
      const h = W * img.height / img.width
      need(h + 24)
      page.drawImage(img, { x: M, y: y - h, width: W, height: h }); y -= h + 6
      if (b.caption) text(b.caption, { size: 8.5, color: GREY })
    }
    if (b.table) {
      const cols = b.table[0].length, cw = b.widths || Array(cols).fill(W / cols)
      b.table.forEach((row, i) => {
        need(22)
        if (i === 0) page.drawRectangle({ x: M, y: y - 6, width: W, height: 20, color: SOFT })
        let x = M
        row.forEach((cell, j) => {
          const f = i === 0 || (b.boldLast && i === b.table.length - 1) ? B : R
          const right = j > 0 && b.alignRight
          const tw = f.widthOfTextAtSize(String(cell), 9.5)
          page.drawText(String(cell), { x: right ? x + cw[j] - tw - 6 : x + 6, y, size: 9.5, font: f, color: INK })
          x += cw[j]
        })
        y -= 20
        page.drawLine({ start: { x: M, y: y + 8 }, end: { x: M + W, y: y + 8 }, thickness: 0.5, color: LINE })
      })
      y -= 10
    }
  }
  const pages = pdf.getPages()
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 48 }, end: { x: A4[0] - M, y: 48 }, thickness: 0.5, color: LINE })
    p.drawText('Voorbeelddocument in de Buuur-demo. Namen, bedragen en data zijn fictief.', { x: M, y: 34, size: 8, font: R, color: GREY })
    const n = `${i + 1} / ${pages.length}`
    p.drawText(n, { x: A4[0] - M - R.widthOfTextAtSize(n, 8), y: 34, size: 8, font: R, color: GREY })
  })
  const bytes = await pdf.save()
  writeFileSync(`${DIR}/out/${file}`, bytes)
  console.log(file, bytes.length)
}

const docs = JSON.parse(readFileSync(`${HERE}docs.json`, 'utf8'))
for (const d of docs) await make(d.file, { ...d, blocks: d.blocks.map(b => b.img ? { ...b, img: `${DIR}/${b.img}` } : b) })
