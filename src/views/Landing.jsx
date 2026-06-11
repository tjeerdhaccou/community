import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const HERO_IMG = 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1400&q=80&auto=format'
const COMMUNITY_IMG = 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=800&q=80&auto=format'
const EVENT_IMG = 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&q=80&auto=format'
const TOGETHER_IMG = 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&q=80&auto=format'

const FEATURES = [
  {
    icon: 'fa-solid fa-bullhorn',
    title: 'Updates & Nieuws',
    desc: 'Houd iedereen op de hoogte met projectnieuws, foto\'s en belangrijke updates.',
    color: 'orange',
  },
  {
    icon: 'fa-solid fa-comments',
    title: 'Prikbord',
    desc: 'Een plek waar buren vragen stellen, ideeën delen en met elkaar in gesprek gaan.',
    color: 'green',
  },
  {
    icon: 'fa-solid fa-calendar-days',
    title: 'Evenementen',
    desc: 'Plan bijeenkomsten, borrels en workshops — met aanmeldingen en herinneringen.',
    color: 'yellow',
  },
  {
    icon: 'fa-solid fa-folder-open',
    title: 'Documenten',
    desc: 'Deel bestanden, notulen en rapporten overzichtelijk met de juiste mensen.',
    color: 'blue',
  },
  {
    icon: 'fa-solid fa-user-plus',
    title: 'Ledenwerving',
    desc: 'Van geïnteresseerde tot volwaardig lid — met intake, profiel en voorkeuren.',
    color: 'purple',
  },
  {
    icon: 'fa-solid fa-chart-line',
    title: 'Projectbeheer',
    desc: 'Dashboard, roadmap en instellingen voor het team dat het project begeleidt.',
    color: 'red',
  },
]

const STATS = [
  { value: '500+', label: 'Bewoners actief' },
  { value: '12', label: 'Projecten live' },
  { value: '98%', label: 'Tevreden gebruikers' },
]

export default function Landing() {
  const { user } = useAuth()

  const ctaLink = user ? '/dashboard' : '/login'
  const ctaLabel = user ? 'Naar het platform' : 'Aan de slag'

  return (
    <div className="landing">
      <nav className="landing__nav">
        <div className="landing__nav-inner">
          <span className="landing__logo">buuur</span>
          <div className="landing__nav-links">
            <a href="#features" className="landing__nav-link">Features</a>
            <a href="#how" className="landing__nav-link">Hoe het werkt</a>
            <Link to={ctaLink} className="cl-btn cl-btn--primary landing__login-btn">
              {user ? (
                <><i className="fa-solid fa-arrow-right" /> Naar het platform</>
              ) : (
                <><i className="fa-solid fa-right-to-bracket" /> Inloggen</>
              )}
            </Link>
          </div>
        </div>
      </nav>

      <main className="landing__main">
        <section className="landing__hero">
          <div className="landing__hero-content">
            <span className="landing__badge">
              <i className="fa-solid fa-sparkles" /> Het platform voor wooninitiatieven
            </span>
            <h1 className="landing__title">
              Samen bouwen aan<br />jullie gemeenschap
            </h1>
            <p className="landing__subtitle">
              Buuur verbindt bewoners, professionals en organisaties op één plek.
              Van het eerste idee tot een hechte buurt — wij maken het makkelijk
              om samen te bouwen aan jullie thuis.
            </p>
            <div className="landing__cta-row">
              <Link to={ctaLink} className="cl-btn cl-btn--primary landing__cta">
                {ctaLabel} <i className="fa-solid fa-arrow-right" />
              </Link>
              <a href="#features" className="cl-btn landing__cta landing__cta--ghost">
                Ontdek de mogelijkheden
              </a>
            </div>
          </div>
          <div className="landing__hero-visual">
            <img
              src={HERO_IMG}
              alt="Groep lachende buren die samen buiten zijn"
              className="landing__hero-img"
              loading="eager"
            />
          </div>
        </section>

        <section className="landing__stats">
          <div className="landing__stats-inner">
            {STATS.map(s => (
              <div key={s.label} className="landing__stat">
                <span className="landing__stat-value">{s.value}</span>
                <span className="landing__stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="landing__features" id="features">
          <div className="landing__section-header">
            <h2>Alles wat je nodig hebt</h2>
            <p>Van communicatie tot administratie — buuur heeft het geregeld.</p>
          </div>
          <div className="landing__features-grid">
            {FEATURES.map(f => (
              <div key={f.title} className="landing__feature">
                <div className={`landing__feature-icon landing__feature-icon--${f.color}`}>
                  <i className={f.icon} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing__showcase">
          <div className="landing__showcase-inner">
            <div className="landing__showcase-text">
              <h2>Meer dan een platform — een buurt</h2>
              <p>
                Woonprojecten draaien om mensen. Buuur helpt jullie om elkaar te leren
                kennen, samen beslissingen te nemen en een gemeenschap te vormen nog
                voordat het eerste huis gebouwd is.
              </p>
              <div className="landing__showcase-points">
                <div className="landing__showcase-point">
                  <i className="fa-solid fa-heart" />
                  <span>Persoonlijke profielen met interesses en voorkeuren</span>
                </div>
                <div className="landing__showcase-point">
                  <i className="fa-solid fa-bell" />
                  <span>Slimme notificaties zodat niemand iets mist</span>
                </div>
                <div className="landing__showcase-point">
                  <i className="fa-solid fa-shield-halved" />
                  <span>Privacy-first: elk project z'n eigen veilige omgeving</span>
                </div>
              </div>
            </div>
            <div className="landing__showcase-images">
              <img
                src={COMMUNITY_IMG}
                alt="Mensen in een gemeenschappelijke ruimte"
                className="landing__showcase-img landing__showcase-img--main"
                loading="lazy"
              />
              <img
                src={EVENT_IMG}
                alt="Buurtbijeenkomst met diverse bewoners"
                className="landing__showcase-img landing__showcase-img--accent"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        <section className="landing__how" id="how">
          <div className="landing__section-header">
            <h2>Zo werkt het</h2>
            <p>In drie stappen van idee naar actieve community.</p>
          </div>
          <div className="landing__steps">
            <div className="landing__step">
              <span className="landing__step-nr">1</span>
              <h3>Project aanmaken</h3>
              <p>Een woningcorporatie of bewonersgroep start een project en nodigt het team uit.</p>
            </div>
            <div className="landing__step-arrow">
              <i className="fa-solid fa-arrow-right" />
            </div>
            <div className="landing__step">
              <span className="landing__step-nr">2</span>
              <h3>Bewoners uitnodigen</h3>
              <p>Toekomstige buren ontvangen een uitnodiging en maken hun profiel aan.</p>
            </div>
            <div className="landing__step-arrow">
              <i className="fa-solid fa-arrow-right" />
            </div>
            <div className="landing__step">
              <span className="landing__step-nr">3</span>
              <h3>Samen aan de slag</h3>
              <p>Updates, evenementen en gesprekken — de gemeenschap groeit van dag één.</p>
            </div>
          </div>
        </section>

        <section className="landing__quote">
          <div className="landing__quote-inner">
            <img
              src={TOGETHER_IMG}
              alt="Mensen die samen werken aan een project"
              className="landing__quote-bg"
              loading="lazy"
            />
            <div className="landing__quote-overlay" />
            <div className="landing__quote-content">
              <i className="fa-solid fa-quote-left landing__quote-icon" />
              <blockquote>
                Een sterke buurt begint met goede buren.<br />
                Buuur maakt dat mogelijk — van het eerste contact tot een hechte gemeenschap.
              </blockquote>
            </div>
          </div>
        </section>

        <section className="landing__final-cta">
          <div className="landing__final-cta-inner">
            <h2>Klaar om jullie gemeenschap te starten?</h2>
            <p>Neem contact op en ontdek wat buuur voor jouw project kan betekenen.</p>
            <div className="landing__cta-row">
              <Link to={ctaLink} className="cl-btn cl-btn--primary landing__cta">
                {ctaLabel} <i className="fa-solid fa-arrow-right" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing__footer">
        <div className="landing__footer-inner">
          <div className="landing__footer-top">
            <div className="landing__footer-brand-col">
              <span className="landing__footer-brand">buuur</span>
              <p className="landing__footer-tagline">Het platform voor wooninitiatieven</p>
            </div>
            <div className="landing__footer-links">
              <Link to="/privacy">Privacybeleid</Link>
              <Link to="/voorwaarden">Algemene voorwaarden</Link>
            </div>
          </div>
          <p className="landing__footer-copy">© {new Date().getFullYear()} CrowdBuilding — Met ❤️ gemaakt in Amsterdam</p>
        </div>
      </footer>
    </div>
  )
}
