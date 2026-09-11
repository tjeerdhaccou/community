import { useMemo, useState } from 'react'
import { useMembers } from '../../hooks/useMembers'
import { ROLE_LABELS } from '../../lib/constants'
import Avatar from './Avatar'

const CHAT_ROLES = ['member', 'moderator', 'admin']

/**
 * Lijst van projectleden die mogen chatten (member+), met zoekveld.
 * Alleen naam en avatar — geen e-mail, dit is de lid-kant.
 *
 *   mode="single"  → onPick(profileId)
 *   mode="multi"   → selected: Set, onToggle(profileId)
 */
export default function MemberPicker({ mode = 'single', excludeIds = [], selected, onPick, onToggle, autoFocus = true }) {
  const { members, loading } = useMembers()
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const ex = new Set(excludeIds)
    return members
      .filter((m) => CHAT_ROLES.includes(m.role) && m.profile && !ex.has(m.profile.id))
      .filter((m) => !q || (m.profile.full_name || '').toLowerCase().includes(q))
      .sort((a, b) => (a.profile.full_name || '').localeCompare(b.profile.full_name || ''))
  }, [members, query, excludeIds])

  return (
    <div className="mpick">
      <div className="chat-search chat-search--modal">
        <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek op naam…"
          aria-label="Zoek een lid"
        />
      </div>
      <div className="mpick__list" role={mode === 'multi' ? 'group' : 'listbox'}>
        {loading ? (
          <div className="mpick__empty">Leden laden…</div>
        ) : list.length === 0 ? (
          <div className="mpick__empty">{query ? 'Geen leden gevonden.' : 'Geen andere leden om mee te chatten.'}</div>
        ) : list.map((m) => {
          const p = m.profile
          const on = mode === 'multi' && selected?.has(p.id)
          return (
            <button
              key={p.id}
              type="button"
              className={`mpick__row ${on ? 'mpick__row--on' : ''}`}
              onClick={() => (mode === 'multi' ? onToggle?.(p.id) : onPick?.(p.id))}
              role={mode === 'multi' ? 'checkbox' : 'option'}
              aria-checked={mode === 'multi' ? !!on : undefined}
            >
              {mode === 'multi' && <span className={`mpick__chk ${on ? 'mpick__chk--on' : ''}`}>{on && <i className="fa-solid fa-check" aria-hidden="true" />}</span>}
              <Avatar size={32} url={p.avatar_url} name={p.full_name} />
              <span className="mpick__name">{p.full_name || 'Naamloos lid'}</span>
              <span className="mpick__role">{ROLE_LABELS[m.role] || m.role}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
