import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import MemberPicker from './MemberPicker'

const EMOJI_CHOICES = ['💬', '🌱', '💶', '🏘️', '🔨', '🚲', '🧒', '🎉', '📐', '⚡', '🌳', '🍽️', '🎨', '📣', '🔒']

/** Nieuwe thema-groep: naam, thema, emoji, open/besloten en optioneel leden. */
export default function NewGroupModal({ onCreate, onClose }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [emoji, setEmoji] = useState('💬')
  const [joinPolicy, setJoinPolicy] = useState('open')
  const [selected, setSelected] = useState(new Set())
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(false)

  function toggle(id) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function submit(e) {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      await onCreate({ title: title.trim(), topic: topic.trim(), emoji, joinPolicy, memberIds: [...selected] })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card--chat" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="newgroup-title">
        <div className="modal-header">
          <h2 id="newgroup-title">Nieuwe groep</h2>
          <button className="modal-close" onClick={onClose} aria-label="Sluiten"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
        </div>
        <form className="modal-form" onSubmit={submit}>
          <p className="chat-modal__intro">Een groep hoort bij dit project. Leden kunnen open groepen zelf vinden en aansluiten.</p>

          <div className="form-group">
            <label htmlFor="grp-title">Naam</label>
            <div className="grp-namerow">
              <div className="grp-emoji">
                <button type="button" className="grp-emoji__btn" onClick={() => setShowPicker((s) => !s)} aria-label="Kies een emoji" aria-expanded={showPicker}>{emoji}</button>
                {showPicker && (
                  <div className="grp-emoji__menu">
                    {EMOJI_CHOICES.map((e) => (
                      <button type="button" key={e} className={e === emoji ? 'on' : ''} onClick={() => { setEmoji(e); setShowPicker(false) }}>{e}</button>
                    ))}
                  </div>
                )}
              </div>
              <input id="grp-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bijv. Duurzaamheid" maxLength={60} required />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="grp-topic">Thema <span className="chat-modal__opt">optioneel</span></label>
            <input id="grp-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Waar gaat deze groep over?" maxLength={120} />
          </div>

          <div className="form-group">
            <label>Zichtbaarheid</label>
            <div className="grp-seg" role="radiogroup">
              <button type="button" role="radio" aria-checked={joinPolicy === 'open'} className={joinPolicy === 'open' ? 'on' : ''} onClick={() => setJoinPolicy('open')}>
                <b><i className="fa-solid fa-hashtag" aria-hidden="true" /> Open</b>
                <span>Iedereen in het project kan aansluiten</span>
              </button>
              <button type="button" role="radio" aria-checked={joinPolicy === 'invite'} className={joinPolicy === 'invite' ? 'on' : ''} onClick={() => setJoinPolicy('invite')}>
                <b><i className="fa-solid fa-lock" aria-hidden="true" /> Besloten</b>
                <span>Alleen op uitnodiging</span>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Leden uitnodigen <span className="chat-modal__opt">optioneel · {selected.size} gekozen</span></label>
            <MemberPicker mode="multi" excludeIds={[user?.id]} selected={selected} onToggle={toggle} autoFocus={false} />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Annuleren</button>
            <button type="submit" className="btn-primary" disabled={!title.trim() || saving}>
              {saving ? 'Aanmaken…' : 'Groep aanmaken'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
