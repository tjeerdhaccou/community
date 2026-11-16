import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { sendOtpCode, verifyOtpCode } from '../lib/auth'
import { useAuth } from '../contexts/AuthContext'
import { logger } from '../lib/logger'
import { loadFonts } from '../lib/fonts'
import { CONSENT_VERSION } from '../lib/constants'
import { START_GROEP as C, MODULES } from '../content/landing'
import '../styles/landing.css'

function toSlug(value) {
  return value
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

// Zelfde regel als create_initiative_group in de database.
const SLUG_OK = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/

const LIGHT_MODULES = MODULES.items.filter(m => C.modules.titles.includes(m.title))

function bubbleStyle(name) {
  return { '--lp-b-bg': `var(--lp-bub-${name}-bg)`, '--lp-b-fg': `var(--lp-bub-${name}-fg)`, '--lp-b-ic': `var(--lp-ic-${name})` }
}

/**
 * Zelf een groep starten vanaf buuur.nl (buuur light), zonder uitnodiging.
 *
 * Stap 1: gegevens van de initiatiefnemer en de groep.
 * Stap 2: code uit de mail. Die bevestigt het adres en maakt het account aan.
 * Daarna maakt create_initiative_group de groep aan en gaat de bezoeker door
 * naar de "Aan de slag"-checklist van het nieuwe project.
 *
 * Wie al is ingelogd slaat de code-stap over. De gewone login (/login) blijft
 * op uitnodiging; dit is de enige plek waar een nieuw adres een account krijgt.
 */
export default function StartGroep() {
  const { user, profile } = useAuth()
  const [step, setStep] = useState('form') // form | code | creating
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', group: '', slug: '', location: '', consent: false })
  const [slugTouched, setSlugTouched] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [resent, setResent] = useState(false)

  useEffect(() => { loadFonts(['Instrument Serif']) }, [])

  // Al ingelogd: naam en akkoord zijn bekend, alleen de groep nog invullen.
  const hasProfileName = !!(profile?.first_name?.trim() && profile?.last_name?.trim())
  const hasConsent = !!profile?.terms_accepted_at && profile?.terms_version === CONSENT_VERSION
  const askName = !user || !hasProfileName
  const askConsent = !user || !hasConsent

  const slugValid = SLUG_OK.test(form.slug)
  const formValid =
    form.group.trim().length >= 2 && slugValid &&
    (!askName || (form.firstName.trim() && form.lastName.trim())) &&
    (user || /^\S+@\S+\.\S+$/.test(form.email.trim())) &&
    (!askConsent || form.consent)

  function update(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function createGroup(userId) {
    setStep('creating')

    // Naam en akkoord op het profiel, zodat het project niet opnieuw vraagt.
    const patch = {}
    if (askName) {
      patch.first_name = form.firstName.trim()
      patch.last_name = form.lastName.trim()
      patch.full_name = `${form.firstName.trim()} ${form.lastName.trim()}`
    }
    if (askConsent) {
      patch.terms_accepted_at = new Date().toISOString()
      patch.terms_version = CONSENT_VERSION
    }
    if (Object.keys(patch).length) {
      const { error: profileError } = await supabase.from('profiles').update(patch).eq('id', userId)
      if (profileError) logger.error('StartGroep: profiel bijwerken mislukt', profileError)
    }

    const { data, error: rpcError } = await supabase.rpc('create_initiative_group', {
      p_group_name: form.group.trim(),
      p_slug: form.slug,
    })
    if (rpcError) {
      logger.error('create_initiative_group failed', rpcError)
      // De functie geeft zelf een Nederlandse melding (adres bezet, limiet, ...).
      setError(rpcError.code === 'P0001' || rpcError.code === '42501'
        ? rpcError.message
        : 'Het aanmaken is niet gelukt. Probeer het opnieuw.')
      setStep('form')
      return
    }

    const location = form.location.trim()
    const name = askName ? patch.full_name : (profile?.full_name || '')
    const email = user?.email || form.email.trim().toLowerCase()
    // Bijzaken: mogen het starten niet tegenhouden.
    await Promise.allSettled([
      location
        ? supabase.from('projects').update({ location }).eq('id', data.project_id)
        : Promise.resolve(),
      // Melding aan het buuur-team via de bestaande leads-mail.
      supabase.from('leads').insert({
        segment: 'bewoner',
        name: name || email,
        email,
        organization: form.group.trim(),
        region: location || null,
        phase: 'Heeft zelf een groep gestart',
        message: `Nieuwe buuur light-groep: ${data.slug}.buuur.nl`,
        source: 'start-groep',
      }),
    ])

    // Volledige paginawissel: na de code-stap kent de AuthContext de nieuwe
    // membership nog niet, en een verse start laadt alles in één keer goed.
    window.location.replace(`/p/${data.slug}/aan-de-slag`)
  }

  async function handleForm(e) {
    e.preventDefault()
    if (!formValid || busy) return
    setError(null)
    if (user) {
      await createGroup(user.id)
      return
    }
    setBusy(true)
    try {
      await sendOtpCode(form.email)
      setCode('')
      setStep('code')
    } catch (err) {
      logger.error('StartGroep: code versturen mislukt', err)
      setError(err?.status === 429
        ? 'Er zijn net te veel codes aangevraagd. Wacht een minuut en probeer het opnieuw.'
        : 'We konden geen code versturen. Controleer je e-mailadres en probeer het opnieuw.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCode(e) {
    e.preventDefault()
    if (code.length < 6 || busy) return
    setBusy(true)
    setError(null)
    let session
    try {
      const result = await verifyOtpCode(form.email, code)
      session = result?.session
    } catch (err) {
      logger.error('StartGroep: code ongeldig', err)
    }
    setBusy(false)
    if (!session) {
      setError('Deze code klopt niet of is verlopen. Controleer je mail of vraag een nieuwe code aan.')
      return
    }
    await createGroup(session.user.id)
  }

  async function handleResend() {
    setError(null)
    setResent(false)
    try {
      await sendOtpCode(form.email)
      setResent(true)
    } catch {
      setError('Een nieuwe code versturen lukte niet. Wacht een minuut en probeer het opnieuw.')
    }
  }

  const panel = step === 'creating' ? (
    <div className="lp-sg__busy" role="status">
      <h2>Je groep wordt klaargezet</h2>
      <p><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Een ogenblik…</p>
    </div>
  ) : step === 'code' ? (
    <>
      <button type="button" className="lp-back" onClick={() => { setStep('form'); setError(null) }}>
        <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Gegevens aanpassen
      </button>
      <h2>Check je mail</h2>
      <p>We hebben een code gestuurd naar <strong>{form.email.trim()}</strong>. Vul hem hieronder in, dan staat {form.group.trim()} klaar.</p>
      <form className="lp-form" onSubmit={handleCode}>
        <div className="lp-field">
          <label htmlFor="sg-code">Code uit de mail</label>
          <input
            id="sg-code" className="lp-input" type="text" inputMode="numeric" autoComplete="one-time-code"
            autoFocus maxLength={8} value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        {error && <p className="lp-form__error" role="alert">{error}</p>}
        {resent && !error && <p role="status" className="lp-sg__hint">Er is een nieuwe code onderweg.</p>}
        <div className="lp-form__actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="lp-back" style={{ margin: 0 }} onClick={handleResend}>Nieuwe code sturen</button>
          <button type="submit" className="lp-btn" disabled={busy || code.length < 6}>
            {busy ? 'Controleren…' : 'Groep starten'} <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </button>
        </div>
      </form>
    </>
  ) : (
    <>
      <h2>Jouw groep in een paar minuten</h2>
      <p>Vul dit in, dan sturen we een code naar je mail.</p>
      <form className="lp-form" onSubmit={handleForm}>
        {askName && (
          <>
            <div className="lp-field">
              <label htmlFor="sg-first">Voornaam *</label>
              <input id="sg-first" className="lp-input" type="text" required autoComplete="given-name" value={form.firstName} onChange={update('firstName')} />
            </div>
            <div className="lp-field">
              <label htmlFor="sg-last">Achternaam *</label>
              <input id="sg-last" className="lp-input" type="text" required autoComplete="family-name" value={form.lastName} onChange={update('lastName')} />
            </div>
          </>
        )}
        {!user && (
          <div className="lp-field">
            <label htmlFor="sg-email">E-mailadres *</label>
            <input id="sg-email" className="lp-input" type="email" required autoComplete="email" value={form.email} onChange={update('email')} />
          </div>
        )}

        <div className="lp-field">
          <label htmlFor="sg-group">Naam van je initiatief *</label>
          <input
            id="sg-group" className="lp-input" type="text" required maxLength={80}
            placeholder="Bijvoorbeeld Vlinderhaven" value={form.group}
            onChange={e => {
              const group = e.target.value
              setForm(f => ({ ...f, group, slug: slugTouched ? f.slug : toSlug(group) }))
            }}
          />
        </div>
        <div className="lp-field">
          <label htmlFor="sg-slug">Webadres *</label>
          <div className="lp-sg__slug">
            <input
              id="sg-slug" className="lp-input" type="text" required maxLength={40}
              value={form.slug} aria-describedby="sg-slug-hint"
              onChange={e => {
                setSlugTouched(true)
                setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))
              }}
            />
            <span>.buuur.nl</span>
          </div>
          <span id="sg-slug-hint" className="lp-sg__hint">
            {form.slug && !slugValid
              ? 'Gebruik 3 tot 40 tekens: kleine letters, cijfers en koppeltekens.'
              : 'Op dit adres vinden je leden de groep. Later wijzigen kan niet zelf.'}
          </span>
        </div>
        <div className="lp-field">
          <label htmlFor="sg-location">Plaats of regio</label>
          <input id="sg-location" className="lp-input" type="text" placeholder="Bijvoorbeeld Amsterdam of de Achterhoek" value={form.location} onChange={update('location')} />
        </div>

        {askConsent && (
          <label className="lp-sg__consent">
            <input type="checkbox" required checked={form.consent} onChange={e => setForm(f => ({ ...f, consent: e.target.checked }))} />
            <span>
              Ik ga akkoord met de <Link to="/voorwaarden" target="_blank">algemene voorwaarden</Link> en
              de <Link to="/privacy" target="_blank">privacyverklaring</Link>.
            </span>
          </label>
        )}

        {error && <p className="lp-form__error" role="alert">{error}</p>}

        <div className="lp-form__actions">
          <button type="submit" className="lp-btn" disabled={busy || !formValid}>
            {busy ? 'Versturen…' : user ? 'Groep starten' : 'Verder'} <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </button>
        </div>
      </form>
    </>
  )

  return (
    <div className="lp" data-look="fris">
      <nav className="lp-nav" aria-label="Hoofdnavigatie">
        <div className="lp-nav__in">
          <Link to="/" className="lp-logo">
            <span className="lp-logo__mark"><i className="fa-solid fa-house" aria-hidden="true" /></span>buuur
          </Link>
          {!user && (
            <div className="lp-nav__links">
              <Link to="/login" className="lp-btn lp-btn--ghost lp-btn--sm">Inloggen</Link>
            </div>
          )}
        </div>
      </nav>

      <main>
        <div className="lp-wrap">
          <div className="lp-sg">
            <div className="lp-sg__pitch">
              <header className="lp-start__head">
                <span className="lp-eyebrow">{C.eyebrow}</span>
                <h1>{C.title}</h1>
                <p>{C.intro}</p>
              </header>
              <ul className="lp-checks">
                {C.points.map(text => (
                  <li key={text}>
                    <span className="lp-check"><i className="fa-solid fa-check" aria-hidden="true" /></span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
              <div className="lp-sg__img"><img src={C.image.src} alt={C.image.alt} loading="lazy" /></div>
            </div>
            <div className="lp-sg__card" id="formulier">{panel}</div>
          </div>
        </div>

        <section className="lp-section">
          <div className="lp-wrap">
            <div className="lp-sec-h">
              <span className="lp-eyebrow">{C.steps.eyebrow}</span>
              <h2>{C.steps.title}</h2>
            </div>
            <ol className="lp-steps">
              {C.steps.items.map((s, i) => (
                <li key={s.title} className="lp-step">
                  <span className="lp-step__n">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-section lp-section--tight">
          <div className="lp-wrap">
            <div className="lp-sec-h">
              <span className="lp-eyebrow">{C.modules.eyebrow}</span>
              <h2>{C.modules.title}</h2>
            </div>
            <div className="lp-mods">
              {LIGHT_MODULES.map(m => (
                <div key={m.title} className="lp-mod">
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

        <section className="lp-section lp-section--tight">
          <div className="lp-wrap">
            <div className="lp-sec-h">
              <span className="lp-eyebrow">{C.faq.eyebrow}</span>
              <h2>{C.faq.title}</h2>
            </div>
            <div className="lp-faq">
              {C.faq.items.map(f => (
                <div key={f.q}>
                  <h3>{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="lp-sg-final">
          <a href="#formulier" className="lp-btn">{C.finalCta} <i className="fa-solid fa-arrow-up" aria-hidden="true" /></a>
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
