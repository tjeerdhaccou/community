/**
 * Steunkleur per project → contrastveilige CSS-variabelen.
 *
 * Een projectkleur mag nooit rauw op de plek van het functionele palet worden
 * gezet. De coral van Negen Kavels (#FC8151) haalt met wit maar 2.50:1 en als
 * linktekst op wit net zo weinig — onleesbaar. Daarom leiden we uit één
 * gekozen kleur drie waarden af:
 *
 *   fill    de kleur zelf, voor gevulde vlakken (knop, FAB, actieve pill)
 *   onFill  zwart of wit erop, welke van de twee het meeste contrast geeft
 *   text    dezelfde kleur, donkerder (licht thema) of lichter (donker thema)
 *           gemaakt tot hij 4.5:1 haalt tegen het oppervlak — voor links,
 *           iconen en focusranden
 *
 * Dit is precies waarom merkkleuren er eerder zijn uitgehaald (zie de notitie
 * in ThemeContext.jsx): ze gingen rauw op <html> in zowel licht als donker.
 * Met een afgeleide per thema kan het wel.
 */

const AA_NORMAL = 4.5

// Tekstkleur op een gevuld vlak: de twee uit het designsysteem, niet zomaar
// #000 — zo blijft een gevulde knop bij de rest van de UI horen.
const ON_FILL_DARK = '#1A1A2E'
const ON_FILL_LIGHT = '#FFFFFF'

// Oppervlak waartegen links en iconen gelezen worden (--bg-surface per thema).
const SURFACE_LIGHT = '#FFFFFF'
const SURFACE_DARK = '#2C2C2E'

export function parseHex(hex) {
  if (typeof hex !== 'string') return null
  const m = hex.trim().replace(/^#/, '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
}

function toHex(rgb) {
  return '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

/**
 * Maak de kleur stap voor stap donkerder (licht thema) of lichter (donker
 * thema) tot hij leesbaar is tegen het oppervlak. Haalt hij het ook in het
 * uiterste niet, dan is dat uiterste nog altijd de best mogelijke uitkomst.
 */
function readableOn(rgb, surface, dark) {
  for (let step = 0; step <= 100; step++) {
    const t = step / 100
    const candidate = dark
      ? rgb.map((v) => v + (255 - v) * t)
      : rgb.map((v) => v * (1 - t))
    if (contrastRatio(candidate, surface) >= AA_NORMAL) return candidate
  }
  return dark ? [255, 255, 255] : [0, 0, 0]
}

/**
 * Alle afgeleiden van één merkkleur. Geeft null terug bij een lege of ongeldige
 * waarde, zodat de aanroeper simpelweg niets toepast en het functionele palet
 * intact blijft.
 */
export function deriveAccent(hex, dark = false) {
  const rgb = parseHex(hex)
  if (!rgb) return null

  const surface = parseHex(dark ? SURFACE_DARK : SURFACE_LIGHT)
  const onDark = parseHex(ON_FILL_DARK)
  const onLight = parseHex(ON_FILL_LIGHT)

  const onFill = contrastRatio(rgb, onDark) >= contrastRatio(rgb, onLight) ? ON_FILL_DARK : ON_FILL_LIGHT
  const text = toHex(readableOn(rgb, surface, dark))

  return {
    fill: toHex(rgb),
    onFill,
    text,
    rgb,
    contrastOnFill: contrastRatio(rgb, parseHex(onFill)),
    contrastText: contrastRatio(parseHex(text), surface),
  }
}


function mix(rgb, surface, alpha) {
  return rgb.map((v, i) => v * alpha + surface[i] * (1 - alpha))
}

/**
 * Fase-schaal: vijf tinten van de structuurkleur, van licht (Nieuw) naar vol
 * (Bewoner). Per stap wordt de tekstkleur gekozen op contrast tegen de
 * werkelijke, gemengde achtergrond — een lichte tint krijgt de leesbare
 * structuurvariant, een volle tint de kleur-op-vlak.
 */
function scaleVars(str, dark) {
  const surface = parseHex(dark ? SURFACE_DARK : SURFACE_LIGHT)
  const out = {}
  ;[0.10, 0.22, 0.36, 0.55, 0.85].forEach((alpha, i) => {
    const n = i + 1
    const blended = mix(str.rgb, surface, alpha)
    const textRgb = parseHex(str.text)
    const onFillRgb = parseHex(str.onFill)
    const text = contrastRatio(textRgb, blended) >= AA_NORMAL ? str.text
      : contrastRatio(onFillRgb, blended) >= contrastRatio(textRgb, blended) ? str.onFill : str.text
    out[`--scale-${n}-bg`] = `rgba(${str.rgb.join(', ')}, ${alpha})`
    out[`--scale-${n}-text`] = text
  })
  return out
}

/**
 * CSS-variabelen voor de merkkleuren van een project.
 *
 * Twee rollen, want zo werkt een huisstijl meestal: Negen Kavels heeft groen
 * voor structuur en coral voor de knop. Het CrowdBuilding-thema splitst intern
 * hetzelfde (navy structuur, coral CTA).
 *
 *   accent     knoppen en call-to-actions
 *   structure  vlakken, labels, iconen, links, actieve elementen
 *
 * Ontbreekt er één, dan neemt hij de andere over. Zijn ze allebei leeg, dan
 * wordt er niets gezet en blijft het functionele palet intact.
 *
 * Semantische kleuren (rood, groen, geel, notificatiebolletjes) blijven altijd
 * ongemoeid: die betekenen iets en horen niet mee te kleuren.
 */
export function accentVars({ accent, structure } = {}, dark = false) {
  const cta = deriveAccent(accent || structure, dark)
  const str = deriveAccent(structure || accent, dark)
  if (!cta && !str) return {}

  return {
    // Knoppen en CTA's
    '--accent-cta': cta.fill,
    '--accent-on-cta': cta.onFill,
    // Vlakken krijgen de merkkleur zelf, niet de tekstvariant — anders staat er
    // een bruinige tint naast je knop in plaats van je eigen kleur.
    '--accent-fill': str.fill,
    '--accent-on-fill': str.onFill,
    // Tekst, links en iconen: de op contrast afgestemde variant.
    '--accent-primary': str.text,
    '--accent-blue': str.text,
    '--accent-blue-rgb': str.rgb.join(', '),
    '--clean-inbox': str.text,
    // Labels en tags (rol, type, categorie): één tint van de structuurkleur.
    // Betekenis zit dan in het icoon of de tekst, niet in een eigen kleur.
    '--tag-brand-bg': `rgba(${str.rgb.join(', ')}, 0.14)`,
    '--tag-brand-text': str.text,
    // Fase-badges: tintschaal Nieuw → Bewoner
    ...scaleVars(str, dark),
    // Nav-iconen volgen de structuurkleur, niet de actiekleur: iconen zijn
    // navigatie-meubilair en de actiekleur moet schaars blijven zodat de knop
    // die ertoe doet opvalt.
    '--nav-icon-brand': str.text,
    '--border-focus': str.text,
  }
}

export const ACCENT_VAR_NAMES = Object.keys(accentVars({ accent: '#000000' }))
