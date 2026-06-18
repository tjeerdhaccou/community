import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { resolveIntakeFields } from '../lib/intakeFields'
import Skeleton from '../components/Skeleton'

// Lid vult een door de initiatiefnemer verstuurd intake-formulier in.
// De link uit de mail bevat een token; we laden het bijbehorende verzoek
// (RLS staat alleen het eigen verzoek toe), tonen de gevraagde velden en
// schrijven de antwoorden naar het profiel.
export default function ProfileIntake() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { profile, reload } = useAuth()
  const { basePath } = useProject()

  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!token || !profile?.id) return
    let stale = false

    async function load() {
      const { data: req } = await supabase
        .from('profile_intake_requests')
        .select('*')
        .eq('token', token)
        .maybeSingle()

      if (stale) return
      if (!req) { setRequest(null); setLoading(false); return }

      // Beginwaarden uit het huidige profiel (en membership voor de top-3).
      const fields = resolveIntakeFields(req.fields)
      const init = {}
      for (const f of fields) {
        if (f.type === 'housing_top3') continue
        const v = profile[f.column]
        init[f.key] = v == null ? '' : v
      }
      if (fields.some(f => f.type === 'housing_top3')) {
        const { data: mem } = await supabase
          .from('memberships')
          .select('housing_preferences')
          .eq('profile_id', profile.id)
          .eq('project_id', req.project_id)
          .maybeSingle()
        const prefs = Array.isArray(mem?.housing_preferences) ? mem.housing_preferences : []
        init.housing_top3 = [prefs[0] || '', prefs[1] || '', prefs[2] || '']
      }

      if (stale) return
      setRequest(req)
      setValues(init)
      setLoading(false)
    }

    load()
    return () => { stale = true }
  }, [token, profile?.id])

  function setValue(key, val) {
    setValues(prev => ({ ...prev, [key]: val }))
  }

  function coerce(field, raw) {
    if (field.type === 'number') return raw === '' || raw == null ? null : parseInt(raw, 10)
    if (field.type === 'boolean') return !!raw
    if (typeof raw === 'string') return raw.trim() || null
    return raw ?? null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const fields = resolveIntakeFields(request.fields)

      // Profielvelden samenstellen.
      const profileUpdates = {}
      for (const f of fields) {
        if (f.target === 'memberships' || f.type === 'housing_top3') continue
        profileUpdates[f.column] = coerce(f, values[f.key])
      }
      // first/last meegenomen → full_name opnieuw samenstellen.
      if ('first_name' in profileUpdates || 'last_name' in profileUpdates) {
        const fn = (profileUpdates.first_name ?? profile.first_name ?? '') || ''
        const ln = (profileUpdates.last_name ?? profile.last_name ?? '') || ''
        profileUpdates.full_name = `${fn} ${ln}`.trim() || null
      }

      if (Object.keys(profileUpdates).length > 0) {
        const { error: pErr } = await supabase.from('profiles').update(profileUpdates).eq('id', profile.id)
        if (pErr) throw pErr
      }

      // Top-3 woningvoorkeur via RPC (leeft op memberships).
      if (fields.some(f => f.type === 'housing_top3')) {
        const prefs = (values.housing_top3 || []).map(s => (s || '').trim()).filter(Boolean)
        const { error: hErr } = await supabase.rpc('set_my_housing_preferences', {
          p_project_id: request.project_id,
          p_prefs: prefs,
        })
        if (hErr) throw hErr
      }

      const { error: rErr } = await supabase
        .from('profile_intake_requests')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', request.id)
      if (rErr) throw rErr

      reload()
      setDone(true)
    } catch (err) {
      console.error('Intake submit failed:', err)
      setError('Opslaan mislukt. Probeer het opnieuw.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Skeleton.Page rows={4} />

  if (!request) {
    return (
      <div className="intake-fill">
        <div className="intake-fill__card intake-fill__card--message">
          <i className="fa-solid fa-circle-question intake-fill__icon" />
          <h1>Formulier niet gevonden</h1>
          <p>Deze link is niet (meer) geldig, of hoort bij een ander account. Log in met het
          e-mailadres waarop je de uitnodiging hebt ontvangen.</p>
          <button className="btn-primary" onClick={() => navigate(basePath || '/')}>Naar dashboard</button>
        </div>
      </div>
    )
  }

  if (done || request.status === 'completed') {
    return (
      <div className="intake-fill">
        <div className="intake-fill__card intake-fill__card--message">
          <i className="fa-solid fa-circle-check intake-fill__icon intake-fill__icon--done" />
          <h1>Bedankt!</h1>
          <p>Je gegevens zijn opgeslagen. De initiatiefnemers kunnen je profiel nu inzien.</p>
          <button className="btn-primary" onClick={() => navigate(basePath || '/')}>Naar dashboard</button>
        </div>
      </div>
    )
  }

  const fields = resolveIntakeFields(request.fields)

  return (
    <div className="intake-fill">
      <div className="intake-fill__card">
        <h1>Vul je gegevens aan</h1>
        <p className="intake-fill__intro">
          {request.message?.trim()
            ? request.message
            : 'De initiatiefnemers vragen je om een paar gegevens aan te vullen.'}
        </p>

        <form onSubmit={handleSubmit} className="intake-fill__form">
          {fields.map(field => (
            <IntakeFieldInput key={field.key} field={field} value={values[field.key]} onChange={setValue} />
          ))}

          {fields.length === 0 && (
            <p className="intake-fill__intro">Dit formulier bevat geen velden.</p>
          )}

          {error && <p style={{ color: 'var(--accent-red)', fontSize: 14 }}>{error}</p>}

          <div className="intake-fill__actions">
            <button type="submit" className="btn-primary" disabled={saving || fields.length === 0}>
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FieldHelp({ field }) {
  if (!field.help) return null
  return <p className="form-hint">{field.help}</p>
}

function IntakeFieldInput({ field, value, onChange }) {
  const id = `intake-${field.key}`

  if (field.type === 'housing_top3') {
    const arr = Array.isArray(value) ? value : ['', '', '']
    return (
      <div className="form-group">
        <label>{field.label}</label>
        <FieldHelp field={field} />
        <div className="intake-fill__top3">
          {[0, 1, 2].map(i => (
            <div key={i} className="intake-fill__top3-row">
              <span className="intake-fill__top3-rank">{i + 1}</span>
              <input
                type="text"
                value={arr[i] || ''}
                onChange={e => {
                  const next = [...arr]
                  next[i] = e.target.value
                  onChange(field.key, next)
                }}
                placeholder={`Voorkeur ${i + 1}`}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <div className="form-group">
        <label htmlFor={id}>{field.label}</label>
        <FieldHelp field={field} />
        <textarea id={id} value={value || ''} onChange={e => onChange(field.key, e.target.value)} rows={3} />
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <div className="form-group">
        <label htmlFor={id}>{field.label}</label>
        <FieldHelp field={field} />
        <select id={id} value={value || ''} onChange={e => onChange(field.key, e.target.value)}>
          <option value="">Kies…</option>
          {field.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>
    )
  }

  if (field.type === 'boolean') {
    return (
      <div className="form-group intake-fill__checkbox">
        <label htmlFor={id}>
          <input id={id} type="checkbox" checked={!!value} onChange={e => onChange(field.key, e.target.checked)} />
          {field.label}
        </label>
        <FieldHelp field={field} />
      </div>
    )
  }

  return (
    <div className="form-group">
      <label htmlFor={id}>{field.label}</label>
      <FieldHelp field={field} />
      <input
        id={id}
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        value={value || ''}
        onChange={e => onChange(field.key, e.target.value)}
      />
    </div>
  )
}
