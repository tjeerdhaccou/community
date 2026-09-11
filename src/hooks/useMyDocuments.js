import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { logger, friendlyError } from '../lib/logger'
import { uploadFile, downloadProjectFile } from '../lib/storage'
import { useToast } from '../components/Toast'

export function useMyDocuments() {
  const toast = useToast()
  const { user } = useAuth()
  const { project } = useProject()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchFiles = useCallback(async () => {
    if (!user?.id || !project?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('member_files')
      .select('id, title, description, category, file_name, file_path, file_size, file_type, is_visible_to_member, uploaded_by, request_id, expires_at, created_at')
      .eq('profile_id', user.id)
      .eq('project_id', project.id)
      .eq('is_visible_to_member', true)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Error fetching my documents:', error)
    } else {
      setFiles(data || [])
    }
    setLoading(false)
  }, [user?.id, project?.id])

  useEffect(() => { fetchFiles() }, [fetchFiles])

  async function download(fileId, filePath, fileName) {
    // AVG-audit: eerst loggen, daarna downloaden. De download gaat via een
    // signed URL met attachment-header, dus zonder nieuw tabblad — een pop-up
    // blocker kan hem niet tegenhouden.
    supabase.from('file_download_log').insert({
      file_id: fileId,
      downloaded_by: user.id,
      project_id: project.id,
    }).then(({ error: logErr }) => {
      if (logErr) logger.error('download audit log failed', logErr)
    })

    const ok = await downloadProjectFile(filePath, { bucket: 'member-files', fileName })
    if (!ok) {
      logger.error('download mislukt voor', filePath)
      toast.error('Dit bestand is niet (meer) beschikbaar. Vraag het team om het opnieuw te uploaden.')
    }
  }

  async function upload(file, requestId = null) {
    // Owner-scoped path: the storage RLS policy treats the last folder segment
    // (the profile id) as the file owner, so members may only read/write here.
    const { path } = await uploadFile(file, 'member-files', `${project.id}/${user.id}`)
    const row = {
      profile_id: user.id,
      project_id: project.id,
      title: file.name,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      file_type: file.type,
      uploaded_by: user.id,
      is_visible_to_member: true,
      category: 'overig',
    }
    if (requestId) row.request_id = requestId

    const { data, error } = await supabase.from('member_files').insert(row).select('id').single()
    if (error) { logger.error('useMyDocuments.upload', error); throw new Error(friendlyError(error)) }
    await fetchFiles()
    return data?.id
  }

  async function remove(fileId) {
    const { error } = await supabase.from('member_files').delete().eq('id', fileId).eq('uploaded_by', user.id)
    if (error) { logger.error('useMyDocuments.remove', error); throw new Error(friendlyError(error)) }
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  return { files, loading, download, upload, remove, refetch: fetchFiles }
}
