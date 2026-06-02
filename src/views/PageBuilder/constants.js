export const SECTION_TYPES = [
  { value: 'text-image-left', label: 'Tekst links, beeld rechts', icon: 'fa-solid fa-table-columns' },
  { value: 'text-image-right', label: 'Tekst rechts, beeld links', icon: 'fa-solid fa-table-columns' },
  { value: 'text-only', label: 'Alleen tekst', icon: 'fa-solid fa-align-left' },
  { value: 'image-full', label: 'Volledig beeld', icon: 'fa-solid fa-image' },
  { value: 'image-carousel', label: 'Beeldcarousel', icon: 'fa-solid fa-images' },
  { value: 'cards', label: 'Kaarten in kolommen', icon: 'fa-solid fa-table-cells-large' },
  { value: 'members', label: 'Leden showcase', icon: 'fa-solid fa-users' },
  { value: 'agenda', label: 'Volgend evenement', icon: 'fa-solid fa-calendar-check' },
  { value: 'updates', label: 'Laatste updates', icon: 'fa-solid fa-newspaper' },
  { value: 'footer', label: 'Footerblok', icon: 'fa-solid fa-grip-lines' },
]

export const FONT_THEMES = [
  { value: 'clean', label: 'Clean', heading: 'Inter', body: 'Inter' },
  { value: 'editorial', label: 'Editorial', heading: 'Playfair Display', body: 'Source Sans 3' },
  { value: 'modern', label: 'Modern', heading: 'Space Grotesk', body: 'DM Sans' },
  { value: 'warm', label: 'Warm', heading: 'Lora', body: 'Nunito' },
  { value: 'bold', label: 'Bold', heading: 'Ubuntu', body: 'Kreon' },
]

export const COLOR_THEMES = {
  clean:     { label: 'Clean',    primary: '#3B82F6', secondary: '#64748B', accent: '#EF4444', muted: '#E2E8F0', background: '#FAFBFC', text: '#0F172A' },
  designer:  { label: 'Designer', primary: '#F43F5E', secondary: '#0857D0', accent: '#18B34D', highlight: '#FED348', muted: '#FEF3D6', background: '#FEFCFB', text: '#1A1A2E' },
  botanical: { label: 'Botanical',primary: '#126842', secondary: '#5CA484', accent: '#F48B9A', muted: '#CFB177', background: '#F5F3EE', text: '#0E2E1E' },
  classic:   { label: 'Classic',  primary: '#1E3A5F', secondary: '#B8860B', accent: '#8B2252', muted: '#E8E4DD', background: '#FAF8F5', text: '#1A1A1A' },
  sunrise:   { label: 'Sunrise',  primary: '#E35B23', secondary: '#FE8340', accent: '#A2DDFD', muted: '#FED348', background: '#FFF8ED', text: '#3D1F0A' },
  terra:     { label: 'Terra',    primary: '#C2623B', secondary: '#8B7355', accent: '#7A8B4A', muted: '#E8DDD0', background: '#F9F5F0', text: '#3B2E25' },
}

// Swatches for block bg picker: all theme colors excluding 'text' + white
export function getThemeSwatches(themeKey) {
  const theme = COLOR_THEMES[themeKey] || COLOR_THEMES.clean
  return [
    { key: 'white', color: '#ffffff', label: 'Wit' },
    ...Object.entries(theme)
      .filter(([k]) => k !== 'label' && k !== 'text')
      .map(([key, color]) => ({ key, color, label: key.charAt(0).toUpperCase() + key.slice(1) })),
  ]
}

export function tempId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// DB-defaults voor NOT-NULL kolommen op public_sections.
// Wanneer secties uit DB/localStorage/templates komen, kunnen ze sommige van
// deze velden missen of op null hebben staan. PG's DEFAULT-clause werkt alleen
// als de kolom uit de INSERT/UPDATE wordt weggelaten — niet als je expliciet
// null meestuurt. Daarom dwingen we hier veilige waarden af.
export const SECTION_NOT_NULL_DEFAULTS = {
  card_columns: 3,
  text_color: 'dark',
  text_align: 'left',
  text_size: 'normal',
  images: [],
}

// Vult ontbrekende of null-waarde keys met defaults, zonder bestaande waarden
// te overschrijven.
export function withSectionDefaults(section) {
  if (!section) return section
  const out = { ...section }
  for (const [k, v] of Object.entries(SECTION_NOT_NULL_DEFAULTS)) {
    if (out[k] === null || out[k] === undefined) out[k] = v
  }
  return out
}
