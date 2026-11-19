// Gevoelige stukken: financieel en identiteit (zie migratie 128).
//
// Buuur bewaart uitkomsten, geen identiteitsbewijzen. Een identiteitsbewijs
// wordt nooit geüpload: de beoordelaar laat het tonen en legt alleen de
// uitkomst vast. Financiële stukken zijn alleen zichtbaar voor beoordelaars
// van het project, worden alleen bekeken via een link van hooguit 60 seconden
// en verdwijnen automatisch na de bewaartermijn.

export const SENSITIVE_CATEGORIES = ['financieel', 'identiteit']

/** Hoe lang een link naar een gevoelig stuk geldig is, in seconden. */
export const SENSITIVE_URL_SECONDS = 60

/** Standaard en maximale bewaartermijn van een financieel stuk, in dagen. */
export const DEFAULT_RETENTION_DAYS = 30

export const IDENTITY_DOCUMENT_TYPES = [
  { value: 'paspoort', label: 'Paspoort' },
  { value: 'id_kaart', label: 'Identiteitskaart' },
  { value: 'rijbewijs', label: 'Rijbewijs' },
]

export function isSensitiveCategory(category) {
  return SENSITIVE_CATEGORIES.includes(category)
}

/** Identiteitscontrole, of een oud uploadverzoek met categorie identiteit. */
export function isIdentityRequest(request) {
  return request?.type === 'identity_check' || request?.category === 'identiteit'
}

export function isSensitiveRequest(request) {
  return isIdentityRequest(request) || isSensitiveCategory(request?.category)
}

export function identityDocumentLabel(value) {
  return IDENTITY_DOCUMENT_TYPES.find(t => t.value === value)?.label || value || ''
}

export function formatDateNl(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function retentionDays(project) {
  const days = Number(project?.sensitive_retention_days)
  return days >= 1 && days <= DEFAULT_RETENTION_DAYS ? days : DEFAULT_RETENTION_DAYS
}
