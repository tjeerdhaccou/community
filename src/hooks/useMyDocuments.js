import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { logger } from '../lib/logger'

export function useMyDocuments() {
  const { user } = useAuth()
  const { project } = useProject()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user?.id || !project?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('member_files')
      .select('id, title, description, category, file_name, file_path, file_size, file_type, is_visible_to_member, created_at')
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

  useEffect(() => { fetch() }, [fetch])

  async function download(filePath, fileName) {
    const { data, error } = await supabase.storage
      .from('member-files')
      .createSignedUrl(filePath, 120)

    if (error) {
      logger.error('Error creating download URL:', error)
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  return { files, loading, download }
}
