import { createContext, useContext, useEffect, useState } from 'react'
import { safeStorage } from '../lib/safeStorage'

const ThemeContext = createContext(null)

/**
 * ThemeProvider with optional scope for independent theme storage.
 * - scope="project-{id}" or "org-{id}" → stores theme per scope, user can toggle
 * - scope=null/undefined → forces 'light', no storage, no toggle
 */
export function ThemeProvider({ children, projectBranding, scope }) {
  const storageKey = scope ? `theme-mode-${scope}` : null

  const [mode, setModeState] = useState(() => {
    if (!storageKey) return 'light'
    return safeStorage.getItem(storageKey) || projectBranding?.default_theme || 'light'
  })

  // If no scope, mode is always light
  const setMode = storageKey ? setModeState : () => {}

  useEffect(() => {
    if (storageKey) {
      safeStorage.setItem(storageKey, mode)
    }
    document.documentElement.setAttribute('data-theme', mode)
  }, [mode, storageKey])

  useEffect(() => {
    // In contrast mode, don't apply project branding — use theme's own colors
    if (mode === 'contrast') {
      document.documentElement.style.removeProperty('--accent-primary')
      document.documentElement.style.removeProperty('--border-focus')
      document.documentElement.style.removeProperty('--accent-green')
      return
    }

    // Apply project branding colors as CSS custom properties
    if (projectBranding?.brand_primary_color) {
      document.documentElement.style.setProperty('--accent-primary', projectBranding.brand_primary_color)
      document.documentElement.style.setProperty('--border-focus', projectBranding.brand_primary_color)
    }
    if (projectBranding?.brand_accent_color) {
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
