import { createContext, useContext, useEffect, useState } from 'react'
import { safeStorage } from '../lib/safeStorage'

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

  // Project-merkkleuren (brand_primary_color / brand_accent_color) worden
  // bewust NIET meer toegepast. Ze overschreven --accent-primary/--accent-green
  // inline op <html> in zowel licht als donker, waardoor donkere merkkleuren
  // onleesbaar werden tegen de zwarte dark-mode achtergrond. Het functionele
  // palet (uit clean-tokens.css) is per thema al op contrast afgestemd, dus
  // alle projecten gebruiken nu datzelfde palet. Sluit aan op de geparkeerde
  // merkkleur-kiezer (botste met het functionele palet).

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
