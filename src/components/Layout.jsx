import { Suspense, lazy } from 'react'
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

// Alleen demobezoekers krijgen de rondleiding; de rest laadt de code niet.
const DemoTour = lazy(() => import('./DemoTour'))

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

function LookToggle() {
  const { look, lookAvailable, toggleLook } = useTheme()
  if (!lookAvailable) return null
  const on = look === 'fris'
  return (
    <button
      className={`theme-toggle-btn look-toggle-btn ${on ? 'look-toggle-btn--on' : ''}`}
      onClick={toggleLook}
      title={on ? 'Terug naar de vertrouwde look' : 'Probeer de nieuwe look (beta)'}
      aria-label="Nieuwe look (beta)"
      aria-pressed={on}
    >
      <i className="fa-solid fa-wand-magic-sparkles" />
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
        {/* De demobalk staat in de topbar-rij en is even hoog als de knoppen
            ernaast. Zo kost de demo geen extra verticale ruimte en schuift er
            niets: views die met calc(100dvh - …) rekenen (chat) blijven kloppen. */}
        <div className="main-topbar">
          {readOnly && <DemoBanner />}
          <GlobalSearch />
          <LookToggle />
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
      {readOnly && <Suspense fallback={null}><DemoTour /></Suspense>}
      <ModalScrollLock />
    </div>
  )
}
