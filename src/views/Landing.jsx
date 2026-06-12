import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  UnderlineDoodle,
  CircleDoodle,
  ArrowDoodle,
  SparkleDoodle,
  SunDoodle,
  HeartDoodle,
  SquiggleDoodle,
  AsteriskDoodle,
  SmileyDoodle,
  HouseDoodle,
} from '../components/LandingDoodles'
import '../styles/landing.css'

const PHOTO_URBAN = 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=700&q=80&auto=format'
const PHOTO_PEOPLE = 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=700&q=80&auto=format'
const PHOTO_COUNTRY = 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=700&q=80&auto=format'
const PHOTO_COMMUNITY = 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=800&q=80&auto=format'
const PHOTO_EVENT = 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&q=80&auto=format'

const FEATURES = [
  {
    icon: 'fa-solid fa-bullhorn',
    title: 'Updates & Nieuws',
    desc: 'Houd de hele gemeenschap op de hoogte van het ontwikkelproces — van vergunning tot bouwplanning.',
    color: 'var(--lp-coral)',
    soft: 'var(--lp-coral-soft)',
  },
  {
    icon: 'fa-solid fa-comments',
    title: 'Prikbord',
    desc: 'Een plek waar toekomstige bewoners vragen stellen, ideeën delen en elkaar leren kennen.',
    color: 'var(--lp-green)',
    soft: 'var(--lp-green-soft)',
  },
  {
    icon: 'fa-solid fa-calendar-days',
    title: 'Evenementen',
    desc: 'Plan informatieavonden, ontwerpsessies en bijeenkomsten — met aanmeldingen en herinneringen.',
    color: 'var(--lp-yellow)',
    soft: 'var(--lp-yellow-soft)',
  },
  {
    icon: 'fa-solid fa-folder-open',
    title: 'Documenten',
    desc: 'Deel ontwerpen, notulen en rapporten overzichtelijk met de juiste mensen.',
    color: 'var(--lp-sky)',
    soft: 'var(--lp-sky-soft)',
  },
  {
    icon: 'fa-solid fa-user-plus',
    title: 'Ledenwerving',
    desc: 'Van geïnteresseerde tot toekomstige bewoner — met intake, profiel en woonvoorkeuren.',
    color: 'var(--lp-lilac)',
    soft: 'var(--lp-lilac-soft)',
  },
  {
    icon: 'fa-solid fa-chart-line',
    title: 'Projectbeheer',
    desc: 'Dashboard, roadmap en instellingen voor initiatiefnemers en procesbegeleiders.',
    color: 'var(--lp-green)',
    soft: 'var(--lp-green-soft)',
  },
]

const STATS = [
  { value: '500+', label: 'toekomstige bewoners' },
  { value: '12', label: 'woonprojecten live' },
  { value: '98%', label: 'tevreden gebruikers' },
]

const STEPS = [
  {
    nr: '1',
    title: 'Project aanmaken',
    desc: 'Een initiatiefnemer, procesbegeleider of ontwikkelaar start een projectomgeving en nodigt het team uit.',
    soft: 'var(--lp-coral-soft)',
  },
  {
    nr: '2',
    title: 'Bewoners uitnodigen',
    desc: 'Toekomstige bewoners en geïnteresseerden ontvangen een uitnodiging en maken hun profiel aan.',
    soft: 'var(--lp-yellow-soft)',
  },
  {
    nr: '3',
    title: 'Samen ontwikkelen',
    desc: 'Updates, bijeenkomsten en gesprekken — de gemeenschap groeit mee met de bouw.',
    soft: 'var(--lp-green-soft)',
  },
]

const MARQUEE_ITEMS = [
  'samen ontwikkelen',
  'CPO & wooncoöperaties',
  'leer je buren kennen vóór de eerste steen',
  'van schets tot sleutel',
  'nieuwe buren welkom',
  'meedenken & meebouwen',
]

const PLANS = [
  {
    name: 'buuur light',
    sub: 'voor bewonersgroepen',
    segment: 'bewoner',
    color: 'var(--lp-green)',
    desc: 'Voor CPO-initiatieven, wooncoöperaties en bewonersgroepen die hun gemeenschap willen opbouwen tijdens het ontwikkelproces.',
    points: [
      'Start jullie eigen projectomgeving',
      'Prikbord, evenementen en documenten',
      'Groei van los idee naar hechte bewonersgroep',
    ],
  },
  {
    name: 'buuur pro',
    sub: 'voor professionals',
    segment: 'professional',
    color: 'var(--lp-lilac)',
    desc: 'Voor procesbegeleiders, projectontwikkelaars en corporaties die laagdrempelig in contact willen staan met toekomstige bewoners en geïnteresseerden.',
    points: [
      'Alles uit light, plus volledig CMS & CRM',
      'Ledenwerving en intake op maat',
      'Meerdere projecten en teams beheren',
    ],
  },
]

// Voegt .is-in toe zodra het element in beeld scrollt — triggert de
// fade-up en de teken-animatie van de doodles (zie landing.css).
function Reveal({ as: Tag = 'div', className = '', delay = 0, style, children, ...rest }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-in')
          io.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      className={`lp-reveal ${className}`}
      style={delay ? { ...style, '--lp-delay': `${delay}ms` } : style}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export default function Landing() {
  const { user } = useAuth()
  const scrollRef = useRef(null)
  const [navHidden, setNavHidden] = useState(false)

  const ctaLink = user ? '/dashboard' : '/start'
  const ctaLabel = user ? 'Naar het platform' : 'Aan de slag'

  // Nav verbergen bij omlaag scrollen, tonen bij omhoog scrollen
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let last = el.scrollTop
    const onScroll = () => {
      const y = el.scrollTop
      const delta = y - last
      if (y < 80 || delta < -4) setNavHidden(false)
      else if (delta > 4) setNavHidden(true)
      last = y
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="lp" ref={scrollRef}>
      <nav className={`lp-nav ${navHidden ? 'lp-nav--hidden' : ''}`}>
        <div className="lp-nav__inner">
          <span className="lp-nav__logo">
            buuur
            <UnderlineDoodle stretch />
          </span>
          <div className="lp-nav__links">
            <a href="#features" className="lp-nav__link">Features</a>
            <a href="#plans" className="lp-nav__link">Light & pro</a>
            <a href="#how" className="lp-nav__link">Hoe het werkt</a>
            <Link to={user ? '/dashboard' : '/login'} className="lp-btn lp-btn--small">
              {user ? 'Naar het platform' : 'Inloggen'}
            </Link>
          </div>
        </div>
      </nav>

      <main className="lp-main">
        <Reveal as="section" className="lp-hero">
          <div className="lp-float lp-hero__sparkle"><SparkleDoodle /></div>
          <div className="lp-float lp-float--slow lp-hero__heart"><HeartDoodle /></div>
          <div className="lp-float lp-float--slow lp-hero__house"><HouseDoodle /></div>
          <span className="lp-hero__badge">voor CPO's, wooncoöperaties & bouwgroepen</span>
          <h1 className="lp-hero__title">
            Samen bouwen aan{' '}
            <span className="lp-circled">
              jullie buurt
              <CircleDoodle />
            </span>
          </h1>
          <p className="lp-hero__subtitle">
            Buuur is het platform voor gemeenschappelijke woningbouw. Eén digitale
            plek waar toekomstige bewoners elkaar leren kennen, meedenken en
            meebouwen — van het eerste idee tot de sleuteloverdracht.
          </p>
          <div className="lp-hero__cta-row">
            <Link to={ctaLink} className="lp-btn">
              {ctaLabel} <i className="fa-solid fa-arrow-right" />
            </Link>
            <a href="#features" className="lp-btn lp-btn--ghost">
              Ontdek de mogelijkheden
            </a>
          </div>
          <div className="lp-hero__arrow"><ArrowDoodle /></div>
        </Reveal>

        <Reveal as="section" className="lp-photos" delay={150}>
          <div className="lp-photo" style={{ '--r': '-3deg', '--c': 'var(--lp-sky)', '--tape': '-4deg' }}>
            <img src={PHOTO_URBAN} alt="Stadsgebouwen in de avondzon" loading="eager" />
            <span className="lp-photo__label">de stad ✦</span>
          </div>
          <div className="lp-photo lp-photo--tall" style={{ '--r': '1.5deg', '--c': 'var(--lp-coral)', '--tape': '3deg' }}>
            <img src={PHOTO_PEOPLE} alt="Groep lachende buren samen buiten" loading="eager" />
            <span className="lp-photo__label">de buren ♥</span>
          </div>
          <div className="lp-photo" style={{ '--r': '3deg', '--c': 'var(--lp-green)', '--tape': '-2deg' }}>
            <img src={PHOTO_COUNTRY} alt="Landweg door het platteland bij zonsondergang" loading="eager" />
            <span className="lp-photo__label">het dorp ✿</span>
          </div>
        </Reveal>

        <div className="lp-marquee" aria-hidden="true">
          <div className="lp-marquee__track">
            {[0, 1].map(copy => (
              <div className="lp-marquee__item" key={copy}>
                {MARQUEE_ITEMS.map(item => (
                  <span className="lp-marquee__item" key={item}>
                    {item}
                    <AsteriskDoodle />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <section className="lp-features" id="features">
          <Reveal className="lp-section-header">
            <h2>
              Alles wat een woonproject{' '}
              <span className="lp-underlined">
                nodig heeft
                <UnderlineDoodle stretch />
              </span>
            </h2>
            <p>Van eerste kennismaking tot bouwupdate — buuur heeft het geregeld.</p>
          </Reveal>
          <div className="lp-features__grid">
            {FEATURES.map((f, i) => (
              <Reveal
                key={f.title}
                className="lp-card"
                delay={i * 70}
                style={{ '--c': f.color, '--c-soft': f.soft }}
              >
                <div className="lp-card__icon">
                  <i className={f.icon} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="lp-stats">
          <div className="lp-stats__inner">
            {STATS.map((s, i) => (
              <Reveal className="lp-stat" key={s.label} delay={i * 120}>
                <span className="lp-stat__value">
                  <CircleDoodle />
                  {s.value}
                </span>
                <span className="lp-stat__label">{s.label}</span>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="lp-showcase">
          <Reveal className="lp-showcase__text">
            <h2>Een buurt ontstaat vóór de oplevering</h2>
            <p>
              Gebouwen ontwikkel je niet alleen met stenen, maar met mensen. Buuur
              helpt toekomstige bewoners om elkaar te leren kennen, mee te denken en
              samen beslissingen te nemen — nog voordat het eerste huis er staat.
            </p>
            <div className="lp-showcase__points">
              <div className="lp-showcase__point" style={{ '--c-soft': 'var(--lp-coral-soft)' }}>
                <i className="fa-solid fa-heart" />
                <span>Persoonlijke profielen met interesses en voorkeuren</span>
              </div>
              <div className="lp-showcase__point" style={{ '--c-soft': 'var(--lp-yellow-soft)' }}>
                <i className="fa-solid fa-bell" />
                <span>Slimme notificaties zodat niemand iets mist</span>
              </div>
              <div className="lp-showcase__point" style={{ '--c-soft': 'var(--lp-sky-soft)' }}>
                <i className="fa-solid fa-shield-halved" />
                <span>Privacy-first: elk project z'n eigen veilige omgeving</span>
              </div>
            </div>
          </Reveal>
          <Reveal className="lp-showcase__photos" delay={120}>
            <div className="lp-spin lp-showcase__sun"><SunDoodle /></div>
            <div className="lp-photo" style={{ '--r': '-2deg', '--c': 'var(--lp-lilac)', '--tape': '-3deg' }}>
              <img src={PHOTO_COMMUNITY} alt="Mensen in een gemeenschappelijke ruimte" loading="lazy" />
              <span className="lp-photo__label">samen aan de slag</span>
            </div>
            <div className="lp-photo" style={{ '--r': '2.5deg', '--c': 'var(--lp-yellow)', '--tape': '4deg' }}>
              <img src={PHOTO_EVENT} alt="Buurtbijeenkomst met diverse bewoners" loading="lazy" />
              <span className="lp-photo__label">buurtborrel!</span>
            </div>
          </Reveal>
        </section>

        <section className="lp-plans" id="plans">
          <Reveal className="lp-section-header">
            <h2>
              Voor bewoners{' '}
              <span className="lp-underlined">
                én professionals
                <UnderlineDoodle stretch />
              </span>
            </h2>
            <p>Buuur komt in twee smaken — allebei gebouwd rond de bewonersgemeenschap.</p>
          </Reveal>
          <div className="lp-plans__grid">
            {PLANS.map((plan, i) => (
              <Reveal
                key={plan.name}
                className="lp-card lp-plan"
                delay={i * 120}
                style={{ '--c': plan.color }}
              >
                <span className="lp-plan__badge">binnenkort</span>
                <h3>{plan.name}</h3>
                <p className="lp-plan__sub">{plan.sub}</p>
                <p>{plan.desc}</p>
                <ul>
                  {plan.points.map(point => (
                    <li key={point}>
                      <i className="fa-solid fa-check" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <Link to={`/start?segment=${plan.segment}`} className="lp-plan__link">
                  Houd me op de hoogte <i className="fa-solid fa-arrow-right" />
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="lp-how" id="how">
          <Reveal className="lp-section-header">
            <h2>
              Zo{' '}
              <span className="lp-underlined">
                werkt het
                <UnderlineDoodle stretch />
              </span>
            </h2>
            <p>In drie stappen van idee naar actieve community.</p>
          </Reveal>
          <div className="lp-steps">
            <Reveal className="lp-steps__squiggle" delay={300}>
              <SquiggleDoodle />
            </Reveal>
            {STEPS.map((step, i) => (
              <Reveal className="lp-card lp-step" key={step.nr} delay={i * 120} style={{ '--c': 'var(--lp-ink)' }}>
                <span className="lp-step__nr" style={{ '--c-soft': step.soft }}>{step.nr}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="lp-quote">
          <Reveal>
            <div className="lp-float lp-quote__spark-l"><SparkleDoodle /></div>
            <div className="lp-float lp-float--slow lp-quote__spark-r"><AsteriskDoodle /></div>
            <blockquote>
              "Een sterke buurt ontstaat niet bij de oplevering — die begint bij
              de eerste kennismaking."
            </blockquote>
            <p className="lp-quote__attr">— het idee achter buuur</p>
          </Reveal>
        </section>

        <section className="lp-final">
          <div className="lp-final__card">
            <div className="lp-spin lp-final__sun"><SunDoodle /></div>
            <div className="lp-float lp-final__asterisk"><AsteriskDoodle /></div>
            <div className="lp-float lp-float--slow lp-final__smiley"><SmileyDoodle /></div>
            <Reveal>
              <h2>Klaar om samen te bouwen?</h2>
              <p>Van CPO-initiatief tot gebiedsontwikkeling — ontdek wat buuur voor jouw woonproject kan betekenen.</p>
              <Link to={ctaLink} className="lp-btn">
                {ctaLabel} <i className="fa-solid fa-arrow-right" />
              </Link>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-footer__inner">
          <div className="lp-footer__top">
            <div>
              <span className="lp-footer__brand">buuur</span>
              <p className="lp-footer__tagline">het platform voor gemeenschappelijke woningbouw</p>
            </div>
            <div className="lp-footer__smiley"><SmileyDoodle /></div>
            <div className="lp-footer__links">
              <Link to="/privacy">Privacybeleid</Link>
              <Link to="/voorwaarden">Algemene voorwaarden</Link>
            </div>
          </div>
          <p className="lp-footer__copy">© {new Date().getFullYear()} CrowdBuilding — Met ❤️ gemaakt in Amsterdam</p>
        </div>
      </footer>
    </div>
  )
}
