import { useState } from 'react'

export default function IntakeResponseDetail({ response: initialResponse, questions, onClose, onInvite, onReject }) {
  const [response, setResponse] = useState(initialResponse)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const timeAgo = getTimeAgo(response.created_at)

  async function handleInvite() {
    setError(null)
    setLoading(true)
    try {
      await onInvite()
      setResponse(prev => ({ ...prev, status: 'invited', invited_at: new Date().toISOString() }))
    } catch (err) {
      setError(err.message || 'Uitnodigen mislukt.')
    } finally {
      setLoading(false)
    }
  }

  async function handleReject() {
    setError(null)
    setLoading(true)
    try {
      await onReject()
      setResponse(prev => ({ ...prev, status: 'rejected' }))
    } catch (err) {
      setError(err.message || 'Afwijzen mislukt.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card--profile" onClick={e => e.stopPropagation()}>
        <div className="modal-detail-actions">
          <button onClick={onClose} aria-label="Sluiten">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="intake-detail">
          <div className="intake-detail__header">
            <div className="intake-detail__avatar">
              {response.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="intake-detail__name">{response.name}</h2>
              <p className="intake-detail__meta">{timeAgo}</p>
            </div>
          </div>

          <div className="intake-detail__status-badge" data-status={response.status}>
            {response.status === 'pending' && 'Nieuw'}
            {response.status === 'invited' && 'Uitgenodigd'}
            {response.status === 'joined' && 'Lid geworden'}
            {response.status === 'rejected' && 'Afgewezen'}
          </div>

          {/* Contact info */}
          <div className="intake-detail__section">
            <div className="intake-detail__field">
              <i className="fa-solid fa-envelope" />
              <a href={`mailto:${response.email}`}>{response.email}</a>
            </div>
            {response.phone && (
              <div className="intake-detail__field">
                <i className="fa-solid fa-phone" />
                <a href={`tel:${response.phone}`}>{response.phone}</a>
              </div>
            )}
          </div>

          {/* Answers */}
          {questions.length > 0 && (
            <div className="intake-detail__answers">
              <h3>Antwoorden</h3>
              {questions.map(q => {
                const answer = response.answers?.[q.id]
                if (!answer) return null
                return (
                  <div key={q.id} className="intake-detail__answer">
                    <span className="intake-detail__answer-label">{q.question_text}</span>
                    <span className="intake-detail__answer-value">{answer}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pending: show action buttons */}
          {response.status === 'pending' && (
            <>
              {error && (
                <p style={{ color: 'var(--accent-red)', fontSize: '14px', margin: '12px 0 0' }}>{error}</p>
              )}
              <div className="intake-detail__actions">
                <button className="btn-secondary" onClick={handleReject} disabled={loading}>
                  <i className="fa-solid fa-xmark" /> Afwijzen
                </button>
                <button className="btn-primary" onClick={handleInvite} disabled={loading}>
                  <i className="fa-solid fa-paper-plane" /> {loading ? 'Bezig...' : 'Uitnodigen'}
                </button>
              </div>
            </>
          )}

          {/* Invited: confirmation that email was sent */}
          {response.status === 'invited' && (
            <div className="intake-detail__invite-info">
              <p>
                <i className="fa-solid fa-circle-check" style={{ color: 'var(--accent-green)' }} />{' '}
                Uitgenodigd{response.invited_at ? ` op ${new Date(response.invited_at).toLocaleDateString('nl-NL')}` : ''}
              </p>
              <p className="intake-detail__invite-hint">
                {response.name.split(' ')[0]} heeft een e-mail met inloglink ontvangen op <strong>{response.email}</strong>.
              </p>
            </div>
          )}

          {/* Rejected: show status */}
          {response.status === 'rejected' && (
            <div className="intake-detail__rejected-info">
              <p><i className="fa-solid fa-circle-xmark" /> Aanmelding is afgewezen</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} min geleden`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} uur geleden`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'gisteren'
  return `${days} dagen geleden`
}
