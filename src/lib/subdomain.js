const MAIN_DOMAIN = import.meta.env.VITE_MAIN_DOMAIN || 'buuur.nl'

export function getSubdomain() {
  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null
  if (!hostname.endsWith(`.${MAIN_DOMAIN}`)) return null
  const sub = hostname.slice(0, hostname.length - MAIN_DOMAIN.length - 1)
  if (!sub || sub.includes('.')) return null
  return sub
}

/**
 * True alleen op de echte productie-host (buuur.nl of een *.buuur.nl subdomein).
 * Op previews (*.vercel.app) en localhost → false, zodat login/navigatie daar
 * path-based lokaal blijft i.p.v. naar het hardcoded productiedomein te bouncen.
 */
export function isProductionHost() {
  const h = window.location.hostname
  return h === MAIN_DOMAIN || h.endsWith(`.${MAIN_DOMAIN}`)
}

export function isOrgDomain() {
  return getSubdomain() === 'my'
}

export function isProjectDomain() {
  const sub = getSubdomain()
  return sub !== null && sub !== 'my' && sub !== 'www'
}

export function getProjectSlugFromSubdomain() {
  return isProjectDomain() ? getSubdomain() : null
}

/**
 * Navigate to a different subdomain while preserving the auth session.
 * Passes tokens via /auth/callback#access_token=...&refresh_token=...
 */
export async function navigateToSubdomain(targetUrl) {
  const { supabase } = await import('./supabase')
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    const url = new URL(targetUrl)
    // If target is a different origin, pass session tokens
    if (url.origin !== window.location.origin) {
      const callbackUrl = `${url.origin}/auth/callback`
      window.location.href = `${callbackUrl}#access_token=${session.access_token}&refresh_token=${session.refresh_token}&returnPath=${encodeURIComponent(url.pathname + url.search)}`
      return
    }
  }
  window.location.href = targetUrl
}

/**
 * Open a different subdomain in a new tab while preserving the auth session.
 * Must be called from inside a user-gesture handler (the blank window is opened
 * synchronously so the popup blocker permits it; tokens are written after).
 */
export function openSubdomainInNewTab(targetUrl) {
  const newWindow = window.open('about:blank', '_blank')
  if (!newWindow) return // popup blocked
  ;(async () => {
    const { supabase } = await import('./supabase')
    const { data: { session } } = await supabase.auth.getSession()
    const url = new URL(targetUrl)
    if (session && url.origin !== window.location.origin) {
      newWindow.location.href = `${url.origin}/auth/callback#access_token=${session.access_token}&refresh_token=${session.refresh_token}&returnPath=${encodeURIComponent(url.pathname + url.search)}`
    } else {
      newWindow.location.href = targetUrl
    }
  })()
}

/**
 * Get the base URL for a project. Uses subdomain if custom_domain is set,
 * otherwise falls back to main domain with /p/ path.
 */
export function getProjectBaseUrl(project) {
  if (!project) return window.location.origin
  // Alleen op productie naar het custom_domain (bv. vlinderhaven.buuur.nl);
  // op previews/localhost blijven we in dezelfde omgeving via /p/<slug>.
  if (isProductionHost() && project.custom_domain) return `https://${project.custom_domain}`
  const slug = project.slug || project.id
  return `${getMainOrigin()}/p/${slug}`
}

/**
 * Get the public intake URL for a project.
 */
export function getIntakeUrl(project) {
  if (!project) return ''
  if (isProductionHost() && project.custom_domain) return `https://${project.custom_domain}/intake`
  return `${getMainOrigin()}/intake/${project.slug || project.id}`
}

/**
 * Get the public site URL for a project.
 */
export function getPublicSiteUrl(project) {
  if (!project) return ''
  if (isProductionHost() && project.custom_domain) return `https://${project.custom_domain}/public`
  return `${getMainOrigin()}/project/${project.slug || project.id}`
}

function getMainOrigin() {
  // Op previews/localhost in dezelfde omgeving blijven i.p.v. naar het hardcoded
  // productiedomein (buuur.nl) te springen — anders "komt de preview weer uit
  // bij de productie-URL".
  if (!isProductionHost()) return window.location.origin
  return MAIN_DOMAIN ? `https://${MAIN_DOMAIN}` : window.location.origin
}

/**
 * Clean, stable share URL for a document (buuur.nl/d/<code>).
 * Resolved server-side by /api/d/[code] to a fresh signed URL on each click.
 */
export function getDocumentShareUrl(shareCode) {
  if (!shareCode) return ''
  return `${getMainOrigin()}/d/${shareCode}`
}
