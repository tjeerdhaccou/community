// Google Fonts on-demand laden. Aangeroepen vanuit views die specifieke
// web fonts nodig hebben (Landing, PublicProject). Voorkomt dat dashboard-
// bezoekers van project-subdomeinen Google Fonts requests doen die ze niet
// gebruiken.
//
// Idempotent: meervoudige aanroepen voor dezelfde family voegen maar één
// <link> aan de <head> toe.

const loaded = new Set()

// Map van family-naam → Google Fonts specifier (incl. gewichten).
const SPECS = {
  Inter: 'Inter:wght@400;500;600;700',
  'Space Grotesk': 'Space+Grotesk:wght@500;700',
  Caveat: 'Caveat:wght@600;700',
  'DM Sans': 'DM+Sans:wght@400;500;600',
  Lora: 'Lora:wght@700',
  Nunito: 'Nunito:wght@400;600',
  'Playfair Display': 'Playfair+Display:wght@700',
  Kreon: 'Kreon:wght@400;600',
  'Source Sans 3': 'Source+Sans+3:wght@400;600',
  Ubuntu: 'Ubuntu:wght@500;700',
}

export function loadFonts(families) {
  const missing = families.filter(f => SPECS[f] && !loaded.has(f))
  if (!missing.length) return
  missing.forEach(f => loaded.add(f))

  const url = 'https://fonts.googleapis.com/css2?' +
    missing.map(f => 'family=' + SPECS[f]).join('&') +
    '&display=swap'

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = url
  document.head.appendChild(link)
}
