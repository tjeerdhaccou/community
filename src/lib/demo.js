// Klik-demo helpers. De demo draait op een is_demo-project met een anonieme
// sessie (zie signInToDemo in auth.js). De bezoeker kijkt read-only rond;
// schrijfacties tonen in plaats daarvan een uitnodiging om Buuur te ontdekken.

export const DEMO_SIGNUP_EVENT = 'open-demo-signup'

// Waar de "meer weten"-CTA naartoe wijst. Dit is de marketingkant voor
// mogelijke klanten, niet de app-login.
export function getDemoInfoUrl() {
  const mainDomain = import.meta.env.VITE_MAIN_DOMAIN || 'buuur.nl'
  return `https://${mainDomain}`
}

// Roept de demo-signup-prompt op (DemoBanner luistert op dit event) en geeft
// altijd false terug, zodat write-handlers kunnen doen: if (readOnly) return promptDemoSignup()
export function promptDemoSignup() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DEMO_SIGNUP_EVENT))
  }
  return false
}
