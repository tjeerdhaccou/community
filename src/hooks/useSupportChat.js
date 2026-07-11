import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { logger, friendlyError } from '../lib/logger'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'

/**
 * Support-chat vanuit de lid-kant, maar dan voor de volledige Chat-pagina i.p.v.
 * het zwevende widget. Levert álle gesprekken van het lid (open + gesloten) met
 * hun berichten, plus een robuuste server-zoek over de berichthistorie.
 *
 * Nu is er per lid feitelijk één gesprek (met het team), maar de vorm is bewust
 * meervoudig zodat toekomstige 1-op-1- en groepsgesprekken hier kunnen instromen
 * zonder de UI te verbouwen. Deelt de support_*-tabellen met het widget.
 */
function mapConversation(c) {
  const messages = [...(c.support_messages || [])].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  )
  const last = messages[messages.length - 1] || null
  return {
    id: c.id,
    status: c.status,
    project: c.project,
    project_id: c.project_id,
    org_id: c.org_id,
    last_message_at: c.last_message_at,
    created_at: c.created_at,
    messages,
    last,
    unread: messages.filter((m) => m.sender_role === 'agent' && !m.read_at).length,
  }
}

// % en _ zijn ilike-wildcards; escape ze zodat gebruikersinvoer letterlijk zoekt.
function escapeLike(s) {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`)
}

export function useSupportChat() {
  const { user } = useAuth()
  const { project } = useProject()
  const userId = user?.id
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('support_conversations')
      .select(
        `id, status, project_id, org_id, last_message_at, created_at,
         project:projects(name),
         support_messages(id, conversation_id, sender_id, sender_role, body, read_at, created_at, attachment_path, attachment_name, attachment_type)`,
      )
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false })

    if (error) {
      logger.error('chat: gesprekken laden mislukt', error)
      setLoading(false)
      return
    }
    setConversations((data || []).map(mapConversation))
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Realtime: bij elke wijziging in berichten/gesprekken opnieuw ophalen. Voor een
  // lid met een handvol gesprekken is dit ruim voldoende en het houdt de state
  // simpel (geen handmatige merge-logica die uit de pas kan lopen met het widget).
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`support-chat-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, () => fetchAll())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_messages' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, () => fetchAll())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [userId, fetchAll])

  // Verstuur een bericht. Zonder convId (nog geen gesprek) maakt het lid er zelf
  // één aan met de huidige project/org als context — net als het widget.
  async function sendMessage(convId, body, file = null) {
    const text = (body || '').trim()
    if ((!text && !file) || !userId || sending) return null
    setSending(true)
    try {
      let id = convId
      if (!id) {
        const { data, error } = await supabase
          .from('support_conversations')
          .insert({
            user_id: userId,
            project_id: project?.id ?? null,
            org_id: project?.organization_id ?? null,
          })
          .select()
          .single()
        if (error) throw error
        id = data.id
      }

      let attachment = {}
      if (file) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${id}/${Date.now()}_${safe}`
        const { error: upErr } = await supabase.storage
          .from('support-attachments')
          .upload(path, file, { contentType: file.type })
        if (upErr) throw upErr
        attachment = { attachment_path: path, attachment_name: file.name, attachment_type: file.type }
      }

      // sender_role wordt server-side door een trigger gezet.
      const { error: msgErr } = await supabase
        .from('support_messages')
        .insert({ conversation_id: id, sender_id: userId, body: text, ...attachment })
      if (msgErr) throw msgErr

      await fetchAll()
      return id
    } catch (err) {
      logger.error('chat: versturen mislukt', err)
      throw new Error(friendlyError(err))
    } finally {
      setSending(false)
    }
  }

  const markRead = useCallback(async (convId) => {
    if (!convId) return
    const now = new Date().toISOString()
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? {
              ...c,
              unread: 0,
              messages: c.messages.map((m) =>
                m.sender_role === 'agent' && !m.read_at ? { ...m, read_at: now } : m,
              ),
            }
          : c,
      ),
    )
    await supabase
      .from('support_messages')
      .update({ read_at: now })
      .eq('conversation_id', convId)
      .eq('sender_role', 'agent')
      .is('read_at', null)
  }, [])

  // Robuuste server-zoek over de berichten van álle gesprekken van dit lid
  // (ook gesloten). Geeft treffers met genoeg context om naartoe te springen.
  const search = useCallback(
    async (query) => {
      const q = (query || '').trim()
      if (q.length < 2) return []
      const ids = conversations.map((c) => c.id)
      if (ids.length === 0) return []
      const { data, error } = await supabase
        .from('support_messages')
        .select('id, conversation_id, body, sender_role, created_at')
        .in('conversation_id', ids)
        .ilike('body', `%${escapeLike(q)}%`)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) {
        logger.error('chat: zoeken mislukt', error)
        return []
      }
      return data || []
    },
    [conversations],
  )

  const totalUnread = conversations.reduce((n, c) => n + c.unread, 0)

  return { conversations, loading, sending, sendMessage, markRead, search, totalUnread }
}
