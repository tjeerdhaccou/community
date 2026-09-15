import { useState } from 'react'
import { PROFESSIONAL_TYPES, PROFESSIONAL_LABELS, PROFESSIONAL_COLORS, tagStyle } from '../lib/constants'

export default function InviteSheet({ invites, onInvite, onRevoke, onClose }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('architect')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return

    setSaving(true)
    try {
      await onInvite({ email: email.trim(), name: name.trim(), professional_type: type })
      setEmail('')
      setName('')
      setType('architect')
    } catch (err) {
      console.error('Error inviting:', err)
      alert('Uitnodiging versturen mislukt.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Professional uitnodigen</h2>
          <button className="modal-close" onClick={onClose} aria-label="Sluiten">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="invite-email">E-mailadres</label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="naam@bedrijf.nl"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="invite-name">Naam</label>
            <input
              id="invite-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Volledige naam"
            />
          </div>

          <div className="form-group">
            <label htmlFor="invite-type">Rol</label>
            <select id="invite-type" value={type} onChange={e => setType(e.target.value)}>
              {PROFESSIONAL_TYPES.map(t => (
                <option key={t} value={t}>{PROFESSIONAL_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Annuleren</button>
            <button type="submit" className="btn-primary" disabled={saving || !email.trim()}>
              {saving ? 'Versturen...' : 'Uitnodiging versturen'}
            </button>
          </div>
        </form>

        {/* Invited professionals list */}
        {invites.length > 0 && (
          <div className="invite-list">
            <h3 className="invite-list__title">Uitgenodigd</h3>
            {invites.map(inv => {
              const color = PROFESSIONAL_COLORS[inv.professional_type] || '#9ba1b0'
              return (
                <div key={inv.id} className="invite-row">
                  <div className="invite-row__avatar" style={{ background: color }}>
                    {(inv.name || inv.email)[0].toUpperCase()}
                  </div>
                  <div className="invite-row__info">
                    <span className="invite-row__name">{inv.name || inv.email}</span>
                    <span className="invite-row__email">{inv.email}</span>
                  </div>
                  <span className="pro-badge" style={tagStyle(color)}>
                    {PROFESSIONAL_LABELS[inv.professional_type]}
                  </span>
                  {inv.status === 'pending' ? (
                    <button className="btn-icon-sm" onClick={() => onRevoke(inv.id)} title="Intrekken" aria-label="Intrekken">
                      <i className="fa-solid fa-xmark" />
                    </button>
                  ) : (
                    <span className={`invite-status invite-status--${inv.status}`}>
                      {inv.status === 'accepted' ? 'Actief' : 'Ingetrokken'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
