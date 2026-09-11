import { useState } from 'react'
import Avatar from './Avatar'
import MemberPicker from './MemberPicker'

const EMOJI_CHOICES = ['💬', '🌱', '💶', '🏘️', '🔨', '🚲', '🧒', '🎉', '📐', '⚡', '🌳', '🍽️', '🎨', '📣', '🔒']

/**
 * Groepsinformatie: leden, dempen, verlaten; voor owner/moderator ook
 * bewerken, leden toevoegen/verwijderen en archiveren.
 */
export default function GroupInfoModal({ thread, me, canManage, onAddMembers, onRemoveMember, onUpdate, onToggleMute, onLeave, onArchive, onClose }) {
  const [tab, setTab] = useState('members') // members | add | edit
  const [selected, setSelected] = useState(new Set())
  const [title, setTitle] = useState(thread.title || '')
  const [topic, setTopic] = useState(thread.topic || '')
  const [emoji, setEmoji] = useState(thread.emoji || '💬')
  const [joinPolicy, setJoinPolicy] = useState(thread.joinPolicy)
  const [busy, setBusy] = useState(false)

  function toggle(id) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function addSelected() {
    if (selected.size === 0 || busy) return
    setBusy(true)
    try { await onAddMembers([...selected]); setSelected(new Set()); setTab('members') } finally { setBusy(false) }
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!title.trim() || busy) return
    setBusy(true)
    try {
      await onUpdate({ title: title.trim(), topic: topic.trim() || null, emoji, join_policy: joinPolicy })
      setTab('members')
    } finally { setBusy(false) }
  }

  const owners = thread.participants.filter((p) => p.role === 'owner')
  const others = thread.participants.filter((p) => p.role !== 'owner')
  const sorted = [...owners, ...others].sort((a, b) => (a.role === b.role ? (a.full_name || '').localeCompare(b.full_name || '') : a.role === 'owner' ? -1 : 1))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card--chat" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="grpinfo-title">
        <div className="modal-header">
          <div className="grp-head">
            <Avatar size={44} emoji={thread.emoji} name={thread.title} icon={thread.emoji ? null : 'fa-solid fa-hashtag'} />
            <div>
              <h2 id="grpinfo-title">{thread.title}</h2>
              <div className="grp-head__sub">
                {thread.participants.length} {thread.participants.length === 1 ? 'lid' : 'leden'} · {thread.joinPolicy === 'open' ? 'open groep' : 'besloten groep'}
                {thread.topic ? ` · ${thread.topic}` : ''}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Sluiten"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
        </div>

        <div className="modal-form">
          <div className="grp-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'members'} className={tab === 'members' ? 'on' : ''} onClick={() => setTab('members')}>Leden</button>
            {canManage && <button type="button" role="tab" aria-selected={tab === 'add'} className={tab === 'add' ? 'on' : ''} onClick={() => setTab('add')}>Toevoegen</button>}
            {canManage && <button type="button" role="tab" aria-selected={tab === 'edit'} className={tab === 'edit' ? 'on' : ''} onClick={() => setTab('edit')}>Bewerken</button>}
          </div>

          {tab === 'members' && (
            <>
              <div className="mpick__list">
                {sorted.map((p) => (
                  <div key={p.id} className="mpick__row mpick__row--static">
                    <Avatar size={32} url={p.avatar_url} name={p.full_name} />
                    <span className="mpick__name">{p.full_name || 'Naamloos lid'}{p.id === me ? ' (jij)' : ''}</span>
                    <span className="mpick__role">{p.role === 'owner' ? 'Eigenaar' : ''}</span>
                    {canManage && p.id !== me && p.role !== 'owner' && (
                      <button type="button" className="mpick__x" onClick={() => onRemoveMember(p.id)} aria-label={`${p.full_name || 'Lid'} verwijderen uit groep`} title="Verwijderen uit groep">
                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="modal-actions modal-actions--spread">
                <div className="grp-actions">
                  <button type="button" className="btn-secondary" onClick={onToggleMute}>
                    <i className={`fa-solid ${thread.muted ? 'fa-bell' : 'fa-bell-slash'}`} aria-hidden="true" /> {thread.muted ? 'Dempen opheffen' : 'Dempen'}
                  </button>
                  <button type="button" className="btn-secondary" onClick={onLeave}>
                    <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" /> Verlaten
                  </button>
                </div>
                {canManage && (
                  <button type="button" className="btn-secondary btn-secondary--danger" onClick={onArchive}>
                    <i className="fa-solid fa-box-archive" aria-hidden="true" /> Archiveren
                  </button>
                )}
              </div>
            </>
          )}

          {tab === 'add' && canManage && (
            <>
              <MemberPicker mode="multi" excludeIds={thread.participants.map((p) => p.id)} selected={selected} onToggle={toggle} />
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setTab('members')}>Terug</button>
                <button type="button" className="btn-primary" disabled={selected.size === 0 || busy} onClick={addSelected}>
                  {busy ? 'Toevoegen…' : selected.size === 0 ? 'Toevoegen' : `${selected.size} toevoegen`}
                </button>
              </div>
            </>
          )}

          {tab === 'edit' && canManage && (
            <form onSubmit={saveEdit} className="grp-editform">
              <div className="form-group">
                <label htmlFor="grp-edit-title">Naam</label>
                <div className="grp-namerow">
                  <div className="grp-emoji">
                    <select value={emoji} onChange={(e) => setEmoji(e.target.value)} aria-label="Emoji" className="grp-emoji__select">
                      {EMOJI_CHOICES.map((e) => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  <input id="grp-edit-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} required />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="grp-edit-topic">Thema</label>
                <input id="grp-edit-topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={120} placeholder="Waar gaat deze groep over?" />
              </div>
              <div className="form-group">
                <label>Zichtbaarheid</label>
                <div className="grp-seg" role="radiogroup">
                  <button type="button" role="radio" aria-checked={joinPolicy === 'open'} className={joinPolicy === 'open' ? 'on' : ''} onClick={() => setJoinPolicy('open')}>
                    <b><i className="fa-solid fa-hashtag" aria-hidden="true" /> Open</b><span>Iedereen kan aansluiten</span>
                  </button>
                  <button type="button" role="radio" aria-checked={joinPolicy === 'invite'} className={joinPolicy === 'invite' ? 'on' : ''} onClick={() => setJoinPolicy('invite')}>
                    <b><i className="fa-solid fa-lock" aria-hidden="true" /> Besloten</b><span>Alleen op uitnodiging</span>
                  </button>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setTab('members')}>Annuleren</button>
                <button type="submit" className="btn-primary" disabled={!title.trim() || busy}>{busy ? 'Opslaan…' : 'Opslaan'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
