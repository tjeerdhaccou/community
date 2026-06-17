// Catalogus van profielvelden die via een org-intakeformulier uitgevraagd
// kunnen worden. Het CMS toont deze als keuzemenu; de community-app rendert
// de geselecteerde velden in het lid-formulier.
//
// LET OP: dezelfde lijst staat (in TypeScript) in buuur-admin als
// src/lib/intake-fields.ts. Houd ze in sync.
//
// Per veld:
//   key     — stabiele sleutel (opgeslagen in templates/requests)
//   label   — Nederlands label
//   type    — text | textarea | number | date | select | boolean | housing_top3
//   target  — 'profiles' (standaard) of 'memberships'
//   column  — kolomnaam in de doel-tabel
//   group   — groepslabel voor de UI
//   options — alleen voor select

export const INTAKE_FIELD_GROUPS = [
  'Persoonlijk', 'Adres', 'Huishouden', 'Wonen', 'Werk & inkomen', 'Motivatie', 'Noodcontact',
]

export const INTAKE_FIELDS = [
  // Persoonlijk
  { key: 'first_name', label: 'Voornaam', type: 'text', column: 'first_name', group: 'Persoonlijk' },
  { key: 'last_name', label: 'Achternaam', type: 'text', column: 'last_name', group: 'Persoonlijk' },
  { key: 'date_of_birth', label: 'Geboortedatum', type: 'date', column: 'date_of_birth', group: 'Persoonlijk' },
  { key: 'gender', label: 'Geslacht', type: 'select', column: 'gender', group: 'Persoonlijk',
    options: ['Man', 'Vrouw', 'Anders', 'Zeg ik liever niet'] },
  { key: 'phone', label: 'Telefoonnummer', type: 'text', column: 'phone', group: 'Persoonlijk' },

  // Adres
  { key: 'postal_code', label: 'Postcode', type: 'text', column: 'postal_code', group: 'Adres' },
  { key: 'house_number', label: 'Huisnummer', type: 'text', column: 'house_number', group: 'Adres' },
  { key: 'street_address', label: 'Straat', type: 'text', column: 'street_address', group: 'Adres' },
  { key: 'city', label: 'Plaats', type: 'text', column: 'city', group: 'Adres' },

  // Huishouden
  { key: 'household', label: 'Huishoudsamenstelling', type: 'text', column: 'household', group: 'Huishouden' },
  { key: 'partner_name', label: 'Naam partner', type: 'text', column: 'partner_name', group: 'Huishouden' },
  { key: 'num_children', label: 'Aantal kinderen', type: 'number', column: 'num_children', group: 'Huishouden' },
  { key: 'children_ages', label: 'Leeftijden kinderen', type: 'text', column: 'children_ages', group: 'Huishouden' },

  // Wonen
  { key: 'housing_top3', label: 'Woningvoorkeur (top 3)', type: 'housing_top3', target: 'memberships', column: 'housing_preferences', group: 'Wonen' },
  { key: 'current_housing_type', label: 'Huidige woonsituatie', type: 'select', column: 'current_housing_type', group: 'Wonen',
    options: ['Huur', 'Koop', 'Anders'] },
  { key: 'housing_preference', label: 'Woonvoorkeur', type: 'select', column: 'housing_preference', group: 'Wonen',
    options: ['Koop', 'Huur', 'Flexibel'] },
  { key: 'max_budget', label: 'Budget', type: 'text', column: 'max_budget', group: 'Wonen' },
  { key: 'desired_rooms', label: 'Gewenst aantal kamers', type: 'number', column: 'desired_rooms', group: 'Wonen' },
  { key: 'desired_area_m2', label: 'Gewenst oppervlak (m²)', type: 'number', column: 'desired_area_m2', group: 'Wonen' },
  { key: 'parking_needed', label: 'Parkeerplaats nodig', type: 'boolean', column: 'parking_needed', group: 'Wonen' },
  { key: 'accessibility_needs', label: 'Toegankelijkheidswensen', type: 'textarea', column: 'accessibility_needs', group: 'Wonen' },
  { key: 'housing_dream', label: 'Woondroom', type: 'textarea', column: 'housing_dream', group: 'Wonen' },

  // Werk & inkomen
  { key: 'occupation', label: 'Beroep', type: 'text', column: 'occupation', group: 'Werk & inkomen' },
  { key: 'employer', label: 'Werkgever', type: 'text', column: 'employer', group: 'Werk & inkomen' },
  { key: 'income_indication', label: 'Inkomensindicatie', type: 'text', column: 'income_indication', group: 'Werk & inkomen' },
  { key: 'partner_occupation', label: 'Beroep partner', type: 'text', column: 'partner_occupation', group: 'Werk & inkomen' },

  // Motivatie
  { key: 'motivation', label: 'Motivatie', type: 'textarea', column: 'motivation', group: 'Motivatie' },
  { key: 'skills', label: 'Wat breng je mee?', type: 'textarea', column: 'skills', group: 'Motivatie' },
  { key: 'availability', label: 'Beschikbaarheid', type: 'text', column: 'availability', group: 'Motivatie' },

  // Noodcontact
  { key: 'emergency_contact_name', label: 'Naam noodcontact', type: 'text', column: 'emergency_contact_name', group: 'Noodcontact' },
  { key: 'emergency_contact_phone', label: 'Telefoon noodcontact', type: 'text', column: 'emergency_contact_phone', group: 'Noodcontact' },
]

const BY_KEY = Object.fromEntries(INTAKE_FIELDS.map(f => [f.key, f]))

export function getIntakeField(key) {
  return BY_KEY[key] || null
}

// Sleutels → veld-objecten, in catalogus-volgorde, onbekende sleutels weggefilterd.
export function resolveIntakeFields(keys) {
  if (!Array.isArray(keys)) return []
  const set = new Set(keys)
  return INTAKE_FIELDS.filter(f => set.has(f.key))
}
