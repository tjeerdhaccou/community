import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { logger, friendlyError } from '../lib/logger'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'

/**
 * Ledenchat (chat_* tabellen, migratie 099): 1-op-1-gesprekken en thema-groepen
 * binnen het huidige project. Staat naast de support-chat; de Chat-pagina voegt
 * beide bronnen samen tot één lijst.
 *
 * Vorm van een thread (genormaliseerd, zodat Chat.jsx niet hoeft te weten uit
 * welke tabel iets komt):
 *   { id, source: 'chat', kind: 'direct' | 'group', title, subtitle, emoji,
 *     avatarUrl, participants: [{ id, full_name, avatar_url, role }],
 *     myRole, muted, archived, joinPolicy, last, last_message_at, unread }
 *
 * Berichten worden per thread lazy geladen (loadMessages) — niet alles vooraf,
 * want groepen kunnen groot worden.
 */

const MSG_SELECT =
  'id, thread_id, sender_id, body, created_at, edited_at, deleted_at, reply_to, attachment_path, attachment_name, attachment_type, sender:profiles!sender_id(id, full_name, avatar_url)'

const THREAD_SELECT = `
  id, project_id, kind, title, topic, emoji, join_policy, archived_at, last_message_at, created_at, created_by,
  chat_participants(profile_id, role, last_read_at, muted_until, profile:profiles!profile_id(id, full_name, avatar_url)),
  chat_messages(id, body, created_at, sender_id, deleted_at, attachment_path)
`

function escapeLike(s) {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`)
}

function normalizeThread(row, me, unreadMap) {
  const participants = (row.chat_participants || []).map((p) => ({
    id: p.profile_id,
    role: p.role,
    last_read_at: p.last_read_at,
    muted_until: p.muted_until,
    full_name: p.profile?.full_name ?? null,
    avatar_url: p.profile?.avatar_url ?? null,
  }))
  const mine = participants.find((p) => p.id === me) || null
  const others = participants.filter((p) => p.id !== me)
  // Embedded, op created_at desc gesorteerd en gelimiteerd tot 1 → het laatste bericht.
  const last = Array.isArray(row.chat_messages) ? row.chat_messages[0] || null : null

  const isDirect = row.kind === 'direct'
  const other = isDirect ? others[0] || null : null
  const title = isDirect ? (other?.full_name || 'Onbekend lid') : row.title
  const u = unreadMap.get(row.id)

  return {
    id: row.id,
    source: 'chat',
    kind: row.kind,
    project_id: row.project_id,
    title,
    topic: row.topic || null,
    emoji: isDirect ? null : row.emoji,
    avatarUrl: isDirect ? other?.avatar_url ?? null : null,
    participants,
    others,
    myRole: mine?.role ?? null,
    isMember: !!mine,
    muted: !!(mine?.muted_until && new Date(mine.muted_until) > new Date()),
    archived: !!row.archived_at,
    joinPolicy: row.join_policy,
    created_by: row.created_by,
    last_message_at: row.last_message_at,
    created_at: row.created_at,
    last: last
      ? {
          body: last.deleted_at ? 'Bericht verwijderd' : last.body || (last.attachment_path ? '📎 Bijlage' : ''),
          created_at: last.created_at,
          mine: last.sender_id === me,
          senderName: participants.find((p) => p.id === last.sender_id)?.full_name?.split(' ')[0] || null,
        }
      : null,
    unread: u ? Number(u.unread) : 0,
  }
}

export function useMemberChat({ enabled = true } = {}) {
  const { user } = useAuth()
  const { project } = useProject()
  const me = user?.id
  const projectId = project?.id

  const [threads, setThreads] = useState([])
  const [discover, setDiscover] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [messagesByThread, setMessagesByThread] = useState({})
  const loadedRef = useRef(new Set())

  // ---- Threads + ontdek-lijst + unread in één ronde --------------------------
  const fetchThreads = useCallback(async () => {
    if (!me || !projectId || !enabled) { setLoading(false); return }

    const [threadsRes, unreadRes] = await Promise.all([
      supabase
        .from('chat_threads')
        .select(THREAD_SELECT)
        .eq('project_id', projectId)
        .order('last_message_at', { ascending: false })
        .order('created_at', { referencedTable: 'chat_messages', ascending: false })
        .limit(1, { referencedTable: 'chat_messages' }),
      supabase.rpc('chat_unread_counts', { p_project_id: projectId }),
    ])

    if (threadsRes.error) {
      logger.error('chat: threads laden mislukt', threadsRes.error)
      setLoading(false)
      return
    }
    if (unreadRes.error) logger.error('chat: unread laden mislukt', unreadRes.error)

    const unreadMap = new Map((unreadRes.data || []).map((r) => [r.thread_id, r]))
    const all = (threadsRes.data || []).map((row) => normalizeThread(row, me, unreadMap))

    // RLS geeft ook open groepen (Ontdek) en, voor moderators, alle groepen terug.
    // Mijn lijst = waar ik deelnemer ben; Ontdek = open, niet gearchiveerd, geen deelnemer.
    setThreads(all.filter((t) => t.isMember && !t.archived))
    setDiscover(all.filter((t) => !t.isMember && t.kind === 'group' && t.joinPolicy === 'open' && !t.archived))
    setLoading(false)
  }, [me, projectId, enabled])

  useEffect(() => { fetchThreads() }, [fetchThreads])

  // ---- Berichten per thread (lazy) -------------------------------------------
  const loadMessages = useCallback(async (threadId, { force = false } = {}) => {
    if (!threadId || (!force && loadedRef.current.has(threadId))) return
    loadedRef.current.add(threadId)
    const { data, error } = await supabase
      .from('chat_messages')
      .select(MSG_SELECT)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      logger.error('chat: berichten laden mislukt', error)
      loadedRef.current.delete(threadId)
      return
    }
    setMessagesByThread((prev) => ({ ...prev, [threadId]: (data || []).reverse() }))
  }, [])

  // ---- Realtime -----------------------------------------------------------------
  useEffect(() => {
    if (!me || !projectId || !enabled) return
    const channel = supabase
      .channel(`member-chat-${projectId}-${me}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async (payload) => {
        const msg = payload.new
        // Alleen threads die we al open hebben gehad krijgen het bericht erbij;
        // de lijst (snippet, volgorde, unread) halen we compact opnieuw op.
        if (loadedRef.current.has(msg.thread_id)) {
          const { data } = await supabase.from('chat_messages').select(MSG_SELECT).eq('id', msg.id).single()
          if (data) {
            setMessagesByThread((prev) => {
              const cur = prev[msg.thread_id] || []
              if (cur.some((m) => m.id === data.id)) return prev
              return { ...prev, [msg.thread_id]: [...cur, data] }
            })
          }
        }
        fetchThreads()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, (payload) => {
        const msg = payload.new
        setMessagesByThread((prev) => {
          const cur = prev[msg.thread_id]
          if (!cur) return prev
          return { ...prev, [msg.thread_id]: cur.map((m) => (m.id === msg.id ? { ...m, ...msg, sender: m.sender } : m)) }
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_threads' }, () => fetchThreads())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_participants' }, () => fetchThreads())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [me, projectId, enabled, fetchThreads])

  // ---- Acties -------------------------------------------------------------------
  async function sendMessage(threadId, body, file = null) {
    const text = (body || '').trim()
    if ((!text && !file) || !me || sending) return
    setSending(true)
    try {
      let attachment = {}
      if (file) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${threadId}/${Date.now()}_${safe}`
        const { error: upErr } = await supabase.storage
          .from('chat-attachments')
          .upload(path, file, { contentType: file.type })
        if (upErr) throw upErr
        attachment = { attachment_path: path, attachment_name: file.name, attachment_type: file.type }
      }
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({ thread_id: threadId, sender_id: me, body: text, ...attachment })
        .select(MSG_SELECT)
        .single()
      if (error) throw error
      setMessagesByThread((prev) => {
        const cur = prev[threadId] || []
        if (cur.some((m) => m.id === data.id)) return prev
        return { ...prev, [threadId]: [...cur, data] }
      })
      // Eigen bericht = gelezen tot nu.
      await supabase.from('chat_participants').update({ last_read_at: data.created_at })
        .eq('thread_id', threadId).eq('profile_id', me)
      fetchThreads()
    } catch (err) {
      logger.error('chat: versturen mislukt', err)
      throw new Error(friendlyError(err))
    } finally {
      setSending(false)
    }
  }

  const markRead = useCallback(async (threadId) => {
    if (!threadId || !me) return
    setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, unread: 0 } : t)))
    await supabase.from('chat_participants').update({ last_read_at: new Date().toISOString() })
      .eq('thread_id', threadId).eq('profile_id', me)
  }, [me])

  async function startDirect(otherId) {
    const { data, error } = await supabase.rpc('chat_start_direct', { p_project_id: projectId, p_other_id: otherId })
    if (error) { logger.error('chat: DM starten mislukt', error); throw new Error(friendlyError(error)) }
    await fetchThreads()
    return data
  }

  async function createGroup({ title, topic, emoji, joinPolicy = 'open', memberIds = [] }) {
    const { data, error } = await supabase.rpc('chat_create_group', {
      p_project_id: projectId,
      p_title: title,
      p_topic: topic || null,
      p_emoji: emoji || null,
      p_join_policy: joinPolicy,
      p_member_ids: memberIds,
    })
    if (error) { logger.error('chat: groep aanmaken mislukt', error); throw new Error(friendlyError(error)) }
    await fetchThreads()
    return data
  }

  async function joinGroup(threadId) {
    const { error } = await supabase.from('chat_participants').insert({ thread_id: threadId, profile_id: me, role: 'member' })
    if (error) { logger.error('chat: aansluiten mislukt', error); throw new Error(friendlyError(error)) }
    await fetchThreads()
  }

  async function leaveGroup(threadId) {
    const { error } = await supabase.from('chat_participants').delete().eq('thread_id', threadId).eq('profile_id', me)
    if (error) { logger.error('chat: verlaten mislukt', error); throw new Error(friendlyError(error)) }
    await fetchThreads()
  }

  async function addMembers(threadId, memberIds) {
    const { data, error } = await supabase.rpc('chat_add_members', { p_thread_id: threadId, p_member_ids: memberIds })
    if (error) { logger.error('chat: leden toevoegen mislukt', error); throw new Error(friendlyError(error)) }
    await fetchThreads()
    return data
  }

  async function removeMember(threadId, profileId) {
    const { error } = await supabase.from('chat_participants').delete().eq('thread_id', threadId).eq('profile_id', profileId)
    if (error) { logger.error('chat: lid verwijderen mislukt', error); throw new Error(friendlyError(error)) }
    await fetchThreads()
  }

  async function setMuted(threadId, muted) {
    // Dempen = "voor altijd" (ver in de toekomst); ontdempen = null.
    const until = muted ? '2999-01-01T00:00:00Z' : null
    setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, muted } : t)))
    const { error } = await supabase.from('chat_participants').update({ muted_until: until })
      .eq('thread_id', threadId).eq('profile_id', me)
    if (error) { logger.error('chat: dempen mislukt', error); fetchThreads(); throw new Error(friendlyError(error)) }
  }

  async function updateGroup(threadId, patch) {
    const { error } = await supabase.from('chat_threads').update(patch).eq('id', threadId)
    if (error) { logger.error('chat: groep bijwerken mislukt', error); throw new Error(friendlyError(error)) }
    await fetchThreads()
  }

  async function archiveGroup(threadId) {
    return updateGroup(threadId, { archived_at: new Date().toISOString() })
  }

  async function deleteMessage(messageId) {
    const { error } = await supabase.from('chat_messages').update({ deleted_at: new Date().toISOString() }).eq('id', messageId)
    if (error) { logger.error('chat: bericht verwijderen mislukt', error); throw new Error(friendlyError(error)) }
  }

  // Server-zoek over berichten in mijn threads binnen dit project.
  const search = useCallback(async (query) => {
    const q = (query || '').trim()
    if (q.length < 2) return []
    const ids = threads.map((t) => t.id)
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, thread_id, body, created_at, sender_id, sender:profiles!sender_id(full_name)')
      .in('thread_id', ids)
      .is('deleted_at', null)
      .ilike('body', `%${escapeLike(q)}%`)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) { logger.error('chat: zoeken mislukt', error); return [] }
    return (data || []).map((m) => ({
      id: m.id,
      thread_id: m.thread_id,
      source: 'chat',
      body: m.body,
      created_at: m.created_at,
      mine: m.sender_id === me,
      senderName: m.sender?.full_name || null,
    }))
  }, [threads, me])

  const unreadTotal = useMemo(
    () => threads.reduce((n, t) => n + (t.muted ? 0 : t.unread), 0),
    [threads],
  )

  return {
    threads, discover, loading, sending, unreadTotal,
    messagesByThread, loadMessages,
    sendMessage, markRead, search,
    startDirect, createGroup, joinGroup, leaveGroup, addMembers, removeMember,
    setMuted, updateGroup, archiveGroup, deleteMessage,
    refresh: fetchThreads,
  }
}

/**
 * Lichte variant voor de sidebar-badge: alleen het ongelezen-totaal (gedempte
 * threads niet meegeteld), live via realtime.
 */
export function useMemberChatUnread(projectId, enabled = true) {
  const { user } = useAuth()
  const me = user?.id
  const [total, setTotal] = useState(0)

  const fetchCount = useCallback(async () => {
    if (!me || !projectId || !enabled) { setTotal(0); return }
    const { data, error } = await supabase.rpc('chat_unread_counts', { p_project_id: projectId })
    if (error) { logger.error('chat: unread-badge mislukt', error); return }
    setTotal((data || []).reduce((n, r) => n + (r.muted ? 0 : Number(r.unread)), 0))
  }, [me, projectId, enabled])

  useEffect(() => { fetchCount() }, [fetchCount])

  useEffect(() => {
    if (!me || !projectId || !enabled) return
    const ch = supabase
      .channel(`member-chat-unread-${projectId}-${me}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, fetchCount)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_participants', filter: `profile_id=eq.${me}` }, fetchCount)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [me, projectId, enabled, fetchCount])

  return total
}
