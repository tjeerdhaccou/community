import { useState, useEffect, lazy, Suspense } from 'react'
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
import CookieConsent from './components/CookieConsent'
import ProfileCompletionGuard from './components/ProfileCompletionGuard'
import { getProjectSlugFromSubdomain } from './lib/subdomain'

const Login = lazy(() => import('./views/Login'))
const AuthCallback = lazy(() => import('./views/AuthCallback'))
const Dashboard = lazy(() => import('./views/Dashboard'))
const Updates = lazy(() => import('./views/Updates'))
const Community = lazy(() => import('./views/Community'))
const Events = lazy(() => import('./views/Events'))
const Settings = lazy(() => import('./views/Settings'))
const Roadmap = lazy(() => import('./views/Roadmap'))
const ProfessionalUpdates = lazy(() => import('./views/ProfessionalUpdates'))
const AdviseurTeam = lazy(() => import('./views/AdviseurTeam'))
const Profile = lazy(() => import('./views/Profile'))
const ProfileIntake = lazy(() => import('./views/ProfileIntake'))
const DocumentArchive = lazy(() => import('./views/DocumentArchive'))
const DocumentShare = lazy(() => import('./views/DocumentShare'))
const OrgDashboard = lazy(() => import('./views/OrgDashboard'))
const OrgSettings = lazy(() => import('./views/OrgSettings'))
const NewProject = lazy(() => import('./views/NewProject'))
const JoinProject = lazy(() => import('./views/JoinProject'))
const IntakeForm = lazy(() => import('./views/IntakeForm'))
const Ledenwerving = lazy(() => import('./views/Ledenwerving'))
const PrivacyPolicy = lazy(() => import('./views/PrivacyPolicy'))
const AlgemeneVoorwaarden = lazy(() => import('./views/AlgemeneVoorwaarden'))
const LegalOverview = lazy(() => import('./views/legal/LegalOverview'))
const Verwerkersovereenkomst = lazy(() => import('./views/legal/Verwerkersovereenkomst'))
const Datalekprotocol = lazy(() => import('./views/legal/Datalekprotocol'))
const Verwerkingsregister = lazy(() => import('./views/legal/Verwerkingsregister'))
const DPIADocument = lazy(() => import('./views/legal/DPIADocument'))
const Unsubscribe = lazy(() => import('./views/Unsubscribe'))
const PublicProject = lazy(() => import('./views/PublicProject'))
const PageBuilder = lazy(() => import('./views/PageBuilder'))
const Onboarding = lazy(() => import('./views/Beheer/Onboarding'))
const Groepen = lazy(() => import('./views/Beheer/Groepen'))
const MyDocuments = lazy(() => import('./views/MyDocuments'))
const Tekenen = lazy(() => import('./views/Tekenen'))
const Leden = lazy(() => import('./views/Leden'))
const Organisatie = lazy(() => import('./views/Organisatie'))
const DocumentenHub = lazy(() => import('./views/DocumentenHub'))
const PlatformAdmin = lazy(() => import('./views/PlatformAdmin'))
const OrgOnboarding = lazy(() => import('./views/OrgOnboarding'))
const Landing = lazy(() => import('./views/Landing'))
const Start = lazy(() => import('./views/Start'))
const PostLoginRedirect = lazy(() => import('./views/PostLoginRedirect'))

const RouteFallback = () => <div className="loading-page"><p>Laden...</p></div>

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
  const { featureEnabled, basePath, loading } = useProject()
  if (loading) return <div className="loading-page"><p>Laden...</p></div>
  // Uitgezette module = voor iederéén dicht, ook voor admins. De org beheert de
  // zichtbaarheid centraal via het org-dashboard (Modules-toggle).
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
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return // wait for auth — RLS hides orgs from anonymous users
    let cancelled = false
    async function lookup() {
      setLoading(true)
      // Volledig project ophalen ipv alleen id — ProjectProvider hergebruikt dit
      // zodat de tweede round-trip naar Frankfurt wegvalt.
      const { data: proj } = await supabase.from('projects').select('*').eq('slug', slug).maybeSingle()
      if (cancelled) return
      if (proj) { setProject(proj); setType('project'); setLoading(false); return }

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

  // Juridische pagina's zijn statisch en hoeven het project niet te kennen.
  // Anonieme bezoekers worden anders naar Login gestuurd zodra RLS de
  // project-lookup blokkeert, waardoor /privacy en /voorwaarden onbereikbaar
  // zijn vanaf een subdomain.
  if (
    location.pathname === '/privacy' ||
    location.pathname === '/voorwaarden' ||
    location.pathname === '/legal' ||
    location.pathname.startsWith('/legal/')
  ) {
    return (
      <Routes>
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/voorwaarden" element={<AlgemeneVoorwaarden />} />
        <Route path="/legal" element={<LegalOverview />} />
        <Route path="/legal/verwerkersovereenkomst" element={<Verwerkersovereenkomst />} />
        <Route path="/legal/datalekprotocol" element={<Datalekprotocol />} />
        <Route path="/legal/verwerkingsregister" element={<Verwerkingsregister />} />
        <Route path="/legal/dpia" element={<DPIADocument />} />
      </Routes>
    )
  }

  if (loading || authLoading) return <div className="loading-page"><p>Laden...</p></div>
  if (type === 'project') return <ProjectSubdomainApp slug={slug} initialProject={project} />
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
      <Route path="/start" element={<Start />} />
      <Route path="/d/:code" element={<AuthGuard><DocumentShare /></AuthGuard>} />
      <Route path="/dashboard" element={<AuthGuard><PostLoginRedirect /></AuthGuard>} />

      {/* Platform admin */}
      <Route path="/platform" element={<AuthGuard><PlatformAdmin /></AuthGuard>} />
      <Route path="/onboarding" element={<AuthGuard><OrgOnboarding /></AuthGuard>} />

      {/* Org-level routes */}
      <Route path="/org/:orgSlug" element={<AuthGuard><OrgThemeWrapper><OrgDashboard /></OrgThemeWrapper></AuthGuard>} />
      <Route path="/org/:orgId/settings" element={<AuthGuard><OrgThemeWrapper><OrgSettings /></OrgThemeWrapper></AuthGuard>} />
      <Route path="/org/:orgId/new-project" element={<AuthGuard><OrgThemeWrapper><NewProject /></OrgThemeWrapper></AuthGuard>} />

      {/* Project-level routes */}
      {/* Auth-callback for path-based projects (no custom domain): invite/magic-link
          emails redirect to /p/:slug/auth/callback. Must sit OUTSIDE the AuthGuard so
          the session can be set from the URL before any auth gate runs. */}
      <Route path="/p/:slug/auth/callback" element={<AuthCallback />} />
      <Route path="/p/:slug" element={<AuthGuard><ProjectShell /></AuthGuard>}>
        <Route index element={<Dashboard />} />
        <Route path="updates" element={<FeatureRoute feature="updates"><Updates /></FeatureRoute>} />
        <Route path="documenten" element={<DocumentenHub />} />
        <Route path="mijn-documenten" element={<MyDocuments />} />
        <Route path="mijn-dossier" element={<MyDocuments />} />
        <Route path="tekenen/:id" element={<Tekenen />} />
        <Route path="pro-updates" element={<ProfessionalUpdates />} />
        <Route path="adviseurs" element={<FeatureRoute feature="team"><AdviseurTeam /></FeatureRoute>} />
        <Route path="organisatie" element={<Organisatie />} />
        <Route path="community" element={<FeatureRoute feature="board"><Community /></FeatureRoute>} />
        <Route path="events" element={<FeatureRoute feature="events"><Events /></FeatureRoute>} />
        <Route path="roadmap" element={<FeatureRoute feature="roadmap"><Roadmap /></FeatureRoute>} />
        <Route path="documents" element={<FeatureRoute feature="documents"><DocumentArchive /></FeatureRoute>} />
        <Route path="members" element={<FeatureRoute feature="members"><Leden /></FeatureRoute>} />
        <Route path="ledenwerving" element={<FeatureRoute feature="ledenwerving"><Ledenwerving /></FeatureRoute>} />
        <Route path="profile" element={<Profile />} />
        <Route path="profiel-intake/:token" element={<ProfileIntake />} />
        <Route path="aan-de-slag" element={<Onboarding />} />
        <Route path="groepen" element={<Groepen />} />
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

  // Check if user is admin of THIS org
  const isAdminOfOrg = orgId && orgMemberships.some(om => om.organization_id === orgId && om.role === 'admin')

  // Org subdomain redirects to CMS — moet vóór alle early returns staan zodat
  // de hook-volgorde per render gelijk blijft (React error #310 anders).
  useEffect(() => {
    if (isAdminOfOrg && orgSlug) {
      window.location.href = `https://admin.buuur.nl/org/${orgSlug}`
    }
  }, [isAdminOfOrg, orgSlug])

  if (loading || orgLoading) return <div className="loading-page"><p>Laden...</p></div>
  if (!user) return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )

  if (!isAdminOfOrg) {
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
        <Route path="*" element={<div className="loading-page"><p>Doorsturen naar beheerportaal...</p></div>} />
      </Routes>
    </ThemeProvider>
  )
}

function ProjectSubdomainApp({ slug, initialProject }) {
  return (
    <ProjectProvider slugOverride={slug} initialProject={initialProject}>
      <Routes>
        {/* Public — no auth */}
        <Route path="/public" element={<PublicProject slugOverride={slug} />} />
        <Route path="/intake" element={<IntakeForm slugOverride={slug} />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        {/* Juridische pagina's moeten leesbaar zijn zonder login */}
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/voorwaarden" element={<AlgemeneVoorwaarden />} />
        <Route path="/legal" element={<LegalOverview />} />
        <Route path="/legal/verwerkersovereenkomst" element={<Verwerkersovereenkomst />} />
        <Route path="/legal/datalekprotocol" element={<Datalekprotocol />} />
        <Route path="/legal/verwerkingsregister" element={<Verwerkingsregister />} />
        <Route path="/legal/dpia" element={<DPIADocument />} />
        {/* Authenticated project — all other paths */}
        <Route path="/*" element={<AuthGuard><ProjectShellSubdomain /></AuthGuard>}>
          <Route index element={<Dashboard />} />
          <Route path="updates" element={<FeatureRoute feature="updates"><Updates /></FeatureRoute>} />
          <Route path="documenten" element={<DocumentenHub />} />
          <Route path="mijn-documenten" element={<MyDocuments />} />
          <Route path="mijn-dossier" element={<MyDocuments />} />
          <Route path="tekenen/:id" element={<Tekenen />} />
          <Route path="pro-updates" element={<ProfessionalUpdates />} />
          <Route path="adviseurs" element={<FeatureRoute feature="team"><AdviseurTeam /></FeatureRoute>} />
          <Route path="organisatie" element={<Organisatie />} />
          <Route path="community" element={<FeatureRoute feature="board"><Community /></FeatureRoute>} />
          <Route path="events" element={<FeatureRoute feature="events"><Events /></FeatureRoute>} />
          <Route path="roadmap" element={<FeatureRoute feature="roadmap"><Roadmap /></FeatureRoute>} />
          <Route path="documents" element={<FeatureRoute feature="documents"><DocumentArchive /></FeatureRoute>} />
          <Route path="members" element={<FeatureRoute feature="members"><Leden /></FeatureRoute>} />
          <Route path="aan-de-slag" element={<Onboarding />} />
          <Route path="groepen" element={<Groepen />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
          <Route path="profiel-intake/:token" element={<ProfileIntake />} />
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
            <Suspense fallback={<RouteFallback />}>
              <SubdomainRouter />
            </Suspense>
          </ConfirmProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
    <CookieConsent />
    </ErrorBoundary>
  )
}
