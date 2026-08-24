import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import NotificationBell from './NotificationBell'
import GlobalSearch from './GlobalSearch'
import SupportWidget from './SupportChat/SupportWidget'
import ModalScrollLock from './ModalScrollLock'
import DemoBanner from './DemoBanner'
import { useTheme } from '../contexts/ThemeContext'
import { useProject } from '../contexts/ProjectContext'

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
  const { readOnly } = useProject()
  return (
    <div className={`app-layout ${readOnly ? 'app-layout--demo' : ''}`}>
      <a href="#main-content" className="skip-link">Ga naar inhoud</a>
      <Sidebar />
      <main className="main-content" role="main" id="main-content">
        {readOnly && <DemoBanner />}
        <div className="main-topbar">
          <GlobalSearch />
          <ThemeToggle />
          <NotificationBell />
        </div>
        <Suspense fallback={<div className="loading-page"><p>Laden...</p></div>}>
          <Outlet />
        </Suspense>
      </main>
      <BottomNav />
      {/* Support-chat is niet zinvol in de demo (en zou tegen RLS aanlopen). */}
      {!readOnly && <SupportWidget />}
      <ModalScrollLock />
    </div>
  )
}
