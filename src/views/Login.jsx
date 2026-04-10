import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithGoogle, checkInvitedEmail, sendOtpCode, verifyOtpCode } from '../lib/auth'
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
  const [mode, setMode] = useState('choice') // choice | email | otp
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
      // Check if email is invited
      const invite = await checkInvitedEmail(email)
      if (!invite) {
        setError('Dit e-mailadres is niet uitgenodigd. Neem contact op met de beheerders van het project.')
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

        navigate(saved || '/', { replace: true })
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

  // Step 1: Choose login method
  if (mode === 'choice') {
    return (
      <div className="login-page">
        <div className="cl-card cl-card--elevated login-card">
          {projectInfo?.logo_url && (
            <img src={projectInfo.logo_url} alt={projectInfo.name + ' logo'} style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', objectFit: 'cover', marginBottom: 12 }} />
          )}
          <h1 className="login-title">{projectInfo?.name || 'Community Platform'}</h1>
          <p className="login-subtitle">{projectInfo?.tagline || 'Log in om verder te gaan'}</p>

          <button onClick={signInWithGoogle} className="cl-btn cl-btn--primary login-google-btn">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.26c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Inloggen met Google
          </button>

          <div className="login-divider">
            <span>of</span>
          </div>

          <button onClick={() => setMode('email')} className="login-email-btn">
            <i className="fa-solid fa-envelope" />
            Inloggen met e-mail
          </button>

          <p style={{ marginTop: 24, fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>
            Door in te loggen ga je akkoord met ons{' '}
            <a href="/privacy" style={{ color: 'var(--accent-primary)' }}>privacybeleid</a>.
          </p>
        </div>
      </div>
    )
  }

  // Step 2: Enter email
  if (mode === 'email') {
    return (
      <div className="login-page">
        <div className="cl-card cl-card--elevated login-card">
          <h1 className="login-title">Inloggen met e-mail</h1>
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

          <button className="login-back-btn" onClick={() => { setMode('choice'); setError(null) }}>
            <i className="fa-solid fa-arrow-left" /> Terug
          </button>
        </div>
      </div>
    )
  }

  // Step 3: Enter OTP code
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
