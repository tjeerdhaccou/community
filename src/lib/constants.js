// ===== Tag definitions =====

export const POST_TAGS = ['Vraag', 'Idee', 'Sociaal', 'In de media', 'Even voorstellen']

export const POST_TAG_COLORS = {
  'Vraag': '#4A90D9',
  'Idee': '#3BD269',
  'Sociaal': '#F09020',
  'In de media': '#F23578',
  'Even voorstellen': '#7B5EA7',
}

export const UPDATE_TAGS = ['Mijlpaal', 'Update', 'Besluit', 'Verslag']

export const UPDATE_TAG_COLORS = {
  'Mijlpaal': { bg: '#3BD269', color: '#fff' },
  'Update': { bg: '#4A90D9', color: '#fff' },
  'Besluit': { bg: '#F23578', color: '#fff' },
  'Verslag': { bg: '#F09020', color: '#fff' },
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
  { key: 'public', label: 'Iedereen (ook gasten)', icon: 'fa-solid fa-globe' },
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
