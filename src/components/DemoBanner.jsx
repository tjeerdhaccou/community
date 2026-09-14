import { useState, useEffect } from 'react'
import { DEMO_SIGNUP_EVENT, getDemoInfoUrl } from '../lib/demo'

// Bovenbalk + prompt voor de klik-demo. Alleen zichtbaar in read-only demo-modus.
// De prompt opent zodra een schrijfactie promptDemoSignup() aanroept.
export default function DemoBanner() {
  const [promptOpen, setPromptOpen] = useState(false)
  const infoUrl = getDemoInfoUrl()

  useEffect(() => {
    function onPrompt() { setPromptOpen(true) }
    window.addEventListener(DEMO_SIGNUP_EVENT, onPrompt)
    return () => window.removeEventListener(DEMO_SIGNUP_EVENT, onPrompt)
  }, [])

  return (
    <>
      <div className="demo-banner" role="status">
        <span className="demo-banner__text">
          <i className="fa-solid fa-eye" aria-hidden="true" />
          <span className="demo-banner__long">Dit is een demo. Je kijkt rond in een voorbeeldproject.</span>
          <span className="demo-banner__short">Demo</span>
        </span>
        <a className="demo-banner__cta" href={infoUrl} target="_blank" rel="noopener noreferrer">
          <span className="demo-banner__long">Buuur voor jouw project?</span>
          <span className="demo-banner__short">Meer weten</span>
        </a>
      </div>

      {promptOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setPromptOpen(false)}>
          <div className="modal-card demo-prompt" onClick={e => e.stopPropagation()}>
            <div className="demo-prompt__icon">
              <i className="fa-solid fa-eye" aria-hidden="true" />
            </div>
            <h2>Dit is een demo</h2>
            <p>
              Hier kun je alles bekijken, maar niet meedoen. Wil je Buuur voor je
              eigen project inzetten? Kijk wat er mogelijk is.
            </p>
            <div className="modal-actions demo-prompt__actions">
              <button className="btn-secondary" onClick={() => setPromptOpen(false)}>
                Verder kijken
              </button>
              <a className="btn-primary" href={infoUrl} target="_blank" rel="noopener noreferrer">
                <i className="fa-solid fa-arrow-up-right-from-square" /> Naar buuur.nl
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
