import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { safeStorage } from '../../lib/safeStorage'
import { useProject } from '../../contexts/ProjectContext'

/**
 * "Aan de slag" — geleide setup-checklist voor group-admins (buuur light).
 * Leest bestaande databronnen om per stap te bepalen of die klaar is, en
 * linkt naar de bestaande beheertool. Alleen zichtbaar voor admins.
 */
export default function Onboarding() {
  const { project, role, basePath, onboardingActive } = useProject()
  const navigate = useNavigate()
  const [counts, setCounts] = useState({ sections: 0, invites: 0, members: 0, groups: 0 })
  const [loading, setLoading] = useState(true)

  // Onboarding uit voor dit project (bv. pro/MO-project) → terug naar dashboard.
  useEffect(() => {
    if (project && !onboardingActive) navigate(basePath || '/', { replace: true })
  }, [project, onboardingActive, basePath, navigate])

  // Gezien: het dashboard stuurt hierna niet meer vanzelf door.
  useEffect(() => {
    if (project?.id) safeStorage.setItem(`buuur-onboarding-seen-${project.id}`, '1')
  }, [project?.id])

  useEffect(() => {
    if (!project?.id) return
    let active = true
    ;(async () => {
      setLoading(true)
      const [sec, inv, mem, grp] = await Promise.all([
        supabase.from('public_sections').select('id', { count: 'exact', head: true }).eq('project_id', project.id),
        supabase.from('member_invites').select('id', { count: 'exact', head: true }).eq('project_id', project.id),
        supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('project_id', project.id),
        supabase.from('workgroups').select('id', { count: 'exact', head: true }).eq('project_id', project.id),
      ])
      if (!active) return
      setCounts({ sections: sec.count || 0, invites: inv.count || 0, members: mem.count || 0, groups: grp.count || 0 })
      setLoading(false)

      // Alles klaar? Dan de checklist afronden zodat de auto-redirect stopt.
      const complete = !!(project.logo_url || project.app_accent_color) && (sec.count || 0) > 0 && !!project.intake_enabled
        && (grp.count || 0) > 0 && ((inv.count || 0) > 0 || (mem.count || 0) > 1)
      const key = `buuur-onboarding-skip-${project.id}`
      if (complete && !project.onboarding_dismissed && !safeStorage.getItem(key)) {
        safeStorage.setItem(key, '1')
        supabase.from('projects').update({ onboarding_dismissed: true }).eq('id', project.id)
      }
    })()
    return () => { active = false }
  }, [project?.id])

  if (role !== 'admin') {
    return (
      <div className="empty-inline">
        <i className="fa-solid fa-lock" />
        <p>Deze pagina is alleen voor beheerders.</p>
      </div>
    )
  }

  const steps = [
    {
      key: 'branding',
      icon: 'fa-solid fa-palette',
      color: 'var(--accent-purple, #7B5EA7)',
      title: 'Logo & uitstraling',
      desc: 'Upload een logo of kies je eigen kleur. Klaar zodra een van de twee is opgeslagen.',
      done: !!(project?.logo_url || project?.app_accent_color),
      to: 'settings#branding',
      cta: 'Naar instellingen',
    },
    {
      key: 'page',
      icon: 'fa-solid fa-wand-magic-sparkles',
      color: 'var(--accent-primary, #4A90D9)',
      title: 'Vul je openbare pagina',
      desc: 'Vertel bezoekers waar jullie project over gaat. Klaar zodra er één blok op je pagina staat.',
      done: counts.sections > 0,
      to: 'page-builder',
      cta: 'Open de Paginabouwer',
    },
    {
      key: 'intake',
      icon: 'fa-solid fa-clipboard-list',
      color: 'var(--accent-orange, #F09020)',
      title: 'Zet je aanmeldformulier op',
      desc: 'Laat geïnteresseerden zich aanmelden. Zet het formulier aan in Instellingen en sla op.',
      done: !!project?.intake_enabled,
      to: 'settings#aanmeldformulier',
      cta: 'Naar instellingen',
    },
    {
      key: 'groups',
      icon: 'fa-solid fa-people-group',
      color: 'var(--accent-primary, #4A90D9)',
      title: 'Maak een groep',
      desc: 'Verdeel het werk over commissies of werkgroepen, zoals Financiën of Communicatie.',
      done: counts.groups > 0,
      to: 'organisatie?tab=groepen',
      cta: 'Naar groepen',
    },
    {
      key: 'invite',
      icon: 'fa-solid fa-paper-plane',
      color: 'var(--accent-green, #3BD269)',
      title: 'Nodig je eerste leden uit',
      desc: 'Breng je groep samen: verstuur je eerste uitnodiging per mail.',
      done: counts.invites > 0 || counts.members > 1,
      to: 'members',
      cta: 'Naar Leden',
    },
  ]

  const completed = steps.filter(s => s.done).length
  const allDone = completed === steps.length
  const pct = Math.round((completed / steps.length) * 100)

  async function dismissOnboarding() {
    if (project?.id) {
      safeStorage.setItem(`buuur-onboarding-skip-${project.id}`, '1')
      await supabase.from('projects').update({ onboarding_dismissed: true }).eq('id', project.id)
    }
    navigate(basePath || '/')
  }

  return (
    <div className="view-onboarding">
      <div className="view-header">
        <h1>Aan de slag</h1>
        <p className="view-header__subtitle">
          {allDone
            ? 'Mooi werk, je community staat klaar! 🎉'
            : 'In een paar stappen staat jullie community klaar. Je kunt later alles nog aanpassen.'}
        </p>
      </div>

      {/* Voortgang */}
      <div className="onboarding-progress">
        <div className="onboarding-progress__meta">
          <span>{completed} van {steps.length} klaar</span>
          <span>{pct}%</span>
        </div>
        <div
          className="onboarding-progress__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={completed}
          aria-label="Voortgang"
        >
          <div className="onboarding-progress__bar" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Stappen: rijen zoals op het dashboard. Op mobiel staat de knoptekst
          onder de uitleg, zodat de tekst de volle breedte houdt. */}
      <ol className="dash-feed onboarding-steps" aria-busy={loading}>
        {steps.map((step, i) => (
          <li key={step.key}>
            <button
              type="button"
              className={`dash-card onboarding-step${step.done ? ' onboarding-step--done' : ''}`}
              onClick={() => navigate(`${basePath}/${step.to}`)}
            >
              <span className="onboarding-step__status" style={step.done ? undefined : { color: step.color }} aria-hidden="true">
                <i className={step.done ? 'fa-solid fa-check' : step.icon} />
              </span>
              <span className="dash-card__content">
                <span className="dash-card__label">
                  {step.done ? 'Klaar' : `Stap ${i + 1}`}
                </span>
                <span className="dash-card__title">{step.title}</span>
                <span className="dash-card__meta">{step.desc}</span>
                <span className="onboarding-step__cta">
                  {step.done ? 'Aanpassen' : step.cta}
                  <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                </span>
              </span>
              <i className="fa-solid fa-chevron-right dash-card__arrow" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>

      {/* Escape: naar dashboard, stopt de auto-redirect */}
      <div className="onboarding-footer">
        <button type="button" className={allDone ? "btn-primary" : "btn-secondary"} onClick={dismissOnboarding}>
          {allDone ? 'Naar mijn dashboard' : 'Later afmaken, naar dashboard'}
        </button>
      </div>
    </div>
  )
}
