import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import { showNotification as showBrowserNotification } from '../lib/browserNotifications'
import { useAuth } from '../contexts/AuthContext'

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const userId = user?.id

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    const { data, error } = await supabase
      .from('notifications')
      .select('*, actor:profiles!actor_id(id, full_name, avatar_url)')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error) setNotifications(data || [])
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  // Realtime subscription
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${userId}`,
      }, (payload) => {
        // Fetch the full record with actor join
        supabase
          .from('notifications')
          .select('*, actor:profiles!actor_id(id, full_name, avatar_url)')
          .eq('id', payload.new.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setNotifications(prev => [data, ...prev])
              // Toon browser notification (helper checkt zelf permission + tab-visibility)
              showBrowserNotification({
                title: data.title || 'Nieuwe melding',
                body: data.body || '',
                tag: data.id,
                onClick: () => { window.location.href = '/' },
              })
            }
          })
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${userId}`,
      }, (payload) => {
        setNotifications(prev =>
          prev.map(n => n.id === payload.new.id ? { ...n, ...payload.new } : n)
        )
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [userId])

  const unreadCount = useMemo(() =>
    notifications.filter(n => !n.is_read).length,
  [notifications])

  async function markAsRead(notificationId) {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    )
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
  }

  async function markAllAsRead() {
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', userId)
      .eq('is_read', false)
  }

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  }
}
