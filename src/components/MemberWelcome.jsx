import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { safeStorage } from '../lib/safeStorage'
import { getProfileCompleteness } from '../lib/profileCompleteness'

// Lichte welkomst-checklist voor nieuwe leden op het dashboard.
// - Stap 1 (profiel afmaken) wordt automatisch afgevinkt zodra het profiel
//   100% is; de voortgang staat er live bij.
// - De andere stappen worden afgevinkt zodra de gebruiker ze aanklikt.
// - De X klapt de checklist in — je kunt 'm daarna weer uitklappen.
// - Pas als álle stappen klaar zijn kan de checklist definitief weg.
// Admins/moderators krijgen hun eigen "Aan de slag"-flow en zien dit niet.
export default function MemberWelcome() {
  const { profile } = useAuth()
  const { project, role, basePath } = useProject()
  const navigate = useNavigate()

  const dismissKey = project ? `buuur-member-welcome-dismissed-${project.id}` : null
  const collapsedKey = project ? `buuur-member-welcome-collapsed-${project.id}` : null
  const stepsKey = project ? `buuur-member-welcome-steps-${project.id}` : null

  const [dismissed, setDismissed] = useState(() => dismissKey ? !!safeStorage.getItem(dismissKey) : false)
  const [collapsed, setCollapsed] = useState(() => collapsedKey ? !!safeStorage.getItem(collapsedKey) : false)
  const [stepDone, setStepDone] = useState(() => {
    if (!stepsKey) return {}
    try { return JSON.parse(safeStorage.getItem(stepsKey) || '{}') } catch { return {} }
  })

  if (!project || dismissed) return null
  if (role === 'admin' || role === 'moderator') return null

  const completeness = getProfileCompleteness(profile)
  const profileDone = completeness.pct === 100

  const steps = [
    {
      key: 'profile',
      done: profileDone,
      icon: 'fa-solid fa-user-pen',
      title: profileDone ? 'Je profiel is compleet' : `Maak je profiel af (${completeness.pct}%)`,
      desc: profileDone
        ? 'De andere leden weten nu wie je bent.'
        : 'Vul je gegevens aan zodat de groep je leert kennen.',
      path: `${basePath}/profile`,
    },
    {
      key: 'prikbord',
      done: !!stepDone.prikbord,
      icon: 'fa-solid fa-comments',
      title: 'Stel je voor op het prikbord',
      desc: 'Een kort berichtje breekt het ijs.',
      path: `${basePath}/community`,
    },
    {
      key: 'roadmap',
      done: !!stepDone.roadmap,
      icon: 'fa-solid fa-road',
      title: 'Bekijk de roadmap',
      desc: 'Zie waar het project staat en wat er komt.',
      path: `${basePath}/roadmap`,
    },
    {
      key: 'notificaties',
      done: !!stepDone.notificaties,
      icon: 'fa-solid fa-bell',
      title: 'Stel je notificaties in',
      desc: 'Bepaal waarover je een e-mail wilt ontvangen.',
      path: `${basePath}/profile#notif-section`,
    },
  ]

  const doneCount = steps.filter(s => s.done).length
  const allDone = doneCount === steps.length

  function markStepDone(key) {
    if (key === 'profile') return // wordt automatisch berekend
    const next = { ...stepDone, [key]: true }
    setStepDone(next)
    if (stepsKey) safeStorage.setItem(stepsKey, JSON.stringify(next))
  }

  function handleStepClick(step) {
    markStepDone(step.key)
    navigate(step.path)
  }

  function handleToggle() {
    if (allDone) {
      if (dismissKey) safeStorage.setItem(dismissKey, '1')
      setDismissed(true)
      return
    }
    const next = !collapsed
    setCollapsed(next)
    if (collapsedKey) {
      if (next) safeStorage.setItem(collapsedKey, '1')
      else safeStorage.removeItem(collapsedKey)
    }
  }

  if (collapsed) {
    return (
      <button
        type="button"
        className="member-welcome member-welcome--collapsed"
        onClick={handleToggle}
        aria-label="Welkomststappen uitklappen"
      >
        <span className="member-welcome__check">
          <i className="fa-solid fa-rocket" />
        </span>
        <span className="member-welcome__collapsed-text">
          <span className="member-welcome__title">Welkom bij {project.name}</span>
          <span className="member-welcome__sub">{doneCount} van {steps.length} stappen gedaan</span>
        </span>
        <i className="fa-solid fa-chevron-down member-welcome__step-arrow" />
      </button>
    )
  }

  return (
    <div className="member-welcome">
      <div className="member-welcome__head">
        <div>
          <h3 className="member-welcome__title">Welkom bij {project.name}! 👋</h3>
          <p className="member-welcome__sub">
            {allDone
              ? 'Alle stappen gedaan — je bent klaar om te sluiten.'
              : `Een paar stappen om goed van start te gaan · ${doneCount}/${steps.length}`}
          </p>
        </div>
        <button
          className="member-welcome__dismiss"
          onClick={handleToggle}
          aria-label={allDone ? 'Sluiten' : 'Inklappen'}
          title={allDone ? 'Sluiten' : 'Inklappen'}
        >
          <i className={allDone ? 'fa-solid fa-xmark' : 'fa-solid fa-chevron-up'} />
        </button>
      </div>

      <div className="member-welcome__steps">
        {steps.map(step => (
          <button
            key={step.key}
            type="button"
            className={`member-welcome__step ${step.done ? 'member-welcome__step--done' : ''}`}
            onClick={() => handleStepClick(step)}
          >
            <span className="member-welcome__check">
              <i className={step.done ? 'fa-solid fa-circle-check' : step.icon} />
            </span>
            <span className="member-welcome__step-text">
              <span className="member-welcome__step-title">{step.title}</span>
              <span className="member-welcome__step-desc">{step.desc}</span>
            </span>
            <i className="fa-solid fa-arrow-right member-welcome__step-arrow" />
          </button>
        ))}
      </div>
    </div>
  )
}
