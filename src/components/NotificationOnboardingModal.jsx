import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { logger } from '../lib/logger'

// Eenmalige modal die nieuwe users hun email-notificatie-voorkeuren laat kiezen.
// Toont zich pas zodra:
//   - er een profiel is geladen
//   - notifications_onboarded_at is null
//   - de user is lid van minstens één project (anders heeft het geen nut)
//
// Defaults volgen Tjeerds keuze: updates aan, events aan, prikbord aan,
// documenten aan. Mensen kunnen los uitzetten voor ze opslaan.
export default function NotificationOnboardingModal() {
  const { profile, memberships, reload } = useAuth()
  const [prefs, setPrefs] = useState({
    pref_updates: 'all',
    pref_prikbord: 'all',
    pref_events: 'all',
    pref_documents: 'all',
  })
  const [saving, setSaving] = useState(false)

  const shouldShow =
    profile &&
    !profile.notifications_onboarded_at &&
    (memberships?.length || 0) > 0

  // Voorkom flikkeren tijdens initial load
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (shouldShow) {
      const t = setTimeout(() => setArmed(true), 250)
      return () => clearTimeout(t)
    }
    setArmed(false)
  }, [shouldShow])

  if (!shouldShow || !armed) return null

  function toggle(key) {
    setPrefs(p => ({ ...p, [key]: p[key] === 'all' ? 'mute' : 'all' }))
  }

  async function save(skipAll = false) {
    if (!profile?.id) return
    setSaving(true)
    const toSave = skipAll
      ? { pref_updates: 'mute', pref_prikbord: 'mute', pref_events: 'mute', pref_documents: 'mute' }
      : prefs

    const { error: prefErr } = await supabase
      .from('notification_preferences')
      .upsert(
        { profile_id: profile.id, ...toSave },
        { onConflict: 'profile_id' }
      )
    if (prefErr) {
      logger.error('NotificationOnboarding.savePrefs', prefErr)
    }

    const { error: profErr } = await supabase
      .from('profiles')
      .update({ notifications_onboarded_at: new Date().toISOString() })
      .eq('id', profile.id)
    if (profErr) logger.error('NotificationOnboarding.saveProfile', profErr)

    await reload()
    setSaving(false)
  }

  const rows = [
    { key: 'pref_updates', icon: 'fa-solid fa-bullhorn', label: 'Updates', desc: 'Belangrijke aankondigingen vanuit het project' },
    { key: 'pref_events', icon: 'fa-solid fa-calendar-check', label: 'Events', desc: 'Nieuwe events en bijeenkomsten' },
    { key: 'pref_prikbord', icon: 'fa-solid fa-comments', label: 'Prikbord', desc: 'Reacties op je eigen berichten + nieuwe berichten' },
    { key: 'pref_documents', icon: 'fa-solid fa-folder-open', label: 'Documenten', desc: 'Nieuwe documenten in het archief' },
  ]

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-card" style={{ maxWidth: 520, padding: 0 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '28px 28px 8px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Welkom! Stel je notificaties in</h2>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Je krijgt standaard een e-mail bij belangrijke activiteit. Vink uit wat
            je niet per mail wilt — je kunt dit later altijd aanpassen in je profiel.
          </p>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map(r => (
            <label
              key={r.key}
              className="notif-pref-row"
              style={{ cursor: 'pointer', padding: '12px 12px', borderRadius: 12 }}
            >
              <div className="notif-pref-row__info">
                <i className={r.icon} />
                <div>
                  <span className="notif-pref-row__label">{r.label}</span>
                  <span className="notif-pref-row__desc">{r.desc}</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefs[r.key] === 'all'}
                onChange={() => toggle(r.key)}
                style={{ width: 20, height: 20, cursor: 'pointer' }}
              />
            </label>
          ))}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 28px 24px',
          borderTop: '1px solid var(--border-subtle, #f0f0f4)',
          marginTop: 8,
        }}>
          <button
            className="btn-secondary"
            onClick={() => save(true)}
            disabled={saving}
            style={{ fontSize: 14 }}
          >
            Geen mails sturen
          </button>
          <button
            className="btn-primary"
            onClick={() => save(false)}
            disabled={saving}
          >
            {saving ? 'Opslaan…' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  )
}
