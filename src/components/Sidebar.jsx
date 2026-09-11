import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { signOut } from '../lib/auth'
import { isProjectDomain } from '../lib/subdomain'
import { useSidebarSignals } from '../hooks/useSidebarSignals'
import { NAV_SECTIONS, isNavItemVisible } from '../lib/navigation'

export default function Sidebar() {
  const { profile, isOrgAdmin, primaryOrgId, primaryOrgSlug } = useAuth()
  const { project, role, basePath, featureEnabled, onboardingActive } = useProject()
  const navigate = useNavigate()
  const location = useLocation()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [openSections, setOpenSections] = useState({})
  const menuRef = useRef(null)
  const isProfessional = role === 'professional'
  // Sidebar heeft twee soorten signalen (zie useSidebarSignals):
  //   actions.*  → rood cijfer, "jij moet iets doen"
  //   unread.*   → blauwe dot, "nieuw sinds vorige keer"
  const { actions, unread } = useSidebarSignals()

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
    // Zichtbaarheid komt uit één gedeelde bron (lib/navigation.js), ook voor de mobiele onderbalk.
    if (!isNavItemVisible(item, { role, featureEnabled, onboardingActive })) return null
    // Item-key: 'to' als het een route is, anders 'dispatchEvent' of label
    // (voor niet-route items zoals Support).
    const key = item.to ?? item.dispatchEvent ?? item.label
    const handleClick = () => {
      if (item.dispatchEvent === 'open-support-chat') {
        // Sync via URL: '?support=1' opent de widget en is bookmark/deelbaar.
        // Widget luistert ook op het event voor snelle open (SSR-veilig).
        const url = new URL(window.location.href)
        url.searchParams.set('support', '1')
        window.history.pushState({}, '', url)
        window.dispatchEvent(new CustomEvent('open-support-chat'))
        return
      }
      if (item.dispatchEvent) {
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
        {item.to === 'members' && actions.leden > 0 && (
          <span className="sidebar-badge">{actions.leden}</span>
        )}
        {item.to === 'mijn-dossier' && actions.dossier > 0 && (
          <span className="sidebar-badge">{actions.dossier}</span>
        )}
        {item.to === 'chat' && actions.chat > 0 && (
          <span className="sidebar-badge">{actions.chat > 9 ? '9+' : actions.chat}</span>
        )}
        {item.to === 'community' && unread.board && (
          <span className="sidebar-dot" aria-label="Nieuwe berichten" title="Nieuwe berichten" />
        )}
        {item.to === 'updates' && unread.updates && (
          <span className="sidebar-dot" aria-label="Nieuw projectnieuws" title="Nieuw projectnieuws" />
        )}
        {item.to === 'events' && unread.events && (
          <span className="sidebar-dot" aria-label="Nieuwe events" title="Nieuwe events" />
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

          const visibleItems = section.items.filter(item => isNavItemVisible(item, { role, featureEnabled, onboardingActive }))
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
