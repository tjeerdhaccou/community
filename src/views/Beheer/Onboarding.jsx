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
  const { project, role, basePath } = useProject()
  const navigate = useNavigate()
  const [counts, setCounts] = useState({ sections: 0, invites: 0, members: 0, groups: 0 })
  const [loading, setLoading] = useState(true)

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
      const complete = !!project.logo_url && (sec.count || 0) > 0 && !!project.intake_enabled
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
      desc: 'Geef je community een herkenbaar gezicht met een logo en kleuren.',
      done: !!project?.logo_url,
      to: 'settings',
      cta: 'Naar instellingen',
    },
    {
      key: 'page',
      icon: 'fa-solid fa-wand-magic-sparkles',
      color: 'var(--accent-primary, #4A90D9)',
      title: 'Vul je openbare pagina',
      desc: 'Vertel bezoekers waar jullie project over gaat met de paginabouwer.',
      done: counts.sections > 0,
      to: 'page-builder',
      cta: 'Open paginabouwer',
    },
    {
      key: 'intake',
      icon: 'fa-solid fa-clipboard-list',
      color: 'var(--accent-orange, #F09020)',
      title: 'Zet je aanmeldformulier op',
      desc: 'Laat geïnteresseerden zich aanmelden bij jullie groep.',
      done: !!project?.intake_enabled,
      to: 'settings',
      cta: 'Naar instellingen',
    },
    {
      key: 'groups',
      icon: 'fa-solid fa-people-group',
      color: 'var(--accent-primary, #4A90D9)',
      title: 'Maak een groep',
      desc: 'Organiseer je community in commissies of doelgroepen.',
      done: counts.groups > 0,
      to: 'groepen',
      cta: 'Naar groepen',
    },
    {
      key: 'invite',
      icon: 'fa-solid fa-paper-plane',
      color: 'var(--accent-green, #3BD269)',
      title: 'Nodig je eerste leden uit',
      desc: 'Breng je groep samen — nodig de eerste bewoners uit.',
      done: counts.invites > 0 || counts.members > 1,
      to: 'ledenwerving',
      cta: 'Naar ledenwerving',
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
        <div className="view-header__row">
          <h1>Aan de slag</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
          {allDone
            ? 'Mooi werk — je community staat klaar! 🎉'
            : 'In een paar stappen staat jullie community klaar. Je kunt later alles nog aanpassen.'}
        </p>
      </div>

      {/* Voortgang */}
      <div style={{ margin: '4px 0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', fontWeight: 600 }}>
            {completed} van {steps.length} klaar
          </span>
          <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', fontWeight: 600 }}>{pct}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--bg-hover)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 999,
            background: 'var(--accent-green, #3BD269)',
            transition: 'width 300ms ease',
          }} />
        </div>
      </div>

      {/* Stappen */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {steps.map(step => (
          <div
            key={step.key}
            onClick={() => navigate(`${basePath}/${step.to}`)}
            role="button"
            tabIndex={0}
            className="onboarding-step"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: 16,
              borderRadius: 'var(--radius-md, 12px)',
              background: 'var(--bg-surface)',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))',
              cursor: 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {/* Status-bolletje */}
            <div style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: step.done ? 'var(--accent-green, #3BD269)' : 'var(--bg-hover)',
              color: step.done ? '#fff' : step.color,
            }}>
              <i className={step.done ? 'fa-solid fa-check' : step.icon} />
            </div>

            {/* Tekst */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 600,
                color: 'var(--text-primary)',
                textDecoration: step.done ? 'none' : 'none',
              }}>
                {step.title}
              </div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 2 }}>
                {step.desc}
              </div>
            </div>

            {/* CTA */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                {step.done ? 'Aanpassen' : step.cta}
              </span>
              <i className="fa-solid fa-chevron-right" style={{ color: 'var(--text-tertiary)', fontSize: 12 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Escape — naar dashboard, stopt de auto-redirect */}
      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <button
          className="btn-secondary"
          onClick={dismissOnboarding}
          style={{ fontSize: 'var(--text-caption)' }}
        >
          {allDone ? 'Naar mijn dashboard' : 'Later afmaken — naar dashboard'}
        </button>
      </div>
    </div>
  )
}
