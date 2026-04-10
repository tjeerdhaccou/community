import { createContext, useContext, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { isProjectDomain } from '../lib/subdomain'

const ProjectContext = createContext(null)

export function ProjectProvider({ children, slugOverride }) {
  const params = useParams()
  const slug = slugOverride || params.slug
  const { user, memberships, orgMemberships, isOrgAdmin, reload: reloadAuth } = useAuth()
  const [project, setProject] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Membership is keyed by UUID; wait for project to load first
  const membership = project ? memberships.find(m => m.project_id === project.id) : null

  // Org admins get admin access to all projects in their org
  const isOrgAdminOfProject = isOrgAdmin && project?.organization_id &&
    orgMemberships.some(om => om.organization_id === project.organization_id && om.role === 'admin')

  const role = membership?.role || (isOrgAdminOfProject ? 'admin' : 'guest')

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

      // Auto-create admin membership for org admins who don't have one yet
      const proj = projectRes.data
      const hasMembership = memberships.some(m => m.project_id === proj.id)
      if (!hasMembership && proj.organization_id && isOrgAdmin) {
        const isAdminOfOrg = orgMemberships.some(om =>
          om.organization_id === proj.organization_id && om.role === 'admin'
        )
        if (isAdminOfOrg) {
          await supabase.from('memberships').insert({
            profile_id: user.id,
            project_id: proj.id,
            role: 'admin',
          })
          // Refresh auth context so membership is picked up
          reloadAuth()
        }
      }

      const milestonesRes = await supabase
        .from('milestones')
        .select('*')
        .eq('project_id', proj.id)
        .order('sort_order')
      setMilestones(milestonesRes.data || [])
      setLoading(false)
    }

    load()
  }, [slug, user])

  const branding = project ? {
    brand_primary_color: project.brand_primary_color,
    brand_accent_color: project.brand_accent_color,
    default_theme: project.default_theme,
  } : {}

  const isSubdomain = isProjectDomain()
  const basePath = isSubdomain ? '' : `/p/${project?.slug || ''}`

  return (
    <ProjectContext.Provider value={{ project, milestones, role, membership, loading, error, branding, basePath, isSubdomain }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used within ProjectProvider')
  return ctx
}
