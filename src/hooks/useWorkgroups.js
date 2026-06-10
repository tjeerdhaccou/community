import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'

/**
 * Hook to fetch workgroups for the current project and determine
 * which workgroups the current user is a member of.
 *
 * Returns:
 * - allWorkgroups: all workgroups for the project
 * - myWorkgroups: workgroups the current user belongs to
 * - loading: boolean
 */
export function useWorkgroups() {
  const { user } = useAuth()
  const { project } = useProject()
  const [allWorkgroups, setAllWorkgroups] = useState([])
  const [myWorkgroupIds, setMyWorkgroupIds] = useState(new Set())
  const [loading, setLoading] = useState(true)

  const projectId = project?.id

  const fetch = useCallback(async () => {
    if (!projectId) return
    setLoading(true)

    const [wgRes, memberRes] = await Promise.all([
      supabase
        .from('workgroups')
        .select('id, name, description, type, icon, sort_order')
        .eq('project_id', projectId)
        .order('type')
        .order('sort_order')
        .order('name'),
      user?.id
        ? supabase
            .from('workgroup_members')
            .select('workgroup_id')
            .eq('profile_id', user.id)
        : Promise.resolve({ data: [] }),
    ])

    setAllWorkgroups(wgRes.data || [])

    const memberWgIds = new Set(
      (memberRes.data || [])
        .map(m => m.workgroup_id)
        // Only include workgroups that belong to this project
        .filter(wgId => (wgRes.data || []).some(wg => wg.id === wgId))
    )
    setMyWorkgroupIds(memberWgIds)
    setLoading(false)
  }, [projectId, user?.id])

  useEffect(() => { fetch() }, [fetch])

  const myWorkgroups = allWorkgroups.filter(wg => myWorkgroupIds.has(wg.id))

  return {
    allWorkgroups,
    myWorkgroups,
    myWorkgroupIds,
    loading,
    refetch: fetch,
  }
}
