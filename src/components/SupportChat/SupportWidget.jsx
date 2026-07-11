import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useSupportConversation } from '../../hooks/useSupportConversation'
import { useToast } from '../Toast'
import './SupportWidget.css'

const EMOJI = ['👍', '🙏', '😊', '🎉', '❤️', '👋', '😅', '🤔', '👌', '🙌', '✅', '🚀']

function SupportAttachment({ message }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let active = true
    supabase.storage
      .from('support-attachments')
      .createSignedUrl(message.attachment_path, 3600)
      .then(({ data }) => { if (active) setUrl(data?.signedUrl ?? null) })
    return () => { active = false }
  }, [message.attachment_path])

  const isImage = (message.attachment_type || '').startsWith('image/')
  if (!url) return <div className="sc-att sc-att--loading">Bijlage laden…</div>
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img className="sc-att-img" src={url} alt={message.attachment_name || 'bijlage'} />
      </a>
    )
  }
  return (
    <a className="sc-att" href={url} target="_blank" rel="noreferrer">
      <i className="fa-solid fa-file-pdf" aria-hidden="true" /> {message.attachment_name || 'Bijlage'}
    </a>
  )
}

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
  const [file, setFile] = useState(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [labelVisible, setLabelVisible] = useState(true)
  const { messages, loading, sending, sendMessage, markRead, unreadCount } = useSupportConversation()
  const toast = useToast()
  const bodyRef = useRef(null)
  const fileRef = useRef(null)

  // Deeplink: ?support opent de widget (gebruikt door notificatie-mails).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('support')) setOpen(true)
  }, [])

  // 'open-support-chat' event vanuit de sidebar (Voor jou → Chat) — zo hoeft
  // die nav-knop geen route te openen; hij triggert direct de widget.
  useEffect(() => {
    const openHandler = () => setOpen(true)
    window.addEventListener('open-support-chat', openHandler)
    return () => window.removeEventListener('open-support-chat', openHandler)
  }, [])

  // Toon het "Chat met ons"-label kort na binnenkomst, verberg daarna weer.
  useEffect(() => {
    const t = setTimeout(() => setLabelVisible(false), 60_000)
    return () => clearTimeout(t)
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
    if (!text && !file) return
    const sentFile = file
    setDraft('')
    setFile(null)
    setShowEmoji(false)
    try {
      await sendMessage(text, sentFile)
    } catch (err) {
      toast.error(err.message)
      setDraft(text)
      setFile(sentFile)
    }
  }

  function pickFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 10 * 1024 * 1024) { toast.error('Bestand is te groot (max 10MB).'); return }
    setFile(f)
    if (fileRef.current) fileRef.current.value = ''
  }

  if (!open) {
    return (
      <div className="sc-fab-wrap">
        <button
          type="button"
          className={`sc-fab-label ${labelVisible ? '' : 'sc-fab-label--hidden'}`}
          onClick={() => setOpen(true)}
          tabIndex={-1}
          aria-hidden="true"
        >
          Chat met ons
        </button>
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
      </div>
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
                <div className={`sc-bubble ${mine ? 'sc-bubble--out' : 'sc-bubble--in'}`}>
                  {m.attachment_path && <SupportAttachment message={m} />}
                  {m.body && <div className="sc-bubble__text">{m.body}</div>}
                </div>
                <div className="sc-stamp">{mine ? '' : 'Support · '}{formatTime(m.created_at)}</div>
              </div>
            )
          })
        )}
      </div>

      <form className="sc-foot" onSubmit={handleSend}>
        {file && (
          <div className="sc-filechip">
            <i className={`fa-solid ${file.type.startsWith('image/') ? 'fa-image' : 'fa-file-pdf'}`} aria-hidden="true" />
            <span className="sc-filechip__name">{file.name}</span>
            <button type="button" onClick={() => setFile(null)} aria-label="Bijlage verwijderen">
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </div>
        )}
        {showEmoji && (
          <div className="sc-emoji">
            {EMOJI.map(e => (
              <button type="button" key={e} onClick={() => { setDraft(d => d + e); setShowEmoji(false) }}>{e}</button>
            ))}
          </div>
        )}
        <div className="sc-inputrow">
          <button type="button" className="sc-icon" onClick={() => setShowEmoji(s => !s)} aria-label="Emoji">
            <i className="fa-regular fa-face-smile" aria-hidden="true" />
          </button>
          <button type="button" className="sc-icon" onClick={() => fileRef.current?.click()} aria-label="Bijlage toevoegen">
            <i className="fa-solid fa-paperclip" aria-hidden="true" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
            onChange={pickFile}
            hidden
          />
          <input
            className="sc-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Typ een bericht…"
            aria-label="Bericht"
            autoFocus
          />
          <button type="submit" className="sc-send" disabled={sending || (!draft.trim() && !file)} aria-label="Versturen">
            <i className="fa-solid fa-paper-plane" aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  )
}
