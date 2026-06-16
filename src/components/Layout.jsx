import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import NotificationBell from './NotificationBell'
import GlobalSearch from './GlobalSearch'
import { useTheme } from '../contexts/ThemeContext'

function ThemeToggle() {
  const { mode, setMode } = useTheme()

  const modes = [
    { value: 'warm', icon: 'fa-solid fa-cloud-sun', label: 'Warm' },
    { value: 'dark', icon: 'fa-solid fa-moon', label: 'Donker' },
    { value: 'crowdbuilding', icon: 'fa-solid fa-palette', label: 'CrowdBuilding' },
  ]

  const current = modes.find(m => m.value === mode) || modes[0]
  const nextIndex = (modes.findIndex(m => m.value === current.value) + 1) % modes.length

  return (
    <button
      className="theme-toggle-btn"
      onClick={() => setMode(modes[nextIndex].value)}
      title={`Thema: ${current.label}`}
      aria-label={`Thema: ${current.label}`}
    >
      <i className={current.icon} />
    </button>
  )
}

export default function Layout() {
  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">Ga naar inhoud</a>
      <Sidebar />
      <main className="main-content" role="main" id="main-content">
        <div className="main-topbar">
          <GlobalSearch />
          <ThemeToggle />
          <NotificationBell />
        </div>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
