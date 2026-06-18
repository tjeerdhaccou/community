import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { logger, friendlyError } from '../lib/logger'
import { dispatchNotification } from '../lib/notifications'
import { toStoragePath } from '../lib/storage'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'

export function useDocuments() {
  const { user } = useAuth()
  const { project } = useProject()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  const projectId = project?.id

  const fetch = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('documents')
      .select('*, uploader:profiles(id, full_name, avatar_url)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (!error) setDocuments(data || [])
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetch() }, [fetch])

  async function uploadDocument({ title, description, category, file }) {
    const path = `documents/${projectId}/${Date.now()}-${file.name}`
    const { error: uploadErr } = await supabase.storage.from('project-files').upload(path, file)
    if (uploadErr) { logger.error('useDocuments.upload', uploadErr); throw new Error(friendlyError(uploadErr)) }

    const { data: inserted, error } = await supabase.from('documents').insert({
      project_id: projectId,
      title,
      description: description || null,
      category,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      file_type: file.type,
      uploaded_by: user?.id,
    }).select('id').single()
    if (error) { logger.error('useDocuments.upload', error); throw new Error(friendlyError(error)) }
    if (inserted?.id) {
      dispatchNotification({ projectId, type: 'new_document', referenceId: inserted.id, actorId: user?.id })
    }
    fetch()
  }

  async function removeDocument(id, filePath) {
    const storagePath = toStoragePath(filePath)
    if (storagePath) await supabase.storage.from('project-files').remove([storagePath])
    await supabase.from('documents').delete().eq('id', id)
    fetch()
  }

  return { documents, loading, uploadDocument, removeDocument, refetch: fetch }
}
