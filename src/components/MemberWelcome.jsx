import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { safeStorage } from '../lib/safeStorage'
import { getProfileCompleteness } from '../lib/profileCompleteness'

// Lichte welkomst-checklist voor nieuwe leden op het dashboard.
// - Stap 1 (profiel afmaken) wordt automatisch afgevinkt zodra het profiel
//   100% is; de voortgang staat er live bij.
// - De andere stappen zijn aanmoedigingen met een directe link.
// - Wegklikbaar per project via safeStorage; verschijnt niet meer terug.
// Admins/moderators krijgen hun eigen "Aan de slag"-flow en zien dit niet.
export default function MemberWelcome() {
  const { profile } = useAuth()
  const { project, role, basePath } = useProject()
  const navigate = useNavigate()

  const dismissKey = project ? `buuur-member-welcome-dismissed-${project.id}` : null
  const [dismissed, setDismissed] = useState(() => dismissKey ? !!safeStorage.getItem(dismissKey) : false)

  if (!project || dismissed) return null
  if (role === 'admin' || role === 'moderator') return null

  const completeness = getProfileCompleteness(profile)
  const profileDone = completeness.pct === 100

  function dismiss() {
    if (dismissKey) safeStorage.setItem(dismissKey, '1')
    setDismissed(true)
  }

  const steps = [
    {
      key: 'profile',
      done: profileDone,
      icon: 'fa-solid fa-user-pen',
      title: profileDone ? 'Je profiel is compleet' : `Maak je profiel af (${completeness.pct}%)`,
      desc: profileDone
        ? 'De andere leden weten nu wie je bent.'
        : 'Vul je gegevens aan zodat de groep je leert kennen.',
      action: () => navigate(`${basePath}/profile`),
    },
    {
      key: 'prikbord',
      done: false,
      icon: 'fa-solid fa-comments',
      title: 'Stel je voor op het prikbord',
      desc: 'Een kort berichtje breekt het ijs.',
      action: () => navigate(`${basePath}/community`),
    },
    {
      key: 'roadmap',
      done: false,
      icon: 'fa-solid fa-road',
      title: 'Bekijk de roadmap',
      desc: 'Zie waar het project staat en wat er komt.',
      action: () => navigate(`${basePath}/roadmap`),
    },
    {
      key: 'notificaties',
      done: false,
      icon: 'fa-solid fa-bell',
      title: 'Stel je notificaties in',
      desc: 'Bepaal waarover je een e-mail wilt ontvangen.',
      action: () => navigate(`${basePath}/profile#notif-section`),
    },
  ]

  return (
    <div className="member-welcome">
      <div className="member-welcome__head">
        <div>
          <h3 className="member-welcome__title">Welkom bij {project.name}! 👋</h3>
          <p className="member-welcome__sub">Een paar stappen om goed van start te gaan.</p>
        </div>
        <button className="member-welcome__dismiss" onClick={dismiss} aria-label="Sluiten">
          <i className="fa-solid fa-xmark" />
        </button>
      </div>

      <div className="member-welcome__steps">
        {steps.map(step => (
          <button
            key={step.key}
            type="button"
            className={`member-welcome__step ${step.done ? 'member-welcome__step--done' : ''}`}
            onClick={step.action}
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
