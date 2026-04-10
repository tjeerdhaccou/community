import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { canDo } from '../lib/permissions'
import { signOut } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { isProjectDomain } from '../lib/subdomain'

const NAV_SECTIONS = [
  {
    items: [
      { to: '', icon: 'fa-solid fa-house', color: 'var(--clean-inbox, #4A90D9)', label: 'Dashboard', end: true },
    ]
  },
  {
    label: 'Actueel',
    items: [
      { to: 'updates', icon: 'fa-solid fa-bullhorn', color: 'var(--clean-today, #F4B400)', label: 'Updates' },
      { to: 'community', icon: 'fa-solid fa-comments', color: 'var(--clean-anytime, #3BD269)', label: 'Prikbord', action: 'read_board', membersOnly: true },
      { to: 'events', icon: 'fa-solid fa-calendar-check', color: 'var(--clean-upcoming, #F09020)', label: 'Events' },
    ]
  },
  {
    label: 'Project',
    items: [
      { to: 'roadmap', icon: 'fa-solid fa-road', color: 'var(--clean-logbook, #7B5EA7)', label: 'Roadmap', action: 'view_roadmap', membersOnly: true },
      { to: 'documenten', icon: 'fa-solid fa-folder-open', color: '#9B59B6', label: 'Documenten' },
      { to: 'adviseurs', icon: 'fa-solid fa-helmet-safety', color: '#C9A96E', label: 'Team', action: 'view_team' },
    ]
  },
  {
    label: 'Community',
    items: [
      { to: 'members', icon: 'fa-solid fa-users', color: '#F23578', label: 'Leden', action: 'view_members_list' },
      { to: 'ledenwerving', icon: 'fa-solid fa-clipboard-list', color: 'var(--accent-orange, #F09020)', label: 'Ledenwerving', action: 'manage_intake' },
    ]
  },
  {
    label: 'Beheer',
    items: [
      { to: 'page-builder', icon: 'fa-solid fa-wand-magic-sparkles', color: 'var(--accent-purple, #7B5EA7)', label: 'Pagina bouwer', adminOnly: true },
      { to: 'settings', icon: 'fa-solid fa-gear', color: 'var(--text-tertiary)', label: 'Instellingen', adminOnly: true },
    ]
  },
]

export default function Sidebar() {
  const { profile, isOrgAdmin, primaryOrgId, primaryOrgSlug } = useAuth()
  const { project, role, basePath } = useProject()
  const navigate = useNavigate()
  const location = useLocation()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const isProfessional = role === 'professional'
  const [intakePendingCount, setIntakePendingCount] = useState(0)

  useEffect(() => {
    if (!project?.id || !canDo(role, 'manage_intake')) return
    supabase
      .from('intake_responses')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .eq('status', 'pending')
      .then(({ count }) => setIntakePendingCount(count || 0))
  }, [project?.id, role])

  function isActive(to) {
    if (to === '') return location.pathname === basePath || location.pathname === basePath + '/'
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
    if (item.membersOnly && isProfessional) return null
    if (item.action && !canDo(role, item.action)) return null
    return (
      <div
        key={item.to}
        className={`cl-nav-item ${isActive(item.to) ? 'cl-nav-item--active' : ''}`}
        onClick={() => navigate(item.to === '' ? basePath : `${basePath}/${item.to}`)}
        role="button"
        tabIndex={0}
      >
        <i className={`cl-nav-item__icon ${item.icon}`} style={{ color: item.color }} />
        <span>{item.label}</span>
        {item.to === 'ledenwerving' && intakePendingCount > 0 && (
          <span className="sidebar-badge">{intakePendingCount}</span>
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

      <div className="sidebar-project-header" onClick={() => navigate(basePath)} role="button" tabIndex={0}>
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
            if (item.membersOnly && isProfessional) return false
            if (item.adminOnly && role !== 'admin') return false
            if (item.action && !canDo(role, item.action)) return false
            return true
          })
          if (visibleItems.length === 0) return null

          return (
            <div key={si} className="sidebar-nav-group">
              {section.label && (
                <div className="sidebar-nav-group__label">{section.label}</div>
              )}
              {visibleItems.map(item => renderNavItem(item))}
            </div>
          )
        })}
      </div>

      {/* User row at bottom */}
      <div className="sidebar-footer" ref={menuRef}>
        {userMenuOpen && (
          <div className="sidebar-user-menu">
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
