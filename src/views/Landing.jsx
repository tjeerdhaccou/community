import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { NAV_SECTIONS } from '../lib/navigation'
import { HERO, MAKER, STRIP, DOELGROEPEN, STAPPEN, MODULES, OVER, QUOTE, PLANS, SLOT, FOOTER } from '../content/landing'
import '../styles/landing.css'

const MAIN_DOMAIN = import.meta.env.VITE_MAIN_DOMAIN || 'buuur.nl'
// Het open demoproject (is_demo). Bezoekers kijken read-only rond, zie lib/demo.js.
const DEMO_URL = `https://demoproject.${MAIN_DOMAIN}`

// De zijbalk in het productframe komt uit dezelfde bron als de echte app, zodat
// namen, iconen en kleuren nooit uit de pas lopen met wat je na inloggen ziet.
// Dit is wat een gewoon lid ziet; beheeritems laten we weg.
const DEMO_NAV = ['', 'mijn-dossier', 'chat', 'updates', 'community', 'events', 'roadmap', 'documenten', 'members', 'organisatie']

function bubbleStyle(name) {
  return { '--lp-b-bg': `var(--lp-bub-${name}-bg)`, '--lp-b-fg': `var(--lp-bub-${name}-fg)` }
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Laat elementen met data-reveal binnenglijden zodra ze in beeld komen. De
// klasse lp--js gaat er pas op als dit draait, zodat de pagina zonder JS
// gewoon zichtbaar blijft. Vertraging per element via --d in de style.
// Layout-effect, zodat de hero niet eerst even zichtbaar is en dan verdwijnt.
function useReveal(rootRef) {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const els = root.querySelectorAll('[data-reveal]')
    if (reducedMotion() || !('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('is-in'))
      return
    }
    root.classList.add('lp--js')
    const io = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-in')
        io.unobserve(entry.target)
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [rootRef])
}

// Telt op van 0 naar `to` zodra het getal in beeld komt.
function CountUp({ to, duration = 1400 }) {
  const ref = useRef(null)
  const [value, setValue] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reducedMotion() || !('IntersectionObserver' in window)) { setValue(to); return }
    let frame
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      io.disconnect()
      const start = performance.now()
      const tick = now => {
        const t = Math.min(1, (now - start) / duration)
        setValue(Math.round(to * (1 - Math.pow(1 - t, 3))))
        if (t < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(frame) }
  }, [to, duration])

  return <b ref={ref}>{value}</b>
}

function Eyebrow({ children }) {
  return <span className="lp-eyebrow">{children}</span>
}

function Checks({ items }) {
  return (
    <ul className="lp-checks">
      {items.map(text => (
        <li key={text}>
          <span className="lp-check"><i className="fa-solid fa-check" aria-hidden="true" /></span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  )
}

// Statisch dashboard van het demoproject, opgebouwd uit dezelfde tokens als de
// app. Geen screenshot: dit volgt licht/donker en blijft scherp op elk scherm.
function ProductFrame() {
  const items = NAV_SECTIONS.flatMap(s => s.items.map(item => ({ ...item, section: s.label })))
    .filter(item => DEMO_NAV.includes(item.to))
  const sections = []
  for (const item of items) {
    const last = sections[sections.length - 1]
    if (!last || last.label !== item.section) sections.push({ label: item.section, items: [item] })
    else last.items.push(item)
  }

  return (
    <div className="lp-app" role="img" aria-label="Het dashboard van een project in Buuur, met zijbalk, kengetallen en het eerstvolgende event">
      <aside className="lp-app__side">
        <div className="lp-app__proj"><i className="fa-solid fa-people-roof" aria-hidden="true" /> Demoproject</div>
        {sections.map(section => (
          <div key={section.label || 'top'}>
            {section.label && <div className="lp-app__lbl">{section.label}</div>}
            {section.items.map(item => (
              <div key={item.to} className={`lp-app__it ${item.to === '' ? 'lp-app__it--on' : ''}`}>
                <i className={item.icon} style={{ color: item.color }} aria-hidden="true" /> {item.label}
              </div>
            ))}
          </div>
        ))}
      </aside>
      <div className="lp-app__main">
        <div className="lp-app__banner"><i className="fa-solid fa-eye" aria-hidden="true" /> Dit is een demo. Je kijkt rond in een voorbeeldproject.</div>
        <div className="lp-app__title"><b>Demoproject</b><span>Nieuwe woongemeenschap waar iedereen aan deel kan nemen.</span></div>
        <div className="lp-tiles">
          <div className="lp-tile"><b>Lid</b><span>Jouw rol</span></div>
          <div className="lp-tile"><CountUp to={53} /><span>Leden</span></div>
          <div className="lp-tile"><CountUp to={11} /><span>Nieuws</span></div>
          <div className="lp-tile"><b>Voorlopig Ontwerp</b><span>Fase</span></div>
        </div>
        <div className="lp-mini">
          <div className="lp-mini__k"><i className="fa-solid fa-calendar-check" style={{ color: 'var(--clean-upcoming)' }} aria-hidden="true" /> Eerstvolgende event</div>
          <div className="lp-mini__t">Informatieavond voor nieuwe leden</div>
          <div className="lp-mini__m">20 sep · 21:00 · Buurthuis De Meevaart, Amsterdam</div>
        </div>
        <div className="lp-mini">
          <div className="lp-mini__k"><i className="fa-solid fa-bullhorn" style={{ color: 'var(--clean-today)' }} aria-hidden="true" /> Laatste update</div>
          <div className="lp-mini__t">Definitief ontwerp is klaar</div>
          <div className="lp-mini__m">Sophie van der Berg · 4 dagen geleden</div>
        </div>
        <div className="lp-mini">
          <div className="lp-mini__k"><i className="fa-solid fa-users" style={{ color: 'var(--accent-pink)' }} aria-hidden="true" /> Nieuwste leden</div>
          <div className="lp-avs">
            <span className="lp-av">S</span><span className="lp-av">H</span><span className="lp-av">T</span><span className="lp-av">T</span>
            <span className="lp-av lp-av--plus">+</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Het productframe met een paar zwevende kaartjes eromheen: de app zelf, plus
// wat er op een gewone dag in gebeurt.
function HeroVisual() {
  return (
    <div className="lp-hero__visual" data-reveal style={{ '--d': 2 }}>
      <ProductFrame />
      {HERO.chips.map((chip, i) => (
        <div key={chip.title} className={`lp-chip lp-chip--${i + 1}`} aria-hidden="true">
          <span className="lp-bub lp-bub--sm" style={bubbleStyle(chip.bubble)}><i className={chip.icon} /></span>
          <div><b>{chip.title}</b><span>{chip.meta}</span></div>
        </div>
      ))}
    </div>
  )
}

// Doorlopende fotostrook over de volle breedte. De lijst staat er twee keer in
// zodat de lus naadloos is; de kopie is voor screenreaders verborgen.
function PhotoStrip() {
  return (
    <div className="lp-strip">
      <div className="lp-strip__track">
        {[0, 1].map(copy => STRIP.map((photo, i) => (
          <img
            key={`${copy}-${photo.src}`}
            className="lp-strip__img"
            src={photo.src}
            alt={copy ? '' : photo.alt}
            aria-hidden={copy ? 'true' : undefined}
            width="720"
            height="480"
            loading={i < 4 && !copy ? 'eager' : 'lazy'}
            decoding="async"
          />
        )))}
      </div>
    </div>
  )
}

function Doelgroepen() {
  const [active, setActive] = useState(DOELGROEPEN.items[0].key)

  function onKey(e, index) {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const next = DOELGROEPEN.items[(index + dir + DOELGROEPEN.items.length) % DOELGROEPEN.items.length]
    setActive(next.key)
    document.getElementById(`lp-tab-${next.key}`)?.focus()
  }

  return (
    <section className="lp-section" id="voorwie">
      <div className="lp-wrap">
        <div className="lp-sec-h" data-reveal>
          <Eyebrow>{DOELGROEPEN.eyebrow}</Eyebrow>
          <h2>{DOELGROEPEN.title}</h2>
          <p>{DOELGROEPEN.intro}</p>
        </div>

        <div className="lp-tabs" role="tablist" aria-label="Kies je rol" data-reveal style={{ '--d': 1 }}>
          {DOELGROEPEN.items.map((item, i) => {
            const on = item.key === active
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                id={`lp-tab-${item.key}`}
                className="lp-tab"
                aria-selected={on}
                aria-controls={`lp-panel-${item.key}`}
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(item.key)}
                onKeyDown={e => onKey(e, i)}
              >
                {item.tab}
              </button>
            )
          })}
        </div>

        {DOELGROEPEN.items.map(item => (
          <div
            key={item.key}
            role="tabpanel"
            id={`lp-panel-${item.key}`}
            aria-labelledby={`lp-tab-${item.key}`}
            className="lp-panel"
            hidden={item.key !== active}
          >
            <div className="lp-panel__media">
              <img src={item.image.src} alt={item.image.alt} width="1000" height="1000" loading="lazy" decoding="async" />
              <div className="lp-pain">
                <span className="lp-pain__k">{DOELGROEPEN.painLabel}</span>
                <p>{item.pain}</p>
                <span className="lp-pain__w">{item.painSub}</span>
              </div>
            </div>
            <div className="lp-panel__body">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <Checks items={item.points} />
              <div className="lp-panel__cta">
                <Link to={item.ctaTo} className="lp-btn">{item.cta}</Link>
                <small>{item.ctaNote}</small>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Landing() {
  const { user } = useAuth()
  const rootRef = useRef(null)
  useReveal(rootRef)
  const primaryTo = user ? '/dashboard' : '/start?segment=professional'
  const primaryLabel = user ? 'Naar het platform' : HERO.primary

  useEffect(() => {
    const prev = document.title
    document.title = 'Buuur, eerst de buren, dan de woningen'
    return () => { document.title = prev }
  }, [])

  return (
    <div className="lp" ref={rootRef}>
      <nav className="lp-nav" aria-label="Hoofdnavigatie">
        <div className="lp-nav__in">
          <Link to="/" className="lp-logo">
            <span className="lp-logo__mark"><i className="fa-solid fa-house" aria-hidden="true" /></span>buuur
            <span className="lp-logo__by">{MAKER.label}</span>
          </Link>
          <div className="lp-nav__links">
            <a href="#voorwie">Voor wie</a>
            <a href="#hoe">Zo werkt het</a>
            <a href="#modules">Wat erin zit</a>
            <a href="#over">Over ons</a>
            <a href="#plans">Light &amp; pro</a>
            {user ? (
              <Link to="/dashboard" className="lp-btn lp-btn--sm">Naar het platform</Link>
            ) : (
              <>
                <Link to="/login">Inloggen</Link>
                <Link to={primaryTo} className="lp-btn lp-btn--sm">{HERO.primary}</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main>
        <div className="lp-wrap">
          <div className="lp-hero">
            <div className="lp-hero__text" data-reveal>
              <Eyebrow><i className="fa-solid fa-people-roof" aria-hidden="true" /> {HERO.eyebrow}</Eyebrow>
              <h1>{HERO.title}</h1>
              <p className="lp-lead">{HERO.lead}</p>
              <div className="lp-hero__cta">
                <Link to={primaryTo} className="lp-btn">{primaryLabel} <i className="fa-solid fa-arrow-right" aria-hidden="true" /></Link>
                <a href={DEMO_URL} className="lp-btn lp-btn--ghost" target="_blank" rel="noopener noreferrer">{HERO.secondary}</a>
              </div>
              <p className="lp-hero__note">{HERO.note}</p>
            </div>
            <HeroVisual />
          </div>
        </div>

        <PhotoStrip />

        <Doelgroepen />

        <section className="lp-section" id="hoe">
          <div className="lp-wrap">
            <div className="lp-sec-h" data-reveal>
              <Eyebrow>{STAPPEN.eyebrow}</Eyebrow>
              <h2>{STAPPEN.title}</h2>
            </div>
            <ol className="lp-steps">
              {STAPPEN.items.map((step, i) => (
                <li key={step.title} className="lp-step" data-reveal style={{ '--d': i }}>
                  <div className="lp-step__media">
                    <img src={step.image.src} alt={step.image.alt} width="800" height="500" loading="lazy" decoding="async" />
                  </div>
                  <span className="lp-step__n" style={bubbleStyle(step.bubble)}>{i + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-section" id="modules">
          <div className="lp-wrap">
            <div className="lp-sec-h" data-reveal>
              <Eyebrow>{MODULES.eyebrow}</Eyebrow>
              <h2>{MODULES.title}</h2>
              <p>{MODULES.intro}</p>
            </div>
            <div className="lp-mods">
              {MODULES.items.map((m, i) => (
                <div key={m.title} className="lp-mod" data-reveal style={{ '--d': i % 3 }}>
                  <span className="lp-bub" style={bubbleStyle(m.bubble)}><i className={m.icon} aria-hidden="true" /></span>
                  <div>
                    <h3>{m.title}</h3>
                    <p>{m.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section" id="over">
          <div className="lp-wrap">
            <div className="lp-over">
              <div className="lp-over__media" data-reveal>
                <img src={OVER.image.src} alt={OVER.image.alt} width="1600" height="1066" loading="lazy" decoding="async" />
              </div>
              <div className="lp-over__body" data-reveal style={{ '--d': 1 }}>
                <Eyebrow>{OVER.eyebrow}</Eyebrow>
                <h2>{OVER.title}</h2>
                {OVER.body.map(text => <p key={text}>{text}</p>)}
                <a href={MAKER.href} className="lp-btn lp-btn--ghost" target="_blank" rel="noopener noreferrer">
                  {OVER.link} <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-band" data-reveal>
          <img className="lp-band__bg" src={QUOTE.image.src} alt={QUOTE.image.alt} loading="lazy" decoding="async" />
          <div className="lp-wrap">
            <figure className="lp-quote lp-quote--band">
              <div>
                <blockquote>"{QUOTE.text}"</blockquote>
                <figcaption>{QUOTE.caption}</figcaption>
              </div>
              <div className="lp-quote__who">
                <span className="lp-av lp-av--lg" style={bubbleStyle('peach')}>{QUOTE.initials}</span>
                <div><b>{QUOTE.name}</b><span>{QUOTE.org}</span></div>
              </div>
            </figure>
          </div>
        </section>

        <section className="lp-section" id="plans">
          <div className="lp-wrap">
            <div className="lp-sec-h" data-reveal>
              <Eyebrow>{PLANS.eyebrow}</Eyebrow>
              <h2>{PLANS.title}</h2>
              <p>{PLANS.intro}</p>
            </div>
            <div className="lp-plans">
              {PLANS.items.map((plan, i) => (
                <div key={plan.key} className={`lp-plan ${plan.featured ? 'lp-plan--featured' : ''}`} data-reveal style={{ '--d': i }}>
                  <span className={`lp-plan__tag lp-plan__tag--${plan.tagTint}`}>{plan.tag}</span>
                  <h3>{plan.name}<small>{plan.sub}</small></h3>
                  <p>{plan.body}</p>
                  <Checks items={plan.points} />
                  <Link to={plan.ctaTo} className={`lp-btn ${plan.featured ? '' : 'lp-btn--ghost'}`}>{plan.cta}</Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section lp-section--tight">
          <div className="lp-wrap">
            <div className="lp-final" data-reveal>
              <div className="lp-final__media">
                <img src={SLOT.image.src} alt={SLOT.image.alt} width="1100" height="900" loading="lazy" decoding="async" />
              </div>
              <div className="lp-final__body">
                <h2>{SLOT.title}</h2>
                <p>{SLOT.body}</p>
                <div className="lp-final__btns">
                  <a href={DEMO_URL} className="lp-btn" target="_blank" rel="noopener noreferrer">{SLOT.primary} <i className="fa-solid fa-arrow-right" aria-hidden="true" /></a>
                  <Link to={primaryTo} className="lp-btn lp-btn--ghost">{SLOT.secondary}</Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap">
          <div className="lp-footer__in">
            <span>
              <b>buuur</b> · {FOOTER.tagline} Een tool van{' '}
              <a href={MAKER.href} className="lp-footer__maker" target="_blank" rel="noopener noreferrer">{MAKER.name}</a>, Amsterdam.
            </span>
            <span className="lp-footer__links">
              <Link to="/privacy">Privacybeleid</Link>
              <Link to="/voorwaarden">Algemene voorwaarden</Link>
              <Link to="/login">Inloggen</Link>
            </span>
          </div>
          <p className="lp-footer__copy">© {new Date().getFullYear()} CrowdBuilding</p>
        </div>
      </footer>
    </div>
  )
}
