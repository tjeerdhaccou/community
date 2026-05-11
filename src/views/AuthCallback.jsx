import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getReturnCookie } from '../lib/auth'

export default function AuthCallback() {
  const navigate = useNavigate()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    async function redirectAfterLogin() {
      // Check cookie first (set by subdomain before OAuth redirect)
      const returnUrl = getReturnCookie()
      if (returnUrl) {
        // Pass session tokens to subdomain via URL hash so it can restore the session
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const url = new URL(returnUrl)
          url.pathname = '/auth/callback'
          url.hash = `access_token=${session.access_token}&refresh_token=${session.refresh_token}&type=recovery`
          window.location.replace(url.toString())
          return
        }
      }

      // Fallback to localStorage (same-domain redirects)
      let savedPath
      try { savedPath = localStorage.getItem('redirectAfterLogin'); localStorage.removeItem('redirectAfterLogin') } catch {}
      navigate(savedPath || '/', { replace: true })
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
            navigate(returnPath ? decodeURIComponent(returnPath) : '/', { replace: true })
            return
          }
          navigate('/login', { replace: true })
        } catch {
          navigate('/login', { replace: true })
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
          navigate('/login', { replace: true })
        }, 5000)
      } catch {
        subscription.unsubscribe()
        navigate('/login', { replace: true })
      }
    }

    handleAuth()
    return () => subscription.unsubscribe()
  }, [navigate])

  return (
    <div className="loading-page">
      <p>Inloggen...</p>
    </div>
  )
}
