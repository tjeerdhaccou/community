import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { logger, friendlyError } from '../lib/logger'
import { dispatchNotification } from '../lib/notifications'

export function useDocumentRequests() {
  const { user } = useAuth()
  const { project } = useProject()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRequests = useCallback(async () => {
    if (!user?.id || !project?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('document_requests')
      .select(`
        *,
        attached_file:member_files!attached_file_id(id, title, file_name, file_path, file_size, file_type, category, expires_at),
        response_file:member_files!response_file_id(id, title, file_name, file_path, file_size, file_type, category, expires_at)
      `)
      .eq('profile_id', user.id)
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('useDocumentRequests.fetch', error)
    } else {
      setRequests(data || [])
    }
    setLoading(false)
  }, [user?.id, project?.id])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  useEffect(() => {
    if (!user?.id || !project?.id) return
    const channel = supabase
      .channel(`doc-requests-${project.id}-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'document_requests',
        filter: `profile_id=eq.${user.id}`,
      }, () => fetchRequests())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user?.id, project?.id, fetchRequests])

  async function submitResponse(requestId, fileId) {
    const { error } = await supabase
      .from('document_requests')
      .update({
        response_file_id: fileId,
        status: 'submitted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('profile_id', user.id)
    if (error) { logger.error('useDocumentRequests.submit', error); throw new Error(friendlyError(error)) }
    dispatchNotification({ projectId: project.id, type: 'document_request_submitted', referenceId: requestId, actorId: user.id })
    await fetchRequests()
  }

  async function markReviewed(requestId) {
    const { error } = await supabase
      .from('document_requests')
      .update({
        status: 'submitted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('profile_id', user.id)
    if (error) { logger.error('useDocumentRequests.markReviewed', error); throw new Error(friendlyError(error)) }
    dispatchNotification({ projectId: project.id, type: 'document_request_submitted', referenceId: requestId, actorId: user.id })
    await fetchRequests()
  }

  return { requests, loading, submitResponse, markReviewed, refetch: fetchRequests }
}

export function useAdminDocumentRequests(profileId) {
  const { user } = useAuth()
  const { project } = useProject()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRequests = useCallback(async () => {
    if (!profileId || !project?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('document_requests')
      .select(`
        *,
        attached_file:member_files!attached_file_id(id, title, file_name, file_path, file_size, file_type, category, expires_at),
        response_file:member_files!response_file_id(id, title, file_name, file_path, file_size, file_type, category, expires_at),
        reviewer:profiles!reviewer_id(full_name)
      `)
      .eq('profile_id', profileId)
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('useAdminDocumentRequests.fetch', error)
    } else {
      setRequests(data || [])
    }
    setLoading(false)
  }, [profileId, project?.id])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  async function createRequest({ type, category, title, description, deadline, attachedFileId }) {
    const { data, error } = await supabase.from('document_requests').insert({
      project_id: project.id,
      profile_id: profileId,
      created_by: user.id,
      type,
      // Een identiteitscontrole heeft altijd categorie identiteit en nooit een bestand.
      category: type === 'identity_check' ? 'identiteit' : category,
      title,
      description,
      deadline: deadline || null,
      attached_file_id: attachedFileId || null,
    }).select('id').single()
    if (error) { logger.error('useAdminDocumentRequests.create', error); throw new Error(friendlyError(error)) }
    if (data?.id) {
      dispatchNotification({ projectId: project.id, type: 'document_request', referenceId: data.id, actorId: user.id })
    }
    await fetchRequests()
  }

  async function reviewRequest(requestId, approved, note) {
    const { error } = await supabase
      .from('document_requests')
      .update({
        status: approved ? 'approved' : 'rejected',
        reviewer_id: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: note || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
    if (error) { logger.error('useAdminDocumentRequests.review', error); throw new Error(friendlyError(error)) }
    await fetchRequests()
  }

  // Uitkomst van een identiteitscontrole vastleggen. Er wordt geen bestand
  // opgeslagen: alleen soort document, geldig tot en de datum van de controle.
  // "Gecontroleerd door" zet de database zelf op de ingelogde beoordelaar.
  async function recordIdentityCheck(requestId, { approved, documentType, validUntil, checkedOn, note }) {
    const patch = {
      status: approved ? 'approved' : 'rejected',
      review_note: note || null,
      updated_at: new Date().toISOString(),
    }
    if (approved) {
      patch.identity_document_type = documentType
      patch.identity_valid_until = validUntil
      patch.identity_checked_on = checkedOn || new Date().toISOString().slice(0, 10)
    }
    const { error } = await supabase.from('document_requests').update(patch).eq('id', requestId)
    if (error) { logger.error('useAdminDocumentRequests.identity', error); throw new Error(friendlyError(error)) }
    await fetchRequests()
  }

  async function deleteRequest(requestId) {
    const { error } = await supabase
      .from('document_requests')
      .delete()
      .eq('id', requestId)
    if (error) { logger.error('useAdminDocumentRequests.delete', error); throw new Error(friendlyError(error)) }
    setRequests(prev => prev.filter(r => r.id !== requestId))
  }

  return { requests, loading, createRequest, reviewRequest, recordIdentityCheck, deleteRequest, refetch: fetchRequests }
}
