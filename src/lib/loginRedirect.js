import { supabase } from './supabase'
import { navigateToSubdomain } from './subdomain'

const MAIN_DOMAIN = import.meta.env.VITE_MAIN_DOMAIN || 'buuur.nl'

export async function redirectByRole(session, navigate) {
  const userId = session.user.id

  const [profileRes, orgRes, memberRes] = await Promise.all([
    supabase.from('profiles').select('is_platform_admin').eq('id', userId).single(),
    supabase.from('org_members').select('role, organization:organizations(slug)').eq('profile_id', userId).eq('role', 'admin'),
    supabase.from('memberships').select('project_id, projects(slug, custom_domain)').eq('profile_id', userId).limit(1),
  ])

  const cmsBase = `https://admin.${MAIN_DOMAIN}`
  const tokenHash = `access_token=${session.access_token}&refresh_token=${session.refresh_token}`

  if (profileRes.data?.is_platform_admin) {
    const returnPath = encodeURIComponent('/platform')
    window.location.href = `${cmsBase}/auth/session#${tokenHash}&returnPath=${returnPath}`
    return
  }

  const orgMembership = orgRes.data?.[0]
  if (orgMembership?.organization?.slug) {
    const returnPath = encodeURIComponent(`/org/${orgMembership.organization.slug}`)
    window.location.href = `${cmsBase}/auth/session#${tokenHash}&returnPath=${returnPath}`
    return
  }

  const membership = memberRes.data?.[0]
  if (membership?.projects) {
    const p = membership.projects
    const domain = p.custom_domain || `${p.slug}.${MAIN_DOMAIN}`
    navigateToSubdomain(`https://${domain}/`)
    return
  }

  navigate('/dashboard', { replace: true })
}
