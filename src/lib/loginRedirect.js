import { supabase } from './supabase'
import { getProjectBaseUrl, navigateToSubdomain } from './subdomain'

const MAIN_DOMAIN = import.meta.env.VITE_MAIN_DOMAIN || 'buuur.nl'
const PROJECT_FIELDS = 'id, slug, name, logo_url, custom_domain'

/**
 * Waar hoort iemand na het inloggen op het hoofddomein thuis?
 *   cms     platformbeheerder of beheerder van een pro-organisatie → admin.buuur.nl
 *   project precies één omgeving → daar direct heen
 *   choose  meerdere omgevingen → keuzescherm (PostLoginRedirect)
 *   none    nergens lid van → uitleg (PostLoginRedirect)
 *
 * Een light-groep hangt onder een eigen, onzichtbare organisatie (kind
 * 'personal'). De beheerder daarvan hoort in de community zelf, niet in het CMS.
 */
export async function resolveLoginTarget(session) {
  const userId = session.user.id

  const [profileRes, orgRes, memberRes] = await Promise.all([
    supabase.from('profiles').select('is_platform_admin').eq('id', userId).single(),
    supabase.from('org_members').select('role, organization:organizations(id, slug, kind)').eq('profile_id', userId).eq('role', 'admin'),
    supabase.from('memberships').select(`project_id, projects(${PROJECT_FIELDS})`).eq('profile_id', userId),
  ])

  const cmsBase = `https://admin.${MAIN_DOMAIN}`
  const tokenHash = `access_token=${session.access_token}&refresh_token=${session.refresh_token}`
  const cmsUrl = (path) => `${cmsBase}/auth/session#${tokenHash}&returnPath=${encodeURIComponent(path)}`

  if (profileRes.data?.is_platform_admin) return { kind: 'cms', url: cmsUrl('/platform') }

  const orgs = (orgRes.data || []).map(o => o.organization).filter(Boolean)
  const proOrg = orgs.find(o => o.kind !== 'personal' && o.slug)
  if (proOrg) return { kind: 'cms', url: cmsUrl(`/org/${proOrg.slug}`) }

  const projects = (memberRes.data || []).map(m => m.projects).filter(Boolean)

  // De beheerder van een light-groep heeft niet altijd al een lidmaatschapsrij
  // (die ontstaat bij het eerste bezoek), dus de groep komt uit de organisatie.
  const lightOrgIds = orgs.filter(o => o.kind === 'personal').map(o => o.id)
  if (lightOrgIds.length > 0) {
    const { data } = await supabase.from('projects').select(PROJECT_FIELDS).in('organization_id', lightOrgIds)
    for (const p of data || []) {
      if (!projects.some(x => x.id === p.id)) projects.push(p)
    }
  }

  if (projects.length === 0) return { kind: 'none' }
  const withUrl = projects.map(p => ({ id: p.id, name: p.name, logo_url: p.logo_url, url: getProjectBaseUrl(p) }))
  if (withUrl.length === 1) return { kind: 'project', url: withUrl[0].url }
  return { kind: 'choose', projects: withUrl.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'nl')) }
}

export function goToLoginTarget(target) {
  if (target.kind === 'cms') window.location.href = target.url
  else navigateToSubdomain(target.url)
}

export async function redirectByRole(session, navigate) {
  const target = await resolveLoginTarget(session)
  if (target.kind === 'cms' || target.kind === 'project') {
    goToLoginTarget(target)
    return
  }
  navigate('/dashboard', { replace: true, state: { loginTarget: target } })
}
