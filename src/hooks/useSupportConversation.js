import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { logger, friendlyError } from '../lib/logger'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'

/**
 * Support-chat vanuit de lid-kant. Eén open gesprek per gebruiker; bij het eerste
 * bericht wordt het gesprek aangemaakt met de huidige project/org als context, zodat
 * de juiste moderator/admin het in de agent-inbox ziet (zie SUPPORT_CHAT_SPEC.md).
 */
export function useSupportConversation() {
  const { user } = useAuth()
  const { project } = useProject()
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const userId = user?.id

  const fetchConversation = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    const { data: convs, error } = await supabase
      .from('support_conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'open')
      .order('last_message_at', { ascending: false })
      .limit(1)

    if (error) {
      logger.error('support: gesprek laden mislukt', error)
      setLoading(false)
      return
    }

    const conv = convs?.[0] || null
    setConversation(conv)

    if (conv) {
      const { data: msgs } = await supabase
        .from('support_messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true })
      setMessages(msgs || [])
    } else {
      setMessages([])
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchConversation() }, [fetchConversation])

  // Realtime: nieuwe berichten in het actieve gesprek (agent-antwoorden).
  useEffect(() => {
    const convId = conversation?.id
    if (!convId) return

    const channel = supabase
      .channel(`support:${convId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: `conversation_id=eq.${convId}`,
      }, (payload) => {
        setMessages(prev =>
          prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]
        )
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [conversation?.id])

  async function sendMessage(body) {
    const text = (body || '').trim()
    if (!text || !userId || sending) return
    setSending(true)
    try {
      let conv = conversation
      if (!conv) {
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
        conv = data
        setConversation(conv)
      }

      // sender_role wordt server-side door een trigger gezet.
      const { data: msg, error: msgErr } = await supabase
        .from('support_messages')
        .insert({ conversation_id: conv.id, sender_id: userId, body: text })
        .select()
        .single()
      if (msgErr) throw msgErr

      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
    } catch (err) {
      logger.error('support: versturen mislukt', err)
      throw new Error(friendlyError(err))
    } finally {
      setSending(false)
    }
  }

  // Markeer agent-berichten als gelezen (onderdrukt de e-mail-nudge + badge).
  const markRead = useCallback(async () => {
    const convId = conversation?.id
    if (!convId) return
    const hasUnread = messages.some(m => m.sender_role === 'agent' && !m.read_at)
    if (!hasUnread) return

    const now = new Date().toISOString()
    setMessages(prev => prev.map(m =>
      m.sender_role === 'agent' && !m.read_at ? { ...m, read_at: now } : m
    ))
    await supabase
      .from('support_messages')
      .update({ read_at: now })
      .eq('conversation_id', convId)
      .eq('sender_role', 'agent')
      .is('read_at', null)
  }, [conversation?.id, messages])

  const unreadCount = messages.filter(m => m.sender_role === 'agent' && !m.read_at).length

  return { conversation, messages, loading, sending, sendMessage, markRead, unreadCount }
}
