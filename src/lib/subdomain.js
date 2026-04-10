const MAIN_DOMAIN = import.meta.env.VITE_MAIN_DOMAIN || 'commoncity.nl'

export function getSubdomain() {
  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null
  if (!hostname.endsWith(`.${MAIN_DOMAIN}`)) return null
  const sub = hostname.slice(0, hostname.length - MAIN_DOMAIN.length - 1)
  if (!sub || sub.includes('.')) return null
  return sub
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
 * Get the base URL for a project. Uses subdomain if custom_domain is set,
 * otherwise falls back to main domain with /p/ path.
 */
export function getProjectBaseUrl(project) {
  if (!project) return window.location.origin
  const domain = project.custom_domain
  if (domain) return `https://${domain}`
  const slug = project.slug || project.id
  return `${window.location.origin}/p/${slug}`
}

/**
 * Get the public intake URL for a project.
 */
export function getIntakeUrl(project) {
  if (!project) return ''
  if (project.custom_domain) return `https://${project.custom_domain}/intake`
  return `${window.location.origin}/intake/${project.id}`
}

/**
 * Get the public site URL for a project.
 */
export function getPublicSiteUrl(project) {
  if (!project) return ''
  if (project.custom_domain) return `https://${project.custom_domain}/public`
  return `${window.location.origin}/project/${project.slug || project.id}`
}
