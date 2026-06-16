import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import NotificationBell from './NotificationBell'
import GlobalSearch from './GlobalSearch'
import { useTheme } from '../contexts/ThemeContext'

function ThemeToggle() {
  const { dark, toggleDark } = useTheme()

  return (
    <button
      className="theme-toggle-btn"
      onClick={toggleDark}
      title={dark ? 'Lichte modus' : 'Donkere modus'}
      aria-label={dark ? 'Schakel naar lichte modus' : 'Schakel naar donkere modus'}
    >
      <i className={dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon'} />
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
