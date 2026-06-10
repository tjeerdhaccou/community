import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Landing() {
  const { user } = useAuth()

  return (
    <div className="landing">
      <nav className="landing__nav">
        <div className="landing__nav-inner">
          <span className="landing__logo">buuur</span>
          <div className="landing__nav-links">
            {user ? (
              <Link to="/dashboard" className="cl-btn cl-btn--primary landing__login-btn">
                <i className="fa-solid fa-arrow-right" /> Naar het platform
              </Link>
            ) : (
              <Link to="/login" className="cl-btn cl-btn--primary landing__login-btn">
                <i className="fa-solid fa-right-to-bracket" /> Inloggen
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="landing__main">
        <section className="landing__hero">
          <div className="landing__hero-content">
            <h1 className="landing__title">
              Het platform voor<br />jouw woongemeenschap
            </h1>
            <p className="landing__subtitle">
              Buuur brengt bewoners, professionals en organisaties samen in één plek.
              Van updates en documenten tot evenementen en ledenwerving — alles wat je
              nodig hebt om samen te bouwen.
            </p>
            <div className="landing__cta-row">
              {user ? (
                <Link to="/dashboard" className="cl-btn cl-btn--primary landing__cta">
                  Naar het platform <i className="fa-solid fa-arrow-right" />
                </Link>
              ) : (
                <Link to="/login" className="cl-btn cl-btn--primary landing__cta">
                  Inloggen <i className="fa-solid fa-arrow-right" />
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="landing__features">
          <div className="landing__features-grid">
            <div className="landing__feature">
              <div className="landing__feature-icon">
                <i className="fa-solid fa-bullhorn" />
              </div>
              <h3>Updates & Nieuws</h3>
              <p>Houd alle betrokkenen op de hoogte met updates, nieuwsbrieven en notificaties.</p>
            </div>
            <div className="landing__feature">
              <div className="landing__feature-icon">
                <i className="fa-solid fa-users" />
              </div>
              <h3>Community</h3>
              <p>Een prikbord waar leden vragen stellen, ideeën delen en met elkaar in gesprek gaan.</p>
            </div>
            <div className="landing__feature">
              <div className="landing__feature-icon">
                <i className="fa-solid fa-calendar-days" />
              </div>
              <h3>Evenementen</h3>
              <p>Plan bijeenkomsten, informatiesessies en workshops met aanmeldingen en herinneringen.</p>
            </div>
            <div className="landing__feature">
              <div className="landing__feature-icon">
                <i className="fa-solid fa-folder-open" />
              </div>
              <h3>Documenten</h3>
              <p>Deel bestanden, notulen en rapporten overzichtelijk met de juiste mensen.</p>
            </div>
            <div className="landing__feature">
              <div className="landing__feature-icon">
                <i className="fa-solid fa-user-plus" />
              </div>
              <h3>Ledenwerving</h3>
              <p>Intake-formulieren en een gestroomlijnd proces van geïnteresseerde tot volwaardig lid.</p>
            </div>
            <div className="landing__feature">
              <div className="landing__feature-icon">
                <i className="fa-solid fa-chart-line" />
              </div>
              <h3>Projectbeheer</h3>
              <p>Dashboard, roadmap en instellingen voor professionals die het project begeleiden.</p>
            </div>
          </div>
        </section>

        <section className="landing__how">
          <h2>Hoe het werkt</h2>
          <div className="landing__steps">
            <div className="landing__step">
              <span className="landing__step-nr">1</span>
              <h3>Organisatie maakt een project aan</h3>
              <p>Een woningcorporatie of ontwikkelaar start een project en nodigt het team uit.</p>
            </div>
            <div className="landing__step">
              <span className="landing__step-nr">2</span>
              <h3>Bewoners worden uitgenodigd</h3>
              <p>Via e-mail ontvangen toekomstige bewoners toegang tot hun eigen community.</p>
            </div>
            <div className="landing__step">
              <span className="landing__step-nr">3</span>
              <h3>Samen bouwen aan de gemeenschap</h3>
              <p>Updates, evenementen, documenten en discussies — alles op één plek.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing__footer">
        <div className="landing__footer-inner">
          <span className="landing__footer-brand">buuur</span>
          <div className="landing__footer-links">
            <Link to="/privacy">Privacybeleid</Link>
            <Link to="/voorwaarden">Algemene voorwaarden</Link>
          </div>
          <p className="landing__footer-copy">© {new Date().getFullYear()} CrowdBuilding</p>
        </div>
      </footer>
    </div>
  )
}
