import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { useSupportChat } from '../hooks/useSupportChat'
import { useMemberChat } from '../hooks/useMemberChat'
import { useToast } from '../components/Toast'
import { canDo } from '../lib/permissions'
import ConfirmModal from '../components/ConfirmModal'
import NewDirectModal from '../components/Chat/NewDirectModal'
import NewGroupModal from '../components/Chat/NewGroupModal'
import GroupInfoModal from '../components/Chat/GroupInfoModal'
import Avatar from '../components/Chat/Avatar'
import PushBanner from '../components/Chat/PushBanner'
import { lockBodyScroll, isNarrowScreen } from '../lib/scrollLock'
import { promptDemoSignup } from '../lib/demo'
import './Chat.css'

const EMOJI = ['👍', '🙏', '😊', '🎉', '❤️', '👋', '😅', '🤔', '👌', '🙌', '✅', '🚀']

/* ── Kleine helpers ───────────────────────────────────────────────────────── */

function Attachment({ bucket, path, name, type }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let active = true
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600)
      .then(({ data }) => { if (active) setUrl(data?.signedUrl ?? null) })
    return () => { active = false }
  }, [bucket, path])

  const isImage = (type || '').startsWith('image/')
  if (!url) return <div className="chat-att chat-att--loading">Bijlage laden…</div>
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img className="chat-att-img" src={url} alt={name || 'bijlage'} />
      </a>
    )
  }
  return (
    <a className="chat-att" href={url} target="_blank" rel="noreferrer">
      <i className="fa-solid fa-file-pdf" aria-hidden="true" /> {name || 'Bijlage'}
    </a>
  )
}

function formatTime(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
    const diffDays = Math.round((today - d) / 86400000)
    if (diffDays < 7) return d.toLocaleDateString('nl-NL', { weekday: 'short' })
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  } catch { return '' }
}

function formatClock(iso) {
  try { return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

function dayLabel(iso) {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date(); yest.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Vandaag'
  if (d.toDateString() === yest.toDateString()) return 'Gisteren'
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

function firstName(name) {
  return (name || '').split(' ')[0] || 'Lid'
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Splitst tekst in stukken en licht @Naam van deelnemers uit. */
function renderWithMentions(text, names) {
  if (!text || !names || names.length === 0) return text
  const re = new RegExp(`@(${names.map(escapeRe).join('|')})`, 'g')
  const out = []
  let last = 0, m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(<span key={m.index} className="chat-mention">@{m[1]}</span>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/* ── Support-gesprekken normaliseren naar dezelfde thread-vorm ─────────────── */

function normalizeSupport(c, teamName) {
  return {
    id: c.id,
    source: 'support',
    kind: 'support',
    title: teamName,
    subtitle: 'Reageert meestal binnen één werkdag',
    icon: 'fa-regular fa-life-ring',
    last: c.last
      ? { body: c.last.body || (c.last.attachment_path ? '📎 Bijlage' : ''), created_at: c.last.created_at, mine: c.last.sender_role === 'user', senderName: null }
      : null,
    last_message_at: c.last_message_at,
    unread: c.unread,
    muted: false,
    archived: false,
    messages: c.messages,
  }
}

/* ── Pagina ────────────────────────────────────────────────────────────────── */

export default function Chat() {
  const { user } = useAuth()
  const { project, role, featureEnabled, readOnly } = useProject()
  const toast = useToast()
  const me = user?.id

  // Ledenchat alleen voor leden (member+) en als de module aan staat.
  const chatOn = featureEnabled('chat') && canDo(role, 'use_member_chat')
  const canCreateGroup =
    chatOn && (project?.chat_group_creation === 'moderators' ? canDo(role, 'moderate_board') : true)
  const canModerate = canDo(role, 'moderate_board')

  const support = useSupportChat()
  const chat = useMemberChat({ enabled: chatOn })

  const teamName = project?.name ? `Team ${project.name}` : 'Support'

  // Eén gesorteerde lijst per sectie.
  const directThreads = useMemo(() => {
    const s = support.conversations.map((c) => normalizeSupport(c, teamName))
    const d = chat.threads.filter((t) => t.kind === 'direct')
    return [...s, ...d].sort((a, b) => (b.last_message_at || '').localeCompare(a.last_message_at || ''))
  }, [support.conversations, chat.threads, teamName])

  const groupThreads = useMemo(
    () => chat.threads.filter((t) => t.kind === 'group'),
    [chat.threads],
  )

  const allThreads = useMemo(() => [...directThreads, ...groupThreads], [directThreads, groupThreads])

  const [selectedId, setSelectedId] = useState(null)
  const [mobileThread, setMobileThread] = useState(false)
  const [draft, setDraft] = useState('')
  const [file, setFile] = useState(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showNewMenu, setShowNewMenu] = useState(false)
  const [modal, setModal] = useState(null) // 'direct' | 'group' | 'info' | null
  const [confirm, setConfirm] = useState(null) // { message, onConfirm }
  const [discoverOpen, setDiscoverOpen] = useState(true)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [highlightId, setHighlightId] = useState(null)
  const [mentionIds, setMentionIds] = useState(() => new Set())

  const bodyRef = useRef(null)
  const fileRef = useRef(null)
  const newMenuRef = useRef(null)

  const selected = useMemo(() => allThreads.find((t) => t.id === selectedId) || null, [allThreads, selectedId])

  // Berichten van de geselecteerde thread (support: vooraf geladen; chat: lazy).
  const messages = useMemo(() => {
    if (!selected) return []
    if (selected.source === 'support') {
      return selected.messages.map((m) => ({
        id: m.id, body: m.body, created_at: m.created_at,
        mine: m.sender_role === 'user',
        senderName: m.sender_role === 'user' ? null : teamName,
        senderAvatar: null,
        attachment: m.attachment_path ? { bucket: 'support-attachments', path: m.attachment_path, name: m.attachment_name, type: m.attachment_type } : null,
        deleted: false, edited: false, read: !!m.read_at,
      }))
    }
    return (chat.messagesByThread[selected.id] || []).map((m) => ({
      id: m.id, body: m.body, created_at: m.created_at,
      mine: m.sender_id === me,
      senderId: m.sender_id,
      senderName: m.sender?.full_name || 'Lid',
      senderAvatar: m.sender?.avatar_url || null,
      attachment: m.attachment_path && !m.deleted_at ? { bucket: 'chat-attachments', path: m.attachment_path, name: m.attachment_name, type: m.attachment_type } : null,
      deleted: !!m.deleted_at, edited: !!m.edited_at, read: false,
    }))
  }, [selected, chat.messagesByThread, me, teamName])

  // ?thread=<id> deeplink (e-mails, notificaties) → selecteren.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('thread')
    if (t && allThreads.some((x) => x.id === t)) {
      setSelectedId(t); setMobileThread(true)
      const url = new URL(window.location.href); url.searchParams.delete('thread'); window.history.replaceState({}, '', url)
    }
  }, [allThreads])

  // Standaard het nieuwste gesprek kiezen zodra er data is (desktop).
  useEffect(() => {
    if (!selectedId && allThreads.length > 0) setSelectedId(allThreads[0].id)
  }, [allThreads, selectedId])

  // Berichten laden + als gelezen markeren zodra een thread in beeld is.
  useEffect(() => {
    if (!selected) return
    if (selected.source === 'chat') chat.loadMessages(selected.id)
    if (selected.unread > 0) {
      if (selected.source === 'support') support.markRead(selected.id)
      else chat.markRead(selected.id)
    }
  }, [selected?.id, selected?.unread, selected?.source]) // eslint-disable-line react-hooks/exhaustive-deps

  // Zoeken (gedebounced) over beide bronnen.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    let active = true
    const t = setTimeout(async () => {
      const [s, c] = await Promise.all([support.search(q), chat.search(q)])
      if (!active) return
      const sr = s.map((r) => ({ id: r.id, thread_id: r.conversation_id, source: 'support', body: r.body, created_at: r.created_at, mine: r.sender_role === 'user', senderName: r.sender_role === 'agent' ? teamName : null }))
      setResults([...sr, ...c].sort((a, b) => b.created_at.localeCompare(a.created_at)))
    }, 220)
    return () => { active = false; clearTimeout(t) }
  }, [query, support.search, chat.search, teamName])

  // Scroll naar onderen bij nieuw bericht / wisselen.
  useEffect(() => {
    if (highlightId) return
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [messages.length, selectedId, highlightId])

  useEffect(() => {
    if (!highlightId) return
    const el = document.getElementById(`chat-msg-${highlightId}`)
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const t = setTimeout(() => setHighlightId(null), 2200)
    return () => clearTimeout(t)
  }, [highlightId, selectedId])

  // Mobiel: zodra een gesprek open staat, verdwijnt de onderbalk (zie Chat.css)
  // zodat de composer direct boven het toetsenbord zit, zoals in messenger-apps.
  useEffect(() => {
    document.body.classList.toggle('chat-thread-open', mobileThread)
    // Op mobiel: pagina-scroll vergrendelen zodat alleen de berichtenlijst scrolt
    // (geen rubber-banding van de hele pagina, geen verspringende composer).
    const unlock = mobileThread && isNarrowScreen() ? lockBodyScroll() : null
    return () => { document.body.classList.remove('chat-thread-open'); unlock?.() }
  }, [mobileThread])

  // Toetsenbord open/dicht (visualViewport verandert): onderaan blijven als we daar al waren.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function onResize() {
      const el = bodyRef.current
      if (!el) return
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160
      if (nearBottom) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])

  // Composer groeit mee met de tekst (max-height via CSS), zoals in messenger-apps.
  const inputRef = useRef(null)
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    // scrollHeight telt de randen niet mee, maar het veld is border-box. Zetten
    // we de hoogte zonder die correctie, dan komt het vakje 2px tekort en houdt
    // het veld permanent een schuifbalk — ook als het leeg is.
    const borderY = el.offsetHeight - el.clientHeight
    el.style.height = `${Math.min(el.scrollHeight + borderY, 132)}px`
  }, [draft])

  // Nieuw-menu sluiten bij klik buiten.
  useEffect(() => {
    if (!showNewMenu) return
    function onDoc(e) { if (newMenuRef.current && !newMenuRef.current.contains(e.target)) setShowNewMenu(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [showNewMenu])

  function openThread(id) {
    setSelectedId(id)
    setMobileThread(true)
    setShowEmoji(false)
    setMentionIds(new Set())
  }

  function openResult(res) {
    openThread(res.thread_id)
    setQuery('')
    setResults([])
    setHighlightId(res.id)
  }

  async function handleSend(e) {
    e.preventDefault()
    if (readOnly) { promptDemoSignup(); return }
    const text = draft.trim()
    if (!text && !file) return
    const sentFile = file
    setDraft(''); setFile(null); setShowEmoji(false)
    try {
      if (!selected || selected.source === 'support') {
        const id = await support.sendMessage(selected?.id ?? null, text, sentFile)
        if (id) openThread(id)
      } else {
        await chat.sendMessage(selected.id, text, sentFile, activeMentions(text))
        setMentionIds(new Set())
      }
    } catch (err) {
      toast.error(err.message)
      setDraft(text); setFile(sentFile)
    }
  }

  function pickFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 10 * 1024 * 1024) { toast.error('Bestand is te groot (max 10MB).'); return }
    setFile(f)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleJoin(threadId) {
    if (readOnly) { promptDemoSignup(); return }
    try { await chat.joinGroup(threadId); openThread(threadId); toast.success('Je bent aangesloten bij de groep.') }
    catch (err) { toast.error(err.message) }
  }

  // Nieuwe gesprekken starten kan niet in de demo: de RLS zou het toch weigeren,
  // dus vragen we meteen om aan te melden i.p.v. een foutmelding te tonen.
  function openChatModal(name) {
    if (readOnly) { promptDemoSignup(); return }
    setModal(name)
  }

  async function handleStartDirect(otherId) {
    try { const id = await chat.startDirect(otherId); setModal(null); openThread(id) }
    catch (err) { toast.error(err.message) }
  }

  async function handleCreateGroup(payload) {
    try { const id = await chat.createGroup(payload); setModal(null); openThread(id); toast.success('Groep aangemaakt.') }
    catch (err) { toast.error(err.message) }
  }

  function askLeave(thread) {
    if (readOnly) { promptDemoSignup(); return }
    setConfirm({
      message: `Groep "${thread.title}" verlaten? Je kunt later weer aansluiten als de groep open is.`,
      label: 'Verlaten',
      onConfirm: async () => {
        try { await chat.leaveGroup(thread.id); setSelectedId(null); setMobileThread(false); setModal(null) }
        catch (err) { toast.error(err.message) }
      },
    })
  }

  function askArchive(thread) {
    if (readOnly) { promptDemoSignup(); return }
    setConfirm({
      message: `Groep "${thread.title}" archiveren? Niemand kan er dan nog in schrijven.`,
      label: 'Archiveren',
      onConfirm: async () => {
        try { await chat.archiveGroup(thread.id); setSelectedId(null); setMobileThread(false); setModal(null); toast.success('Groep gearchiveerd.') }
        catch (err) { toast.error(err.message) }
      },
    })
  }

  function askHide(thread) {
    if (readOnly) { promptDemoSignup(); return }
    setConfirm({
      message: `Gesprek met ${firstName(thread.title)} verwijderen uit je lijst? Stuurt ${firstName(thread.title)} een nieuw bericht, dan komt het gesprek vanzelf terug.`,
      label: 'Verwijderen',
      onConfirm: async () => {
        try { await chat.hideThread(thread.id); setSelectedId(null); setMobileThread(false) }
        catch (err) { toast.error(err.message) }
      },
    })
  }

  function askDeleteMessage(msg) {
    if (readOnly) { promptDemoSignup(); return }
    setConfirm({
      message: 'Dit bericht verwijderen? Anderen zien dan "Bericht verwijderd".',
      label: 'Verwijderen',
      onConfirm: async () => {
        try { await chat.deleteMessage(msg.id) } catch (err) { toast.error(err.message) }
      },
    })
  }

  const searching = query.trim().length >= 2
  const isGroup = selected?.kind === 'group'
  const isDirect = selected?.kind === 'direct'

  // @-vermeldingen: alleen in groepen; suggesties op basis van de tekst achter de laatste '@'.
  const participantNames = useMemo(
    () => (selected?.source === 'chat' ? (selected.participants || []).map((p) => p.full_name).filter(Boolean) : []),
    [selected],
  )
  const mentionMatch = isGroup ? draft.match(/(?:^|\s)@([^\s@]{0,30})$/) : null
  const mentionOptions = useMemo(() => {
    if (!mentionMatch || !selected) return []
    const q = mentionMatch[1].toLowerCase()
    return (selected.others || [])
      .filter((p) => p.full_name && p.full_name.toLowerCase().includes(q))
      .slice(0, 6)
  }, [mentionMatch, selected])

  function pickMention(p) {
    setDraft((d) => d.replace(/@[^\s@]{0,30}$/, `@${p.full_name} `))
    setMentionIds((prev) => new Set(prev).add(p.id))
  }

  // Vermeldingen die nog echt in de tekst staan (gebruiker kan ze weer weghalen).
  function activeMentions(text) {
    if (!selected || selected.source !== 'chat') return []
    return [...mentionIds].filter((id) => {
      const p = selected.participants.find((x) => x.id === id)
      return p?.full_name && text.includes(`@${p.full_name}`)
    })
  }
  const canPost = !!selected && (selected.source === 'support' || (!selected.archived && chatOn))
  const isNarrow = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)').matches
  const composerPlaceholder = !selected ? 'Stel je vraag aan het team…'
    : selected.source === 'support' || isNarrow ? 'Typ een bericht…'
    : isGroup ? `Bericht aan ${selected.title}…` : `Bericht aan ${firstName(selected.title)}…`

  /* ── Render ─────────────────────────────────────────────────────────────── */

  function renderConv(t) {
    const snippet = t.last
      ? `${t.last.mine ? 'Jij: ' : t.kind === 'group' && t.last.senderName ? `${t.last.senderName}: ` : ''}${t.last.body}`
      : t.kind === 'group' ? (t.topic || 'Nog geen berichten') : 'Nog geen berichten'
    return (
      <button
        key={t.id}
        type="button"
        className={`chat-conv ${t.id === selectedId ? 'chat-conv--active' : ''} ${t.muted ? 'chat-conv--muted' : ''}`}
        onClick={() => openThread(t.id)}
      >
        <Avatar url={t.avatarUrl} name={t.title} emoji={t.emoji} icon={t.icon || (t.kind === 'group' ? 'fa-solid fa-hashtag' : null)} />
        <span className="chat-conv__mid">
          <span className="chat-conv__top">
            <span className="chat-conv__name">
              {t.title}
              {t.kind === 'group' && t.joinPolicy === 'invite' && <i className="fa-solid fa-lock chat-conv__ic" aria-label="Besloten groep" />}
              {t.muted && <i className="fa-solid fa-bell-slash chat-conv__ic" aria-label="Gedempt" />}
            </span>
            <span className="chat-conv__time">{t.last ? formatTime(t.last.created_at) : ''}</span>
          </span>
          <span className="chat-conv__snip">{snippet}</span>
        </span>
        {t.unread > 0 && <span className="chat-conv__badge">{t.unread > 9 ? '9+' : t.unread}</span>}
      </button>
    )
  }

  return (
    <div className={`view-chat ${mobileThread ? 'view-chat--thread' : ''}`}>
      {/* ── Gesprekkenlijst + zoeken ─────────────────────────────────────── */}
      <aside className="chat-list">
        {chatOn && <PushBanner />}
        <div className="chat-list__search">
          <div className={`chat-search ${searching ? 'chat-search--active' : ''}`}>
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            <input
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
          {chatOn && (
            <div className="chat-new" ref={newMenuRef}>
              <button type="button" className="chat-new__btn" onClick={() => setShowNewMenu((s) => !s)} aria-label="Nieuw gesprek" aria-expanded={showNewMenu}>
                <i className="fa-solid fa-plus" aria-hidden="true" />
              </button>
              {showNewMenu && (
                <div className="chat-new__menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setShowNewMenu(false); openChatModal('direct') }}>
                    <span className="chat-new__ic"><i className="fa-regular fa-user" aria-hidden="true" /></span>
                    <span><b>Bericht aan een lid</b><small>Kies iemand uit het project</small></span>
                  </button>
                  {canCreateGroup && (
                    <button type="button" role="menuitem" onClick={() => { setShowNewMenu(false); openChatModal('group') }}>
                      <span className="chat-new__ic"><i className="fa-solid fa-user-group" aria-hidden="true" /></span>
                      <span><b>Nieuwe groep</b><small>Rond een thema, open of besloten</small></span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {searching ? (
          <div className="chat-results">
            <div className="chat-results__count">
              {results.length === 0 ? 'Geen resultaten' : `${results.length} ${results.length === 1 ? 'resultaat' : 'resultaten'}`}
            </div>
            {results.map((r) => (
              <button key={r.id} type="button" className="chat-result" onClick={() => openResult(r)}>
                <div className="chat-result__who">
                  <span>{r.mine ? 'Jij' : r.senderName || 'Lid'}</span>
                  <span className="chat-result__time">{new Date(r.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>
                </div>
                <div className="chat-result__txt">{r.body}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="chat-convs">
            <div className="chat-convs__label">Direct</div>
            {directThreads.length === 0 ? (
              <p className="chat-convs__empty">Je gesprek met het team verschijnt hier.</p>
            ) : directThreads.map(renderConv)}

            {chatOn && (
              <>
                <div className="chat-convs__label">Groepen</div>
                {groupThreads.length === 0 ? (
                  <p className="chat-convs__empty">
                    {canCreateGroup ? 'Start een groep rond een thema via de plus-knop.' : 'Je zit nog in geen groep.'}
                  </p>
                ) : groupThreads.map(renderConv)}

                {chat.discover.length > 0 && (
                  <>
                    <button type="button" className="chat-convs__label chat-convs__label--btn" onClick={() => setDiscoverOpen((o) => !o)} aria-expanded={discoverOpen}>
                      <span>Ontdek groepen <span className="chat-convs__count">{chat.discover.length}</span></span>
                      <i className={`fa-solid fa-chevron-${discoverOpen ? 'up' : 'down'}`} aria-hidden="true" />
                    </button>
                    {discoverOpen && chat.discover.map((t) => (
                      <div key={t.id} className="chat-conv chat-conv--discover">
                        <Avatar emoji={t.emoji} name={t.title} icon={t.emoji ? null : 'fa-solid fa-hashtag'} />
                        <span className="chat-conv__mid">
                          <span className="chat-conv__top"><span className="chat-conv__name">{t.title}</span></span>
                          <span className="chat-conv__snip">{t.participants.length} {t.participants.length === 1 ? 'lid' : 'leden'}{t.topic ? ` · ${t.topic}` : ''}</span>
                        </span>
                        <button type="button" className="chat-join" onClick={() => handleJoin(t.id)}>Aansluiten</button>
                      </div>
                    ))}
                  </>
                )}
              </>
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
          <div className="chat-head__avwrap">
            <Avatar
              size={42}
              url={selected?.avatarUrl}
              name={selected?.title || teamName}
              emoji={selected?.emoji}
              icon={!selected || selected.source === 'support' ? 'fa-regular fa-life-ring' : isGroup ? 'fa-solid fa-hashtag' : null}
            />
            {(!selected || selected.source === 'support') && <span className="chat-head__on" />}
          </div>
          <div className="chat-head__txt">
            <div className="chat-head__title">
              {selected?.title || teamName}
              {isGroup && selected.joinPolicy === 'invite' && <i className="fa-solid fa-lock chat-head__lock" aria-label="Besloten groep" />}
            </div>
            <div className="chat-head__sub">
              {!selected || selected.source === 'support' ? 'Reageert meestal binnen één werkdag'
                : isGroup ? (
                  <>
                    <span className="chat-stack">
                      {selected.participants.slice(0, 4).map((p) => <Avatar key={p.id} size={18} url={p.avatar_url} name={p.full_name} />)}
                    </span>
                    {selected.participants.length} {selected.participants.length === 1 ? 'lid' : 'leden'} · {selected.joinPolicy === 'open' ? 'open groep' : 'besloten groep'}{selected.topic ? ` · ${selected.topic}` : ''}
                  </>
                ) : 'Privégesprek · alleen jullie twee kunnen dit lezen'}
            </div>
          </div>
          {isDirect && (
            <div className="chat-head__actions">
              <button type="button" className="chat-icon" onClick={() => askHide(selected)} aria-label="Gesprek verwijderen uit je lijst" title="Verwijderen uit je lijst">
                <i className="fa-regular fa-trash-can" aria-hidden="true" />
              </button>
            </div>
          )}
          {isGroup && (
            <div className="chat-head__actions">
              <button type="button" className="chat-icon" onClick={() => setModal('info')} aria-label="Groepsinformatie en leden" title="Leden">
                <i className="fa-solid fa-user-group" aria-hidden="true" />
              </button>
              <button type="button" className="chat-icon" onClick={() => chat.setMuted(selected.id, !selected.muted).catch((e) => toast.error(e.message))} aria-label={selected.muted ? 'Dempen opheffen' : 'Dempen'} title={selected.muted ? 'Dempen opheffen' : 'Dempen'}>
                <i className={`fa-solid ${selected.muted ? 'fa-bell-slash' : 'fa-bell'}`} aria-hidden="true" />
              </button>
            </div>
          )}
        </header>

        <div className="chat-body" ref={bodyRef}>
          {(support.loading || (chatOn && chat.loading)) && allThreads.length === 0 ? (
            <div className="chat-hint">Even laden…</div>
          ) : !selected || messages.length === 0 ? (
            <div className="chat-empty">
              <div className="chat-empty__ic"><i className="fa-regular fa-comment-dots" aria-hidden="true" /></div>
              {!selected || selected.source === 'support' ? (
                <>
                  <div className="chat-empty__t">Waarmee kunnen we je helpen?</div>
                  <div className="chat-empty__s">Stel je vraag aan het team. We reageren zo snel mogelijk.</div>
                </>
              ) : isGroup ? (
                <>
                  <div className="chat-empty__t">Welkom in {selected.title}</div>
                  <div className="chat-empty__s">{selected.topic || 'Zet het gesprek in gang met een eerste bericht.'}</div>
                </>
              ) : (
                <>
                  <div className="chat-empty__t">Nieuw gesprek met {firstName(selected.title)}</div>
                  <div className="chat-empty__s">Alleen jullie twee kunnen dit gesprek lezen.</div>
                </>
              )}
            </div>
          ) : (
            messages.map((m, i) => {
              const prev = messages[i - 1]
              const showDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()
              const isLast = i === messages.length - 1
              // Opeenvolgende berichten van dezelfde afzender (binnen 5 min) groeperen.
              const cont = !showDay && prev && !m.mine && prev.senderId === m.senderId && !prev.mine
                && new Date(m.created_at) - new Date(prev.created_at) < 5 * 60000
              const showSender = isGroup && !m.mine && !cont
              const canDelete = !m.deleted && selected.source === 'chat' && (m.mine || (isGroup && canModerate))
              return (
                <Fragment key={m.id}>
                  {showDay && <div className="chat-datesep">{dayLabel(m.created_at)}</div>}
                  <div id={`chat-msg-${m.id}`} className={`chat-msg ${m.mine ? 'chat-msg--out' : 'chat-msg--in'} ${cont ? 'chat-msg--cont' : ''}`}>
                    {isGroup && !m.mine && (
                      <span className="chat-msg__av">{!cont && <Avatar size={28} url={m.senderAvatar} name={m.senderName} />}</span>
                    )}
                    <div className="chat-msg__col">
                      {showSender && <div className="chat-sender">{m.senderName}</div>}
                      <div className={`chat-bubble ${m.mine ? 'chat-bubble--out' : 'chat-bubble--in'} ${highlightId === m.id ? 'chat-bubble--hit' : ''} ${m.deleted ? 'chat-bubble--deleted' : ''}`}>
                        {m.deleted ? (
                          <div className="chat-bubble__text">Bericht verwijderd</div>
                        ) : (
                          <>
                            {m.attachment && <Attachment {...m.attachment} />}
                            {m.body && <div className="chat-bubble__text">{isGroup ? renderWithMentions(m.body, participantNames) : m.body}</div>}
                          </>
                        )}
                        {canDelete && (
                          <button type="button" className="chat-bubble__del" onClick={() => askDeleteMessage(m)} aria-label="Bericht verwijderen" title="Verwijderen">
                            <i className="fa-solid fa-trash-can" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                      <div className="chat-stamp">
                        {!m.mine && selected.source === 'support' ? `${teamName} · ` : ''}
                        {formatClock(m.created_at)}
                        {m.edited && !m.deleted ? ' · bewerkt' : ''}
                        {m.mine && isLast && selected.source === 'support' && m.read ? ' · Gelezen' : ''}
                      </div>
                    </div>
                  </div>
                </Fragment>
              )
            })
          )}
        </div>

        {canPost || !selected ? (
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
            {mentionOptions.length > 0 && (
              <div className="chat-mentions" role="listbox" aria-label="Lid vermelden">
                {mentionOptions.map((p) => (
                  <button type="button" key={p.id} role="option" onClick={() => pickMention(p)}>
                    <Avatar size={24} url={p.avatar_url} name={p.full_name} /> {p.full_name}
                  </button>
                ))}
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
                ref={inputRef}
                className="chat-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === 'Tab') && mentionOptions.length > 0) { e.preventDefault(); pickMention(mentionOptions[0]); return }
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) }
                }}
                placeholder={composerPlaceholder}
                aria-label="Bericht"
                rows={1}
              />
              <button type="submit" className="chat-send" disabled={support.sending || chat.sending || (!draft.trim() && !file)} aria-label="Versturen">
                <i className="fa-solid fa-paper-plane" aria-hidden="true" />
              </button>
            </div>
          </form>
        ) : (
          <div className="chat-foot chat-foot--closed">
            {selected?.archived ? 'Deze groep is gearchiveerd. Je kunt de berichten nog lezen.' : 'Ledenchat is niet beschikbaar voor jouw rol.'}
          </div>
        )}
      </section>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {modal === 'direct' && (
        <NewDirectModal
          excludeIds={[me]}
          onPick={handleStartDirect}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'group' && (
        <NewGroupModal
          onCreate={handleCreateGroup}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'info' && selected && isGroup && (
        <GroupInfoModal
          thread={selected}
          me={me}
          canManage={selected.myRole === 'owner' || canModerate}
          onAddMembers={(ids) => chat.addMembers(selected.id, ids).then((n) => toast.success(n === 1 ? '1 lid toegevoegd.' : `${n} leden toegevoegd.`)).catch((e) => toast.error(e.message))}
          onRemoveMember={(id) => chat.removeMember(selected.id, id).catch((e) => toast.error(e.message))}
          onUpdate={(patch) => chat.updateGroup(selected.id, patch).then(() => toast.success('Groep bijgewerkt.')).catch((e) => toast.error(e.message))}
          onToggleMute={() => chat.setMuted(selected.id, !selected.muted).catch((e) => toast.error(e.message))}
          onLeave={() => askLeave(selected)}
          onArchive={() => askArchive(selected)}
          onClose={() => setModal(null)}
        />
      )}
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          confirmLabel={confirm.label}
          onConfirm={async () => { const fn = confirm.onConfirm; setConfirm(null); await fn() }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
