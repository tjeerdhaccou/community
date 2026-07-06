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
import { loadFonts } from '../lib/fonts'

const PHOTO_URBAN = 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=700&q=80&auto=format'
const PHOTO_PEOPLE = 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=700&q=80&auto=format'
const PHOTO_COUNTRY = 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=700&q=80&auto=format'
const PHOTO_COMMUNITY = 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=800&q=80&auto=format'
const PHOTO_EVENT = 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&q=80&auto=format'

// Pijnpunten van de professional — pijn-eerst (zie blueprint)
const PAINS = [
  { icon: 'fa-solid fa-table-list', text: 'Geïnteresseerden verspreid over Excel, mail en losse WhatsApp-groepen.' },
  { icon: 'fa-solid fa-user-xmark', text: 'Kopers haken laat af — en je weet pas bij oplevering hoe betrokken ze écht zijn.' },
  { icon: 'fa-solid fa-file-lines', text: 'Participatie aantonen voor gemeente of tender kost handwerk en losse documenten.' },
  { icon: 'fa-solid fa-eye-slash', text: 'Je verkoopt "community" als USP, maar je kunt het niet laten zien.' },
]

// De oplossing op 3 uitkomst-thema's
const SOLUTIONS = [
  {
    icon: 'fa-solid fa-link',
    title: 'Binding & minder uitval',
    desc: 'Betrek toekomstige bewoners vanaf de eerste schets en houd ze betrokken tussen mijlpalen door — zo haken er minder af.',
    color: 'var(--lp-coral)',
    soft: 'var(--lp-coral-soft)',
  },
  {
    icon: 'fa-solid fa-layer-group',
    title: 'Overzicht & minder handwerk',
    desc: 'Geïnteresseerden-CRM, intake, rollen en documenten op één plek. Geen losse lijstjes en appgroepen meer.',
    color: 'var(--lp-sky)',
    soft: 'var(--lp-sky-soft)',
  },
  {
    icon: 'fa-solid fa-certificate',
    title: 'Community als bewijs',
    desc: 'Laat betrokkenheid zwart op wit zien — aan kopers, aan de gemeente en in je tender.',
    color: 'var(--lp-green)',
    soft: 'var(--lp-green-soft)',
  },
]

// Voor wie buuur pro is — korte persona-strip
const PERSONAS = [
  {
    icon: 'fa-solid fa-helmet-safety',
    name: 'Projectontwikkelaar',
    line: 'Minder verkooprisico en een wachtlijst die zich al thuis voelt.',
  },
  {
    icon: 'fa-solid fa-people-group',
    name: 'Procesbegeleider',
    line: 'Alles op één plek, minder handwerk, een groep die naar elkaar toe groeit.',
  },
  {
    icon: 'fa-solid fa-building-columns',
    name: 'Corporatie & gemeente',
    line: 'Aantoonbare participatie en bewoners die betrokken zijn.',
  },
]

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
    title: 'Ledenwerving & CRM',
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

const STEPS = [
  {
    nr: '1',
    title: 'Projectomgeving aanmaken',
    desc: 'Jij start als ontwikkelaar of begeleider een eigen projectomgeving en nodigt je team uit.',
    soft: 'var(--lp-coral-soft)',
  },
  {
    nr: '2',
    title: 'Bewoners uitnodigen',
    desc: 'Toekomstige bewoners en geïnteresseerden krijgen een uitnodiging en maken hun profiel aan.',
    soft: 'var(--lp-yellow-soft)',
  },
  {
    nr: '3',
    title: 'Samen ontwikkelen',
    desc: 'Updates, bijeenkomsten en gesprekken — de community groeit mee met je project.',
    soft: 'var(--lp-green-soft)',
  },
]

const MARQUEE_ITEMS = [
  'minder uitval',
  'één plek i.p.v. Excel',
  'betrokken bewoners vanaf de eerste schets',
  'aantoonbare participatie',
  'van schets tot sleutel',
  'community als USP',
]

const PLANS = [
  {
    name: 'buuur pro',
    sub: 'voor professionals',
    segment: 'professional',
    badge: 'aanbevolen',
    featured: true,
    color: 'var(--lp-lilac)',
    desc: 'Voor procesbegeleiders, projectontwikkelaars en corporaties die hun toekomstige bewoners professioneel willen betrekken.',
    points: [
      'Volledig CMS & geïnteresseerden-CRM',
      'Ledenwerving en intake op maat',
      'Meerdere projecten en teams beheren',
    ],
    cta: 'Plan een demo',
  },
  {
    name: 'buuur light',
    sub: 'voor bewonersinitiatieven',
    segment: 'bewoner',
    badge: 'via CrowdBuilding',
    featured: false,
    color: 'var(--lp-green)',
    desc: 'Voor CPO-initiatieven, wooncoöperaties en bewonersgroepen die zelf instappen — ook verkrijgbaar via CrowdBuilding.',
    points: [
      'Start je eigen projectomgeving',
      'Prikbord, evenementen en documenten',
      'Groei van los idee naar hechte groep',
    ],
    cta: 'Meer over light',
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

  const demoLink = '/start?segment=professional'
  const primaryTo = user ? '/dashboard' : demoLink
  const primaryLabel = user ? 'Naar het platform' : 'Plan een demo'

  // Web fonts on-demand laden — niet in index.html zodat dashboard-bezoekers
  // ze niet downloaden. landing.css verwijst naar Inter, Space Grotesk, Caveat.
  useEffect(() => {
    loadFonts(['Inter', 'Space Grotesk', 'Caveat'])
  }, [])

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
            <a href="#oplossing" className="lp-nav__link">Aanpak</a>
            <a href="#voorwie" className="lp-nav__link">Voor wie</a>
            <a href="#plans" className="lp-nav__link">Light & pro</a>
            {user ? (
              <Link to="/dashboard" className="lp-btn lp-btn--small">Naar het platform</Link>
            ) : (
              <>
                <Link to="/login" className="lp-nav__link">Inloggen</Link>
                <Link to={demoLink} className="lp-btn lp-btn--small">Plan een demo</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="lp-main">
        {/* 1. Hero — pro-outcome */}
        <Reveal as="section" className="lp-hero">
          <div className="lp-float lp-hero__sparkle"><SparkleDoodle /></div>
          <div className="lp-float lp-float--slow lp-hero__heart"><HeartDoodle /></div>
          <div className="lp-float lp-float--slow lp-hero__house"><HouseDoodle /></div>
          <span className="lp-hero__badge">voor ontwikkelaars, procesbegeleiders & corporaties</span>
          <h1 className="lp-hero__title">
            Bouw de community nog{' '}
            <span className="lp-circled">
              vóór de woningen
              <CircleDoodle />
            </span>
          </h1>
          <p className="lp-hero__subtitle">
            Buuur is het platform voor gemeenschappelijke woningbouw. Betrek je
            toekomstige bewoners vanaf de eerste schets — minder uitval, soepelere
            participatie en een project dat zichzelf verkoopt.
          </p>
          <div className="lp-hero__cta-row">
            <Link to={primaryTo} className="lp-btn">
              {primaryLabel} <i className="fa-solid fa-arrow-right" />
            </Link>
            <a href="#how" className="lp-btn lp-btn--ghost">
              Bekijk hoe het werkt
            </a>
          </div>
          <div className="lp-hero__arrow"><ArrowDoodle /></div>
        </Reveal>

        {/* 2. Foto's */}
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

        {/* 3. Marquee */}
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

        {/* 4. Pijn — "Herken je dit?" */}
        <section className="lp-pain">
          <Reveal className="lp-section-header">
            <h2>
              Herken je{' '}
              <span className="lp-underlined">
                dit?
                <UnderlineDoodle stretch />
              </span>
            </h2>
            <p>Een woonproject ontwikkelen draait om mensen. De tools daarvoor bestonden niet. Tot nu.</p>
          </Reveal>
          <div className="lp-pain__grid">
            {PAINS.map((p, i) => (
              <Reveal className="lp-pain__item" key={p.text} delay={i * 70}>
                <i className={p.icon} />
                <span>{p.text}</span>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 5. Oplossing — 3 uitkomst-thema's */}
        <section className="lp-features" id="oplossing">
          <Reveal className="lp-section-header">
            <h2>
              Van gedoe naar{' '}
              <span className="lp-underlined">
                grip
                <UnderlineDoodle stretch />
              </span>
            </h2>
            <p>Buuur brengt je toekomstige bewoners en je hele traject samen op één plek.</p>
          </Reveal>
          <div className="lp-features__grid lp-features__grid--3">
            {SOLUTIONS.map((s, i) => (
              <Reveal
                key={s.title}
                className="lp-card"
                delay={i * 90}
                style={{ '--c': s.color, '--c-soft': s.soft }}
              >
                <div className="lp-card__icon">
                  <i className={s.icon} />
                </div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 6. Voor wie */}
        <section className="lp-personas" id="voorwie">
          <Reveal className="lp-section-header">
            <h2>
              Voor wie buuur{' '}
              <span className="lp-underlined">
                pro is
                <UnderlineDoodle stretch />
              </span>
            </h2>
            <p>Eén platform, drie professionals die er hun project mee versterken.</p>
          </Reveal>
          <div className="lp-personas__grid">
            {PERSONAS.map((p, i) => (
              <Reveal className="lp-persona" key={p.name} delay={i * 90}>
                <i className={p.icon} />
                <h3>{p.name}</h3>
                <p>{p.line}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 7. Hoe het werkt */}
        <section className="lp-how" id="how">
          <Reveal className="lp-section-header">
            <h2>
              Zo{' '}
              <span className="lp-underlined">
                werkt het
                <UnderlineDoodle stretch />
              </span>
            </h2>
            <p>In drie stappen van projectomgeving naar actieve community.</p>
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

        {/* 8. Showcase — de bewonerservaring */}
        <section className="lp-showcase">
          <Reveal className="lp-showcase__text">
            <h2>Zo voelt het voor je toekomstige bewoners</h2>
            <p>
              De ervaring die je je bewoners geeft, is wat je project onderscheidt.
              Een warme, veilige plek waar ze elkaar leren kennen, meedenken en zich
              thuis voelen — nog voordat het eerste huis er staat.
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

        {/* 9. Features — bewijs */}
        <section className="lp-features" id="features">
          <Reveal className="lp-section-header">
            <h2>
              En alles{' '}
              <span className="lp-underlined">
                zit erin
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

        {/* 10. Testimonial — CommonCity */}
        <section className="lp-quote">
          <Reveal>
            <div className="lp-float lp-quote__spark-l"><SparkleDoodle /></div>
            <div className="lp-float lp-float--slow lp-quote__spark-r"><AsteriskDoodle /></div>
            <p className="lp-quote__eyebrow">in gebruik bij de eerste woonprojecten</p>
            <blockquote>
              "Met buuur staan onze toekomstige bewoners al vanaf de eerste schets
              met elkaar in contact. Dat scheelt ons bergen mailwerk — en je voelt de
              buurt ontstaan nog vóór er een steen ligt."
            </blockquote>
            <p className="lp-quote__attr">Jasper Ewals — CommonCity</p>
          </Reveal>
        </section>

        {/* 11. Light & pro */}
        <section className="lp-plans" id="plans">
          <Reveal className="lp-section-header">
            <h2>
              Twee smaken, één{' '}
              <span className="lp-underlined">
                platform
                <UnderlineDoodle stretch />
              </span>
            </h2>
            <p>buuur pro voor professionals, buuur light voor bewonersinitiatieven.</p>
          </Reveal>
          <div className="lp-plans__grid">
            {PLANS.map((plan, i) => (
              <Reveal
                key={plan.name}
                className={`lp-card lp-plan ${plan.featured ? 'lp-plan--featured' : ''}`}
                delay={i * 120}
                style={{ '--c': plan.color }}
              >
                <span className="lp-plan__badge">{plan.badge}</span>
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
                  {plan.cta} <i className="fa-solid fa-arrow-right" />
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 12. Zijdeur voor bewoners/initiatiefnemers */}
        <section className="lp-sidedoor">
          <Reveal className="lp-sidedoor__card">
            <div className="lp-sidedoor__text">
              <h3>Zelf kartrekker van een woongroep?</h3>
              <p>buuur light helpt jouw initiatief op weg — laagdrempelig, zonder IT-gedoe.</p>
            </div>
            <Link to="/start?segment=bewoner" className="lp-btn lp-btn--ghost">
              Bekijk buuur light <i className="fa-solid fa-arrow-right" />
            </Link>
          </Reveal>
        </section>

        {/* 13. Slot-CTA */}
        <section className="lp-final">
          <div className="lp-final__card">
            <div className="lp-spin lp-final__sun"><SunDoodle /></div>
            <div className="lp-float lp-final__asterisk"><AsteriskDoodle /></div>
            <div className="lp-float lp-float--slow lp-final__smiley"><SmileyDoodle /></div>
            <Reveal>
              <h2>Benieuwd wat buuur voor jouw project doet?</h2>
              <p>Plan een korte kennismaking — we laten je graag zien hoe het werkt voor jouw woonproject.</p>
              <Link to={primaryTo} className="lp-btn">
                {primaryLabel} <i className="fa-solid fa-arrow-right" />
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
