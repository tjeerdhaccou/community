import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { getProjectSlugFromSubdomain } from '../lib/subdomain'
import { signOut } from '../lib/auth'
import ProjectDashboardCard from '../components/ProjectDashboardCard'
import NewProjectCard from '../components/NewProjectCard'
import ProfileEditModal from '../components/ProfileEditModal'

function ThemeToggle({ dark, onToggle }) {
  return (
    <button
      className="theme-toggle-btn"
      onClick={onToggle}
      title={dark ? 'Lichte modus' : 'Donkere modus'}
      aria-label={dark ? 'Schakel naar lichte modus' : 'Schakel naar donkere modus'}
    >
      <i className={dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon'} />
    </button>
  )
}

export default function OrgDashboard({ orgId: orgIdProp }) {
  const params = useParams()
  const orgSlug = params.orgSlug
  const { isOrgAdmin, primaryOrg, primaryOrgId, profile, reload: reloadAuth } = useAuth()
  const profileIncomplete = isOrgAdmin && profile && !profile.full_name?.trim()
  const orgId = orgIdProp || primaryOrgId
  const { dark, toggleDark } = useTheme()
  const navigate = useNavigate()
  const isSubdomain = !!getProjectSlugFromSubdomain()
  const settingsPath = isSubdomain ? '/settings' : `/org/${orgSlug || orgId}/settings`
  const newProjectPath = isSubdomain ? '/new-project' : `/org/${orgSlug || orgId}/new-project`
  const [org, setOrg] = useState(null)
  const [projects, setProjects] = useState([])
  const [pendingByProject, setPendingByProject] = useState([])
  const [loading, setLoading] = useState(true)
  const [creatingNew, setCreatingNew] = useState(false)

  async function load() {
    setLoading(true)
    // Lookup org by slug (from URL) or by id (from prop/context)
    let orgData
    if (orgSlug) {
      const res = await supabase.from('organizations').select('*').eq('slug', orgSlug).single()
      orgData = res.data
    } else if (orgId) {
      const res = await supabase.from('organizations').select('*').eq('id', orgId).single()
      orgData = res.data
    }
    setOrg(orgData)
    const resolvedOrgId = orgData?.id || orgId

    const { data: stats, error } = await supabase
      .rpc('get_org_project_stats', { p_org_id: resolvedOrgId })

    if (error) {
      console.error('Error loading stats:', error)
      const { data: fallback } = await supabase
        .from('projects')
        .select('*')
        .eq('organization_id', resolvedOrgId)
        .order('created_at', { ascending: false })
      setProjects((fallback || []).map(p => ({
        project_id: p.id, project_name: p.name, project_location: p.location,
        project_tagline: p.tagline, project_logo_url: p.logo_url,
        project_cover_image_url: p.cover_image_url,
        project_description: p.description,
        is_public: p.is_public, slug: p.slug, custom_domain: p.custom_domain,
        public_description: p.public_description,
        public_contact_email: p.public_contact_email,
        intake_enabled: p.intake_enabled,
        intake_intro_text: p.intake_intro_text,
        features: p.features || {},
        member_count: 0, update_count: 0, post_count: 0, advisor_count: 0,
        new_updates_week: 0, new_posts_week: 0, new_members_week: 0,
      })))
    } else {
      const projectIds = (stats || []).map(s => s.project_id)

      // Load custom domains + features + admins per project
      if (projectIds.length > 0) {
        const { data: extraData } = await supabase
          .from('projects')
          .select('id, custom_domain, features')
          .in('id', projectIds)
        const domainMap = {}
        const featureMap = {}
        for (const d of (extraData || [])) {
          domainMap[d.id] = d.custom_domain
          featureMap[d.id] = d.features || {}
        }
        // Merge custom_domain + features into stats
        for (const s of (stats || [])) {
          s.custom_domain = domainMap[s.project_id] || null
          s.features = featureMap[s.project_id] || {}
        }

        const { data: adminData } = await supabase
          .from('memberships')
          .select('project_id, role, profile:profiles(full_name, avatar_url)')
          .in('project_id', projectIds)
          .in('role', ['admin', 'moderator'])

        const adminsByProject = {}
        for (const a of (adminData || [])) {
          if (!adminsByProject[a.project_id]) adminsByProject[a.project_id] = []
          adminsByProject[a.project_id].push({ ...a.profile, role: a.role })
        }
        setProjects((stats || []).map(s => ({ ...s, admins: adminsByProject[s.project_id] || [] })))
      } else {
        setProjects(stats || [])
      }
      if (projectIds.length > 0) {
        const { data: pending } = await supabase
          .from('memberships')
          .select('project_id, profile:profiles(full_name, avatar_url)')
          .in('project_id', projectIds)
          .eq('role', 'guest')
        const grouped = {}
        for (const p of (pending || [])) {
          if (!grouped[p.project_id]) grouped[p.project_id] = []
          grouped[p.project_id].push(p.profile)
        }
        setPendingByProject(Object.entries(grouped).map(([pid, members]) => {
          const s = (stats || []).find(s => s.project_id === pid)
          return {
            project_id: pid,
            project_name: s?.project_name,
            slug: s?.slug,
            custom_domain: s?.custom_domain,
            members,
          }
        }))
      }
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [orgSlug, orgId])

  // Aggregate stats
  const totals = projects.reduce((acc, p) => ({
    members: acc.members + (p.member_count || 0),
    newMembers: acc.newMembers + (p.new_members_week || 0),
    updates: acc.updates + (p.update_count || 0),
    newUpdates: acc.newUpdates + (p.new_updates_week || 0),
    posts: acc.posts + (p.post_count || 0),
    advisors: acc.advisors + (p.advisor_count || 0),
  }), { members: 0, newMembers: 0, updates: 0, newUpdates: 0, posts: 0, advisors: 0 })

  return (
    <div className="org-dashboard">
      {/* Topbar */}
      <header className="org-topbar">
        <div className="org-topbar__left">
          {org?.logo_url && <img src={org.logo_url} alt={org.name ? org.name + ' logo' : ''} className="org-topbar__logo" />}
          <h1 className="org-topbar__name">{org?.name || 'Organisatie'}</h1>
        </div>
        <div className="org-topbar__right">
          <ThemeToggle dark={dark} onToggle={toggleDark} />
          {isOrgAdmin && (
            <>
              <button className="btn-secondary" onClick={() => navigate(settingsPath)} aria-label="Instellingen">
                <i className="fa-solid fa-gear" />
              </button>
              <button
                className="btn-secondary"
                onClick={async () => { await signOut() }}
                aria-label="Uitloggen"
                title={profile?.email ? `Uitloggen (${profile.email})` : 'Uitloggen'}
              >
                <i className="fa-solid fa-right-from-bracket" />
              </button>
              <button className="btn-primary" onClick={() => setCreatingNew(true)}>
                <i className="fa-solid fa-plus" /> Nieuw project
              </button>
            </>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="org-content">
        {loading ? (
          <div className="loading-inline"><p>Laden...</p></div>
        ) : projects.length === 0 ? (
          <div className="empty-inline">
            <i className="fa-solid fa-city" />
            <h3 className="empty-inline__title">Geen projecten</h3>
            <p>Maak je eerste project aan om te beginnen.</p>
            {isOrgAdmin && (
              <button className="btn-primary" onClick={() => setCreatingNew(true)}>
                <i className="fa-solid fa-plus" /> Nieuw project
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Aggregate stats */}
            <div className="org-stats-strip">
              <div className="org-stats-strip__item">
                <i className="fa-solid fa-users org-stats-strip__icon" style={{ color: 'var(--accent-primary)' }} />
                <span className="org-stats-strip__value">{totals.members}</span>
                <span className="org-stats-strip__label">Leden totaal</span>
                {totals.newMembers > 0 && <span className="org-stats-strip__trend"><i className="fa-solid fa-arrow-trend-up" /> +{totals.newMembers} deze week</span>}
              </div>
              <div className="org-stats-strip__item">
                <i className="fa-solid fa-city org-stats-strip__icon" style={{ color: 'var(--accent-purple)' }} />
                <span className="org-stats-strip__value">{projects.length}</span>
                <span className="org-stats-strip__label">Projecten</span>
              </div>
              <div className="org-stats-strip__item">
                <i className="fa-solid fa-bullhorn org-stats-strip__icon" style={{ color: 'var(--accent-yellow)' }} />
                <span className="org-stats-strip__value">{totals.updates}</span>
                <span className="org-stats-strip__label">Nieuws</span>
                {totals.newUpdates > 0 && <span className="org-stats-strip__trend"><i className="fa-solid fa-arrow-trend-up" /> +{totals.newUpdates} deze week</span>}
              </div>
              <div className="org-stats-strip__item">
                <i className="fa-solid fa-helmet-safety org-stats-strip__icon" style={{ color: 'var(--accent-orange)' }} />
                <span className="org-stats-strip__value">{totals.advisors}</span>
                <span className="org-stats-strip__label">Adviseurs</span>
              </div>
            </div>

            {/* Action items */}
            {pendingByProject.length > 0 && (
              <div className="org-actions">
                <h2 className="org-section-title">
                  <i className="fa-solid fa-circle-exclamation" style={{ color: 'var(--accent-orange)' }} /> Aandacht vereist
                </h2>
                <div className="org-actions__list">
                  {pendingByProject.map(p => (
                    <div
                      key={p.project_id}
                      className="org-actions__item"
                      onClick={async () => {
                        const { navigateToSubdomain, getProjectBaseUrl } = await import('../lib/subdomain')
                        navigateToSubdomain(`${getProjectBaseUrl(p)}/members`)
                      }}
                    >
                      <div className="org-actions__icon">
                        <i className="fa-solid fa-user-clock" />
                      </div>
                      <div className="org-actions__info">
                        <span className="org-actions__title">
                          {p.members.length} {p.members.length === 1 ? 'aanmelding' : 'aanmeldingen'} wachtend
                        </span>
                        <span className="org-actions__subtitle">{p.project_name}</span>
                      </div>
                      <div className="org-actions__avatars">
                        {p.members.slice(0, 3).map((m, i) => (
                          m?.avatar_url
                            ? <img key={i} src={m.avatar_url} alt="" className="org-actions__avatar" />
                            : <div key={i} className="org-actions__avatar org-actions__avatar--placeholder">{(m?.full_name || '?')[0]}</div>
                        ))}
                        {p.members.length > 3 && <span className="org-actions__more">+{p.members.length - 3}</span>}
                      </div>
                      <i className="fa-solid fa-chevron-right org-actions__chevron" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Project cards */}
            <h2 className="org-section-title">Projecten</h2>
            <div className="org-projects-grid">
              {creatingNew && (
                <NewProjectCard
                  orgId={orgId}
                  onCreated={() => { setCreatingNew(false); load() }}
                  onCancel={() => setCreatingNew(false)}
                />
              )}
              {projects.map(p => (
                <ProjectDashboardCard key={p.project_id} project={p} onSaved={load} isLight={org?.kind === 'personal'} />
              ))}
            </div>
          </>
        )}
      </main>

      {profileIncomplete && (
        <ProfileEditModal
          profile={profile}
          mandatory
          onSave={() => { if (reloadAuth) reloadAuth() }}
          onClose={() => { /* niet sluitbaar zonder save in mandatory mode */ }}
        />
      )}
    </div>
  )
}
