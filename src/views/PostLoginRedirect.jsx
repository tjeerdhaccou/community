import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { redirectByRole } from '../lib/loginRedirect'

export default function PostLoginRedirect() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const redirected = useRef(false)

  useEffect(() => {
    if (loading || redirected.current) return
    if (!user) { navigate('/login', { replace: true }); return }

    redirected.current = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        redirectByRole(session, navigate)
      } else {
        navigate('/login', { replace: true })
      }
    })
  }, [loading, user, navigate])

  return <div className="loading-page"><p>Doorsturen...</p></div>
}
