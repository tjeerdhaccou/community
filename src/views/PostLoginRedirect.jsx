import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { signOut } from '../lib/auth'
import { logger } from '../lib/logger'
import { loadFonts } from '../lib/fonts'
import { goToLoginTarget, resolveLoginTarget } from '../lib/loginRedirect'
import '../styles/landing.css'

export default function PostLoginRedirect() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [target, setTarget] = useState(location.state?.loginTarget || null)
  const [failed, setFailed] = useState(false)
  const started = useRef(false)

  useEffect(() => { loadFonts(['Instrument Serif']) }, [])

  useEffect(() => {
    if (loading || started.current || target) return
    if (!user) { navigate('/login', { replace: true }); return }
    started.current = true

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!session) { navigate('/login', { replace: true }); return null }
        return resolveLoginTarget(session)
      })
      .then(t => {
        if (!t) return
        if (t.kind === 'cms' || t.kind === 'project') goToLoginTarget(t)
        else setTarget(t)
      })
      .catch(err => { logger.error('PostLoginRedirect', err); setFailed(true) })
  }, [loading, user, target, navigate])

  async function handleSignOut() {
    try { await signOut() } catch (err) { logger.error('PostLoginRedirect.signOut', err) }
    navigate('/', { replace: true })
  }

  if (!failed && (!target || target.kind === 'cms' || target.kind === 'project')) {
    return <div className="loading-page"><p>Doorsturen...</p></div>
  }

  return (
    <div className="lp lp--fill" data-look="fris">
      <nav className="lp-nav" aria-label="Hoofdnavigatie">
        <div className="lp-nav__in">
          <Link to="/" className="lp-logo">
            <span className="lp-logo__mark"><i className="fa-solid fa-house" aria-hidden="true" /></span>buuur
          </Link>
          <div className="lp-nav__links">
            <button type="button" className="lp-btn lp-btn--ghost lp-btn--sm" onClick={handleSignOut}>Uitloggen</button>
          </div>
        </div>
      </nav>

      <main>
        <div className="lp-start">
          {failed ? (
            <header className="lp-start__head">
              <h1>Dat lukte niet</h1>
              <p>We konden je omgeving niet ophalen. Controleer je verbinding en probeer het opnieuw.</p>
              <p style={{ marginTop: 24 }}>
                <button type="button" className="lp-btn" onClick={() => window.location.reload()}>Opnieuw proberen</button>
              </p>
            </header>
          ) : target.kind === 'choose' ? (
            <>
              <header className="lp-start__head">
                <h1>Waar wil je heen?</h1>
                <p>Je bent lid van meerdere omgevingen. Kies er een; wisselen kan altijd door opnieuw naar buuur.nl te gaan.</p>
              </header>
              <div className="lp-picks">
                {target.projects.map(p => (
                  <button key={p.id} type="button" className="lp-pick" onClick={() => goToLoginTarget({ kind: 'project', url: p.url })}>
                    {p.logo_url
                      ? <img className="lp-pick__logo" src={p.logo_url} alt="" />
                      : <span className="lp-pick__logo lp-pick__logo--letter" aria-hidden="true">{(p.name || '?')[0]}</span>}
                    <span className="lp-pick__name">{p.name}</span>
                    <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <header className="lp-start__head">
                <h1>Je bent nog nergens lid van</h1>
                <p>
                  Inloggen is gelukt met {user?.email}, maar aan dit adres hangt nog geen omgeving.
                  Ben je uitgenodigd op een ander e-mailadres? Log dan daarmee in.
                </p>
              </header>
              <div className="lp-picks">
                <Link to="/start-groep" className="lp-pick">
                  <span className="lp-pick__logo lp-pick__logo--letter" aria-hidden="true"><i className="fa-solid fa-seedling" /></span>
                  <span className="lp-pick__name">Zelf een groep starten met buuur light</span>
                  <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                </Link>
                <button type="button" className="lp-pick" onClick={handleSignOut}>
                  <span className="lp-pick__logo lp-pick__logo--letter" aria-hidden="true"><i className="fa-solid fa-right-from-bracket" /></span>
                  <span className="lp-pick__name">Uitloggen en een ander adres gebruiken</span>
                  <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
