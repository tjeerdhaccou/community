import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getReturnCookie, sendOtpCode } from '../lib/auth'
import { redirectByRole } from '../lib/loginRedirect'

export default function AuthCallback() {
  const navigate = useNavigate()
  const handled = useRef(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    function fail() { setFailed(true) }

    async function redirectAfterLogin() {
      // Check cookie first (set by subdomain before OAuth redirect)
      const returnUrl = getReturnCookie()
      if (returnUrl) {
        // Pass session tokens to subdomain via URL hash so it can restore the session.
        // Preserve the original path+search as returnPath so the subdomain auth-callback
        // sends the user to where they actually wanted to go, not just to '/'.
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const url = new URL(returnUrl)
          const returnPath = (url.pathname + url.search) || '/'
          url.pathname = '/auth/callback'
          url.search = ''
          url.hash = `access_token=${session.access_token}&refresh_token=${session.refresh_token}&type=recovery&returnPath=${encodeURIComponent(returnPath)}`
          window.location.replace(url.toString())
          return
        }
      }

      // Main domain: determine role and redirect directly
      try { localStorage.removeItem('redirectAfterLogin') } catch {}
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (currentSession) {
        await redirectByRole(currentSession, navigate)
        return
      }
      navigate('/dashboard', { replace: true })
    }

    // Cross-subdomain hash-token flow: handle synchronously without a SIGNED_IN
    // listener — setSession() fires SIGNED_IN, and the listener's redirectAfterLogin
    // would race our navigate(returnPath) and win, sending the user to '/' (which
    // then bounces a platform admin to /platform).
    const hashParams = new URLSearchParams(window.location.hash.replace('#', ''))
    const hashAccessToken = hashParams.get('access_token')
    const hashRefreshToken = hashParams.get('refresh_token')

    if (hashAccessToken && hashRefreshToken) {
      const handleHashTokens = async () => {
        try {
          const { data } = await supabase.auth.setSession({ access_token: hashAccessToken, refresh_token: hashRefreshToken })
          if (data?.session) {
            const returnPath = hashParams.get('returnPath')
            window.history.replaceState(null, '', window.location.pathname)
            navigate(returnPath ? decodeURIComponent(returnPath) : '/dashboard', { replace: true })
            return
          }
          fail()
        } catch {
          fail()
        }
      }
      handleHashTokens()
      return
    }

    // Normal OAuth flow (?code=) or already-authenticated session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        subscription.unsubscribe()
        redirectAfterLogin()
      }
    })

    const handleAuth = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')

        if (code) {
          const { data } = await supabase.auth.exchangeCodeForSession(code)
          if (data?.session) {
            subscription.unsubscribe()
            redirectAfterLogin()
            return
          }
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          subscription.unsubscribe()
          redirectAfterLogin()
          return
        }

        setTimeout(() => {
          subscription.unsubscribe()
          fail()
        }, 5000)
      } catch {
        subscription.unsubscribe()
        fail()
      }
    }

    handleAuth()
    return () => subscription.unsubscribe()
  }, [navigate])

  if (failed) return <ExpiredLink navigate={navigate} />

  return (
    <div className="loading-page">
      <p>Inloggen...</p>
    </div>
  )
}

// Getoond wanneer een magic link verlopen of al gebruikt is. Magic links van
// Supabase zijn eenmalig en een uur geldig — daarna landde de gebruiker
// voorheen zonder uitleg op /login. Hier sturen we een verse inlogcode en
// zetten we door naar de code-invoer.
function ExpiredLink({ navigate }) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  async function handleResend(e) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setError(null)
    try {
      await sendOtpCode(email)
      navigate('/login', { replace: true, state: { email: email.trim(), step: 'otp' } })
    } catch (err) {
      console.error('Resend login code failed:', err)
      setError('Versturen mislukt. Controleer je e-mailadres en probeer het opnieuw.')
      setSending(false)
    }
  }

  return (
    <div className="auth-expired">
      <div className="auth-expired__card">
        <div className="auth-expired__icon">
          <i className="fa-solid fa-link-slash" />
        </div>
        <h1>Deze inloglink werkt niet meer</h1>
        <p>
          De link is verlopen of al een keer gebruikt. Vul je e-mailadres in,
          dan sturen we je meteen een nieuwe inlogcode.
        </p>
        <form onSubmit={handleResend} className="auth-expired__form">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="jouw@email.nl"
            autoFocus
            required
          />
          {error && <p className="auth-expired__error">{error}</p>}
          <button type="submit" className="cl-btn cl-btn--primary" disabled={sending || !email.trim()}>
            {sending ? 'Versturen...' : 'Stuur een nieuwe inlogcode'}
          </button>
        </form>
        <button className="auth-expired__back" onClick={() => navigate('/login', { replace: true })}>
          Terug naar inloggen
        </button>
      </div>
    </div>
  )
}
