/**
 * Groepsiconen voor de chat: een Font Awesome-icoon in een kleur uit het
 * palet, in plaats van een emoji. Opgeslagen in chat_threads.emoji als
 * "fa:<icoon>:<kleur>", zodat er geen migratie nodig is. Oude emoji-waarden
 * worden bij het tonen vertaald naar een passend icoon.
 */

export const GROUP_ICONS = [
  { key: 'comments', label: 'Algemeen' },
  { key: 'helmet-safety', label: 'Bouw' },
  { key: 'house-chimney', label: 'Wonen' },
  { key: 'ruler-combined', label: 'Architectuur' },
  { key: 'hammer', label: 'Klussen' },
  { key: 'seedling', label: 'Duurzaam' },
  { key: 'bolt', label: 'Energie' },
  { key: 'tree', label: 'Tuin' },
  { key: 'couch', label: 'Gemeenschapsruimte' },
  { key: 'euro-sign', label: 'Financiën' },
  { key: 'bicycle', label: 'Mobiliteit' },
  { key: 'child', label: 'Kinderen' },
  { key: 'paw', label: 'Huisdieren' },
  { key: 'utensils', label: 'Eten' },
  { key: 'champagne-glasses', label: 'Feest' },
  { key: 'music', label: 'Muziek' },
  { key: 'palette', label: 'Ontwerp' },
  { key: 'bullhorn', label: 'Aankondigingen' },
  { key: 'water', label: 'Water' },
  { key: 'lock', label: 'Besloten' },
]

export const GROUP_COLORS = [
  { key: 'blue', label: 'Blauw', css: 'var(--accent-blue)' },
  { key: 'orange', label: 'Oranje', css: 'var(--accent-orange)' },
  { key: 'green', label: 'Groen', css: 'var(--accent-green)' },
  { key: 'pink', label: 'Roze', css: 'var(--accent-pink)' },
  { key: 'purple', label: 'Paars', css: 'var(--accent-purple)' },
  { key: 'yellow', label: 'Geel', css: 'var(--accent-yellow)' },
  { key: 'teal', label: 'Teal', css: 'var(--nav-dossier, #2BAFA0)' },
  { key: 'red', label: 'Rood', css: 'var(--accent-red)' },
]

export const DEFAULT_GROUP_ICON = 'fa:comments:blue'

// Bestaande groepen hebben een emoji; die tonen we als het dichtstbijzijnde icoon.
const FROM_EMOJI = {
  '💬': ['comments', 'blue'],
  '🌱': ['seedling', 'green'],
  '💶': ['euro-sign', 'green'],
  '🏘️': ['house-chimney', 'orange'],
  '🏘': ['house-chimney', 'orange'],
  '🔨': ['hammer', 'orange'],
  '🚲': ['bicycle', 'teal'],
  '🧒': ['child', 'pink'],
  '🎉': ['champagne-glasses', 'pink'],
  '📐': ['ruler-combined', 'purple'],
  '⚡': ['bolt', 'yellow'],
  '🌳': ['tree', 'green'],
  '🍽️': ['utensils', 'orange'],
  '🍽': ['utensils', 'orange'],
  '🎨': ['palette', 'purple'],
  '📣': ['bullhorn', 'yellow'],
  '🔒': ['lock', 'blue'],
  '🏗️': ['helmet-safety', 'blue'],
  '🏗': ['helmet-safety', 'blue'],
  '🛋️': ['couch', 'orange'],
  '🛋': ['couch', 'orange'],
}

const ICON_KEYS = new Set(GROUP_ICONS.map((i) => i.key))
const COLOR_BY_KEY = Object.fromEntries(GROUP_COLORS.map((c) => [c.key, c]))

/** Waarde uit de database → { icon, color } of null als er niets bruikbaars in staat. */
export function parseGroupIcon(value) {
  if (!value) return null
  if (value.startsWith('fa:')) {
    const [, icon, color] = value.split(':')
    if (!ICON_KEYS.has(icon)) return null
    return { icon, color: COLOR_BY_KEY[color] ? color : 'blue' }
  }
  const mapped = FROM_EMOJI[value.trim()]
  if (mapped) return { icon: mapped[0], color: mapped[1] }
  return { icon: 'comments', color: 'blue' }
}

export function encodeGroupIcon(icon, color) {
  return `fa:${icon}:${color}`
}

export function groupColorCss(color) {
  return (COLOR_BY_KEY[color] || COLOR_BY_KEY.blue).css
}
