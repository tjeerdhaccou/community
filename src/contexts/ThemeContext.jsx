import { createContext, useContext, useEffect, useState } from 'react'
import { safeStorage } from '../lib/safeStorage'
import { accentVars, ACCENT_VAR_NAMES } from '../lib/brandAccent'
import { loadFonts } from '../lib/fonts'

const ThemeContext = createContext(null)

// Zonder eigen keuze volgt licht/donker de instelling van het apparaat.
const DEVICE_DARK = '(prefers-color-scheme: dark)'
function deviceWantsDark() {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(DEVICE_DARK).matches
}

export function ThemeProvider({ children, projectBranding, scope }) {
  const storageKey = scope ? `dark-mode-${scope}` : null

  // STIJL-AS (clean ↔ crowdbuilding) komt UITSLUITEND uit de CMS-cascade
  // (organizations/projects.default_theme, geresolved in ProjectContext).
  // De gebruiker kiest de stijl niet — alleen licht/donker.
  const style = projectBranding?.default_theme === 'crowdbuilding' ? 'crowdbuilding' : 'clean'

  // LICHT/DONKER-AS is wél een gebruikerskeuze (knop rechtsboven). Zonder
  // handmatige keuze volgt hij het apparaat; de knop wint daar altijd van, dus
  // donker is ook op een donker ingesteld apparaat uit te zetten.
  const [dark, setDarkState] = useState(() => {
    if (!storageKey) return false
    const stored = safeStorage.getItem(storageKey)
    if (stored === 'dark') return true
    if (stored === 'light') return false
    return deviceWantsDark()
  })

  // Expliciete keuze: opslaan, en daarmee het apparaat niet meer volgen voor deze scope.
  const setDark = storageKey
    ? (next) => {
        safeStorage.setItem(storageKey, next ? 'dark' : 'light')
        setDarkState(next)
      }
    : () => {}
  const toggleDark = () => setDark(!dark)

  // Fris is de vaste look bovenop de Clean-stijl, voor elk project en elke
  // organisatie. Bij het CrowdBuilding-thema valt hij weg: die huisstijl blijft
  // leidend. Schermen buiten een project (geen scope) regelen hun look zelf.
  const look = storageKey && style === 'clean' ? 'fris' : 'clean'

  // data-theme = stijl × licht/donker.
  const dataTheme = !storageKey
    ? 'light'
    : style === 'crowdbuilding'
      ? (dark ? 'crowdbuilding-dark' : 'crowdbuilding')
      : (dark ? 'dark' : 'warm')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dataTheme)
  }, [dataTheme])

  useEffect(() => {
    const root = document.documentElement
    if (look === 'fris') {
      loadFonts(['Instrument Serif'])
      root.setAttribute('data-look', 'fris')
    } else {
      root.removeAttribute('data-look')
    }
  }, [look])

  // Zonder handmatige keuze meebewegen als het apparaat van licht naar donker
  // gaat (of terug), zonder herladen.
  useEffect(() => {
    if (!storageKey || !window.matchMedia) return
    const query = window.matchMedia(DEVICE_DARK)
    const onChange = () => {
      const stored = safeStorage.getItem(storageKey)
      if (stored === 'dark' || stored === 'light') return
      setDarkState(query.matches)
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [storageKey])

  // Steunkleur van het project vervangt het blauw uit het functionele palet.
  //
  // Bewust app_accent_color en niet brand_accent_color: dat laatste veld is bij
  // élk project gevuld (de pagina-editor schrijft het bij elke save uit het
  // palet), dus daarop aansluiten zette de kleur overal tegelijk aan in plaats
  // van per project. app_accent_color raakt alleen gevuld vanuit het CMS.
  //
  // Ook niet rauw toepassen: deriveAccent() leidt per thema een leesbare
  // tekstvariant en een passende kleur-op-vlak af. Zonder dat werden donkere
  // merkkleuren onleesbaar in dark mode — de reden dat merkkleuren er ooit
  // uitgingen. Semantische kleuren (rood/groen/geel, notificatiebolletjes)
  // blijven ongemoeid.
  useEffect(() => {
    const root = document.documentElement
    const vars = accentVars(
      {
        accent: projectBranding?.app_accent_color,
        structure: projectBranding?.app_structure_color,
      },
      dark,
    )
    ACCENT_VAR_NAMES.forEach((name) => root.style.removeProperty(name))
    Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value))
    return () => ACCENT_VAR_NAMES.forEach((name) => root.style.removeProperty(name))
  }, [projectBranding?.app_accent_color, projectBranding?.app_structure_color, dark])

  return (
    <ThemeContext.Provider value={{ dark, setDark, toggleDark, style, scoped: !!storageKey, look }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
