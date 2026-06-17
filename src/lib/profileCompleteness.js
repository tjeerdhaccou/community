// Berekent hoe compleet een ledenprofiel is, voor de voortgangs-nudge op het
// dashboard en de ring op de profielpagina.
//
// De velden hieronder zijn bewust een mix van "verplicht bij binnenkomst"
// (naam + adres) en "fijn om te hebben" (foto, bio, woondroom). De
// profiel-guard dwingt alleen de essentiële velden af; deze helper moedigt
// de rest aan zonder te blokkeren.

const FIELDS = [
  { key: 'avatar_url', label: 'Profielfoto', check: p => !!p.avatar_url },
  { key: 'first_name', label: 'Voornaam', check: p => !!(p.first_name || p.full_name)?.trim?.() },
  { key: 'last_name', label: 'Achternaam', check: p => !!p.last_name?.trim?.() },
  { key: 'postal_code', label: 'Postcode', check: p => !!p.postal_code?.trim?.() },
  { key: 'house_number', label: 'Huisnummer', check: p => !!p.house_number?.trim?.() },
  { key: 'phone', label: 'Telefoonnummer', check: p => !!p.phone?.trim?.() },
  { key: 'bio', label: 'Korte introductie', check: p => !!p.bio?.trim?.() },
  { key: 'birth_year', label: 'Geboortejaar', check: p => !!p.birth_year },
  { key: 'household', label: 'Gezinssamenstelling', check: p => !!p.household?.trim?.() },
  { key: 'housing_dream', label: 'Woondroom', check: p => !!p.housing_dream?.trim?.() },
]

export function getProfileCompleteness(profile) {
  if (!profile) return { pct: 0, filled: 0, total: FIELDS.length, missing: [] }

  const missing = []
  let filled = 0
  for (const field of FIELDS) {
    if (field.check(profile)) filled++
    else missing.push({ key: field.key, label: field.label })
  }

  const pct = Math.round((filled / FIELDS.length) * 100)
  return { pct, filled, total: FIELDS.length, missing }
}
