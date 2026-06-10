import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { checkInvitedEmail, sendOtpCode, verifyOtpCode } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { getProjectSlugFromSubdomain } from '../lib/subdomain'

export default function Login() {
  const navigate = useNavigate()
  const [projectInfo, setProjectInfo] = useState(null)

  useEffect(() => {
    const slug = getProjectSlugFromSubdomain()
    if (!slug) return
    supabase.from('projects').select('name, logo_url, tagline').eq('slug', slug).single()
      .then(({ data }) => { if (data) setProjectInfo(data) })
  }, [])
  const [mode, setMode] = useState('email') // email | otp
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [inviteName, setInviteName] = useState('')

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Check if email is invited — scoped op subdomain als we daar zijn
      const subdomainSlug = getProjectSlugFromSubdomain()
      const invite = await checkInvitedEmail(email, subdomainSlug)
      if (!invite) {
        setError('Dit e-mailadres heeft geen toegang. Neem contact op met de beheerder.')
        setLoading(false)
        return
      }

      await sendOtpCode(email)
      setMode('otp')
    } catch (err) {
      console.error('Email submit error:', err)
      if (err?.message?.includes('check_invited_email')) {
        setError('De invite-controle is nog niet ingesteld. Vraag de beheerder om de database migratie te draaien.')
      } else {
        setError(`Er ging iets mis: ${err?.message || 'Onbekende fout'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleOtpSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await verifyOtpCode(email, otpCode)
      if (result?.session) {
        // Link intake response to profile and prefill name
        try {
          await supabase.rpc('link_intake_after_login', {
            p_email: email,
            p_user_id: result.session.user.id,
          })
        } catch (linkErr) {
          console.warn('Could not link intake response:', linkErr)
        }

        let saved
        try { saved = localStorage.getItem('redirectAfterLogin'); localStorage.removeItem('redirectAfterLogin') } catch {}

        // Only use saved redirect for project-specific pages — role-based
        // routing (org admin → CMS, platform admin → /platform) goes
        // through PostLoginRedirect at /dashboard.
        const useSaved = saved && saved.startsWith('/p/')
        navigate(useSaved ? saved : '/dashboard', { replace: true })
      }
    } catch (err) {
      console.error('OTP verify error:', err)
      setError('Ongeldige code. Controleer je email en probeer opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setError(null)
    try {
      await sendOtpCode(email)
      setError(null)
    } catch (err) {
      console.error('Resend error:', err)
      setError('Kon de code niet opnieuw versturen.')
    }
  }

  // Step 1: Enter email
  if (mode === 'email') {
    return (
      <div className="login-page">
        <div className="cl-card cl-card--elevated login-card">
          {projectInfo?.logo_url && (
            <img src={projectInfo.logo_url} alt={projectInfo.name + ' logo'} style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', objectFit: 'cover', marginBottom: 12 }} />
          )}
          <h1 className="login-title">{projectInfo?.name || 'Inloggen'}</h1>
          <p className="login-subtitle">
            Voer het e-mailadres in waarmee je bent uitgenodigd.
          </p>

          <form onSubmit={handleEmailSubmit} className="login-form">
            <div className="form-group">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="naam@voorbeeld.nl"
                required
                autoFocus
              />
            </div>

            {error && <p className="login-error">{error}</p>}

            <button type="submit" className="cl-btn cl-btn--primary login-submit-btn" disabled={loading || !email.trim()}>
              {loading ? 'Controleren...' : 'Verificatiecode versturen'}
            </button>
          </form>

          <p style={{ marginTop: 24, fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>
            Door in te loggen ga je akkoord met onze{' '}
            <a href="/voorwaarden" style={{ color: 'var(--accent-primary)' }}>algemene voorwaarden</a>{' '}
            en ons <a href="/privacy" style={{ color: 'var(--accent-primary)' }}>privacybeleid</a>.
          </p>
        </div>
      </div>
    )
  }

  // Step 2: Enter OTP code
  return (
    <div className="login-page">
      <div className="cl-card cl-card--elevated login-card">
        <div className="login-otp-icon">
          <i className="fa-solid fa-envelope-circle-check" />
        </div>
        <h1 className="login-title">Controleer je e-mail</h1>
        <p className="login-subtitle">
          We hebben een verificatiecode gestuurd naar <strong>{email}</strong>
        </p>

        <form onSubmit={handleOtpSubmit} className="login-form">
          <div className="form-group">
            <input
              type="text"
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="00000000"
              required
              autoFocus
              className="login-otp-input"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="cl-btn cl-btn--primary login-submit-btn" disabled={loading || otpCode.length < 8}>
            {loading ? 'Verifiëren...' : 'Inloggen'}
          </button>
        </form>

        <p className="login-resend">
          Geen code ontvangen?{' '}
          <button className="login-resend-btn" onClick={handleResend}>Opnieuw versturen</button>
        </p>

        <button className="login-back-btn" onClick={() => { setMode('email'); setOtpCode(''); setError(null) }}>
          <i className="fa-solid fa-arrow-left" /> Ander e-mailadres
        </button>
      </div>
    </div>
  )
}
