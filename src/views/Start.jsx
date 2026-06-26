import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import { loadFonts } from '../lib/fonts'
import {
  UnderlineDoodle,
  SparkleDoodle,
  SmileyDoodle,
  HouseDoodle,
} from '../components/LandingDoodles'
import '../styles/landing.css'

const SEGMENTS = {
  bewoner: {
    icon: <HouseDoodle />,
    color: 'var(--lp-green)',
    soft: 'var(--lp-green-soft)',
    title: 'Ik wil hier (samen) wonen',
    desc: 'Je bent toekomstig bewoner, zoekt een woonproject of bent onderdeel van een bewonersgroep.',
    formTitle: 'Vertel ons over je woonwens',
    formIntro: 'Laat je gegevens achter en we nemen contact op zodra buuur light beschikbaar is — of eerder, als er een project bij je past.',
  },
  professional: {
    icon: <SparkleDoodle />,
    color: 'var(--lp-lilac)',
    soft: 'var(--lp-lilac-soft)',
    title: 'Ik begeleid of ontwikkel projecten',
    desc: 'Je bent procesbegeleider, projectontwikkelaar, corporatie of gemeente en wilt in contact staan met toekomstige bewoners.',
    formTitle: 'Vertel ons over je project',
    formIntro: 'Laat je gegevens achter en we plannen een kennismaking — we laten je graag zien wat buuur pro voor jouw project kan doen.',
  },
}

const BEWONER_SITUATIES = [
  'Ik oriënteer me nog',
  'Ik zoek een bestaand woonproject',
  'Ik ben onderdeel van een bewonersgroep',
  'Ons initiatief zoekt een platform',
]

const PRO_ROLLEN = [
  'Procesbegeleider',
  'Projectontwikkelaar',
  'Woningcorporatie',
  'Gemeente',
  'Anders',
]

export default function Start() {
  const [searchParams, setSearchParams] = useSearchParams()
  const paramSegment = searchParams.get('segment')
  const segment = SEGMENTS[paramSegment] ? paramSegment : null

  // landing.css verwijst naar Inter/Space Grotesk/Caveat — on-demand laden.
  useEffect(() => { loadFonts(['Inter', 'Space Grotesk', 'Caveat']) }, [])

  const [form, setForm] = useState({
    name: '',
    email: '',
    organization: '',
    role: '',
    region: '',
    situation: '',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  function pickSegment(key) {
    setSearchParams({ segment: key })
    setError(null)
  }

  function update(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error: insertError } = await supabase.from('leads').insert({
      segment,
      name: form.name.trim(),
      email: form.email.trim(),
      organization: form.organization.trim() || null,
      role: segment === 'professional' ? form.role || null : null,
      region: segment === 'bewoner' ? form.region.trim() || null : null,
      phase: segment === 'bewoner' ? form.situation || null : null,
      message: form.message.trim() || null,
      source: 'landing',
    })
    setSubmitting(false)
    if (insertError) {
      logger.error('Lead insert failed', insertError)
      setError('Er ging iets mis bij het versturen. Probeer het opnieuw of mail ons op hallo@buuur.nl.')
      return
    }
    setDone(true)
  }

  const seg = segment ? SEGMENTS[segment] : null

  return (
    <div className="lp">
      <nav className="lp-nav">
        <div className="lp-nav__inner">
          <Link to="/" className="lp-nav__logo" style={{ textDecoration: 'none' }}>
            buuur
            <UnderlineDoodle stretch />
          </Link>
          <div className="lp-nav__links">
            <Link to="/login" className="lp-btn lp-btn--small">Inloggen</Link>
          </div>
        </div>
      </nav>

      <main className="lp-main">
        <div className="lp-start">
          {done ? (
            <div className="lp-start__success">
              <div className="lp-start__success-smiley"><SmileyDoodle /></div>
              <h1>Gelukt!</h1>
              <p>
                Bedankt {form.name.split(' ')[0]} — we hebben je bericht ontvangen
                en nemen snel contact met je op.
              </p>
              <Link to="/" className="lp-btn">
                Terug naar de homepage
              </Link>
            </div>
          ) : !segment ? (
            <>
              <header className="lp-start__header">
                <h1>
                  Waar kunnen we je{' '}
                  <span className="lp-underlined">
                    mee helpen
                    <UnderlineDoodle stretch />
                  </span>
                  ?
                </h1>
                <p>Kies wat het best bij je past — dan stellen we de juiste vragen.</p>
              </header>
              <div className="lp-start__choices">
                {Object.entries(SEGMENTS).map(([key, s]) => (
                  <button
                    key={key}
                    type="button"
                    className="lp-card lp-start__choice"
                    style={{ '--c': s.color, '--c-soft': s.soft }}
                    onClick={() => pickSegment(key)}
                  >
                    <span className="lp-start__choice-icon">{s.icon}</span>
                    <h2>{s.title}</h2>
                    <p>{s.desc}</p>
                    <span className="lp-start__choice-cta">
                      Verder <i className="fa-solid fa-arrow-right" />
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                className="lp-start__back"
                onClick={() => setSearchParams({})}
              >
                <i className="fa-solid fa-arrow-left" /> Andere keuze
              </button>
              <header className="lp-start__header">
                <h1>{seg.formTitle}</h1>
                <p>{seg.formIntro}</p>
              </header>
              <form className="lp-card lp-start__form" style={{ '--c': seg.color }} onSubmit={handleSubmit}>
                <div className="lp-field">
                  <label htmlFor="lead-name">Naam *</label>
                  <input
                    id="lead-name"
                    className="lp-input"
                    type="text"
                    required
                    autoComplete="name"
                    value={form.name}
                    onChange={update('name')}
                  />
                </div>
                <div className="lp-field">
                  <label htmlFor="lead-email">E-mailadres *</label>
                  <input
                    id="lead-email"
                    className="lp-input"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={update('email')}
                  />
                </div>

                {segment === 'bewoner' && (
                  <>
                    <div className="lp-field">
                      <label htmlFor="lead-region">Regio of woonplaats</label>
                      <input
                        id="lead-region"
                        className="lp-input"
                        type="text"
                        placeholder="bijv. Amsterdam, Achterhoek…"
                        value={form.region}
                        onChange={update('region')}
                      />
                    </div>
                    <div className="lp-field">
                      <label htmlFor="lead-situation">Waar sta je nu?</label>
                      <select
                        id="lead-situation"
                        className="lp-input"
                        value={form.situation}
                        onChange={update('situation')}
                      >
                        <option value="">Maak een keuze…</option>
                        {BEWONER_SITUATIES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {segment === 'professional' && (
                  <>
                    <div className="lp-field">
                      <label htmlFor="lead-org">Organisatie *</label>
                      <input
                        id="lead-org"
                        className="lp-input"
                        type="text"
                        required
                        autoComplete="organization"
                        value={form.organization}
                        onChange={update('organization')}
                      />
                    </div>
                    <div className="lp-field">
                      <label htmlFor="lead-role">Jouw rol</label>
                      <select
                        id="lead-role"
                        className="lp-input"
                        value={form.role}
                        onChange={update('role')}
                      >
                        <option value="">Maak een keuze…</option>
                        {PRO_ROLLEN.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div className="lp-field">
                  <label htmlFor="lead-message">
                    {segment === 'bewoner' ? 'Vertel iets over je woonwens' : 'Vertel iets over je project'}
                  </label>
                  <textarea
                    id="lead-message"
                    className="lp-input"
                    rows={4}
                    value={form.message}
                    onChange={update('message')}
                  />
                </div>

                {error && <p className="lp-start__error">{error}</p>}

                <div className="lp-start__actions">
                  <button type="submit" className="lp-btn" disabled={submitting}>
                    {submitting ? 'Versturen…' : 'Verstuur'} <i className="fa-solid fa-paper-plane" />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </main>

      <footer className="lp-footer">
        <div className="lp-footer__inner">
          <p className="lp-footer__copy">© {new Date().getFullYear()} CrowdBuilding — Met ❤️ gemaakt in Amsterdam</p>
        </div>
      </footer>
    </div>
  )
}
