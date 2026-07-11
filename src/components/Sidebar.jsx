import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { canDo } from '../lib/permissions'
import { signOut } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { isProjectDomain } from '../lib/subdomain'
import { useSignatureRequestCount } from '../hooks/useSignatureRequestCount'
import { useUnreviewedMemberUploads } from '../hooks/useUnreviewedMemberUploads'
import { useUnreadIndicators } from '../hooks/useUnreadIndicators'

const NAV_SECTIONS = [
  {
    items: [
      { to: '', icon: 'fa-solid fa-house', color: 'var(--clean-inbox, #4A90D9)', bubble: 'navy', label: 'Dashboard', end: true },
    ]
  },
  {
    // Persoonlijke acties bovenaan — dit is voor het lid de belangrijkste hub
    // (tekenverzoeken, documentverzoeken, klaargezette bestanden) en verdient
    // 1-click bereikbaarheid, niet weggemoffeld als tab in Documenten.
    label: 'Voor jou',
    items: [
      { to: 'mijn-dossier', icon: 'fa-solid fa-file-shield', color: 'var(--accent-primary, #4A90D9)', bubble: 'navy', label: 'Mijn dossier', membersOnly: true },
      // Support is een globale chat-widget die rechtsonder floats. De nav-link
      // dispatch een custom event dat de widget kan openen — als de widget nog
      // niet is gemount, valt de klik stil.
      { dispatchEvent: 'open-support-chat', icon: 'fa-solid fa-life-ring', color: 'var(--clean-upcoming, #F09020)', bubble: 'amber', label: 'Support' },
    ]
  },
  {
    label: 'Actueel',
    items: [
      { to: 'updates', icon: 'fa-solid fa-bullhorn', color: 'var(--clean-today, #F4B400)', bubble: 'coral', label: 'Projectnieuws', feature: 'updates' },
      { to: 'community', icon: 'fa-solid fa-comments', color: 'var(--clean-anytime, #3BD269)', bubble: 'green', label: 'Prikbord', action: 'read_board', membersOnly: true, feature: 'board' },
      { to: 'events', icon: 'fa-solid fa-calendar-check', color: 'var(--clean-upcoming, #F09020)', bubble: 'amber', label: 'Events', feature: 'events' },
    ]
  },
  {
    label: 'Project',
    items: [
      { to: 'roadmap', icon: 'fa-solid fa-road', color: 'var(--clean-logbook, #7B5EA7)', bubble: 'periwinkle', label: 'Roadmap', action: 'view_roadmap', membersOnly: true, feature: 'roadmap' },
      // Nu library only: projectdocumenten + adviseur-documenten (geen 'Mijn documenten'
      // tab meer — die is nu een top-level nav-item onder "Voor jou"). Naam is
      // ook expliciet "Projectdossier" zodat het lid niet verwacht hier hun eigen
      // bestanden te vinden.
      { to: 'documenten', icon: 'fa-solid fa-folder-open', color: '#9B59B6', bubble: 'pink', label: 'Projectdossier', membersOnly: true },
    ]
  },
  {
    label: 'Community',
    items: [
      // Leden bundelt de ledenlijst + ledenwerving (werving-tab alleen voor moderators+).
      { to: 'members', icon: 'fa-solid fa-users', color: '#F23578', bubble: 'peach', label: 'Leden', action: 'view_members_list', feature: 'members' },
      // Organisatie bundelt Team (adviseurs) + Groepen/commissies. Zichtbaar zodra
      // minstens één tab toegankelijk is.
      {
        to: 'organisatie', icon: 'fa-solid fa-people-group', color: 'var(--accent-primary, #4A90D9)', bubble: 'navy', label: 'Organisatie',
        visible: (ctx) => (canDo(ctx.role, 'view_team') && ctx.featureEnabled('team')) || canDo(ctx.role, 'manage_workgroups'),
      },
    ]
  },
  {
    label: 'Beheer',
    collapsible: true,
    items: [
      { to: 'aan-de-slag', icon: 'fa-solid fa-rocket', color: 'var(--accent-green, #3BD269)', bubble: 'green', label: 'Aan de slag', adminOnly: true, visible: (ctx) => ctx.role === 'admin' && ctx.onboardingActive },
      { to: 'page-builder', icon: 'fa-solid fa-wand-magic-sparkles', color: 'var(--accent-purple, #7B5EA7)', bubble: 'teal', label: 'Pagina bouwer', adminOnly: true, feature: 'page_builder' },
      { to: 'settings', icon: 'fa-solid fa-gear', color: 'var(--text-tertiary)', bubble: 'neutral', label: 'Instellingen', adminOnly: true },
    ]
  },
]

export default function Sidebar() {
  const { profile, isOrgAdmin, primaryOrgId, primaryOrgSlug } = useAuth()
  const { project, role, basePath, featureEnabled, onboardingActive } = useProject()
  const navigate = useNavigate()
  const location = useLocation()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [openSections, setOpenSections] = useState({})
  const menuRef = useRef(null)
  const isProfessional = role === 'professional'
  const [intakePendingCount, setIntakePendingCount] = useState(0)
  const [docRequestCount, setDocRequestCount] = useState(0)
  const { user } = useAuth()
  const signatureRequestCount = useSignatureRequestCount()
  const { memberCount: unreviewedMemberUploads } = useUnreviewedMemberUploads()
  const { hasNewBoard, hasNewUpdates } = useUnreadIndicators(project?.id)
  // Eén badge op 'Documenten' voor alle openstaande acties van de user:
  // documentverzoeken (upload/ter inzage/tekenen-via-doc-request) + nieuwe
  // tekenverzoeken (signature_requests).
  const documentenActionCount = docRequestCount + signatureRequestCount
  // Eén badge op 'Leden' voor admin-signalen: intake-aanmeldingen +
  // leden met ongelezen zelf-uploads in hun dossier.
  const ledenBadgeCount = intakePendingCount + unreviewedMemberUploads

  useEffect(() => {
    // Geen aanmeldingen-badge als ledenwerving-door-de-community uit staat.
    if (!project?.id || !canDo(role, 'manage_intake') || !featureEnabled('ledenwerving')) return
    supabase
      .from('intake_responses')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .eq('status', 'pending')
      .then(({ count }) => setIntakePendingCount(count || 0))
  }, [project?.id, role])

  useEffect(() => {
    if (!project?.id || !user?.id || isProfessional) return
    function fetchCount() {
      supabase
        .from('document_requests')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .eq('profile_id', user.id)
        .eq('status', 'pending')
        .then(({ count }) => setDocRequestCount(count || 0))
    }
    fetchCount()
    const channel = supabase
      .channel(`sidebar-doc-req-${project.id}-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'document_requests',
        filter: `profile_id=eq.${user.id}`,
      }, fetchCount)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [project?.id, user?.id, isProfessional])

  function isActive(to) {
    if (to === '') return location.pathname === (basePath || '/') || location.pathname === basePath + '/'
    return location.pathname.startsWith(`${basePath}/${to}`)
  }

  async function handleSignOut() {
    setUserMenuOpen(false)
    await signOut()
    navigate('/')
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [userMenuOpen])

  const initials = (profile?.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)

  function renderNavItem(item) {
    if (item.visible && !item.visible({ role, featureEnabled, onboardingActive })) return null
    if (item.membersOnly && isProfessional) return null
    if (item.action && !canDo(role, item.action)) return null
    // Uitgezette modules zijn voor iederéén verborgen — ook voor admins. De org
    // beheert de zichtbaarheid centraal via het org-dashboard (Modules-toggle).
    if (item.feature && !featureEnabled(item.feature)) return null
    // Item-key: 'to' als het een route is, anders 'dispatchEvent' of label
    // (voor niet-route items zoals Support).
    const key = item.to ?? item.dispatchEvent ?? item.label
    const handleClick = () => {
      if (item.dispatchEvent) {
        // Custom event zodat globale widgets (bv. Support-chat rechtsonder) hierop
        // kunnen luisteren. Als geen listener → geen effect.
        window.dispatchEvent(new CustomEvent(item.dispatchEvent))
        return
      }
      navigate(item.to === '' ? (basePath || '/') : `${basePath}/${item.to}`)
    }
    return (
      <div
        key={key}
        className={`cl-nav-item ${item.to !== undefined && isActive(item.to) ? 'cl-nav-item--active' : ''}`}
        onClick={handleClick}
        role="button"
        tabIndex={0}
      >
        <i className={`cl-nav-item__icon ${item.icon}`} style={{ '--nav-c': item.color, '--nav-bub-bg': `var(--nav-bub-${item.bubble}-bg)`, '--nav-bub-glyph': `var(--nav-bub-${item.bubble}-glyph)` }} />
        <span>{item.label}</span>
        {item.to === 'members' && ledenBadgeCount > 0 && (
          <span className="sidebar-badge">{ledenBadgeCount}</span>
        )}
        {item.to === 'mijn-dossier' && documentenActionCount > 0 && (
          <span className="sidebar-badge">{documentenActionCount}</span>
        )}
        {item.to === 'community' && hasNewBoard && (
          <span className="sidebar-dot" aria-label="Nieuwe berichten" title="Nieuwe berichten" />
        )}
        {item.to === 'updates' && hasNewUpdates && (
          <span className="sidebar-dot" aria-label="Nieuw projectnieuws" title="Nieuw projectnieuws" />
        )}
      </div>
    )
  }

  return (
    <nav className="cl-sidebar" role="navigation" aria-label="Hoofdnavigatie">
      {isOrgAdmin && (primaryOrgSlug || primaryOrgId) && !isProjectDomain() && (
        <div className="sidebar-back" onClick={() => navigate(`/org/${primaryOrgSlug || primaryOrgId}`)} role="button" tabIndex={0}>
          <i className="fa-solid fa-arrow-left" />
          <span>Alle projecten</span>
        </div>
      )}

      <div className="sidebar-project-header" onClick={() => navigate(basePath || '/')} role="button" tabIndex={0}>
        {project?.logo_url ? (
          <img src={project.logo_url} alt={project.name} className="sidebar-project-logo" />
        ) : (
          <div className="sidebar-project-logo sidebar-project-logo--placeholder">
            {(project?.name || 'C')[0]}
          </div>
        )}
        <div className="sidebar-project-name">{project?.name || 'Community'}</div>
      </div>

      <div className="sidebar-nav-section">
        {NAV_SECTIONS.map((section, si) => {
          // Hide entire section if membersOnly and professional
          if (section.membersOnly && isProfessional) return null

          const visibleItems = section.items.filter(item => {
            if (item.visible) return item.visible({ role, featureEnabled, onboardingActive })
            if (item.membersOnly && isProfessional) return false
            if (item.adminOnly && role !== 'admin') return false
            if (item.action && !canDo(role, item.action)) return false
            // Uitgezette modules zijn voor iederéén verborgen, ook voor admins.
            if (item.feature && !featureEnabled(item.feature)) return false
            return true
          })
          if (visibleItems.length === 0) return null

          // Inklapbare secties (bv. Beheer): standaard dicht, tenzij een item actief is.
          const hasActiveItem = visibleItems.some(item => isActive(item.to))
          const isOpen = section.collapsible
            ? (openSections[section.label] ?? hasActiveItem)
            : true

          return (
            <div key={si} className="sidebar-nav-group">
              {section.label && (
                section.collapsible ? (
                  <button
                    type="button"
                    className="sidebar-nav-group__label sidebar-nav-group__label--toggle"
                    onClick={() => setOpenSections(s => ({ ...s, [section.label]: !isOpen }))}
                    aria-expanded={isOpen}
                  >
                    {section.label}
                    <i className={`fa-solid fa-chevron-down sidebar-nav-group__chevron ${isOpen ? 'sidebar-nav-group__chevron--open' : ''}`} />
                  </button>
                ) : (
                  <div className="sidebar-nav-group__label">{section.label}</div>
                )
              )}
              {isOpen && visibleItems.map(item => renderNavItem(item))}
            </div>
          )
        })}
      </div>

      {/* User row at bottom */}
      <div className="sidebar-footer" ref={menuRef}>
        {userMenuOpen && (
          <div className="sidebar-user-menu">
            {profile?.email && (
              <>
                <div className="sidebar-user-menu-item sidebar-user-menu-item--email" style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', cursor: 'default', pointerEvents: 'none' }}>
                  <i className="fa-regular fa-envelope" />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.email}</span>
                </div>
                <div className="sidebar-user-menu-divider" />
              </>
            )}
            <div
              className="sidebar-user-menu-item"
              onClick={() => { setUserMenuOpen(false); navigate(`${basePath}/profile`) }}
            >
              <i className="fa-solid fa-user" />
              <span>Mijn profiel</span>
            </div>
            <div
              className="sidebar-user-menu-item"
              onClick={() => { setUserMenuOpen(false); navigate(`${basePath}/profile`); setTimeout(() => document.getElementById('notif-section')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
            >
              <i className="fa-solid fa-bell" />
              <span>Notificaties</span>
            </div>
            <div className="sidebar-user-menu-divider" />
            <div className="sidebar-user-menu-item sidebar-user-menu-item--danger" onClick={handleSignOut}>
              <i className="fa-solid fa-right-from-bracket" />
              <span>Uitloggen</span>
            </div>
          </div>
        )}

        <div
          className={`sidebar-user-row ${userMenuOpen ? 'sidebar-user-row--active' : ''}`}
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          role="button"
          tabIndex={0}
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.full_name || ''} className="sidebar-user-avatar" />
          ) : (
            <div className="sidebar-user-avatar sidebar-user-avatar--placeholder">{initials}</div>
          )}
          <span className="sidebar-user-name">{profile?.full_name || 'Gebruiker'}</span>
          <i className={`fa-solid fa-chevron-up sidebar-user-chevron ${userMenuOpen ? 'sidebar-user-chevron--open' : ''}`} />
        </div>
      </div>
    </nav>
  )
}
