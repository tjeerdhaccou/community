import { useState, useEffect, useRef } from 'react'
import { useSupportConversation } from '../../hooks/useSupportConversation'
import { useToast } from '../Toast'
import './SupportWidget.css'

function formatTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function SupportWidget() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const { messages, loading, sending, sendMessage, markRead, unreadCount } = useSupportConversation()
  const toast = useToast()
  const bodyRef = useRef(null)

  // Deeplink: ?support opent de widget (gebruikt door notificatie-mails).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('support')) setOpen(true)
  }, [])

  // Scroll naar onderaan bij nieuwe berichten / openen.
  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [messages, open])

  // Markeer als gelezen zodra het paneel open is (en bij nieuwe berichten).
  useEffect(() => {
    if (open) markRead()
  }, [open, messages, markRead])

  async function handleSend(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setDraft('')
    try {
      await sendMessage(text)
    } catch (err) {
      toast.error(err.message)
      setDraft(text)
    }
  }

  if (!open) {
    return (
      <button
        className="sc-fab"
        onClick={() => setOpen(true)}
        aria-label="Hulp nodig? Open de support-chat"
      >
        <i className="fa-regular fa-comment-dots" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="sc-fab__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>
    )
  }

  return (
    <div className="sc-panel" role="dialog" aria-label="Support-chat">
      <div className="sc-head">
        <div className="sc-head__av">
          <i className="fa-regular fa-life-ring" aria-hidden="true" />
          <span className="sc-head__on" />
        </div>
        <div className="sc-head__txt">
          <div className="sc-head__title">Hulp nodig?</div>
          <div className="sc-head__sub">We reageren meestal binnen één werkdag.</div>
        </div>
        <button className="sc-head__close" onClick={() => setOpen(false)} aria-label="Sluiten">
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </div>

      <div className="sc-body" ref={bodyRef}>
        {loading ? (
          <div className="sc-hint">Even laden…</div>
        ) : messages.length === 0 ? (
          <>
            <div className="sc-msg sc-msg--in">
              <div className="sc-bubble sc-bubble--in">
                Hoi! Waarmee kunnen we je helpen? Stel hieronder je vraag, dan reageren we zo snel mogelijk.
              </div>
            </div>
          </>
        ) : (
          messages.map(m => {
            const mine = m.sender_role === 'user'
            return (
              <div key={m.id} className={`sc-msg ${mine ? 'sc-msg--out' : 'sc-msg--in'}`}>
                <div className={`sc-bubble ${mine ? 'sc-bubble--out' : 'sc-bubble--in'}`}>{m.body}</div>
                <div className="sc-stamp">{mine ? '' : 'Support · '}{formatTime(m.created_at)}</div>
              </div>
            )
          })
        )}
      </div>

      <form className="sc-foot" onSubmit={handleSend}>
        <input
          className="sc-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Typ een bericht…"
          aria-label="Bericht"
          autoFocus
        />
        <button type="submit" className="sc-send" disabled={sending || !draft.trim()} aria-label="Versturen">
          <i className="fa-solid fa-paper-plane" aria-hidden="true" />
        </button>
      </form>
    </div>
  )
}
