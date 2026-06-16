import { createContext, useContext, useEffect, useState } from 'react'
import { safeStorage } from '../lib/safeStorage'

const ThemeContext = createContext(null)

// 's Avonds (19:00–07:00 lokale tijd) standaard donker tonen.
function isEveningNow() {
  const hour = new Date().getHours()
  return hour >= 19 || hour < 7
}

export function ThemeProvider({ children, projectBranding, scope }) {
  const storageKey = scope ? `theme-mode-${scope}` : null

  // Het thema dat geldt zonder handmatige keuze: 's avonds donker, anders het
  // project-/org-standaardthema (front-end project-dashboard biedt 'light' niet aan).
  const autoMode = () => {
    if (isEveningNow()) return 'dark'
    let base = projectBranding?.default_theme || 'light'
    if (scope?.startsWith('project-') && base === 'light') base = 'warm'
    return base
  }

  const [mode, setModeState] = useState(() => {
    if (!storageKey) return 'light'
    const stored = safeStorage.getItem(storageKey)
    // Handmatige keuze onthouden; oude 'contrast'-keuze negeren (thema verwijderd).
    if (stored && stored !== 'contrast') return stored
    return autoMode()
  })

  // Expliciete keuze: opslaan én de avond-automatiek uitschakelen voor deze scope.
  const setMode = storageKey
    ? (next) => {
        safeStorage.setItem(storageKey, next)
        setModeState(next)
      }
    : () => {}

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode)
  }, [mode])

  // Zonder handmatige keuze het thema bijwerken wanneer het tabblad weer zichtbaar
  // wordt — zo wordt het 's avonds donker zonder herladen.
  useEffect(() => {
    if (!storageKey) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const stored = safeStorage.getItem(storageKey)
      if (stored && stored !== 'contrast') return
      setModeState(autoMode())
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, projectBranding?.default_theme])

  useEffect(() => {
    // Apply project branding colors as CSS custom properties.
    // Uitzondering: in het CrowdBuilding-thema willen we het volledige merkpalet
    // (Invested Blue + Coral) tonen — project-branding zou de structuurkleur
    // anders inline overschrijven, waardoor het thema niet zichtbaar is.
    const applyBranding = mode !== 'crowdbuilding'
    if (applyBranding && projectBranding?.brand_primary_color) {
      document.documentElement.style.setProperty('--accent-primary', projectBranding.brand_primary_color)
      document.documentElement.style.setProperty('--border-focus', projectBranding.brand_primary_color)
    }
    if (applyBranding && projectBranding?.brand_accent_color) {
      document.documentElement.style.setProperty('--accent-green', projectBranding.brand_accent_color)
    }

    return () => {
      // Clean up when leaving project
      document.documentElement.style.removeProperty('--accent-primary')
      document.documentElement.style.removeProperty('--border-focus')
      document.documentElement.style.removeProperty('--accent-green')
    }
  }, [projectBranding, mode])

  // Reset to light when entering an unscoped context
  useEffect(() => {
    if (!storageKey) {
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }, [storageKey])

  return (
    <ThemeContext.Provider value={{ mode, setMode, scoped: !!storageKey }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
