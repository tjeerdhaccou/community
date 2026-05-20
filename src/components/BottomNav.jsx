import { useLocation, useNavigate } from 'react-router-dom'
import { useProject } from '../contexts/ProjectContext'
import { canDo } from '../lib/permissions'

const TABS = [
  { to: '', icon: 'fa-solid fa-house', label: 'Home', end: true },
  { to: 'updates', icon: 'fa-solid fa-bullhorn', label: 'Nieuws' },
  { to: 'community', icon: 'fa-solid fa-comments', label: 'Prikbord', action: 'read_board' },
  { to: 'events', icon: 'fa-solid fa-calendar-check', label: 'Events', action: 'view_meetings' },
  { to: 'members', icon: 'fa-solid fa-users', label: 'Leden' },
]

export default function BottomNav() {
  const { project, role, basePath } = useProject()
  const location = useLocation()
  const navigate = useNavigate()

  function isActive(to) {
    if (to === '') return location.pathname === basePath || location.pathname === basePath + '/'
    return location.pathname.startsWith(`${basePath}/${to}`)
  }

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Mobiele navigatie">
      {TABS.map(tab => {
        if (tab.action && !canDo(role, tab.action)) return null
        return (
          <button
            key={tab.to}
            onClick={() => navigate(tab.to === '' ? basePath : `${basePath}/${tab.to}`)}
            className={`bottom-nav-item ${isActive(tab.to) ? 'bottom-nav-item--active' : ''}`}
          >
            <i className={tab.icon} />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
