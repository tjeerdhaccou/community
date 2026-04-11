import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProjectProvider } from './contexts/ProjectContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { useProject } from './contexts/ProjectContext'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import { ConfirmProvider } from './components/ConfirmDialog'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import Login from './views/Login'
import AuthCallback from './views/AuthCallback'
import Dashboard from './views/Dashboard'
import Updates from './views/Updates'
import Community from './views/Community'
import Events from './views/Events'
import Members from './views/Members'
import Settings from './views/Settings'
import Roadmap from './views/Roadmap'
import ProfessionalUpdates from './views/ProfessionalUpdates'
import Documents from './views/Documents'
import AdviseurTeam from './views/AdviseurTeam'
import Profile from './views/Profile'
import DocumentArchive from './views/DocumentArchive'
import OrgDashboard from './views/OrgDashboard'
import OrgSettings from './views/OrgSettings'
import NewProject from './views/NewProject'
import JoinProject from './views/JoinProject'
import IntakeForm from './views/IntakeForm'
import Ledenwerving from './views/Ledenwerving'
import PrivacyPolicy from './views/PrivacyPolicy'
import CookieConsent from './components/CookieConsent'
import PublicProject from './views/PublicProject'
import PageBuilder from './views/PageBuilder'
import PlatformAdmin from './views/PlatformAdmin'
import OrgOnboarding from './views/OrgOnboarding'
import { getProjectSlugFromSubdomain } from './lib/subdomain'

function NotFound() {
  return (
    <div className="error-boundary">
      <div className="error-boundary__card">
        <i className="fa-solid fa-compass error-boundary__icon" style={{ color: 'var(--text-tertiary)' }} />
        <h2>Pagina niet gevonden</h2>
        <p>Deze pagina bestaat niet of je hebt geen toegang.</p>
        <button className="btn-primary" onClick={() => window.location.href = '/'}>
          <i className="fa-solid fa-house" /> Naar home
        </button>
      </div>
    </div>
  )
}

function AuthGuard({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-page"><p>Laden...</p></div>
  if (!user) {
    // Remember where the user wanted to go (including subdomain origin)
    const path = window.location.pathname
    if (path && path !== '/' && path !== '/login') {
      try {
        localStorage.setItem('redirectAfterLogin', path)
        localStorage.setItem('redirectAfterLoginUrl', window.location.origin)
      } catch {}
    }
    return <Navigate to="/login" replace />
  }
  return children
}

function HomeRedirect() {
  const { memberships, orgMemberships, isOrgAdmin, isPlatformAdmin, primaryOrgSlug, loading } = useAuth()
  if (loading) return <div className="loading-page"><p>Laden...</p></div>

  // Platform admin → platform dashboard
  if (isPlatformAdmin) return <Navigate to="/platform" replace />
  // Org admin → org dashboard
  if (isOrgAdmin && primaryOrgSlug) return <Navigate to={`/org/${primaryOrgSlug}`} replace />
  // Single project member → project
  if (memberships.length === 1) return <Navigate to={`/p/${memberships[0].projects?.slug || memberships[0].project_id}`} replace />
  // Multi-project member → first project
  if (memberships.length > 1) return <Navigate to={`/p/${memberships[0].projects?.slug || memberships[0].project_id}`} replace />
  // No org, no projects → onboarding
  if (orgMemberships.length === 0 && memberships.length === 0) return <Navigate to="/onboarding" replace />

  return <div className="empty-state"><h2>Welkom</h2><p>Je bent nog niet lid van een project.</p></div>
}

function MemberGate() {
  const { membership, role, loading, error } = useProject()
  if (loading) return <div className="loading-page"><p>Laden...</p></div>
  if (error) return (
    <div className="error-boundary">
      <div className="error-boundary__card">
        <i className="fa-solid fa-triangle-exclamation error-boundary__icon" style={{ color: 'var(--accent-red)' }} />
        <h2>Project kon niet geladen worden</h2>
        <p>Probeer de pagina te vernieuwen. Als het probleem aanhoudt, neem dan contact op.</p>
        <button className="btn-primary" onClick={() => window.location.reload()}>
          <i className="fa-solid fa-rotate-right" /> Vernieuwen
        </button>
      </div>
    </div>
  )
  // Allow access if user has physical membership OR org-admin role
  if (!membership && role === 'guest') return <JoinProject />
  return <Layout />
}

function ProjectShell() {
  return (
    <ProjectProvider>
      <ProjectThemeWrapper>
        <MemberGate />
      </ProjectThemeWrapper>
    </ProjectProvider>
  )
}

function OrgThemeWrapper({ children }) {
  const { orgId } = useParams()
  return (
    <ThemeProvider scope={`org-${orgId}`}>
      {children}
    </ThemeProvider>
  )
}

function ProjectThemeWrapper({ children }) {
  const { slug } = useParams()
  const { branding } = useProject()
  return (
    <ThemeProvider projectBranding={branding} scope={`project-${slug}`}>
      {children}
    </ThemeProvider>
  )
}

// ==================== Subdomain routing ====================

function SubdomainRouter() {
  const sub = getProjectSlugFromSubdomain()
  if (!sub) return <NormalRoutes />
  return <SubdomainLookup slug={sub} />
}

function SubdomainLookup({ slug }) {
  const [type, setType] = useState(null) // 'project' | 'org' | null
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function lookup() {
      // Check if it's a project slug first
      const { data: project } = await supabase.from('projects').select('id').eq('slug', slug).maybeSingle()
      if (project) { setType('project'); setLoading(false); return }

      // Check if it's an org slug
      const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).maybeSingle()
      if (org) { setType('org'); setLoading(false); return }

      setType(null)
      setLoading(false)
    }
    lookup()
  }, [slug])

  if (loading) return <div className="loading-page"><p>Laden...</p></div>
  if (type === 'project') return <ProjectSubdomainApp slug={slug} />
  if (type === 'org') return <OrgSubdomainApp orgSlug={slug} />
  return <NormalRoutes /> // fallback — 404 will handle it
}

function NormalRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/project/:slug" element={<PublicProject />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/intake/:projectId" element={<IntakeForm />} />

      <Route path="/" element={<AuthGuard><HomeRedirect /></AuthGuard>} />

      {/* Platform admin */}
      <Route path="/platform" element={<AuthGuard><PlatformAdmin /></AuthGuard>} />
      <Route path="/onboarding" element={<AuthGuard><OrgOnboarding /></AuthGuard>} />

      {/* Org-level routes */}
      <Route path="/org/:orgSlug" element={<AuthGuard><OrgThemeWrapper><OrgDashboard /></OrgThemeWrapper></AuthGuard>} />
      <Route path="/org/:orgId/settings" element={<AuthGuard><OrgThemeWrapper><OrgSettings /></OrgThemeWrapper></AuthGuard>} />
      <Route path="/org/:orgId/new-project" element={<AuthGuard><OrgThemeWrapper><NewProject /></OrgThemeWrapper></AuthGuard>} />

      {/* Project-level routes */}
      <Route path="/p/:slug" element={<AuthGuard><ProjectShell /></AuthGuard>}>
        <Route index element={<Dashboard />} />
        <Route path="updates" element={<Updates />} />
        <Route path="documenten" element={<Documents />} />
        <Route path="pro-updates" element={<ProfessionalUpdates />} />
        <Route path="adviseurs" element={<AdviseurTeam />} />
        <Route path="community" element={<Community />} />
        <Route path="events" element={<Events />} />
        <Route path="roadmap" element={<Roadmap />} />
        <Route path="documents" element={<DocumentArchive />} />
        <Route path="members" element={<Members />} />
        <Route path="ledenwerving" element={<Ledenwerving />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="page-builder" element={<PageBuilder />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function OrgSubdomainApp({ orgSlug }) {
  const { isOrgAdmin, loading, user, orgMemberships } = useAuth()
  const [orgId, setOrgId] = useState(null)
  const [orgLoading, setOrgLoading] = useState(true)

  useEffect(() => {
    if (!orgSlug) return
    supabase.from('organizations').select('id').eq('slug', orgSlug).single()
      .then(({ data }) => { setOrgId(data?.id || null); setOrgLoading(false) })
  }, [orgSlug])

  if (loading || orgLoading) return <div className="loading-page"><p>Laden...</p></div>
  if (!user) return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )

  // Check if user is admin of THIS org
  const isAdminOfOrg = orgId && orgMemberships.some(om => om.organization_id === orgId && om.role === 'admin')
  if (!isAdminOfOrg) {
    // Redirect root to /admin info page, but non-admins can't access
    return (
      <div className="error-boundary">
        <div className="error-boundary__card">
          <i className="fa-solid fa-lock error-boundary__icon" style={{ color: 'var(--accent-red)' }} />
          <h2>Geen toegang</h2>
          <p>Je hebt geen beheerderstoegang tot deze organisatie.</p>
        </div>
      </div>
    )
  }
  return (
    <ThemeProvider scope={`org-${orgId}`}>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<OrgDashboard orgId={orgId} />} />
        <Route path="/settings" element={<OrgSettings orgId={orgId} />} />
        <Route path="/new-project" element={<NewProject orgId={orgId} />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </ThemeProvider>
  )
}

function ProjectSubdomainApp({ slug }) {
  return (
    <ProjectProvider slugOverride={slug}>
      <Routes>
        {/* Public — no auth */}
        <Route path="/public" element={<PublicProject slugOverride={slug} />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        {/* Authenticated project — all other paths */}
        <Route path="/*" element={<AuthGuard><ProjectShellSubdomain /></AuthGuard>}>
          <Route index element={<Dashboard />} />
          <Route path="updates" element={<Updates />} />
          <Route path="documenten" element={<Documents />} />
          <Route path="pro-updates" element={<ProfessionalUpdates />} />
          <Route path="adviseurs" element={<AdviseurTeam />} />
          <Route path="community" element={<Community />} />
          <Route path="events" element={<Events />} />
          <Route path="roadmap" element={<Roadmap />} />
          <Route path="documents" element={<DocumentArchive />} />
          <Route path="members" element={<Members />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
          <Route path="ledenwerving" element={<Ledenwerving />} />
          <Route path="page-builder" element={<PageBuilder />} />
        </Route>
      </Routes>
    </ProjectProvider>
  )
}

function ProjectShellSubdomain() {
  return (
    <ProjectThemeWrapperSubdomain>
      <MemberGate />
    </ProjectThemeWrapperSubdomain>
  )
}

function ProjectThemeWrapperSubdomain({ children }) {
  const { branding, project } = useProject()
  return (
    <ThemeProvider projectBranding={branding} scope={`project-${project?.slug}`}>
      {children}
    </ThemeProvider>
  )
}

// ==================== Root ====================

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
          <ConfirmProvider>
            <SubdomainRouter />
          </ConfirmProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
    <CookieConsent />
    </ErrorBoundary>
  )
}
