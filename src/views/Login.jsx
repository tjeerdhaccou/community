import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { checkInvitedEmail, sendOtpCode, verifyOtpCode } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { getProjectSlugFromSubdomain, isProductionHost } from '../lib/subdomain'
import { redirectByRole } from '../lib/loginRedirect'
import { usePublicFris } from '../hooks/usePublicFris'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  // AuthCallback stuurt na een verlopen link (na de controle) een verse code en zet door naar
  // hier met de e-mail al ingevuld en direct op de code-invoerstap.
  const resend = location.state || {}
  // Projectnaam en -logo (op een projectsubdomein) plus de Fris-look met de
  // steunkleur van het project.
  const { project: projectInfo, pageProps } = usePublicFris()
  const [mode, setMode] = useState(resend.step === 'otp' ? 'otp' : 'email') // email | otp
  const [email, setEmail] = useState(resend.email || '')
  const [otpCode, setOtpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [inviteName, setInviteName] = useState('')
  // Of het adres de controle heeft gehaald. Alleen dan versturen we (opnieuw)
  // een code. De gebruiker ziet in beide gevallen dezelfde melding, zodat het
  // formulier niet verraadt welke adressen toegang hebben.
  const [allowed, setAllowed] = useState(resend.allowed === true)

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Controle gescoped op het subdomein als we daar zijn
      const subdomainSlug = getProjectSlugFromSubdomain()
      const invite = await checkInvitedEmail(email, subdomainSlug)
      setAllowed(!!invite)
      if (invite) await sendOtpCode(email)
      setMode('otp')
    } catch (err) {
      console.error('Email submit error:', err)
      if (err?.message?.includes('check_invited_email')) {
        setError('Inloggen lukt nu niet door een fout aan onze kant. Probeer het later opnieuw.')
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

        // Op een subdomein óf een niet-productie-host (preview/localhost): blijf
        // path-based lokaal. redirectByRole bouncet naar hardcoded buuur.nl-domeinen
        // en zou een preview/lokale sessie naar productie sturen.
        if (getProjectSlugFromSubdomain() || !isProductionHost()) {
          let saved
          try { saved = localStorage.getItem('redirectAfterLogin'); localStorage.removeItem('redirectAfterLogin') } catch {}
          navigate(saved || '/', { replace: true })
          return
        }

        // On main domain: determine role and redirect directly
        try { localStorage.removeItem('redirectAfterLogin') } catch {}
        await redirectByRole(result.session, navigate)
      }
    } catch (err) {
      console.error('OTP verify error:', err)
      setError('Ongeldige code. Controleer je e-mail en probeer het opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setError(null)
    try {
      if (allowed) await sendOtpCode(email)
      setError(null)
    } catch (err) {
      console.error('Resend error:', err)
      setError('Kon de code niet opnieuw versturen.')
    }
  }

  // Step 1: Enter email
  if (mode === 'email') {
    return (
      <div className="login-page" {...pageProps}>
        <div className="cl-card cl-card--elevated login-card">
          {projectInfo?.logo_url && (
            <img className="login-logo" src={projectInfo.logo_url} alt={projectInfo.name + ' logo'} style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', objectFit: 'cover', marginBottom: 12 }} />
          )}
          <h1 className="login-title">{projectInfo?.name || 'Inloggen'}</h1>
          <p className="login-subtitle">
            {projectInfo ? 'Vul het e-mailadres in waarmee je bent uitgenodigd.' : 'Vul je e-mailadres in. Je krijgt een inlogcode per mail.'}
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
              {loading ? 'Versturen...' : 'Inlogcode versturen'}
            </button>
          </form>

          <p className="login-terms" style={{ marginTop: 24, fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>
            Door in te loggen ga je akkoord met onze{' '}
            <a href="/voorwaarden" style={{ color: 'var(--accent-primary)' }}>algemene voorwaarden</a>{' '}
            en onze <a href="/privacy" style={{ color: 'var(--accent-primary)' }}>privacyverklaring</a>.
          </p>
        </div>
      </div>
    )
  }

  // Step 2: Enter OTP code
  return (
    <div className="login-page" {...pageProps}>
      <div className="cl-card cl-card--elevated login-card">
        <div className="login-otp-icon">
          <i className="fa-solid fa-envelope-circle-check" />
        </div>
        <h1 className="login-title">Controleer je e-mail</h1>
        <p className="login-subtitle">
          Als <strong>{email}</strong> toegang heeft, hebben we een code gestuurd.
        </p>

        <form onSubmit={handleOtpSubmit} className="login-form">
          <div className="form-group">
            <input
              type="text"
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
              autoFocus
              className="login-otp-input"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="cl-btn cl-btn--primary login-submit-btn" disabled={loading || otpCode.length < 6}>
            {loading ? 'Verifiëren...' : 'Inloggen'}
          </button>
        </form>

        <p className="login-resend">
          Geen code ontvangen?{' '}
          <button className="login-resend-btn" onClick={handleResend}>Opnieuw versturen</button>
        </p>

        <button className="login-back-btn" onClick={() => { setMode('email'); setOtpCode(''); setError(null); setAllowed(false) }}>
          <i className="fa-solid fa-arrow-left" /> Ander e-mailadres
        </button>
      </div>
    </div>
  )
}
