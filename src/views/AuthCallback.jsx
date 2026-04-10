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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        subscription.unsubscribe()
        redirectAfterLogin()
      }
    })

    const handleAuth = async () => {
      try {
        // Check for tokens in URL hash (passed from main domain to subdomain)
        const hashParams = new URLSearchParams(window.location.hash.replace('#', ''))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (accessToken && refreshToken) {
          const { data } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          if (data?.session) {
            const returnPath = hashParams.get('returnPath')
            window.history.replaceState(null, '', window.location.pathname)
            subscription.unsubscribe()
            navigate(returnPath ? decodeURIComponent(returnPath) : '/', { replace: true })
            return
          }
        }

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
