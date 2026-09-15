#!/usr/bin/env node
/**
 * Weigert hardgecodeerde kleuren op plekken waar ze een thema of de
 * projectbranding niet kunnen volgen. Draait als prebuild, want dat is het
 * enige dat bij elke push langskomt — deze repo heeft geen CI.
 *
 * Twee patronen, allebei echt voorgekomen:
 *
 *   1. Een hex in een inline style-attribuut:
 *        style={{ color: '#4A90D9' }}
 *      Kan geen dark mode of merkkleur volgen. Gebruik een token
 *      (var(--accent-primary)) of een helper (navColor, tagStyle).
 *
 *   2. Alpha aan een kleur plakken met string-concat:
 *        style={{ background: `${color}14`, color }}
 *      Zelfde probleem, en het maakt van een token stilzwijgend onzin.
 *      Gebruik tagStyle(color) — die geeft een var() met fallback terug.
 *
 * Kleurkaarten (ROLE_COLORS, FUNNEL_COLORS, …) mogen hex blijven: die worden
 * via helpers geconsumeerd die er een var()-fallback omheen zetten. En een hex
 * als fallback ín een var() — var(--accent-orange, #F5A623) — is juist het
 * gewenste patroon en telt dus niet mee.
 *
 * Ontsnappingsluik: zet `allow-hex` in een commentaar op dezelfde regel.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')
const HEX = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/
/** var(--token, #fallback) is juist het goede patroon — die hex telt niet. */
const stripVarFallbacks = (s) => s.replace(/var\(\s*--[^)]*?\)/g, 'var(--x)')
const ALPHA_CONCAT = /`\$\{[^}]+\}[0-9a-fA-F]{2}`/

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

/** Posities van `style={{ … }}`-blokken, met bijpassende accolades. */
function styleBlocks(text) {
  const blocks = []
  const re = /style=\{\{/g
  let m
  while ((m = re.exec(text))) {
    let depth = 2
    let i = m.index + m[0].length
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth++
      else if (text[i] === '}') depth--
      i++
    }
    blocks.push([m.index, i])
  }
  return blocks
}

const lineOf = (text, idx) => text.slice(0, idx).split('\n').length
const lineText = (text, line) => text.split('\n')[line - 1] ?? ''

const problems = []
for (const file of walk(SRC)) {
  if (!/\.(jsx?|tsx?)$/.test(file)) continue
  const text = readFileSync(file, 'utf8')
  const rel = relative(ROOT, file)

  for (const [start, end] of styleBlocks(text)) {
    const block = stripVarFallbacks(text.slice(start, end))
    const hit = block.match(HEX)
    if (!hit) continue
    const first = lineOf(text, start)
    const last = lineOf(text, end)
    // allow-hex mag op de regel ervoor of ergens in het blok staan.
    const lines = text.split('\n').slice(Math.max(0, first - 2), last)
    if (lines.some((l) => l.includes('allow-hex'))) continue
    const line = first + block.slice(0, hit.index).split('\n').length - 1
    problems.push({ rel, line, hit: hit[0], why: 'hex in inline style — gebruik een token of helper' })
  }

  let m
  const re = new RegExp(ALPHA_CONCAT, 'g')
  while ((m = re.exec(text))) {
    const line = lineOf(text, m.index)
    if (lineText(text, line).includes('allow-hex')) continue
    problems.push({ rel, line, hit: m[0], why: 'alpha aan een kleur geplakt — gebruik tagStyle()' })
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} hardgecodeerde kleur(en) gevonden:\n`)
  for (const p of problems) console.error(`  ${p.rel}:${p.line}  ${p.hit}\n      ${p.why}`)
  console.error('\n  Bewust? Zet `allow-hex` in een commentaar op die regel.\n')
  process.exit(1)
}
console.log('✓ geen hardgecodeerde kleuren in inline styles')
