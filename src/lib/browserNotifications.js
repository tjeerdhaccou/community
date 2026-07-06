// Wrapper rond de Web Notifications API.
// User-preference + browser permission worden los bijgehouden:
//   - browser permission: Notification.permission ('default' | 'granted' | 'denied')
//   - user preference: localStorage flag (kan true zijn terwijl permission denied is)

const PREF_KEY = 'buuur:desktop_notifications'

export function isSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getPermission() {
  if (!isSupported()) return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

export function getUserPreference() {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(PREF_KEY) === 'true'
  } catch {
    return false
  }
}

export function setUserPreference(enabled) {
  try {
    if (enabled) localStorage.setItem(PREF_KEY, 'true')
    else localStorage.removeItem(PREF_KEY)
  } catch {}
}

// Vraag permission. Resolved met 'granted' / 'denied' / 'default' / 'unsupported'.
// Browsers vereisen meestal een user gesture (click), dus deze functie ALLEEN
// aanroepen vanuit een event handler.
export async function requestPermission() {
  if (!isSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const result = await Notification.requestPermission()
    return result
  } catch {
    return 'denied'
  }
}

// Toont een browser notification als:
//   - browser support, permission granted, user preference aan
//   - tab is verborgen (anders krijgt user dubbel: bell + popup)
export function showNotification({ title, body, icon, tag, onClick }) {
  if (!isSupported()) return null
  if (Notification.permission !== 'granted') return null
  if (!getUserPreference()) return null
  if (!document.hidden) return null // alleen wanneer tab niet zichtbaar is

  try {
    const n = new Notification(title, {
      body: body || '',
      icon: icon || '/favicon.ico',
      tag: tag || undefined, // dedupe: zelfde tag overschrijft eerdere
      silent: false,
    })
    if (onClick) {
      n.onclick = () => {
        try { window.focus() } catch {}
        try { n.close() } catch {}
        onClick()
      }
    }
    return n
  } catch {
    return null
  }
}
