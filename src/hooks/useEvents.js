import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { logger, friendlyError } from '../lib/logger'
import { dispatchNotification } from '../lib/notifications'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'

export function useEvents() {
  const { user, profile } = useAuth()
  const { project } = useProject()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const projectId = project?.id

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchEvents = useCallback(async () => {
    if (!projectId) return
    setLoading(true)

    const { data, error } = await supabase
      .from('meetings')
      .select('*, event_rsvps(profile_id, status, profile:profiles(full_name, avatar_url)), meeting_files(id)')
      .eq('project_id', projectId)
      .order('date', { ascending: true })

    if (!mountedRef.current) return

    if (error) {
      logger.error('useEvents.fetch', error)
    } else {
      const transformed = (data || []).map(e => ({
        ...e,
        going_count: e.event_rsvps?.filter(r => r.status === 'going').length || 0,
        maybe_count: e.event_rsvps?.filter(r => r.status === 'maybe').length || 0,
        my_rsvp: e.event_rsvps?.find(r => r.profile_id === user?.id)?.status || null,
        file_count: e.meeting_files?.length || 0,
      }))
      setEvents(transformed)
    }
    setLoading(false)
  }, [projectId, user?.id])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  // Realtime
  useEffect(() => {
    if (!projectId) return
    const channel = supabase
      .channel(`events:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `project_id=eq.${projectId}` }, () => fetchEvents())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_rsvps' }, () => fetchEvents())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [projectId, fetchEvents])

  const now = new Date()
  const upcoming = events.filter(e => new Date(e.date) >= now)
  const past = events.filter(e => new Date(e.date) < now)

  async function createEvent({ title, description, date, location, online_url, max_attendees, duration_hours, event_type, visibility, image_url }) {
    const { data, error } = await supabase
      .from('meetings')
      .insert({ project_id: projectId, title, description, date, location, online_url, max_attendees, duration_hours, event_type, visibility, image_url })
      .select('*')
      .single()
    if (error) { logger.error('useEvents.createEvent', error); throw new Error(friendlyError(error)) }
    // Realtime subscription will trigger fetchEvents automatically
    if (data?.id) dispatchNotification({ projectId, type: 'new_event', referenceId: data.id, actorId: user.id })
    return data
  }

  async function updateEvent(eventId, updates) {
    const { error } = await supabase
      .from('meetings')
      .update(updates)
      .eq('id', eventId)
    if (error) { logger.error('useEvents.updateEvent', error); throw new Error(friendlyError(error)) }
    // Realtime subscription will trigger fetchEvents automatically
  }

  async function rsvp(meetingId, status) {
    if (status === null) {
      const { error } = await supabase.from('event_rsvps').delete().eq('meeting_id', meetingId).eq('profile_id', user.id)
      if (error) { logger.error('useEvents.rsvp', error); throw new Error(friendlyError(error)) }
    } else {
      const { error } = await supabase.from('event_rsvps').upsert({
        meeting_id: meetingId,
        profile_id: user.id,
        status,
      }, { onConflict: 'profile_id,meeting_id' })
      if (error) { logger.error('useEvents.rsvp', error); throw new Error(friendlyError(error)) }
    }
    // Optimistic update
    setEvents(prev => prev.map(e => {
      if (e.id !== meetingId) return e
      const rsvps = (e.event_rsvps || []).filter(r => r.profile_id !== user.id)
      if (status) rsvps.push({ profile_id: user.id, status, profile: { full_name: profile?.full_name, avatar_url: profile?.avatar_url } })
      return {
        ...e,
        event_rsvps: rsvps,
        going_count: rsvps.filter(r => r.status === 'going').length,
        maybe_count: rsvps.filter(r => r.status === 'maybe').length,
        my_rsvp: status,
      }
    }))
  }

  return { events, upcoming, past, loading, createEvent, updateEvent, rsvp, refetch: fetchEvents }
}
