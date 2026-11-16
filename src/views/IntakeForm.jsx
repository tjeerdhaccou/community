import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CONSENT_VERSION } from '../lib/constants'
import { getIntakeField } from '../lib/intakeFields'
import { accentVars, ACCENT_VAR_NAMES } from '../lib/brandAccent'
import { loadFonts } from '../lib/fonts'
import '../styles/intake.css'

// Het blauw van Fris: de terugval als een project nergens een kleur heeft staan.
const FRIS_BLUE = '#2341FF'

// De twee kleuren van het CrowdBuilding-thema (zie clean-tokens.css):
// Rebellious Coral voor de knop, Invested Blue voor structuur.
const CROWDBUILDING_COLORS = { accent: '#FF5C54', structure: '#130F33' }

// Huisstijl van het project voor dit formulier. Eerst de kleuren uit "Branding"
// in het CMS (zoals de ledenomgeving ze gebruikt), dan de CrowdBuilding-kleuren
// als het project die stijl heeft, anders de kleuren van de publieke
// projectpagina, anders het Fris-blauw.
function intakeColors(project) {
  if (project?.app_accent_color || project?.app_structure_color) {
    return { accent: project.app_accent_color, structure: project.app_structure_color }
  }
  if (usesCrowdbuilding(project)) return CROWDBUILDING_COLORS
  if (project?.brand_accent_color || project?.brand_primary_color) {
    return { accent: project.brand_accent_color, structure: project.brand_primary_color }
  }
  return { accent: FRIS_BLUE, structure: FRIS_BLUE }
}

function usesCrowdbuilding(project) {
  return (project?.default_theme || project?.organization?.default_theme) === 'crowdbuilding'
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function IntakeForm({ slugOverride } = {}) {
  const params = useParams()
  const projectIdent = slugOverride || params.projectId
  const [project, setProject] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const [inactive, setInactive] = useState(false)

  // Form fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [answers, setAnswers] = useState({})
  const [consent, setConsent] = useState(false)
  const [termsConsent, setTermsConsent] = useState(false)

  useEffect(() => {
    loadForm()
  }, [projectIdent])

  // Fris is hier de vaste basis, ook voor bezoekers die Fris niet aan hebben
  // staan en ook bij de CrowdBuilding-stijl. Daar zetten we niet het
  // CrowdBuilding-thema aan (Fris en dat thema gaan nooit samen), maar nemen we
  // alleen de twee kleuren ervan over als accent.
  // Altijd licht: dit formulier rendert nooit in dark mode.
  const brandVars = accentVars(intakeColors(project), false)

  useEffect(() => {
    loadFonts(['Instrument Serif'])
  }, [])

  // Thema en projectkleuren ook op <html>, zodat wat buiten het formulier valt
  // (de cookiebalk) dezelfde kleuren draagt.
  useEffect(() => {
    if (!project) return
    const root = document.documentElement
    const prevTheme = root.getAttribute('data-theme')
    root.setAttribute('data-theme', 'warm')
    Object.entries(brandVars).forEach(([name, value]) => root.style.setProperty(name, value))

    return () => {
      if (prevTheme) root.setAttribute('data-theme', prevTheme)
      else root.removeAttribute('data-theme')
      ACCENT_VAR_NAMES.forEach((name) => root.style.removeProperty(name))
    }
  }, [project])

  async function loadForm() {
    setLoading(true)
    try {
      const projectColumn = UUID_REGEX.test(projectIdent) ? 'id' : 'slug'
      const projectRes = await supabase
        .from('projects')
        .select('id, name, tagline, description, logo_url, cover_image_url, brand_primary_color, brand_accent_color, app_accent_color, app_structure_color, intake_enabled, intake_intro_text, default_theme, organization:organizations(default_theme)')
        .eq(projectColumn, projectIdent)
        .single()

      if (projectRes.error) throw projectRes.error
      if (!projectRes.data.intake_enabled) {
        // Project wel bewaren: zo draagt ook deze melding het logo en de kleuren.
        setProject(projectRes.data)
        setInactive(true)
        setError('Dit aanmeldformulier is niet actief.')
        setLoading(false)
        return
      }

      const questionsRes = await supabase
        .from('intake_questions')
        .select('*')
        .eq('project_id', projectRes.data.id)
        .eq('active', true)
        .order('sort_order')

      setProject(projectRes.data)
      setQuestions(questionsRes.data || [])
    } catch (err) {
      console.error('Load error:', err)
      setError('Formulier kon niet geladen worden.')
    } finally {
      setLoading(false)
    }
  }

  function setAnswer(questionId, value) {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const now = new Date().toISOString()
      // Id client-side genereren: anonieme inzenders hebben wel INSERT- maar geen
      // SELECT-recht op intake_responses, dus kunnen we het id niet terugkrijgen via
      // .select(). Met een eigen uuid kennen we 'm toch voor de bevestigingsmail.
      const responseId = crypto.randomUUID()
      const { error: insertError } = await supabase.from('intake_responses').insert({
        id: responseId,
        project_id: project.id,
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        answers,
        terms_accepted_at: now,
        terms_version: CONSENT_VERSION,
        // Aparte toestemming voor het delen van gegevens met initiatiefnemers/leden.
        // De verzendknop staat uit tot dit vinkje aan is, dus hier altijd gezet.
        data_sharing_consent_at: now,
      })

      if (insertError) throw insertError
      setSubmitted(true)

      // Bevestigingsmail (best-effort): de aanmelder weet dat de aanvraag in
      // behandeling is. Mag de succespagina nooit blokkeren — fouten loggen we stil.
      supabase.functions
        .invoke('send-member-email', { body: { type: 'intake_received', responseId } })
        .catch(err => console.error('intake_received email failed:', err))
    } catch (err) {
      console.error('Submit error:', err)
      setError('Er ging iets mis bij het versturen. Probeer het opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  // Tekst/icoon-accent: de op contrast afgestemde variant van de steunkleur,
  // of het functionele accent als het project er geen heeft ingesteld.
  const brandColor = 'var(--accent-primary)'

  // De Fris-tokens gelden vanaf dit element; de projectkleuren staan er inline
  // op, want anders wint het Fris-blauw van wat er op <html> staat.
  const pageProps = { className: 'join-page intake-fris', 'data-look': 'fris', style: brandVars }

  if (loading) {
    return (
      <div {...pageProps}>
        <div className="join-card">
          <div className="join-card__content" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <p className="intake-loading" style={{ color: 'var(--text-tertiary)' }}>Formulier laden...</p>
          </div>
        </div>
      </div>
    )
  }

  if (inactive || (error && !project)) {
    return (
      <div {...pageProps}>
        <div className="join-card intake-state">
          <div className="join-card__content">
            {project?.logo_url && (
              <img src={project.logo_url} alt={project.name + ' logo'} className="join-card__logo" />
            )}
            <div className="join-card__icon join-card__icon--error">
              <i className="fa-solid fa-circle-exclamation" />
            </div>
            <h2 className="intake-state__title">Niet beschikbaar</h2>
            <p className="join-card__tagline">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div {...pageProps}>
        <div className="join-card intake-state intake-state--done" role="status">
          <div className="join-card__content" style={{ paddingTop: 32 }}>
            {project.logo_url && (
              <img src={project.logo_url} alt={project.name + ' logo'} className="join-card__logo" />
            )}
            <div className="intake-success-icon" style={{ color: brandColor }}>
              <i className="fa-solid fa-circle-check" />
            </div>
            <h1 className="join-card__title">Bedankt, {firstName.trim()}!</h1>
            <p className="join-card__tagline">
              Je aanmelding voor {project.name} is ontvangen. De beheerders bekijken je aanmelding
              en nemen contact met je op via {email}.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div {...pageProps}>
      <div className="join-card join-card--wide">
        {project.cover_image_url && (
          <div className="intake-hero">
            <img src={project.cover_image_url} alt={project.name + ' cover'} />
          </div>
        )}
        <div className="join-card__content">
          {project.logo_url && (
            <img
              src={project.logo_url}
              alt={project.name + ' logo'}
              className="join-card__logo"
            />
          )}
          <p className="intake-eyebrow">Aanmelden</p>
          <h1 className="join-card__title">{project.name}</h1>
          {project.tagline && <p className="join-card__tagline">{project.tagline}</p>}

          {project.intake_intro_text && (
            <p className="intake-intro">{project.intake_intro_text}</p>
          )}

          <form onSubmit={handleSubmit} className="intake-form">
            {/* Contact info */}
            <div className="intake-section-label">
              <i className="fa-solid fa-user" /> Jouw gegevens
            </div>

            <div className="form-row">
              <div className="form-group form-group--half">
                <label htmlFor="intake-first">Voornaam <Req /></label>
                <input
                  id="intake-first"
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Voornaam"
                  required
                />
              </div>
              <div className="form-group form-group--half">
                <label htmlFor="intake-last">Achternaam <Req /></label>
                <input
                  id="intake-last"
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Achternaam"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group form-group--half">
                <label htmlFor="intake-email">E-mailadres <Req /></label>
                <input
                  id="intake-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="naam@voorbeeld.nl"
                  required
                />
              </div>
              <div className="form-group form-group--half">
                <label htmlFor="intake-phone">Telefoonnummer</label>
                <input
                  id="intake-phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="06-12345678"
                />
              </div>
            </div>

            {/* Dynamic questions */}
            {questions.length > 0 && (
              <>
                <div className="intake-section-label">
                  <i className="fa-solid fa-comments" /> Over jou
                </div>

                {questions.map(q => {
                  const field = q.profile_field_key ? getIntakeField(q.profile_field_key) : null
                  return (
                    <div key={q.id} className="form-group">
                      <label htmlFor={`q-${q.id}`}>
                        {q.question_text}{q.required && <> <Req /></>}
                      </label>
                      {field?.help && <p className="form-hint" style={{ margin: '2px 0 6px' }}>{field.help}</p>}
                      {renderQuestion(q, field, answers[q.id], val => setAnswer(q.id, val))}
                    </div>
                  )
                })}
              </>
            )}

            {/* Consent */}
            <label className="intake-consent">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
              <span>Ik ga akkoord dat mijn gegevens gedeeld worden met de initiatiefnemers en leden van {project.name}.</span>
            </label>

            <label className="intake-consent">
              <input type="checkbox" checked={termsConsent} onChange={e => setTermsConsent(e.target.checked)} />
              <span>
                Ik ga akkoord met de{' '}
                <a href="/voorwaarden" target="_blank" rel="noopener noreferrer">algemene voorwaarden</a>{' '}
                en de{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">privacyverklaring</a>.
              </span>
            </label>

            {error && <p className="join-card__error" role="alert">{error}</p>}

            <button
              type="submit"
              className="btn-primary join-card__btn"
              disabled={submitting || !firstName.trim() || !lastName.trim() || !email.trim() || !consent || !termsConsent}
              style={{ background: 'var(--accent-cta)', color: 'var(--accent-on-cta)' }}
            >
              {submitting ? 'Versturen...' : 'Aanmelding versturen'}
              {!submitting && <i className="fa-solid fa-arrow-right" aria-hidden="true" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// Sterretje bij een verplicht veld. Het veld zelf draagt `required`, dus voor
// schermlezers is het teken dubbelop.
function Req() {
  return <span className="intake-req" aria-hidden="true">*</span>
}

function renderQuestion(question, field, value, onChange) {
  const id = `q-${question.id}`

  // Catalogus-gekoppelde vraag: render op basis van het profielveld, met
  // canonieke waarden en het juiste opslagtype.
  if (field) {
    switch (field.type) {
      case 'select':
        return (
          <select id={id} value={value || ''} onChange={e => onChange(e.target.value)} required={question.required}>
            <option value="">Kies…</option>
            {field.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        )
      case 'textarea':
        return (
          <textarea id={id} value={value || ''} onChange={e => onChange(e.target.value)} rows={3} required={question.required} />
        )
      case 'boolean':
        // Ja/Nee als radio's: zo is "nee" een expliciet antwoord en niet
        // hetzelfde als "nog niet ingevuld" (wat bij een los vinkje wel zo was).
        return (
          <div className="intake-radio-group" role="radiogroup" aria-label={question.question_text}>
            {[{ val: true, label: 'Ja' }, { val: false, label: 'Nee' }].map(opt => (
              <label key={opt.label} className="intake-radio-option">
                <input
                  type="radio"
                  name={id}
                  checked={value === opt.val}
                  onChange={() => onChange(opt.val)}
                  required={question.required && value == null}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        )
      case 'number':
        return (
          <input
            id={id}
            type="number"
            value={value ?? ''}
            onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
            required={question.required}
          />
        )
      case 'date':
        return (
          <input id={id} type="date" value={value || ''} onChange={e => onChange(e.target.value)} required={question.required} />
        )
      default:
        return (
          <input id={id} type="text" value={value || ''} onChange={e => onChange(e.target.value)} required={question.required} />
        )
    }
  }

  const v = value || ''

  switch (question.question_type) {
    case 'textarea':
      return (
        <textarea
          id={id}
          value={v}
          onChange={e => onChange(e.target.value)}
          placeholder="Typ hier je antwoord..."
          rows={3}
          required={question.required}
        />
      )

    case 'select':
      return (
        <select
          id={id}
          value={v}
          onChange={e => onChange(e.target.value)}
          required={question.required}
        >
          <option value="">Kies een optie...</option>
          {(question.options || []).map((opt, i) => (
            <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
      )

    case 'radio':
      return (
        <div className="intake-radio-group">
          {(question.options || []).map((opt, i) => (
            <label key={i} className="intake-radio-option">
              <input
                type="radio"
                name={id}
                value={opt}
                checked={v === opt}
                onChange={() => onChange(opt)}
                required={question.required && !v}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )

    case 'text':
    default:
      return (
        <input
          id={id}
          type="text"
          value={v}
          onChange={e => onChange(e.target.value)}
          placeholder="Typ hier je antwoord..."
          required={question.required}
        />
      )
  }
}
