import { createContext, useContext, useEffect, useState } from 'react'
import { safeStorage } from '../lib/safeStorage'
import { accentVars, ACCENT_VAR_NAMES } from '../lib/brandAccent'

const ThemeContext = createContext(null)

// 's Avonds (19:00–07:00 lokale tijd) standaard donker tonen.
function isEveningNow() {
  const hour = new Date().getHours()
  return hour >= 19 || hour < 7
}

export function ThemeProvider({ children, projectBranding, scope }) {
  const storageKey = scope ? `dark-mode-${scope}` : null

  // STIJL-AS (clean ↔ crowdbuilding) komt UITSLUITEND uit de CMS-cascade
  // (organizations/projects.default_theme, geresolved in ProjectContext).
  // De gebruiker kiest de stijl niet — alleen licht/donker.
  const style = projectBranding?.default_theme === 'crowdbuilding' ? 'crowdbuilding' : 'clean'

  // LICHT/DONKER-AS is wél een gebruikerskeuze (knop rechtsboven). Zonder
  // handmatige keuze 's avonds automatisch donker.
  const [dark, setDarkState] = useState(() => {
    if (!storageKey) return false
    const stored = safeStorage.getItem(storageKey)
    if (stored === 'dark') return true
    if (stored === 'light') return false
    return isEveningNow()
  })

  // Expliciete keuze: opslaan én de avond-automatiek uitschakelen voor deze scope.
  const setDark = storageKey
    ? (next) => {
        safeStorage.setItem(storageKey, next ? 'dark' : 'light')
        setDarkState(next)
      }
    : () => {}
  const toggleDark = () => setDark(!dark)

  // data-theme = stijl × licht/donker.
  const dataTheme = !storageKey
    ? 'light'
    : style === 'crowdbuilding'
      ? (dark ? 'crowdbuilding-dark' : 'crowdbuilding')
      : (dark ? 'dark' : 'warm')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dataTheme)
  }, [dataTheme])

  // Zonder handmatige keuze het thema bijwerken wanneer het tabblad weer zichtbaar
  // wordt — zo wordt het 's avonds donker zonder herladen.
  useEffect(() => {
    if (!storageKey) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const stored = safeStorage.getItem(storageKey)
      if (stored === 'dark' || stored === 'light') return
      setDarkState(isEveningNow())
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
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
    <ThemeContext.Provider value={{ dark, setDark, toggleDark, style, scoped: !!storageKey }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
