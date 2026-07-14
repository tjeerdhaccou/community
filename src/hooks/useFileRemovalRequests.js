import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { logger, friendlyError } from '../lib/logger'

/**
 * AVG-verwijderingsverzoeken. Een member kan aanvragen dat een document uit
 * z'n dossier wordt verwijderd; admin/moderator beslist.
 *
 * scope:
 *   'own'     — verzoeken van de huidige user (voor lid-view)
 *   'project' — alle verzoeken in dit project (voor admin-view)
 *
 * Realtime: beide scopes luisteren op file_removal_requests-changes van het
 * project zodat status-updates cross-tab meebewegen.
 */
export function useFileRemovalRequests({ scope = 'own' } = {}) {
  const { user } = useAuth()
  const { project } = useProject()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user?.id || !project?.id) return
    setLoading(true)
    let q = supabase
      .from('file_removal_requests')
      .select(`
        id, status, reason, decision_note, created_at, decided_at,
        member_file_id, requested_by, decided_by,
        member_file:member_files(id, title, file_name, file_path, category, profile_id, uploaded_by),
        requester:profiles!requested_by(id, full_name),
        decider:profiles!decided_by(id, full_name)
      `)
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
    if (scope === 'own') q = q.eq('requested_by', user.id)
    const { data, error } = await q
    if (error) logger.error('useFileRemovalRequests.fetch', error)
    else setRequests(data || [])
    setLoading(false)
  }, [user?.id, project?.id, scope])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    if (!project?.id) return
    const ch = supabase
      .channel(`removal-requests-${project.id}-${scope}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'file_removal_requests',
        filter: `project_id=eq.${project.id}`,
      }, fetch)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [project?.id, fetch, scope])

  async function request(fileId, reason) {
    if (!user?.id || !project?.id) return
    const { data, error } = await supabase
      .from('file_removal_requests')
      .insert({
        member_file_id: fileId,
        project_id: project.id,
        requested_by: user.id,
        reason: reason?.trim() || null,
      })
      .select('id')
      .single()
    if (error) { logger.error('useFileRemovalRequests.request', error); throw new Error(friendlyError(error)) }
    await fetch()
    return data
  }

  // Admin actie: goedkeuren = verzoek dicht + file weg (storage + DB-rij).
  // Volgorde is belangrijk: eerst request-rij updaten (audit-trail), dan file
  // deleten. Storage-cleanup is best-effort — als het faalt blijft er een
  // orphaned object over, dat is minder erg dan geen delete van de DB-rij.
  async function approve(reqRow, note) {
    if (!user?.id) return
    const { error: updErr } = await supabase
      .from('file_removal_requests')
      .update({
        status: 'approved',
        decided_by: user.id,
        decided_at: new Date().toISOString(),
        decision_note: note?.trim() || null,
      })
      .eq('id', reqRow.id)
    if (updErr) { logger.error('useFileRemovalRequests.approve.update', updErr); throw new Error(friendlyError(updErr)) }

    const mf = reqRow.member_file
    if (mf?.file_path) {
      const { error: stErr } = await supabase.storage.from('member-files').remove([mf.file_path])
      if (stErr) logger.error('useFileRemovalRequests.approve.storage', stErr)
    }
    if (reqRow.member_file_id) {
      const { error: delErr } = await supabase.from('member_files').delete().eq('id', reqRow.member_file_id)
      if (delErr) { logger.error('useFileRemovalRequests.approve.delete', delErr); throw new Error(friendlyError(delErr)) }
    }
    await fetch()
  }

  async function reject(reqRow, note) {
    if (!user?.id) return
    const { error } = await supabase
      .from('file_removal_requests')
      .update({
        status: 'rejected',
        decided_by: user.id,
        decided_at: new Date().toISOString(),
        decision_note: note?.trim() || null,
      })
      .eq('id', reqRow.id)
    if (error) { logger.error('useFileRemovalRequests.reject', error); throw new Error(friendlyError(error)) }
    await fetch()
  }

  const pendingForFile = (fileId) => requests.find(r => r.member_file_id === fileId && r.status === 'pending')
  const latestForFile = (fileId) => requests.find(r => r.member_file_id === fileId)

  return { requests, loading, request, approve, reject, pendingForFile, latestForFile, refetch: fetch }
}
