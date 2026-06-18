import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CONSENT_VERSION } from '../lib/constants'
import { getIntakeField } from '../lib/intakeFields'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function IntakeForm() {
  const { projectId: projectIdent } = useParams()
  const [project, setProject] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  // Form fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [answers, setAnswers] = useState({})
  const [consent, setConsent] = useState(false)
  const [termsConsent, setTermsConsent] = useState(false)

  useEffect(() => {
    loadForm()
  }, [projectIdent])

  async function loadForm() {
    setLoading(true)
    try {
      const projectColumn = UUID_REGEX.test(projectIdent) ? 'id' : 'slug'
      const projectRes = await supabase
        .from('projects')
        .select('id, name, tagline, description, logo_url, cover_image_url, brand_primary_color, intake_enabled, intake_intro_text')
        .eq(projectColumn, projectIdent)
        .single()

      if (projectRes.error) throw projectRes.error
      if (!projectRes.data.intake_enabled) {
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
      const { error: insertError } = await supabase.from('intake_responses').insert({
        project_id: project.id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        answers,
        terms_accepted_at: new Date().toISOString(),
        terms_version: CONSENT_VERSION,
      })

      if (insertError) throw insertError
      setSubmitted(true)
    } catch (err) {
      console.error('Submit error:', err)
      setError('Er ging iets mis bij het versturen. Probeer het opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  // Apply project branding
  const brandColor = project?.brand_primary_color || '#4A90D9'

  if (loading) {
    return (
      <div className="join-page">
        <div className="join-card">
          <div className="join-card__content" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <p style={{ color: 'var(--text-tertiary)' }}>Formulier laden...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error && !project) {
    return (
      <div className="join-page">
        <div className="join-card">
          <div className="join-card__content">
            <div className="join-card__icon join-card__icon--error">
              <i className="fa-solid fa-circle-exclamation" />
            </div>
            <h2>Niet beschikbaar</h2>
            <p className="join-card__tagline">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="join-page">
        <div className="join-card">
          <div className="join-card__content" style={{ paddingTop: 32 }}>
            {project.logo_url && (
              <img src={project.logo_url} alt={project.name + ' logo'} className="join-card__logo" style={{ marginTop: 0 }} />
            )}
            <div className="intake-success-icon" style={{ color: brandColor }}>
              <i className="fa-solid fa-circle-check" />
            </div>
            <h1 className="join-card__title">Bedankt, {name.split(' ')[0]}!</h1>
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
    <div className="join-page">
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
              style={project.cover_image_url ? { marginTop: -78, position: 'relative', zIndex: 2 } : { marginTop: 20 }}
            />
          )}
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

            <div className="form-group">
              <label htmlFor="intake-name">Naam *</label>
              <input
                id="intake-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Je volledige naam"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group form-group--half">
                <label htmlFor="intake-email">E-mailadres *</label>
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
                        {q.question_text}{q.required ? ' *' : ''}
                      </label>
                      {field?.help && <p className="form-hint">{field.help}</p>}
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

            {error && <p className="join-card__error">{error}</p>}

            <button
              type="submit"
              className="btn-primary join-card__btn"
              disabled={submitting || !name.trim() || !email.trim() || !consent || !termsConsent}
              style={{ background: brandColor }}
            >
              {submitting ? 'Versturen...' : 'Aanmelding versturen'}
            </button>

            <p className="intake-privacy">
              <i className="fa-solid fa-lock" /> Je gegevens worden alleen gedeeld met de
              beheerders van {project.name}.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
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
        return (
          <label className="intake-radio-option">
            <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />
            <span>Ja</span>
          </label>
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
