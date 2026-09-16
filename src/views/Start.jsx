import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import { START } from '../content/landing'
import '../styles/landing.css'

const SEGMENTS = START.segments

function bubbleStyle(name) {
  return { '--lp-b-bg': `var(--lp-bub-${name}-bg)`, '--lp-b-fg': `var(--lp-bub-${name}-fg)` }
}

export default function Start() {
  const [searchParams, setSearchParams] = useSearchParams()
  const paramSegment = searchParams.get('segment')
  const segment = SEGMENTS[paramSegment] ? paramSegment : null

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
      setError(START.error)
      return
    }
    setDone(true)
  }

  const seg = segment ? SEGMENTS[segment] : null
  const firstName = form.name.trim().split(' ')[0]

  return (
    <div className="lp">
      <nav className="lp-nav" aria-label="Hoofdnavigatie">
        <div className="lp-nav__in">
          <Link to="/" className="lp-logo">
            <span className="lp-logo__mark"><i className="fa-solid fa-house" aria-hidden="true" /></span>buuur
          </Link>
          <div className="lp-nav__links">
            <Link to="/login" className="lp-btn lp-btn--ghost lp-btn--sm">Inloggen</Link>
          </div>
        </div>
      </nav>

      <main>
        <div className="lp-start">
          {done ? (
            <div className="lp-start__done">
              <span className="lp-bub lp-bub--lg" style={bubbleStyle('green')}><i className="fa-solid fa-check" aria-hidden="true" /></span>
              <h1>{START.successTitle}</h1>
              <p>{START.successBody.replace('{naam}', firstName || 'je')}</p>
              <Link to="/" className="lp-btn">{START.successCta}</Link>
            </div>
          ) : !segment ? (
            <>
              <header className="lp-start__head">
                <h1>{START.chooseTitle}</h1>
                <p>{START.chooseIntro}</p>
              </header>
              <div className="lp-choices">
                {Object.entries(SEGMENTS).map(([key, s]) => (
                  <button key={key} type="button" className="lp-choice" onClick={() => pickSegment(key)}>
                    <span className="lp-bub" style={bubbleStyle(s.bubble)}><i className={s.icon} aria-hidden="true" /></span>
                    <h2>{s.title}</h2>
                    <p>{s.desc}</p>
                    <span className="lp-choice__cta">Verder <i className="fa-solid fa-arrow-right" aria-hidden="true" /></span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button type="button" className="lp-back" onClick={() => setSearchParams({})}>
                <i className="fa-solid fa-arrow-left" aria-hidden="true" /> {START.back}
              </button>
              <header className="lp-start__head">
                <h1>{seg.formTitle}</h1>
                <p>{seg.formIntro}</p>
              </header>
              <form className="lp-form" onSubmit={handleSubmit}>
                <div className="lp-field">
                  <label htmlFor="lead-name">Naam *</label>
                  <input id="lead-name" className="lp-input" type="text" required autoComplete="name" value={form.name} onChange={update('name')} />
                </div>
                <div className="lp-field">
                  <label htmlFor="lead-email">E-mailadres *</label>
                  <input id="lead-email" className="lp-input" type="email" required autoComplete="email" value={form.email} onChange={update('email')} />
                </div>

                {segment === 'bewoner' && (
                  <>
                    <div className="lp-field">
                      <label htmlFor="lead-region">Regio of woonplaats</label>
                      <input id="lead-region" className="lp-input" type="text" placeholder="Bijvoorbeeld Amsterdam of de Achterhoek" value={form.region} onChange={update('region')} />
                    </div>
                    <div className="lp-field">
                      <label htmlFor="lead-situation">Waar sta je nu?</label>
                      <select id="lead-situation" className="lp-input" value={form.situation} onChange={update('situation')}>
                        <option value="">Maak een keuze</option>
                        {seg.situations.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {segment === 'professional' && (
                  <>
                    <div className="lp-field">
                      <label htmlFor="lead-org">Organisatie *</label>
                      <input id="lead-org" className="lp-input" type="text" required autoComplete="organization" value={form.organization} onChange={update('organization')} />
                    </div>
                    <div className="lp-field">
                      <label htmlFor="lead-role">Jouw rol</label>
                      <select id="lead-role" className="lp-input" value={form.role} onChange={update('role')}>
                        <option value="">Maak een keuze</option>
                        {seg.roles.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </>
                )}

                <div className="lp-field">
                  <label htmlFor="lead-message">{seg.messageLabel}</label>
                  <textarea id="lead-message" className="lp-input" rows={4} value={form.message} onChange={update('message')} />
                </div>

                {error && <p className="lp-form__error" role="alert">{error}</p>}

                <div className="lp-form__actions">
                  <button type="submit" className="lp-btn" disabled={submitting}>
                    {submitting ? 'Versturen…' : 'Verstuur'} <i className="fa-solid fa-paper-plane" aria-hidden="true" />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap">
          <p className="lp-footer__copy">© {new Date().getFullYear()} CrowdBuilding</p>
        </div>
      </footer>
    </div>
  )
}
