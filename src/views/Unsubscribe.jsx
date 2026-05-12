import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Publieke pagina (geen login nodig) — verwerkt unsubscribe-token uit mail.
export default function Unsubscribe() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [status, setStatus] = useState('loading') // loading | success | error
  const [label, setLabel] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMsg('Geen geldige link.')
      return
    }
    supabase.functions.invoke('unsubscribe', { body: { token } })
      .then(({ data, error }) => {
        if (error || !data?.success) {
          setStatus('error')
          setErrorMsg(data?.error || error?.message || 'Er ging iets mis.')
        } else {
          setLabel(data.label || '')
          setStatus('success')
        }
      })
      .catch(err => {
        setStatus('error')
        setErrorMsg(err.message || 'Er ging iets mis.')
      })
  }, [token])

  return (
    <div className="loading-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, textAlign: 'center', background: 'var(--bg-surface, #fff)', borderRadius: 16, padding: 40, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        {status === 'loading' && (
          <>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 32, color: 'var(--text-tertiary, #9ba1b0)', marginBottom: 16 }} />
            <p>Even geduld…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <i className="fa-solid fa-circle-check" style={{ fontSize: 40, color: '#3BD269', marginBottom: 20 }} />
            <h1 style={{ margin: '0 0 12px', fontSize: 22 }}>Je bent uitgeschreven</h1>
            <p style={{ margin: '0 0 24px', fontSize: 15, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              Je krijgt geen mail meer over <strong>{label}</strong>. Je kan dit
              altijd weer aanzetten via je profiel-instellingen.
            </p>
            <Link to="/" className="btn-primary" style={{ textDecoration: 'none' }}>
              Naar Buuur
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <i className="fa-solid fa-circle-exclamation" style={{ fontSize: 40, color: '#F23578', marginBottom: 20 }} />
            <h1 style={{ margin: '0 0 12px', fontSize: 22 }}>Uitschrijven niet gelukt</h1>
            <p style={{ margin: '0 0 24px', fontSize: 15, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              {errorMsg}<br />
              Je kan ook handmatig uitschrijven via je profiel-instellingen.
            </p>
            <Link to="/" className="btn-primary" style={{ textDecoration: 'none' }}>
              Naar Buuur
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
