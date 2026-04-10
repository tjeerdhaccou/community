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

    function redirectAfterLogin() {
      // Check cookie first (set by subdomain before OAuth redirect)
      const returnUrl = getReturnCookie()
      if (returnUrl) {
        window.location.href = returnUrl
        return
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
