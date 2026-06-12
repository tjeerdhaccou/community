import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { logger, friendlyError } from '../lib/logger'
import { uploadFile } from '../lib/storage'

export function useMyDocuments() {
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
    const { data, error } = await supabase.storage
      .from('member-files')
      .createSignedUrl(filePath, 60)

    if (error) {
      logger.error('Error creating download URL:', error)
      return
    }

    supabase.from('file_download_log').insert({
      file_id: fileId,
      downloaded_by: user.id,
      project_id: project.id,
    }).then(({ error: logErr }) => {
      if (logErr) logger.error('download audit log failed', logErr)
    })

    window.open(data.signedUrl, '_blank')
  }

  async function upload(file, requestId = null) {
    const { publicUrl, path } = await uploadFile(file, 'member-files')
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
