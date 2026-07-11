import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react'
import { supabase } from '../lib/supabase'
import { useProject } from '../contexts/ProjectContext'
import { useSupportChat } from '../hooks/useSupportChat'
import { useToast } from '../components/Toast'
import './Chat.css'

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
  if (!url) return <div className="chat-att chat-att--loading">Bijlage laden…</div>
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img className="chat-att-img" src={url} alt={message.attachment_name || 'bijlage'} />
      </a>
    )
  }
  return (
    <a className="chat-att" href={url} target="_blank" rel="noreferrer">
      <i className="fa-solid fa-file-pdf" aria-hidden="true" /> {message.attachment_name || 'Bijlage'}
    </a>
  )
}

function formatTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

function dayLabel(iso) {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date(); yest.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Vandaag'
  if (d.toDateString() === yest.toDateString()) return 'Gisteren'
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

export default function Chat() {
  const { project } = useProject()
  const { conversations, loading, sending, sendMessage, markRead, search } = useSupportChat()
  const toast = useToast()

  const [selectedId, setSelectedId] = useState(null)
  const [mobileThread, setMobileThread] = useState(false)
  const [draft, setDraft] = useState('')
  const [file, setFile] = useState(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [highlightId, setHighlightId] = useState(null)

  const bodyRef = useRef(null)
  const fileRef = useRef(null)
  const searchRef = useRef(null)

  const teamName = project?.name ? `Team ${project.name}` : 'Support'

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId],
  )

  // Selecteer standaard het nieuwste gesprek zodra er data is (desktop).
  useEffect(() => {
    if (!selectedId && conversations.length > 0) setSelectedId(conversations[0].id)
  }, [conversations, selectedId])

  // Markeer gelezen zodra een gesprek in beeld is en er ongelezen team-berichten zijn.
  useEffect(() => {
    if (selected && selected.unread > 0) markRead(selected.id)
  }, [selected, markRead])

  // Zoeken (gedebounced) — server-zoek over de berichthistorie.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    let active = true
    const t = setTimeout(async () => {
      const r = await search(q)
      if (active) setResults(r)
    }, 220)
    return () => { active = false; clearTimeout(t) }
  }, [query, search])

  // Scroll naar onderen bij nieuw bericht / wisselen — tenzij we naar een
  // zoektreffer springen (dan scrollt het highlight-effect zelf).
  useEffect(() => {
    if (highlightId) return
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [selected?.messages.length, selectedId, highlightId])

  // Spring naar een gemarkeerd bericht en laat de markering weer wegvloeien.
  useEffect(() => {
    if (!highlightId) return
    const el = document.getElementById(`chat-msg-${highlightId}`)
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const t = setTimeout(() => setHighlightId(null), 2200)
    return () => clearTimeout(t)
  }, [highlightId, selectedId])

  function openConversation(id) {
    setSelectedId(id)
    setMobileThread(true)
  }

  function openResult(res) {
    setSelectedId(res.conversation_id)
    setMobileThread(true)
    setQuery('')
    setResults([])
    setHighlightId(res.id)
  }

  async function handleSend(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text && !file) return
    const sentFile = file
    setDraft('')
    setFile(null)
    setShowEmoji(false)
    try {
      const id = await sendMessage(selected?.id ?? null, text, sentFile)
      if (id) { setSelectedId(id); setMobileThread(true) }
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

  const searching = query.trim().length >= 2

  return (
    <div className={`view-chat ${mobileThread ? 'view-chat--thread' : ''}`}>
      {/* ── Gesprekkenlijst + zoeken ─────────────────────────────────────── */}
      <aside className="chat-list">
        <div className="chat-list__search">
          <div className={`chat-search ${searching ? 'chat-search--active' : ''}`}>
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Zoek in gesprekken…"
              aria-label="Zoek in gesprekken"
            />
            {query && (
              <button type="button" className="chat-search__clear" onClick={() => setQuery('')} aria-label="Wis zoekopdracht">
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {searching ? (
          <div className="chat-results">
            <div className="chat-results__count">
              {results.length === 0 ? 'Geen resultaten' : `${results.length} ${results.length === 1 ? 'resultaat' : 'resultaten'}`}
            </div>
            {results.map((r) => (
              <button key={r.id} type="button" className="chat-result" onClick={() => openResult(r)}>
                <div className="chat-result__who">
                  <span>{r.sender_role === 'agent' ? teamName : 'Jij'}</span>
                  <span className="chat-result__time">{new Date(r.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>
                </div>
                <div className="chat-result__txt">{r.body}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="chat-convs">
            <div className="chat-convs__label">Direct</div>
            {conversations.length === 0 ? (
              <p className="chat-convs__empty">Je gesprek met het team verschijnt hier.</p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chat-conv ${c.id === selectedId ? 'chat-conv--active' : ''}`}
                  onClick={() => openConversation(c.id)}
                >
                  <span className="chat-conv__av"><i className="fa-regular fa-life-ring" aria-hidden="true" /></span>
                  <span className="chat-conv__mid">
                    <span className="chat-conv__top">
                      <span className="chat-conv__name">{teamName}</span>
                      <span className="chat-conv__time">{c.last ? formatTime(c.last.created_at) : ''}</span>
                    </span>
                    <span className="chat-conv__snip">
                      {c.last ? `${c.last.sender_role === 'user' ? 'Jij: ' : ''}${c.last.body || (c.last.attachment_path ? '📎 Bijlage' : '')}` : 'Nog geen berichten'}
                    </span>
                  </span>
                  {c.unread > 0 && <span className="chat-conv__badge">{c.unread > 9 ? '9+' : c.unread}</span>}
                </button>
              ))
            )}
          </div>
        )}
      </aside>

      {/* ── Thread ───────────────────────────────────────────────────────── */}
      <section className="chat-thread">
        <header className="chat-head">
          <button type="button" className="chat-head__back" onClick={() => setMobileThread(false)} aria-label="Terug naar gesprekken">
            <i className="fa-solid fa-arrow-left" aria-hidden="true" />
          </button>
          <div className="chat-head__av">
            <i className="fa-regular fa-life-ring" aria-hidden="true" />
            <span className="chat-head__on" />
          </div>
          <div className="chat-head__txt">
            <div className="chat-head__title">{teamName}</div>
            <div className="chat-head__sub">Reageert meestal binnen één werkdag</div>
          </div>
        </header>

        <div className="chat-body" ref={bodyRef}>
          {loading ? (
            <div className="chat-hint">Even laden…</div>
          ) : !selected || selected.messages.length === 0 ? (
            <div className="chat-empty">
              <div className="chat-empty__ic"><i className="fa-regular fa-comment-dots" aria-hidden="true" /></div>
              <div className="chat-empty__t">Waarmee kunnen we je helpen?</div>
              <div className="chat-empty__s">Stel je vraag aan het team. We reageren zo snel mogelijk.</div>
            </div>
          ) : (
            selected.messages.map((m, i) => {
              const mine = m.sender_role === 'user'
              const prev = selected.messages[i - 1]
              const showDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()
              const isLast = i === selected.messages.length - 1
              return (
                <Fragment key={m.id}>
                  {showDay && <div className="chat-datesep">{dayLabel(m.created_at)}</div>}
                  <div id={`chat-msg-${m.id}`} className={`chat-msg ${mine ? 'chat-msg--out' : 'chat-msg--in'}`}>
                    <div className={`chat-bubble ${mine ? 'chat-bubble--out' : 'chat-bubble--in'} ${highlightId === m.id ? 'chat-bubble--hit' : ''}`}>
                      {m.attachment_path && <SupportAttachment message={m} />}
                      {m.body && <div className="chat-bubble__text">{m.body}</div>}
                    </div>
                    <div className="chat-stamp">
                      {mine ? '' : `${teamName} · `}{formatTime(m.created_at)}
                      {mine && isLast && m.read_at ? ' · Gelezen' : ''}
                    </div>
                  </div>
                </Fragment>
              )
            })
          )}
        </div>

        <form className="chat-foot" onSubmit={handleSend}>
          {file && (
            <div className="chat-filechip">
              <i className={`fa-solid ${file.type.startsWith('image/') ? 'fa-image' : 'fa-file-pdf'}`} aria-hidden="true" />
              <span className="chat-filechip__name">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} aria-label="Bijlage verwijderen">
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>
          )}
          {showEmoji && (
            <div className="chat-emoji">
              {EMOJI.map((e) => (
                <button type="button" key={e} onClick={() => { setDraft((d) => d + e); setShowEmoji(false) }}>{e}</button>
              ))}
            </div>
          )}
          <div className="chat-inputrow">
            <button type="button" className="chat-icon" onClick={() => setShowEmoji((s) => !s)} aria-label="Emoji">
              <i className="fa-regular fa-face-smile" aria-hidden="true" />
            </button>
            <button type="button" className="chat-icon" onClick={() => fileRef.current?.click()} aria-label="Bijlage toevoegen">
              <i className="fa-solid fa-paperclip" aria-hidden="true" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
              onChange={pickFile}
              hidden
            />
            <textarea
              className="chat-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) } }}
              placeholder="Typ een bericht…"
              aria-label="Bericht"
              rows={1}
            />
            <button type="submit" className="chat-send" disabled={sending || (!draft.trim() && !file)} aria-label="Versturen">
              <i className="fa-solid fa-paper-plane" aria-hidden="true" />
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
