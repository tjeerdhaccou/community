import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    function redirectAfterLogin() {
      let savedUrl, savedPath
      try {
        savedUrl = localStorage.getItem('redirectAfterLoginUrl')
        savedPath = localStorage.getItem('redirectAfterLogin')
        localStorage.removeItem('redirectAfterLoginUrl')
        localStorage.removeItem('redirectAfterLogin')
      } catch {}

      // If we have a full URL (from a subdomain), do a hard redirect
      if (savedUrl && savedUrl !== window.location.origin) {
        window.location.href = savedUrl + (savedPath || '/')
        return
      }
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
