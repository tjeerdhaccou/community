import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useProject } from '../contexts/ProjectContext'
import { getDemoInfoUrl } from '../lib/demo'
import { TOUR_WELCOME, TOUR_MISSIONS, TOUR_FINISH, TOUR_UI } from '../content/demoTour'
import '../styles/demo-tour.css'

// Rondleiding voor bezoekers van de klik-demo: "verzamel je sleutelbos".
// Vier opdrachten door de echte app; per opdracht wijst een spotlight het
// element aan en levert een klik erop een sleutel op. Niets blokkeert: de
// bezoeker kan altijd sluiten en later verder via de sleutelbos rechtsonder.
//
// Voortgang staat in sessionStorage: een nieuw bezoek begint opnieuw.

const STORAGE_KEY = 'buuur-demo-tour'
const FIND_TIMEOUT_MS = 6000
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function loadState() {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* privémodus of geblokkeerde opslag */ }
  return { status: 'welcome', done: [] }
}

function saveState(state) {
  try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* idem */ }
}

function bubbleStyle(name) {
  return { '--tour-b-bg': `var(--tour-bub-${name}-bg)`, '--tour-b-fg': `var(--tour-bub-${name}-fg)` }
}

// Zoekt het doelelement en volgt zijn positie (scrollen, resizen, layout-shift).
function useTarget(selector, active) {
  const [el, setEl] = useState(null)
  const [rect, setRect] = useState(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    setEl(null); setRect(null); setMissing(false)
    if (!active || !selector) return
    const started = Date.now()
    let timer
    const look = () => {
      const found = document.querySelector(selector)
      if (found) {
        setEl(found)
        found.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
        return
      }
      if (Date.now() - started > FIND_TIMEOUT_MS) { setMissing(true); return }
      timer = setTimeout(look, 200)
    }
    look()
    return () => clearTimeout(timer)
  }, [selector, active])

  useEffect(() => {
    if (!el) return
    let frame
    const track = () => {
      if (!el.isConnected) { setEl(null); setRect(null); return }
      const r = el.getBoundingClientRect()
      setRect(prev => (prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height)
        ? prev : { top: r.top, left: r.left, width: r.width, height: r.height })
      frame = requestAnimationFrame(track)
    }
    track()
    return () => cancelAnimationFrame(frame)
  }, [el])

  return { el, rect, missing }
}

// Hoogte van de cookiemelding onderin. Zolang die staat, schuiven kaartjes en
// sleutelbos erboven, anders vallen ze eronder weg.
function useCookieBarHeight() {
  const [h, setH] = useState(0)
  useEffect(() => {
    const measure = () => {
      const bar = document.querySelector('.cookie-consent')
      setH(bar ? bar.offsetHeight : 0)
    }
    measure()
    const t = setInterval(measure, 500)
    return () => clearInterval(t)
  }, [])
  return h
}

function Keys({ done }) {
  return (
    <span className="tour-keys" aria-hidden="true">
      {TOUR_MISSIONS.map(m => (
        <span key={m.id} className={`tour-key ${done.includes(m.id) ? 'tour-key--on' : ''}`}>
          <i className="fa-solid fa-key" />
        </span>
      ))}
    </span>
  )
}

function WelcomeCard({ onStart, onLater }) {
  return (
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-labelledby="tour-welcome-title">
      <div className="tour-card tour-card--welcome">
        <div className="tour-card__art" aria-hidden="true">
          {TOUR_MISSIONS.map((m, i) => (
            <span key={m.id} className="tour-art__bub" style={{ ...bubbleStyle(m.bubble), '--i': i }}>
              <i className={m.icon} />
            </span>
          ))}
          <span className="tour-art__ring"><i className="fa-solid fa-key" /></span>
        </div>
        <span className="tour-card__kicker">{TOUR_WELCOME.kicker}</span>
        <h2 id="tour-welcome-title">{TOUR_WELCOME.title}</h2>
        <p>{TOUR_WELCOME.body}</p>
        <div className="tour-card__actions">
          <button type="button" className="btn-primary" onClick={onStart} autoFocus>
            {TOUR_WELCOME.primary} <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </button>
          <button type="button" className="btn-secondary" onClick={onLater}>{TOUR_WELCOME.secondary}</button>
        </div>
        <span className="tour-card__note"><i className="fa-regular fa-clock" aria-hidden="true" /> {TOUR_WELCOME.duration}</span>
      </div>
    </div>
  )
}

function FinishCard({ onClose }) {
  const base = getDemoInfoUrl()
  return (
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-labelledby="tour-finish-title">
      <div className="tour-card tour-card--finish">
        <div className="tour-card__art tour-card__art--finish" aria-hidden="true">
          <span className="tour-art__ring tour-art__ring--big"><i className="fa-solid fa-key" /></span>
          {Array.from({ length: 10 }, (_, i) => <span key={i} className="tour-spark" style={{ '--i': i }} />)}
        </div>
        <span className="tour-card__kicker">{TOUR_FINISH.kicker}</span>
        <h2 id="tour-finish-title">{TOUR_FINISH.title}</h2>
        <p>{TOUR_FINISH.body}</p>
        <div className="tour-card__actions">
          <a className="btn-primary" href={`${base}${TOUR_FINISH.primaryPath}`} target="_blank" rel="noopener noreferrer">
            {TOUR_FINISH.primary} <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </a>
          <a className="btn-secondary" href={`${base}${TOUR_FINISH.secondaryPath}`} target="_blank" rel="noopener noreferrer">
            {TOUR_FINISH.secondary}
          </a>
        </div>
        <button type="button" className="tour-link" onClick={onClose} autoFocus>{TOUR_FINISH.tertiary}</button>
      </div>
    </div>
  )
}

// Briefing onderaan het scherm: wat de opdracht is en een knop erheen.
function BriefCard({ mission, index, onGo, onSkip, onClose }) {
  return (
    <div className="tour-brief" role="dialog" aria-labelledby="tour-brief-title">
      <button type="button" className="tour-x" onClick={onClose} aria-label={TOUR_UI.close}><i className="fa-solid fa-xmark" /></button>
      <span className="tour-bub" style={bubbleStyle(mission.bubble)}><i className={mission.icon} aria-hidden="true" /></span>
      <div className="tour-brief__body">
        <span className="tour-card__kicker">Opdracht {index + 1} van {TOUR_MISSIONS.length}</span>
        <h3 id="tour-brief-title">{mission.title}</h3>
        <p>{mission.brief}</p>
        <div className="tour-brief__actions">
          <button type="button" className="btn-primary btn-sm" onClick={onGo} autoFocus>
            {mission.go} <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </button>
          <button type="button" className="tour-link" onClick={onSkip}>{TOUR_UI.skip}</button>
        </div>
      </div>
    </div>
  )
}

// Spotlight: een uitsparing in een gedimde laag. Alles blijft klikbaar; de laag
// zelf vangt geen klikken.
function Spotlight({ rect }) {
  const pad = 8
  return (
    <div
      className="tour-spot"
      aria-hidden="true"
      style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
    />
  )
}

function Tip({ mission, rect, onSkip, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    const tip = ref.current
    if (!tip) return
    const vw = window.innerWidth, vh = window.innerHeight
    if (!rect || vw < 600) { setPos(null); return } // mobiel en zonder doel: paneel onderin
    const w = tip.offsetWidth, h = tip.offsetHeight, gap = 16
    const below = rect.top + rect.height + gap
    const top = below + h < vh - 12 ? below : Math.max(12, rect.top - h - gap)
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - w / 2), vw - w - 12)
    const arrow = Math.min(Math.max(20, rect.left + rect.width / 2 - left), w - 20)
    setPos({ top, left, arrow, up: top > rect.top })
  }, [rect])

  const floating = !!pos
  return (
    <div
      ref={ref}
      className={`tour-tip ${floating ? 'tour-tip--float' : 'tour-tip--sheet'} ${pos?.up ? 'tour-tip--below' : ''}`}
      style={floating ? { top: pos.top, left: pos.left, '--arrow': `${pos.arrow}px` } : undefined}
      role="dialog"
      aria-labelledby="tour-tip-title"
    >
      <button type="button" className="tour-x" onClick={onClose} aria-label={TOUR_UI.close}><i className="fa-solid fa-xmark" /></button>
      <h3 id="tour-tip-title"><i className={mission.icon} aria-hidden="true" /> {mission.title}</h3>
      <p>{rect ? mission.tip : TOUR_UI.fallback}</p>
      <div className="tour-tip__actions">
        <button type="button" className="tour-link" onClick={onSkip}>{rect ? TOUR_UI.skip : TOUR_UI.next}</button>
      </div>
    </div>
  )
}

function EarnedToast({ next, count, onNext, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 9000)
    return () => clearTimeout(t)
  }, [onDismiss])
  return (
    <div className="tour-toast" role="status">
      <span className="tour-toast__key" aria-hidden="true"><i className="fa-solid fa-key" /></span>
      <div className="tour-toast__body">
        <b>{TOUR_UI.earned} {count} van {TOUR_MISSIONS.length}</b>
        {next && <span>{TOUR_UI.next}: {next.title}</span>}
      </div>
      {next && (
        <button type="button" className="btn-primary btn-sm" onClick={onNext}>
          {TOUR_UI.next} <i className="fa-solid fa-arrow-right" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

function Keyring({ state, open, onToggle, onResume, onRestart, onStop, onPick }) {
  const count = state.done.length
  return (
    <div className="tour-ring">
      {open && (
        <div className="tour-ring__panel" role="dialog" aria-label={TOUR_UI.keyring}>
          <div className="tour-ring__head">
            <b>{TOUR_WELCOME.title}</b>
            <span>{count} van {TOUR_MISSIONS.length} sleutels</span>
          </div>
          <ul className="tour-ring__list">
            {TOUR_MISSIONS.map(m => {
              const done = state.done.includes(m.id)
              return (
                <li key={m.id}>
                  <button type="button" className={`tour-ring__item ${done ? 'tour-ring__item--done' : ''}`} onClick={() => onPick(m.id)}>
                    <span className="tour-bub tour-bub--sm" style={bubbleStyle(m.bubble)}>
                      <i className={done ? 'fa-solid fa-key' : m.icon} aria-hidden="true" />
                    </span>
                    <span>{m.title}</span>
                    {done && <i className="fa-solid fa-check tour-ring__check" aria-label="Gedaan" />}
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="tour-ring__foot">
            {state.status === 'done'
              ? <button type="button" className="tour-link" onClick={onRestart}>{TOUR_UI.restart}</button>
              : state.status === 'active'
                ? <button type="button" className="tour-link" onClick={onStop}>{TOUR_UI.stop}</button>
                : <button type="button" className="btn-primary btn-sm" onClick={onResume}>{TOUR_UI.resume}</button>}
          </div>
        </div>
      )}
      <button type="button" className="tour-ring__btn" onClick={onToggle} aria-expanded={open}>
        <Keys done={state.done} />
        <span className="tour-ring__label">{TOUR_UI.keyring} <b>{count}/{TOUR_MISSIONS.length}</b></span>
      </button>
    </div>
  )
}

export default function DemoTour() {
  const { basePath } = useProject()
  const location = useLocation()
  const navigate = useNavigate()
  const [state, setState] = useState(loadState)
  const [ringOpen, setRingOpen] = useState(false)
  const [earned, setEarned] = useState(null) // { count, next } na een verdiende sleutel
  const [paused, setPaused] = useState(false) // na een sleutel: wacht tot de bezoeker verder wil
  const [forced, setForced] = useState(null) // opdracht gekozen in de sleutelbos
  const cookieBar = useCookieBarHeight()

  const update = useCallback(next => {
    setState(prev => {
      const value = typeof next === 'function' ? next(prev) : next
      saveState(value)
      return value
    })
  }, [])

  const remaining = TOUR_MISSIONS.filter(m => !state.done.includes(m.id))
  const mission = state.status === 'active'
    ? (TOUR_MISSIONS.find(m => m.id === forced && !state.done.includes(m.id)) || remaining[0])
    : null
  const index = mission ? TOUR_MISSIONS.indexOf(mission) : -1

  const relPath = location.pathname.slice(basePath.length).replace(/^\/+|\/+$/g, '')
  const onPage = !!mission && relPath === mission.path
  const showTip = onPage && !paused
  const { el, rect, missing } = useTarget(mission?.target, showTip)

  const stateRef = useRef(state)
  stateRef.current = state

  const complete = useCallback(id => {
    const prev = stateRef.current
    if (prev.done.includes(id)) return
    const done = [...prev.done, id]
    const next = TOUR_MISSIONS.find(m => !done.includes(m.id)) || null
    update({ ...prev, done, status: next ? prev.status : 'done' })
    setForced(null)
    if (next) { setEarned({ count: done.length, next }); setPaused(true) }
  }, [update])

  // Een klik op het aangewezen element levert de sleutel op. De klik zelf gaat
  // gewoon door, dus de bezoeker ziet meteen wat er achter zit.
  useEffect(() => {
    if (!el || !mission) return
    const onClick = () => complete(mission.id)
    el.addEventListener('click', onClick, { capture: true })
    return () => el.removeEventListener('click', onClick, { capture: true })
  }, [el, mission, complete])

  // Escape sluit de rondleiding (de sleutelbos blijft staan).
  useEffect(() => {
    if (state.status !== 'active' && state.status !== 'welcome') return
    const onKey = e => { if (e.key === 'Escape') update(prev => ({ ...prev, status: 'idle' })) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.status, update])

  function go(m) {
    setPaused(false)
    setEarned(null)
    navigate(`${basePath}/${m.path}`)
  }

  function start() {
    update(prev => ({ ...prev, status: 'active' }))
    setPaused(false)
    setRingOpen(false)
  }

  function pick(id) {
    setForced(id)
    setRingOpen(false)
    setEarned(null)
    setPaused(false)
    update(prev => ({ ...prev, status: prev.done.includes(id) ? prev.status : 'active' }))
    const m = TOUR_MISSIONS.find(x => x.id === id)
    if (m) navigate(`${basePath}/${m.path}`)
  }

  const stop = () => { update(prev => ({ ...prev, status: 'idle' })); setRingOpen(false); setEarned(null) }
  const skip = () => mission && complete(mission.id)

  const showBrief = !!mission && !paused && !onPage
  // Op smalle schermen staan briefing, toast en tip onderin, precies waar de
  // sleutelbos staat. Dan wijkt de sleutelbos even.
  const busy = showBrief || !!earned || (showTip && !!(rect || missing))

  const layer = (
    <div className={`tour-root ${busy ? 'tour-root--busy' : ''}`} style={{ '--tour-safe-bottom': `${cookieBar}px` }}>
      {state.status === 'welcome' && (
        <WelcomeCard onStart={start} onLater={() => update(prev => ({ ...prev, status: 'idle' }))} />
      )}

      {state.status === 'done' && !state.finishSeen && (
        <FinishCard onClose={() => update(prev => ({ ...prev, finishSeen: true }))} />
      )}

      {showBrief && (
        <BriefCard mission={mission} index={index} onGo={() => go(mission)} onSkip={skip} onClose={stop} />
      )}

      {showTip && rect && <Spotlight rect={rect} />}
      {showTip && (rect || missing) && <Tip mission={mission} rect={rect} onSkip={skip} onClose={stop} />}

      {earned && (
        <EarnedToast
          count={earned.count}
          next={earned.next}
          onNext={() => go(earned.next)}
          onDismiss={() => { setEarned(null); setPaused(false) }}
        />
      )}

      {state.status !== 'welcome' && (
        <Keyring
          state={state}
          open={ringOpen}
          onToggle={() => setRingOpen(o => !o)}
          onResume={() => { start(); if (paused) setPaused(false) }}
          onRestart={() => { update({ status: 'active', done: [], finishSeen: false }); setRingOpen(false) }}
          onStop={stop}
          onPick={pick}
        />
      )}
    </div>
  )

  return createPortal(layer, document.body)
}
