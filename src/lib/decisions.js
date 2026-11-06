// Labels en hulpfuncties voor de besluitvormingsmodule (voorkant).
// Alle beslislogica (quorum, meerderheid, deadlines, wie mag wat) staat in de
// database: supabase/migrations/112_decisions.sql. Hier alleen presentatie.

export const FORM_LABEL = {
  consent: 'Consentvoorstel',
  vote: 'Stemming',
  poll: 'Peiling',
  idea: 'Idee',
  mandate: 'Mandaatbesluit',
  meeting: 'Vergaderbesluit',
}

export const STATUS_LABEL = {
  draft: 'Concept',
  published: 'Loopt',
  closed: 'Gesloten',
  adopted: 'Vastgesteld',
  rejected: 'Verworpen',
  amended: 'Aangepast',
  no_quorum: 'Geen quorum',
  withdrawn: 'Ingetrokken',
  noted: 'Ter kennisname',
}

// Statuskleur via de bestaande tag-tokens (14%-tint, donkere tekst).
export const STATUS_TAG = {
  draft: { bg: 'var(--bg-hover)', color: 'var(--text-secondary)' },
  published: { bg: 'var(--tag-blue-bg)', color: 'var(--tag-blue-text)' },
  adopted: { bg: 'var(--tag-green-bg)', color: 'var(--tag-green-text)' },
  rejected: { bg: 'var(--tag-pink-bg)', color: 'var(--tag-pink-text)' },
  amended: { bg: 'var(--tag-orange-bg)', color: 'var(--tag-orange-text)' },
  no_quorum: { bg: 'var(--tag-orange-bg)', color: 'var(--tag-orange-text)' },
  withdrawn: { bg: 'var(--bg-hover)', color: 'var(--text-secondary)' },
  closed: { bg: 'var(--bg-hover)', color: 'var(--text-secondary)' },
  noted: { bg: 'var(--tag-purple-bg)', color: 'var(--tag-purple-text)' },
}

// Reactieopties per vorm, in weergavevolgorde.
export const CHOICES = {
  vote: [
    { key: 'for', label: 'Voor', icon: 'fa-solid fa-thumbs-up' },
    { key: 'against', label: 'Tegen', icon: 'fa-solid fa-thumbs-down' },
    { key: 'abstain', label: 'Onthouding', icon: 'fa-solid fa-minus' },
  ],
  consent: [
    { key: 'agree', label: 'Akkoord', icon: 'fa-solid fa-check' },
    { key: 'accept', label: 'Kan ermee leven', icon: 'fa-solid fa-hand' },
    { key: 'objection', label: 'Bezwaar', icon: 'fa-solid fa-circle-exclamation' },
  ],
}

export const CHOICE_LABEL = Object.fromEntries(
  [...CHOICES.vote, ...CHOICES.consent].map(c => [c.key, c.label]),
)

export const FORM_HELP = {
  consent: 'Aangenomen als niemand een overwegend bezwaar heeft. Kies "kan ermee leven" als het niet je voorkeur is maar je het niet wilt tegenhouden.',
  vote: 'Kies voor, tegen of onthouding. Onthoudingen tellen mee voor het quorum, niet voor de meerderheid.',
}

/** "nog 3 dagen" / "nog 5 uur" / "verlopen" */
export function timeLeft(deadline, now = Date.now()) {
  if (!deadline) return ''
  const ms = new Date(deadline).getTime() - now
  if (ms <= 0) return 'verlopen'
  const hours = Math.floor(ms / 3_600_000)
  if (hours < 1) return 'nog minder dan een uur'
  if (hours < 48) return `nog ${hours} uur`
  return `nog ${Math.floor(hours / 24)} dagen`
}

export function formatDeadline(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  })
}

export function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Breuk als leesbare tekst: 2/3 → "twee derde". */
export function fractionText(num, den) {
  const known = { '1/2': 'de helft', '3/5': 'drie vijfde', '2/3': 'twee derde', '3/4': 'drie kwart', '1/1': 'iedereen' }
  return known[`${num}/${den}`] || `${num}/${den}`
}

/** Mag deze gebruiker namens een groep voorstellen inbrengen? (UI-hint; de DB beslist.) */
export function submitGroupsFor(allWorkgroups, myWorkgroupIds, isModerator) {
  return (allWorkgroups || []).filter(w =>
    (w.type === 'commissie' || w.is_board) && (isModerator || myWorkgroupIds?.has?.(w.id) || myWorkgroupIds?.includes?.(w.id)),
  )
}

/**
 * Foutmelding voor de gebruiker. De besluit-RPC's geven zelf al Nederlandse
 * meldingen (bv. "De reactietermijn is verlopen"); die tonen we letterlijk.
 * Overige fouten via friendlyError.
 */
export function decisionError(err, friendlyError) {
  if (err && (err.code === 'P0001' || err.code === '42501') && err.message && !err.message.includes('row-level security')) {
    return err.message
  }
  return friendlyError(err)
}
