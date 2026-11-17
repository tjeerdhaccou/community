import { useState, useEffect } from 'react'

const CONSENT_KEY = 'cookie-consent-accepted'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) {
        setVisible(true)
      }
    } catch {
      // Private browsing — show banner
      setVisible(true)
    }
  }, [])

  function accept() {
    try { localStorage.setItem(CONSENT_KEY, 'true') } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="cookie-consent" role="dialog" aria-label="Cookie melding">
      <div className="cookie-consent__content">
        <p>
          Alleen functionele cookies: inloggen en je thema. <a href="/privacy">Privacy</a>
        </p>
        <button className="cl-btn cl-btn--primary cookie-consent__btn" onClick={accept}>
          Oké
        </button>
      </div>
    </div>
  )
}
