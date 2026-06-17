import { createContext, useContext, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { isProjectDomain } from '../lib/subdomain'
import { onboardingEnabled } from '../lib/constants'

const ProjectContext = createContext(null)

export function ProjectProvider({ children, slugOverride }) {
  const params = useParams()
  const slug = slugOverride || params.slug
  const { user, memberships, orgMemberships, isOrgAdmin, isPlatformAdmin, reload: reloadAuth } = useAuth()
  const [project, setProject] = useState(null)
  const [org, setOrg] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Membership is keyed by UUID; wait for project to load first
  const membership = project ? memberships.find(m => m.project_id === project.id) : null

  // Org admins get admin access to all projects in their org
  const isOrgAdminOfProject = isOrgAdmin && project?.organization_id &&
    orgMemberships.some(om => om.organization_id === project.organization_id && om.role === 'admin')

  const role = membership?.role || (isOrgAdminOfProject || isPlatformAdmin ? 'admin' : 'guest')

  useEffect(() => {
    if (!slug || !user) return

    async function load() {
      setLoading(true)
      setError(null)

      // Fetch project by slug or by UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
      const projectRes = isUUID
        ? await supabase.from('projects').select('*').eq('id', slug).single()
        : await supabase.from('projects').select('*').eq('slug', slug).single()
      if (projectRes.error || !projectRes.data) {
        console.error('ProjectContext: failed to load project', projectRes.error)
        setError(projectRes.error || new Error('Project niet gevonden'))
        setLoading(false)
        return
      }
      setProject(projectRes.data)

      // Auto-create admin membership for org admins / platform admins zonder fysieke membership
      const proj = projectRes.data
      const hasMembership = memberships.some(m => m.project_id === proj.id)
      const isAdminOfOrg = isOrgAdmin && proj.organization_id && orgMemberships.some(om =>
        om.organization_id === proj.organization_id && om.role === 'admin'
      )
      if (!hasMembership && (isAdminOfOrg || isPlatformAdmin)) {
        await supabase.from('memberships').insert({
          profile_id: user.id,
          project_id: proj.id,
          role: 'admin',
        })
        // Refresh auth context so membership is picked up
        reloadAuth()
      }

      // Organisatie-thema ophalen voor de cascade (project erft van org als het
      // zelf geen default_theme heeft). Faalt stil voor leden die de org niet
      // mogen lezen → dan valt het thema terug op project/warm.
      let orgData = null
      if (proj.organization_id) {
        const orgRes = await supabase
          .from('organizations')
          .select('default_theme, kind')
          .eq('id', proj.organization_id)
          .single()
        orgData = orgRes.data
      }
      setOrg(orgData)

      const milestonesRes = await supabase
        .from('milestones')
        .select('*')
        .eq('project_id', proj.id)
        .order('sort_order')
      setMilestones(milestonesRes.data || [])
      setLoading(false)
    }

    load()
    // Depend on `user?.id` rather than `user` so a refreshed session (new user
    // object reference, same id) doesn't retrigger the full project reload and
    // unmount open modals.
  }, [slug, user?.id])

  const branding = project ? {
    brand_primary_color: project.brand_primary_color,
    brand_accent_color: project.brand_accent_color,
    // Cascade: eigen projectthema → organisatiethema → (ThemeContext valt terug op warm)
    default_theme: project.default_theme || org?.default_theme || undefined,
  } : {}

  const isSubdomain = isProjectDomain()
  const basePath = isSubdomain ? '' : `/p/${project?.slug || ''}`

  // Feature is enabled unless explicitly set to false (so new features added later default to on)
  function featureEnabled(key) {
    if (!project) return true
    const features = project.features || {}
    return features[key] !== false
  }

  // Light = initiatiefgroep (buuur light); pro = echte organisatie met procesbegeleider.
  const isLightProject = org?.kind === 'personal'

  // "Aan de slag"-checklist: standaard aan voor light-groepen, uit voor pro/MO-
  // projecten (die worden door de org begeleid). Per project te overschrijven
  // via features.onboarding (module-toggle in het org-dashboard).
  const onboardingActive = onboardingEnabled(project?.features, isLightProject)

  return (
    <ProjectContext.Provider value={{ project, milestones, role, membership, loading, error, branding, basePath, isSubdomain, featureEnabled, isLightProject, onboardingActive }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used within ProjectProvider')
  return ctx
}
