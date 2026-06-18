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
//   help    — korte uitleg onder het veld (optioneel)
//   options — alleen voor select; { value, label } waarbij value de canonieke
//             slug is die in de database wordt opgeslagen (NIET het label).

export const INTAKE_FIELD_GROUPS = [
  'Persoonlijk', 'Adres', 'Huishouden', 'Wonen', 'Motivatie', 'Noodcontact',
]

// Gedeelde optielijsten (canonieke slugs). Hergebruikt voor o.a. geslacht +
// geslacht partner, zodat ze niet uit elkaar kunnen lopen.
const GENDER_OPTIONS = [
  { value: 'man', label: 'Man' },
  { value: 'vrouw', label: 'Vrouw' },
  { value: 'anders', label: 'Anders' },
  { value: 'zeg-ik-liever-niet', label: 'Zeg ik liever niet' },
]

export const INTAKE_FIELDS = [
  // Persoonlijk
  { key: 'first_name', label: 'Voornaam', type: 'text', column: 'first_name', group: 'Persoonlijk' },
  { key: 'last_name', label: 'Achternaam', type: 'text', column: 'last_name', group: 'Persoonlijk' },
  { key: 'date_of_birth', label: 'Geboortedatum', type: 'date', column: 'date_of_birth', group: 'Persoonlijk',
    help: 'We gebruiken je leeftijd alleen om de samenstelling van de groep beter te begrijpen.' },
  { key: 'gender', label: 'Geslacht', type: 'select', column: 'gender', group: 'Persoonlijk',
    help: 'Optioneel — kies wat het beste bij je past.', options: GENDER_OPTIONS },
  { key: 'phone', label: 'Telefoonnummer', type: 'text', column: 'phone', group: 'Persoonlijk',
    help: 'Zodat de initiatiefnemers je kunnen bereiken.' },

  // Adres
  { key: 'postal_code', label: 'Postcode', type: 'text', column: 'postal_code', group: 'Adres' },
  { key: 'house_number', label: 'Huisnummer', type: 'text', column: 'house_number', group: 'Adres' },
  { key: 'street_address', label: 'Straat', type: 'text', column: 'street_address', group: 'Adres' },
  { key: 'city', label: 'Plaats', type: 'text', column: 'city', group: 'Adres' },

  // Huishouden
  { key: 'household', label: 'Huishoudsamenstelling', type: 'select', column: 'household', group: 'Huishouden',
    help: 'Met wie woon je (samen)? Kies wat het dichtst in de buurt komt.',
    options: [
      { value: 'alleenstaand', label: 'Alleenstaand' },
      { value: 'stel', label: 'Stel' },
      { value: 'gezin', label: 'Gezin' },
      { value: 'eenoudergezin', label: 'Eenoudergezin' },
      { value: 'samenwonend', label: 'Samenwonend' },
      { value: 'anders', label: 'Anders' },
    ] },
  { key: 'partner_name', label: 'Naam partner', type: 'text', column: 'partner_name', group: 'Huishouden',
    help: 'Vul in als je samen met een partner instapt.' },
  { key: 'partner_gender', label: 'Geslacht partner', type: 'select', column: 'partner_gender', group: 'Huishouden',
    help: 'Optioneel.', options: GENDER_OPTIONS },
  { key: 'num_children', label: 'Aantal kinderen', type: 'number', column: 'num_children', group: 'Huishouden',
    help: 'Aantal thuiswonende kinderen.' },
  { key: 'children_ages', label: 'Leeftijden kinderen', type: 'text', column: 'children_ages', group: 'Huishouden',
    help: 'Bijvoorbeeld: 3, 7, 12.' },

  // Wonen
  { key: 'housing_top3', label: 'Woningvoorkeur (top 3)', type: 'housing_top3', target: 'memberships', column: 'housing_preferences', group: 'Wonen',
    help: 'Zet je drie favoriete woningtypes op volgorde van voorkeur.' },
  { key: 'current_housing_type', label: 'Huidige woonsituatie', type: 'select', column: 'current_housing_type', group: 'Wonen',
    help: 'Hoe woon je op dit moment?',
    options: [
      { value: 'huur-sociaal', label: 'Sociale huur' },
      { value: 'huur-midden', label: 'Middenhuur' },
      { value: 'huur-vrij', label: 'Vrije sector huur' },
      { value: 'koop', label: 'Koopwoning' },
      { value: 'inwonend', label: 'Inwonend' },
      { value: 'anders', label: 'Anders' },
    ] },
  { key: 'housing_preference', label: 'Woonvoorkeur', type: 'select', column: 'housing_preference', group: 'Wonen',
    help: 'Wat heeft je voorkeur in het nieuwe project?',
    options: [
      { value: 'koop', label: 'Koop' },
      { value: 'huur', label: 'Huur' },
      { value: 'flexibel', label: 'Flexibel' },
    ] },
  { key: 'max_budget', label: 'Budget', type: 'text', column: 'max_budget', group: 'Wonen',
    help: 'Een indicatie helpt bij het matchen. Bijv. €1.200/maand of €350.000 koop.' },
  { key: 'desired_rooms', label: 'Gewenst aantal kamers', type: 'number', column: 'desired_rooms', group: 'Wonen' },
  { key: 'desired_area_m2', label: 'Gewenst oppervlak (m²)', type: 'number', column: 'desired_area_m2', group: 'Wonen' },
  { key: 'parking_needed', label: 'Parkeerplaats nodig', type: 'boolean', column: 'parking_needed', group: 'Wonen' },
  { key: 'accessibility_needs', label: 'Toegankelijkheidswensen', type: 'textarea', column: 'accessibility_needs', group: 'Wonen',
    help: 'Bijv. gelijkvloers, rolstoeltoegankelijk of geen drempels.' },
  { key: 'housing_dream', label: 'Woondroom', type: 'textarea', column: 'housing_dream', group: 'Wonen',
    help: 'Beschrijf in een paar zinnen hoe jij ideaal zou willen wonen.' },


  // Motivatie
  { key: 'motivation', label: 'Motivatie', type: 'textarea', column: 'motivation', group: 'Motivatie',
    help: 'Waarom wil je graag deelnemen aan dit project?' },
  { key: 'skills', label: 'Wat breng je mee?', type: 'textarea', column: 'skills', group: 'Motivatie',
    help: 'Welke kennis, vaardigheden of tijd breng je mee voor de groep?' },
  { key: 'availability', label: 'Beschikbaarheid', type: 'text', column: 'availability', group: 'Motivatie',
    help: 'Hoeveel tijd kun je ongeveer bijdragen? Bijv. een avond per week.' },

  // Noodcontact
  { key: 'emergency_contact_name', label: 'Naam noodcontact', type: 'text', column: 'emergency_contact_name', group: 'Noodcontact',
    help: 'Wie mogen we bellen in geval van nood?' },
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

// Canonieke value → leesbaar label voor een select-veld. Valt terug op de
// opgeslagen waarde als die niet (meer) in de optielijst staat.
export function optionLabel(field, value) {
  if (!field || value == null || value === '') return ''
  const opt = (field.options || []).find(o => o.value === value)
  return opt ? opt.label : value
}

// Idem, maar op basis van veld-sleutel. Handig voor weergave van profielwaarden.
export function labelForValue(key, value) {
  return optionLabel(getIntakeField(key), value)
}
