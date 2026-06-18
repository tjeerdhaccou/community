import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { toStoragePath } from '../lib/storage'

export function useEventDetail(meetingId) {
  const { user } = useAuth()
  const [agenda, setAgenda] = useState([])
  const [decisions, setDecisions] = useState([])
  const [actions, setActions] = useState([])
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!meetingId) return
    setLoading(true)

    const [agendaRes, decisionsRes, actionsRes, filesRes] = await Promise.all([
      supabase.from('agenda_items').select('*').eq('meeting_id', meetingId).order('sort_order'),
      supabase.from('decisions').select('*, owner:profiles(id, full_name, avatar_url)').eq('meeting_id', meetingId).order('created_at'),
      supabase.from('action_items').select('*, assignee:profiles(id, full_name, avatar_url)').eq('meeting_id', meetingId).order('created_at'),
      supabase.from('meeting_files').select('*, uploader:profiles(id, full_name)').eq('meeting_id', meetingId).order('created_at'),
    ])

    setAgenda(agendaRes.data || [])
    setDecisions(decisionsRes.data || [])
    setActions(actionsRes.data || [])
    setFiles(filesRes.data || [])
    setLoading(false)
  }, [meetingId])

  useEffect(() => { fetch() }, [fetch])

  // Agenda CRUD
  async function addAgendaItem(title, description, duration) {
    const maxOrder = agenda.reduce((m, a) => Math.max(m, a.sort_order || 0), 0)
    const { error } = await supabase.from('agenda_items').insert({
      meeting_id: meetingId, title, description: description || null,
      duration_minutes: duration || null, sort_order: maxOrder + 1,
    })
    if (!error) fetch()
    return error
  }

  async function removeAgendaItem(id) {
    await supabase.from('agenda_items').delete().eq('id', id)
    fetch()
  }

  // Decision CRUD
  async function addDecision(text) {
    const { error } = await supabase.from('decisions').insert({ meeting_id: meetingId, text })
    if (!error) fetch()
    return error
  }

  async function removeDecision(id) {
    await supabase.from('decisions').delete().eq('id', id)
    fetch()
  }

  // Action CRUD
  async function addAction(text, assigneeId, dueDate) {
    const { error } = await supabase.from('action_items').insert({
      meeting_id: meetingId, text,
      assignee_id: assigneeId || null,
      due_date: dueDate || null,
    })
    if (!error) fetch()
    return error
  }

  async function toggleAction(id, isDone) {
    await supabase.from('action_items').update({ is_done: isDone }).eq('id', id)
    setActions(prev => prev.map(a => a.id === id ? { ...a, is_done: isDone } : a))
  }

  async function removeAction(id) {
    await supabase.from('action_items').delete().eq('id', id)
    fetch()
  }

  // File upload
  async function uploadFile(file, category = 'attachment') {
    const ext = file.name.split('.').pop()
    const path = `meetings/${meetingId}/${Date.now()}-${file.name}`

    const { error: uploadErr } = await supabase.storage.from('project-files').upload(path, file)
    if (uploadErr) return uploadErr

    const { error } = await supabase.from('meeting_files').insert({
      meeting_id: meetingId,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      file_type: file.type,
      category,
      uploaded_by: user?.id,
    })
    if (!error) fetch()
    return error
  }

  async function removeFile(id, filePath) {
    // Extract storage path from public URL
    const storagePath = toStoragePath(filePath)
    if (storagePath) {
      await supabase.storage.from('project-files').remove([storagePath])
    }
    await supabase.from('meeting_files').delete().eq('id', id)
    fetch()
  }

  // Update minutes
  async function saveMinutes(minutes) {
    await supabase.from('meetings').update({ minutes }).eq('id', meetingId)
  }

  return {
    agenda, decisions, actions, files, loading,
    addAgendaItem, removeAgendaItem,
    addDecision, removeDecision,
    addAction, toggleAction, removeAction,
    uploadFile, removeFile,
    saveMinutes, refetch: fetch,
  }
}
