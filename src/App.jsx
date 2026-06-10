import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
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
import AlgemeneVoorwaarden from './views/AlgemeneVoorwaarden'
import LegalOverview from './views/legal/LegalOverview'
import Verwerkersovereenkomst from './views/legal/Verwerkersovereenkomst'
import Datalekprotocol from './views/legal/Datalekprotocol'
import Verwerkingsregister from './views/legal/Verwerkingsregister'
import DPIADocument from './views/legal/DPIADocument'
import CookieConsent from './components/CookieConsent'
import NotificationOnboardingModal from './components/NotificationOnboardingModal'
import Unsubscribe from './views/Unsubscribe'
import PublicProject from './views/PublicProject'
import PageBuilder from './views/PageBuilder'
import MyDocuments from './views/MyDocuments'
import PlatformAdmin from './views/PlatformAdmin'
import OrgOnboarding from './views/OrgOnboarding'
import Landing from './views/Landing'
import PostLoginRedirect from './views/PostLoginRedirect'
import ProfileCompletionGuard from './components/ProfileCompletionGuard'
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
  const { user, profile, memberships, orgMemberships, isOrgAdmin, isPlatformAdmin, primaryOrgSlug, loading } = useAuth()
  // Wait for profile to load before deciding where to send the user — otherwise
  // a platform admin can briefly look like a no-org user and get sent to /onboarding.
  if (loading || (user && !profile)) return <div className="loading-page"><p>Laden...</p></div>

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
  return (
    <ProfileCompletionGuard>
      <Layout />
    </ProfileCompletionGuard>
  )
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

function FeatureRoute({ feature, children }) {
  const { featureEnabled, basePath, loading, role } = useProject()
  if (loading) return <div className="loading-page"><p>Laden...</p></div>
  // Admins always have access so they can build out hidden content
  if (role === 'admin') return children
  if (!featureEnabled(feature)) return <Navigate to={basePath || '/'} replace />
  return children
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
  if (sub === 'admin') return <PlatformSubdomainApp />
  return <SubdomainLookup slug={sub} />
}

function PlatformSubdomainApp() {
  const { isPlatformAdmin, loading, user } = useAuth()
  if (loading) return <div className="loading-page"><p>Laden...</p></div>
  if (!user) return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
  if (!isPlatformAdmin) return (
    <div className="error-boundary">
      <div className="error-boundary__card">
        <i className="fa-solid fa-lock error-boundary__icon" style={{ color: 'var(--accent-red)' }} />
        <h2>Geen toegang</h2>
        <p>Je hebt geen platform admin rechten.</p>
      </div>
    </div>
  )
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<PlatformAdmin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  )
}

function SubdomainLookup({ slug }) {
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()
  const [type, setType] = useState(null) // 'project' | 'org' | null
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return // wait for auth — RLS hides orgs from anonymous users
    let cancelled = false
    async function lookup() {
      setLoading(true)
      const { data: project } = await supabase.from('projects').select('id').eq('slug', slug).maybeSingle()
      if (cancelled) return
      if (project) { setType('project'); setLoading(false); return }

      const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).maybeSingle()
      if (cancelled) return
      if (org) { setType('org'); setLoading(false); return }

      setType(null)
      setLoading(false)
    }
    lookup()
    return () => { cancelled = true }
  }, [slug, authLoading, user?.id])

  // Auth callback must work before the DB lookup resolves — session tokens
  // arrive via URL hash and need to be set before the org becomes readable
  // under RLS. After AuthCallback navigates to returnPath, location changes,
  // user updates, and the lookup re-runs successfully.
  if (location.pathname === '/auth/callback') {
    return (
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    )
  }

  if (loading || authLoading) return <div className="loading-page"><p>Laden...</p></div>
  if (type === 'project') return <ProjectSubdomainApp slug={slug} />
  if (type === 'org') return <OrgSubdomainApp orgSlug={slug} />
  // Anonieme bezoekers kunnen de org niet zien door RLS — stuur naar login
  // ipv 404, zodat ze na inloggen op het juiste subdomain landen
  if (!user) return <Login />
  // Ingelogde user die niks ziet heeft vrijwel zeker geen toegang (RLS
  // verbergt orgs/projects waar 'ie geen lid van is). Een echte typo in
  // de subdomain-URL is veel zeldzamer dan een verwijderd lidmaatschap.
  return <SubdomainNoAccess slug={slug} />
}

function SubdomainNoAccess({ slug }) {
  const mainDomain = import.meta.env.VITE_MAIN_DOMAIN || 'buuur.nl'
  const { user } = useAuth()
  async function handleLogoutAndLogin() {
    try { await supabase.auth.signOut() } catch {}
    window.location.reload()
  }
  return (
    <div className="error-boundary">
      <div className="error-boundary__card">
        <i className="fa-solid fa-lock error-boundary__icon" style={{ color: 'var(--text-tertiary)' }} />
        <h2>Geen toegang</h2>
        <p>
          Je bent ingelogd als <strong>{user?.email}</strong> en hebt geen toegang tot <strong>{slug}</strong>.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={handleLogoutAndLogin}>
            <i className="fa-solid fa-right-from-bracket" /> Inloggen met ander account
          </button>
          <button className="btn-secondary" onClick={() => { window.location.href = `https://${mainDomain}` }}>
            <i className="fa-solid fa-house" /> Naar {mainDomain}
          </button>
        </div>
      </div>
    </div>
  )
}

function SubdomainNotFound({ slug }) {
  const mainDomain = import.meta.env.VITE_MAIN_DOMAIN || 'buuur.nl'
  return (
    <div className="error-boundary">
      <div className="error-boundary__card">
        <i className="fa-solid fa-compass error-boundary__icon" style={{ color: 'var(--text-tertiary)' }} />
        <h2>Deze pagina bestaat niet</h2>
        <p>Er is geen project of organisatie met de naam <strong>{slug}</strong>.</p>
        <button className="btn-primary" onClick={() => { window.location.href = `https://${mainDomain}` }}>
          <i className="fa-solid fa-house" /> Naar {mainDomain}
        </button>
      </div>
    </div>
  )
}

function NormalRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/voorwaarden" element={<AlgemeneVoorwaarden />} />
      <Route path="/legal" element={<LegalOverview />} />
      <Route path="/legal/verwerkersovereenkomst" element={<Verwerkersovereenkomst />} />
      <Route path="/legal/datalekprotocol" element={<Datalekprotocol />} />
      <Route path="/legal/verwerkingsregister" element={<Verwerkingsregister />} />
      <Route path="/legal/dpia" element={<DPIADocument />} />
      <Route path="/unsubscribe" element={<Unsubscribe />} />
      <Route path="/project/:slug" element={<PublicProject />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/intake/:projectId" element={<IntakeForm />} />

      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<AuthGuard><PostLoginRedirect /></AuthGuard>} />

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
        <Route path="updates" element={<FeatureRoute feature="updates"><Updates /></FeatureRoute>} />
        <Route path="documenten" element={<FeatureRoute feature="documents"><Documents /></FeatureRoute>} />
        <Route path="mijn-documenten" element={<MyDocuments />} />
        <Route path="pro-updates" element={<ProfessionalUpdates />} />
        <Route path="adviseurs" element={<FeatureRoute feature="team"><AdviseurTeam /></FeatureRoute>} />
        <Route path="community" element={<FeatureRoute feature="board"><Community /></FeatureRoute>} />
        <Route path="events" element={<FeatureRoute feature="events"><Events /></FeatureRoute>} />
        <Route path="roadmap" element={<FeatureRoute feature="roadmap"><Roadmap /></FeatureRoute>} />
        <Route path="documents" element={<FeatureRoute feature="documents"><DocumentArchive /></FeatureRoute>} />
        <Route path="members" element={<FeatureRoute feature="members"><Members /></FeatureRoute>} />
        <Route path="ledenwerving" element={<FeatureRoute feature="ledenwerving"><Ledenwerving /></FeatureRoute>} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="page-builder" element={<FeatureRoute feature="page_builder"><PageBuilder /></FeatureRoute>} />
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
          <Route path="updates" element={<FeatureRoute feature="updates"><Updates /></FeatureRoute>} />
          <Route path="documenten" element={<FeatureRoute feature="documents"><Documents /></FeatureRoute>} />
          <Route path="mijn-documenten" element={<MyDocuments />} />
          <Route path="pro-updates" element={<ProfessionalUpdates />} />
          <Route path="adviseurs" element={<FeatureRoute feature="team"><AdviseurTeam /></FeatureRoute>} />
          <Route path="community" element={<FeatureRoute feature="board"><Community /></FeatureRoute>} />
          <Route path="events" element={<FeatureRoute feature="events"><Events /></FeatureRoute>} />
          <Route path="roadmap" element={<FeatureRoute feature="roadmap"><Roadmap /></FeatureRoute>} />
          <Route path="documents" element={<FeatureRoute feature="documents"><DocumentArchive /></FeatureRoute>} />
          <Route path="members" element={<FeatureRoute feature="members"><Members /></FeatureRoute>} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
          <Route path="ledenwerving" element={<FeatureRoute feature="ledenwerving"><Ledenwerving /></FeatureRoute>} />
          <Route path="page-builder" element={<FeatureRoute feature="page_builder"><PageBuilder /></FeatureRoute>} />
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
            <NotificationOnboardingModal />
          </ConfirmProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
    <CookieConsent />
    </ErrorBoundary>
  )
}
