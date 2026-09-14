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

/**
 * CSS-variabelen voor een merkkleur. Vervangt het blauw uit het functionele
 * palet (--accent-primary/--accent-blue/--clean-inbox) en de CTA-vulkleur.
 * Semantische kleuren (rood, groen, geel, notificatiebolletjes) blijven staan:
 * die betekenen iets en horen niet mee te kleuren.
 */
export function accentVars(hex, dark = false) {
  const a = deriveAccent(hex, dark)
  if (!a) return {}
  return {
    '--accent-cta': a.fill,
    '--accent-on-cta': a.onFill,
    '--accent-primary': a.text,
    '--accent-blue': a.text,
    '--accent-blue-rgb': a.rgb.join(', '),
    '--clean-inbox': a.text,
    '--border-focus': a.text,
  }
}

export const ACCENT_VAR_NAMES = Object.keys(accentVars('#000000'))
