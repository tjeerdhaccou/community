// ===== Tag definitions =====

// Touch-apparaten (mobiel/tablet): autoFocus op formuliervelden opent meteen het
// toetsenbord en duwt op een bottom-sheet de titel/keuzes uit beeld. Desktop houdt autoFocus.
export const isTouchDevice =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: none) and (pointer: coarse)').matches

export const POST_TAGS = ['Vraag', 'Idee', 'Sociaal', 'In de media', 'Even voorstellen']

// Theme-aware via CSS-tokens (zoals UPDATE_TAG_COLORS), zodat prikbord-tags
// meeschakelen met het thema — incl. het CrowdBuilding-palet.
export const POST_TAG_COLORS = {
  'Vraag':            { bg: 'var(--tag-blue-bg)',   color: 'var(--tag-blue-text)' },
  'Idee':             { bg: 'var(--tag-green-bg)',  color: 'var(--tag-green-text)' },
  'Sociaal':          { bg: 'var(--tag-orange-bg)', color: 'var(--tag-orange-text)' },
  'In de media':      { bg: 'var(--tag-pink-bg)',   color: 'var(--tag-pink-text)' },
  'Even voorstellen': { bg: 'var(--tag-purple-bg)', color: 'var(--tag-purple-text)' },
}

export const UPDATE_TAGS = ['Mijlpaal', 'Update', 'Besluit', 'Verslag']

export const UPDATE_TAG_COLORS = {
  'Mijlpaal': { bg: 'var(--tag-green-bg)', color: 'var(--tag-green-text)' },
  'Update': { bg: 'var(--tag-blue-bg)', color: 'var(--tag-blue-text)' },
  'Besluit': { bg: 'var(--tag-pink-bg)', color: 'var(--tag-pink-text)' },
  'Verslag': { bg: 'var(--tag-orange-bg)', color: 'var(--tag-orange-text)' },
}

// ===== Role definitions =====

export const ROLES = ['guest', 'professional', 'aspirant', 'member', 'moderator', 'admin']

export const ROLE_LABELS = {
  guest: 'Gast',
  professional: 'Adviseur',
  aspirant: 'Aspirant-lid',
  member: 'Lid',
  moderator: 'Moderator',
  admin: 'Admin',
}

export const ROLE_COLORS = {
  guest: '#9ba1b0',
  professional: '#C9A96E',
  aspirant: '#F4B400',
  member: '#4A90D9',
  moderator: '#F09020',
  admin: '#F23578',
}

// ===== Professional definitions =====

export const PROFESSIONAL_TYPES = [
  'architect', 'kostendeskundige', 'constructeur',
  'installatie_adviseur', 'notaris', 'anders'
]

export const PROFESSIONAL_LABELS = {
  architect: 'Architect',
  kostendeskundige: 'Kostendeskundige',
  constructeur: 'Constructeur',
  installatie_adviseur: 'Installatie-adviseur',
  notaris: 'Notaris',
  anders: 'Anders',
}

export const PROFESSIONAL_COLORS = {
  architect: '#4A90D9',
  kostendeskundige: '#F09020',
  constructeur: '#3BD269',
  installatie_adviseur: '#7B5EA7',
  notaris: '#F23578',
  anders: '#9ba1b0',
}

// ===== Funnel stage definitions =====

export const FUNNEL_STAGES = ['nieuw', 'orienterend', 'aspirant_koper', 'koper', 'bewoner']

export const FUNNEL_LABELS = {
  nieuw: 'Nieuw',
  orienterend: 'Oriënterend',
  aspirant_koper: 'Aspirant-koper',
  koper: 'Koper',
  bewoner: 'Bewoner',
}

export const FUNNEL_COLORS = {
  nieuw: '#9ba1b0',
  orienterend: '#4A90D9',
  aspirant_koper: '#F4B400',
  koper: '#F09020',
  bewoner: '#3BD269',
}

export const FUNNEL_ICONS = {
  nieuw: 'fa-solid fa-circle',
  orienterend: 'fa-solid fa-magnifying-glass',
  aspirant_koper: 'fa-solid fa-file-signature',
  koper: 'fa-solid fa-handshake',
  bewoner: 'fa-solid fa-house-chimney',
}

// ===== Reaction definitions =====

export const REACTIONS = [
  { key: 'heart', icon: 'fa-solid fa-heart', color: '#F23578', label: 'Mooi' },
  { key: 'thumbsup', icon: 'fa-solid fa-thumbs-up', color: '#4A90D9', label: 'Eens' },
  { key: 'lightbulb', icon: 'fa-solid fa-lightbulb', color: '#F4B400', label: 'Goed idee' },
  { key: 'question', icon: 'fa-solid fa-circle-question', color: '#F09020', label: 'Vraag' },
  { key: 'celebrate', icon: 'fa-solid fa-champagne-glasses', color: '#3BD269', label: 'Feest' },
]

export const REACTION_MAP = Object.fromEntries(
  REACTIONS.map(r => [r.key, r])
)

// ===== Notification definitions =====

export const NOTIFICATION_CONFIG = {
  comment:              { icon: 'fa-solid fa-comment',       color: '#4A90D9' },
  like:                 { icon: 'fa-solid fa-heart',         color: '#F23578' },
  reply:                { icon: 'fa-solid fa-reply',         color: '#4A90D9' },
  new_update:           { icon: 'fa-solid fa-bullhorn',      color: '#F4B400' },
  new_event:            { icon: 'fa-solid fa-calendar-check',color: '#F09020' },
  event_reminder:       { icon: 'fa-solid fa-bell',          color: '#F09020' },
  role_change:          { icon: 'fa-solid fa-user-tag',      color: '#3BD269' },
  membership_approved:  { icon: 'fa-solid fa-circle-check',  color: '#3BD269' },
  new_document:         { icon: 'fa-solid fa-folder-open',   color: '#7B5EA7' },
  document_request:     { icon: 'fa-solid fa-file-circle-question', color: '#2D8CFF' },
  document_request_submitted: { icon: 'fa-solid fa-file-circle-check', color: '#3BD269' },
}

// ===== Event types =====

export const EVENT_TYPES = [
  { key: 'kennismaking', label: 'Kennismaking', color: '#7B5EA7' },
  { key: 'alv', label: 'ALV', color: '#F23578' },
  { key: 'bouwvergadering', label: 'Bouwvergadering', color: '#F09020' },
  { key: 'workshop', label: 'Workshop', color: '#4A90D9' },
  { key: 'uitje', label: 'Uitje', color: '#3BD269' },
  { key: 'overig', label: 'Overig', color: '#9ba1b0' },
]

export const EVENT_TYPE_MAP = Object.fromEntries(
  EVENT_TYPES.map(t => [t.key, t])
)

export const EVENT_VISIBILITY = [
  { key: 'public', label: 'Iedereen', icon: 'fa-solid fa-globe' },
  { key: 'members', label: 'Alleen leden', icon: 'fa-solid fa-user-check' },
]

export const EVENT_VISIBILITY_MAP = Object.fromEntries(
  EVENT_VISIBILITY.map(v => [v.key, v])
)

// ===== Project phases =====

export const PROJECT_PHASES = [
  { key: 'SO', label: 'Structuur Ontwerp', short: 'SO' },
  { key: 'VO', label: 'Voorlopig Ontwerp', short: 'VO' },
  { key: 'DO', label: 'Definitief Ontwerp', short: 'DO' },
  { key: 'VERG', label: 'Vergunningsfase', short: 'Verg.' },
  { key: 'TO', label: 'Technisch Ontwerp', short: 'TO' },
  { key: 'BOUW', label: 'Bouw', short: 'Bouw' },
  { key: 'ALG', label: 'Algemeen', short: 'Alg.' },
]

export const PHASE_LABELS = Object.fromEntries(
  PROJECT_PHASES.map(p => [p.key, p.label])
)

// ===== File helpers =====

export function fileIcon(mimeType) {
  if (mimeType?.startsWith('image/')) return 'fa-solid fa-file-image'
  if (mimeType === 'application/pdf') return 'fa-solid fa-file-pdf'
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return 'fa-solid fa-file-excel'
  if (mimeType?.includes('word') || mimeType?.includes('document')) return 'fa-solid fa-file-word'
  if (mimeType?.includes('dwg') || mimeType?.includes('autocad')) return 'fa-solid fa-drafting-compass'
  return 'fa-solid fa-file'
}

export function fileIconColor(mimeType) {
  if (mimeType === 'application/pdf') return '#F23578'
  if (mimeType?.startsWith('image/')) return '#3BD269'
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return '#3BD269'
  if (mimeType?.includes('word') || mimeType?.includes('document')) return '#4A90D9'
  return '#9ba1b0'
}

// ===== Link helpers =====

const LINK_SERVICES = [
  { pattern: 'docs.google.com/document', icon: 'fa-solid fa-file-lines', color: '#4285F4', label: 'Google Docs' },
  { pattern: 'docs.google.com/spreadsheets', icon: 'fa-solid fa-table', color: '#0F9D58', label: 'Google Sheets' },
  { pattern: 'docs.google.com/presentation', icon: 'fa-solid fa-presentation-screen', color: '#F4B400', label: 'Google Slides' },
  { pattern: 'drive.google.com', icon: 'fa-brands fa-google-drive', color: '#4285F4', label: 'Google Drive' },
  { pattern: 'miro.com', icon: 'fa-solid fa-object-group', color: '#FFD02F', label: 'Miro' },
  { pattern: 'figma.com', icon: 'fa-brands fa-figma', color: '#A259FF', label: 'Figma' },
  { pattern: 'notion.so', icon: 'fa-solid fa-n', color: '#000000', label: 'Notion' },
  { pattern: 'dropbox.com', icon: 'fa-brands fa-dropbox', color: '#0061FF', label: 'Dropbox' },
  { pattern: 'onedrive.live.com', icon: 'fa-brands fa-microsoft', color: '#0078D4', label: 'OneDrive' },
  { pattern: 'sharepoint.com', icon: 'fa-brands fa-microsoft', color: '#0078D4', label: 'SharePoint' },
]

export function linkInfo(url) {
  if (!url) return { icon: 'fa-solid fa-link', color: '#4A90D9', label: 'Link' }
  const match = LINK_SERVICES.find(s => url.includes(s.pattern))
  return match || { icon: 'fa-solid fa-link', color: '#4A90D9', label: 'Link' }
}

export function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ===== Date helpers =====

export const HOUR_MS = 3_600_000

export const MONTHS_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
export const MONTHS_LONG  = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
export const DAYS_LONG    = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']

// ===== Helpers =====

export function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60) return 'Zojuist'
  if (diff < 3600) return `${Math.floor(diff / 60)} min geleden`
  if (diff < 86400) return `${Math.floor(diff / 3600)} uur geleden`
  if (diff < 604800) return `${Math.floor(diff / 86400)} dagen geleden`
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function timeAgoShort(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60) return 'Zojuist'
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)} uur`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

/**
 * Bepaalt of de "Aan de slag"-onboarding actief is voor een project.
 * Light-initiatieven (org kind=personal) staan standaard aan; pro-projecten
 * standaard uit. Een admin kan dit per project overschrijven via de
 * module-toggle (features.onboarding true/false).
 */
export function onboardingEnabled(features, isLight) {
  const f = features || {}
  if (f.onboarding === true) return true
  if (f.onboarding === false) return false
  return !!isLight
}

// Versie van privacyverklaring + algemene voorwaarden waarop leden akkoord geven (AVG).
// Verhoog dit als de voorwaarden materieel wijzigen -> leden geven opnieuw akkoord.
export const CONSENT_VERSION = '2026-06'
