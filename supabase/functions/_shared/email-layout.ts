// Gedeelde e-mail-layout in de Fris-stijl, voor alle mails die de edge
// functions versturen.
//
// Kopie van src/lib/email/layout.ts en brand-color.ts in de admin-repo
// (buuur-admin). Pas je hier iets aan, doe dat daar ook, zodat mails uit de
// admin en uit de community er hetzelfde uitzien. De admin toont alle
// varianten (licht en donker, met en zonder projectkleur) op /dev/e-mails.
//
// Gebruik:
//   const brand = await loadProjectEmailBrand(admin, projectId)
//   const html = renderEmailLayout({ subject, heading, bodyHtml, button, brand })
//
// Tekst van gebruikers gaat altijd door escapeHtml/emailText; de helpers
// (emailQuote, emailLink, emailDetails, ...) escapen zelf.

// ── Kleur ───────────────────────────────────────────────────────────────────

// Steunkleur van een project → contrastveilige kleuren voor in een e-mail.
//
// Zelfde rekenwerk als `src/lib/brandAccent.js` in de community-app, zodat een
// project in zijn mails precies dezelfde knop- en linkkleur krijgt als in de
// ledenomgeving. Een merkkleur gaat nooit rauw de mail in: de coral van Negen
// Kavels (#FC8151) haalt met wit maar 2,5:1. Daarom leiden we af:
//
//   fill    de kleur zelf, voor de knop
//   onFill  inkt of wit erop, welke van de twee het meeste contrast geeft
//   text    dezelfde kleur, donkerder (licht) of lichter (donker) gemaakt tot
//           hij 4,5:1 haalt tegen de kaart — voor links en accenten

const AA_NORMAL = 4.5

export type Rgb = [number, number, number]

export function parseHex(hex: string | null | undefined): Rgb | null {
  if (typeof hex !== 'string') return null
  const m = hex.trim().replace(/^#/, '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb
}

export function toHex(rgb: readonly number[]): string {
  return (
    '#' +
    rgb
      .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
      .join('')
  )
}

function luminance(rgb: readonly number[]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: readonly number[], b: readonly number[]): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

// Stap voor stap donkerder (licht) of lichter (donker) tot de kleur leesbaar is
// tegen het oppervlak. Haalt hij het nooit, dan is het uiterste het beste.
function readableOn(rgb: Rgb, surface: Rgb, dark: boolean): number[] {
  for (let step = 0; step <= 100; step++) {
    const t = step / 100
    const candidate = dark ? rgb.map((v) => v + (255 - v) * t) : rgb.map((v) => v * (1 - t))
    if (contrastRatio(candidate, surface) >= AA_NORMAL) return candidate
  }
  return dark ? [255, 255, 255] : [0, 0, 0]
}

export type DerivedColor = {
  fill: string
  onFill: string
  /** Leesbare variant op de lichte kaart. */
  text: string
  /** Leesbare variant op de donkere kaart (dark mode van de mailclient). */
  textDark: string
  /** Heel lichte tint voor een vlak achter een citaat of bericht. */
  tint: string
}

/**
 * Alle afgeleiden van één kleur. `null` bij een lege of ongeldige waarde, zodat
 * de aanroeper terugvalt op het buuur-blauw.
 */
export function deriveColor(
  hex: string | null | undefined,
  surfaces: { light: string; dark: string; inkOnFill: string },
): DerivedColor | null {
  const rgb = parseHex(hex)
  if (!rgb) return null
  const light = parseHex(surfaces.light)!
  const dark = parseHex(surfaces.dark)!
  const ink = parseHex(surfaces.inkOnFill)!
  const white: Rgb = [255, 255, 255]

  const onFill = contrastRatio(rgb, ink) >= contrastRatio(rgb, white) ? surfaces.inkOnFill : '#FFFFFF'
  return {
    fill: toHex(rgb),
    onFill,
    text: toHex(readableOn(rgb, light, false)),
    textDark: toHex(readableOn(rgb, dark, true)),
    tint: toHex(rgb.map((v, i) => v * 0.08 + light[i] * 0.92)),
  }
}

// Gedeelde e-mail-layout in de Fris-stijl van de admin.
//
// Warme lichte achtergrond, witte kaart met ronde hoeken, sierletter voor de
// kop en het buuur-blauw als steunkleur. Heeft een project eigen kleuren
// (projects.app_accent_color / app_structure_color, dezelfde velden als de
// ledenomgeving gebruikt), dan nemen knop en accenten die over, met een
// knoptekst die op contrast gekozen wordt.
//
// E-mailveilig: tabellen, inline styles, geen SVG. Voor mailclients in dark
// mode staan er donkere varianten in een <style>-blok (Apple Mail, iOS Mail,
// Outlook.com via [data-ogsc]); clients die dat negeren krijgen de lichte mail
// met expliciete achtergronden, zodat ze die netjes zelf omkeren in plaats van
// half (de vaalblauwe knop en grijze tekst van vroeger).
//


/** Fris-tokens uit globals.css, omgerekend van oklch naar hex. */
export const FRIS = {
  light: {
    page: '#F5F4F0', // --color-secondary/muted: warme tint
    card: '#FFFFFF',
    border: '#E6E4DF', // --color-border
    ink: '#1D1713', // --color-foreground
    muted: '#6E6860', // --color-muted-foreground
  },
  dark: {
    page: '#161412',
    card: '#221F1C',
    border: '#37332E',
    ink: '#F3F0EA',
    muted: '#B0AAA1',
  },
  /** buuur-blauw (--brand) en de inktvariant (--brand-ink). */
  brand: '#2341FF',
  brandInk: '#1B34D9',
  brandSubtle: '#F3F5FF',
  /** Beeldmerk van buuur (zelfde als in de bovenbalk). */
  mark: '#000064',
  radius: { card: 16, button: 10, block: 10 },
  font: {
    sans: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    display: "'Instrument Serif', Georgia, 'Times New Roman', serif",
  },
} as const

const SURFACES = { light: FRIS.light.card, dark: FRIS.dark.card, inkOnFill: FRIS.light.ink }

export type EmailBrand = {
  /** Naam van het project of de organisatie; komt in kop en voettekst. */
  name: string
  logoUrl?: string | null
  /** Knoppen en call-to-actions (projects.app_accent_color). */
  accentColor?: string | null
  /** Links, citaatvlakken en accenten (projects.app_structure_color). */
  structureColor?: string | null
}

export type EmailTheme = {
  button: DerivedColor
  structure: DerivedColor
  /** true als er een eigen projectkleur in zit. */
  custom: boolean
}

const BUUUR_BLUE: DerivedColor = {
  ...deriveColor(FRIS.brand, SURFACES)!,
  text: FRIS.brandInk,
  tint: FRIS.brandSubtle,
}

/**
 * Kleuren voor een mail. Ontbreekt één van de twee projectkleuren, dan neemt
 * hij de andere over (zoals in de ledenomgeving); zijn ze allebei leeg of
 * ongeldig, dan het buuur-blauw.
 */
export function resolveEmailTheme(brand?: EmailBrand | null): EmailTheme {
  const accent = deriveColor(brand?.accentColor, SURFACES)
  const structure = deriveColor(brand?.structureColor, SURFACES)
  if (!accent && !structure) return { button: BUUUR_BLUE, structure: BUUUR_BLUE, custom: false }
  return { button: (accent ?? structure)!, structure: (structure ?? accent)!, custom: true }
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )

// ── Bouwstenen voor de inhoud ───────────────────────────────────────────────
// Alles hieronder geeft veilige HTML terug: tekst wordt ge-escaped.

export function emailParagraph(html: string, opts: { muted?: boolean; small?: boolean } = {}) {
  const size = opts.small ? 13 : 16
  const cls = opts.muted ? 'fx-muted' : 'fx-ink'
  const color = opts.muted ? FRIS.light.muted : FRIS.light.ink
  return `<p class="${cls}" style="margin:0 0 16px;font-family:${FRIS.font.sans};font-size:${size}px;line-height:1.6;color:${color};">${html}</p>`
}

/** Persoonlijk bericht of citaat, op een lichte tint van de steunkleur (bewust zonder gekleurde zijrand). */
export function emailQuote(theme: EmailTheme, label: string | null, text: string) {
  const body = escapeHtml(text).replace(/\n/g, '<br/>')
  const labelHtml = label
    ? `<p class="fx-muted" style="margin:0 0 6px;font-family:${FRIS.font.sans};font-size:13px;line-height:1.4;color:${FRIS.light.muted};">${escapeHtml(label)}</p>`
    : ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;border-collapse:separate;">
  <tr><td class="fx-quote" bgcolor="${theme.structure.tint}" style="background:${theme.structure.tint};border-radius:${FRIS.radius.block}px;padding:14px 18px;">
    ${labelHtml}<p class="fx-ink" style="margin:0;font-family:${FRIS.font.sans};font-size:15px;line-height:1.6;color:${FRIS.light.ink};">${body}</p>
  </td></tr>
</table>`
}

/** Link in de leesbare variant van de structuurkleur. */
export function emailLink(theme: EmailTheme, url: string, label?: string) {
  const href = escapeHtml(url)
  return `<a class="fx-link" href="${href}" style="color:${theme.structure.text};text-decoration:underline;word-break:break-all;">${label ? escapeHtml(label) : href}</a>`
}

/** Platte tekst van een gebruiker met regeleinden, veilig als HTML. */
export function emailText(text: string) {
  return escapeHtml(text).replace(/\r?\n/g, '<br/>')
}

/** Rijtje label/waarde, bijv. bedrag en referentie bij een betaling. */
export function emailDetails(rows: { label: string; value: string }[]) {
  const cells = rows
    .map(
      (r) => `<tr>
    <td class="fx-muted fx-rule" style="padding:10px 0;border-bottom:1px solid ${FRIS.light.border};font-family:${FRIS.font.sans};font-size:14px;line-height:1.4;color:${FRIS.light.muted};vertical-align:top;">${escapeHtml(r.label)}</td>
    <td class="fx-ink fx-rule" align="right" style="padding:10px 0 10px 16px;border-bottom:1px solid ${FRIS.light.border};font-family:${FRIS.font.sans};font-size:14px;line-height:1.4;font-weight:600;color:${FRIS.light.ink};vertical-align:top;">${escapeHtml(r.value)}</td>
  </tr>`,
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;border-collapse:collapse;">${cells}</table>`
}

/** Link in de voettekst (bijv. uitschrijven), in de gedempte kleur. */
export function emailFooterLink(url: string, label: string) {
  return `<a class="fx-muted" href="${escapeHtml(url)}" style="color:${FRIS.light.muted};text-decoration:underline;">${escapeHtml(label)}</a>`
}

// ── Layout ──────────────────────────────────────────────────────────────────

export type EmailLayoutOptions = {
  /** Wordt de <title> en de verborgen voorvertoningstekst als die ontbreekt. */
  subject: string
  /** Korte tekst die mailclients naast het onderwerp tonen. */
  preheader?: string
  brand?: EmailBrand | null
  /** Kop in de sierletter, platte tekst. */
  heading: string
  /** Inhoud als HTML, opgebouwd met emailParagraph/emailQuote/emailLink. */
  bodyHtml: string
  button?: { label: string; url: string } | null
  /** Kleine tekst onder de knop, als HTML. */
  afterButtonHtml?: string
  /** Regel in de voettekst onder de kaart, platte tekst. */
  footerNote?: string
  /** Extra regel in de voettekst als HTML, bijv. uitschrijflinks (emailFooterLink). */
  footerHtml?: string
}

export function renderEmailLayout(opts: EmailLayoutOptions, theme = resolveEmailTheme(opts.brand)): string {
  const { light, dark } = FRIS
  const button = opts.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
        <tr><td class="fx-btn" bgcolor="${theme.button.fill}" style="background:${theme.button.fill};border-radius:${FRIS.radius.button}px;mso-padding-alt:14px 24px;">
          <a class="fx-btn-label" href="${escapeHtml(opts.button.url)}" style="display:inline-block;padding:14px 24px;font-family:${FRIS.font.sans};font-size:15px;font-weight:600;line-height:1.2;color:${theme.button.onFill};text-decoration:none;border-radius:${FRIS.radius.button}px;">${escapeHtml(opts.button.label)}</a>
        </td></tr>
      </table>`
    : ''
  const afterButton = opts.afterButtonHtml
    ? `<div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>${opts.afterButtonHtml}`
    : ''

  return `<!doctype html>
<html lang="nl" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(opts.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Instrument+Serif&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
  a { text-decoration-thickness: 1px; text-underline-offset: 2px; }
  @media (max-width: 600px) {
    .fx-pad { padding-left:24px !important; padding-right:24px !important; }
    .fx-h1 { font-size:28px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .fx-page { background:${dark.page} !important; }
    .fx-card { background:${dark.card} !important; border-color:${dark.border} !important; }
    .fx-ink, .fx-h1 { color:${dark.ink} !important; }
    .fx-muted { color:${dark.muted} !important; }
    .fx-link { color:${theme.structure.textDark} !important; }
    .fx-quote { background:${dark.page} !important; }
    .fx-rule { border-color:${dark.border} !important; }
    .fx-brandname { color:${theme.custom ? theme.structure.textDark : dark.ink} !important; }
  }
  [data-ogsc] .fx-ink, [data-ogsc] .fx-h1 { color:${dark.ink} !important; }
  [data-ogsc] .fx-muted { color:${dark.muted} !important; }
  [data-ogsc] .fx-link { color:${theme.structure.textDark} !important; }
  [data-ogsb] .fx-page { background:${dark.page} !important; }
  [data-ogsb] .fx-card { background:${dark.card} !important; }
  [data-ogsb] .fx-quote { background:${dark.page} !important; }
</style>
</head>
<body class="fx-page" style="margin:0;padding:0;background:${light.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(opts.preheader ?? '')}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
  <table role="presentation" class="fx-page" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${light.page}" style="background:${light.page};">
    <tr><td align="center" style="padding:32px 12px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr><td style="padding:0 8px 16px;">${renderHeader(opts.brand, theme)}</td></tr>
        <tr><td>
          <table role="presentation" class="fx-card" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${light.card}" style="background:${light.card};border:1px solid ${light.border};border-radius:${FRIS.radius.card}px;border-collapse:separate;overflow:hidden;">
            <tr><td class="fx-pad" style="padding:36px 40px 36px;">
              <h1 class="fx-h1" style="margin:0 0 20px;font-family:${FRIS.font.display};font-weight:400;font-size:32px;line-height:1.15;letter-spacing:-0.01em;color:${light.ink};">${escapeHtml(opts.heading)}</h1>
              ${opts.bodyHtml}
              ${button}
              ${afterButton}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 8px 0;" align="center">
          ${opts.footerNote ? `<p class="fx-muted" style="margin:0 0 6px;font-family:${FRIS.font.sans};font-size:12px;line-height:1.5;color:${light.muted};">${escapeHtml(opts.footerNote)}</p>` : ''}
          ${opts.footerHtml ? `<p class="fx-muted" style="margin:0 0 6px;font-family:${FRIS.font.sans};font-size:12px;line-height:1.5;color:${light.muted};">${opts.footerHtml}</p>` : ''}
          <p class="fx-muted" style="margin:0;font-family:${FRIS.font.sans};font-size:12px;line-height:1.5;color:${light.muted};">Verstuurd via <a class="fx-muted" href="https://buuur.nl" style="color:${light.muted};text-decoration:underline;">buuur</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// Boven de kaart: het logo van het project als dat er is, anders de naam in de
// steunkleur, en zonder project het buuur-merkje.
function renderHeader(brand: EmailBrand | null | undefined, theme: EmailTheme): string {
  if (brand?.logoUrl) {
    return `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.name)}" height="40" style="display:block;height:40px;width:auto;max-width:200px;border:0;outline:none;">`
  }
  if (brand) {
    const color = theme.custom ? theme.structure.text : FRIS.light.ink
    return `<p class="fx-brandname" style="margin:0;font-family:${FRIS.font.display};font-size:22px;line-height:1.2;color:${color};">${escapeHtml(brand.name)}</p>`
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="24" height="24" align="center" bgcolor="${FRIS.mark}" style="width:24px;height:24px;background:${FRIS.mark};border-radius:5px;font-family:${FRIS.font.sans};font-size:16px;font-weight:700;line-height:24px;color:#FFFFFF;">b</td>
    <td class="fx-ink" style="padding-left:8px;font-family:${FRIS.font.sans};font-size:16px;font-weight:600;letter-spacing:-0.01em;color:${FRIS.light.ink};">buuur</td>
  </tr></table>`
}


// ── Huisstijl van een project ───────────────────────────────────────────────

/**
 * Naam, logo en steunkleuren van een project. Bewust app_accent_color en
 * app_structure_color, net als de ledenomgeving (ThemeContext): brand_*_color
 * vult de pagina-editor bij élk project. Lukt het lezen niet, dan null en
 * krijgt de mail het buuur-blauw.
 */
// deno-lint-ignore no-explicit-any
export async function loadProjectEmailBrand(admin: any, projectId: string | null | undefined): Promise<EmailBrand | null> {
  if (!projectId) return null
  try {
    const { data } = await admin
      .from('projects')
      .select('name, logo_url, app_accent_color, app_structure_color')
      .eq('id', projectId)
      .maybeSingle()
    if (!data) return null
    return {
      name: data.name,
      logoUrl: data.logo_url,
      accentColor: data.app_accent_color,
      structureColor: data.app_structure_color,
    }
  } catch (_e) {
    return null
  }
}
