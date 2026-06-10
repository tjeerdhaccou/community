import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { navigateToSubdomain } from '../lib/subdomain'

const MAIN_DOMAIN = import.meta.env.VITE_MAIN_DOMAIN || 'buuur.nl'

export default function PostLoginRedirect() {
  const { user, profile, memberships, orgMemberships, isOrgAdmin, isPlatformAdmin, primaryOrgSlug, loading } = useAuth()
  const navigate = useNavigate()
  const redirected = useRef(false)

  useEffect(() => {
    if (loading || (user && !profile) || redirected.current) return
    if (!user) { navigate('/login', { replace: true }); return }

    redirected.current = true

    if (isPlatformAdmin) {
      navigate('/platform', { replace: true })
      return
    }

    if (isOrgAdmin && primaryOrgSlug) {
      navigateToSubdomain(`https://${primaryOrgSlug}.${MAIN_DOMAIN}/admin`)
      return
    }

    const firstProject = memberships[0]?.projects
    if (firstProject?.custom_domain || firstProject?.slug) {
      const domain = firstProject.custom_domain || `${firstProject.slug}.${MAIN_DOMAIN}`
      navigateToSubdomain(`https://${domain}/`)
      return
    }

    if (memberships.length >= 1) {
      const slug = memberships[0].projects?.slug || memberships[0].project_id
      navigate(`/p/${slug}`, { replace: true })
      return
    }

    if (orgMemberships.length === 0 && memberships.length === 0) {
      navigate('/onboarding', { replace: true })
      return
    }

    navigate('/', { replace: true })
  }, [loading, user, profile, memberships, orgMemberships, isOrgAdmin, isPlatformAdmin, primaryOrgSlug, navigate])

  return <div className="loading-page"><p>Doorsturen...</p></div>
}
