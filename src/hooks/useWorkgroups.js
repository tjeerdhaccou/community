import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { logger, friendlyError } from '../lib/logger'
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
  // profile_id → Set(workgroup_id) voor álle leden van het project
  const [workgroupIdsByProfile, setWorkgroupIdsByProfile] = useState({})
  const [loading, setLoading] = useState(true)

  const projectId = project?.id

  const fetch = useCallback(async () => {
    if (!projectId) return
    setLoading(true)

    const { data: wgData } = await supabase
      .from('workgroups')
      .select('id, name, description, type, icon, sort_order')
      .eq('project_id', projectId)
      .order('type')
      .order('sort_order')
      .order('name')

    const workgroups = wgData || []
    setAllWorkgroups(workgroups)

    const wgIds = workgroups.map(wg => wg.id)
    let memberships = []
    if (wgIds.length > 0) {
      const { data: memberData } = await supabase
        .from('workgroup_members')
        .select('workgroup_id, profile_id')
        .in('workgroup_id', wgIds)
      memberships = memberData || []
    }

    const byProfile = {}
    const mine = new Set()
    for (const m of memberships) {
      if (!byProfile[m.profile_id]) byProfile[m.profile_id] = new Set()
      byProfile[m.profile_id].add(m.workgroup_id)
      if (m.profile_id === user?.id) mine.add(m.workgroup_id)
    }
    setWorkgroupIdsByProfile(byProfile)
    setMyWorkgroupIds(mine)
    setLoading(false)
  }, [projectId, user?.id])

  useEffect(() => { fetch() }, [fetch])

  const myWorkgroups = allWorkgroups.filter(wg => myWorkgroupIds.has(wg.id))

  // Geef voor een profiel de workgroup-objecten terug (optioneel gefilterd op type)
  const workgroupsForProfile = useCallback((profileId, type) => {
    const ids = workgroupIdsByProfile[profileId]
    if (!ids) return []
    return allWorkgroups.filter(wg => ids.has(wg.id) && (!type || wg.type === type))
  }, [workgroupIdsByProfile, allWorkgroups])

  // ===== CRUD (moderator+ via RLS) =====
  async function createWorkgroup({ name, description, type, icon }) {
    const { error } = await supabase.from('workgroups').insert({
      project_id: projectId,
      name: name.trim(),
      description: description?.trim() || null,
      type: type || 'commissie',
      icon: icon || null,
    })
    if (error) { logger.error('useWorkgroups.create', error); throw new Error(friendlyError(error)) }
    await fetch()
  }

  async function updateWorkgroup(id, { name, description, type, icon }) {
    const { error } = await supabase.from('workgroups').update({
      name: name.trim(),
      description: description?.trim() || null,
      type,
      icon: icon || null,
    }).eq('id', id)
    if (error) { logger.error('useWorkgroups.update', error); throw new Error(friendlyError(error)) }
    await fetch()
  }

  async function deleteWorkgroup(id) {
    const { error } = await supabase.from('workgroups').delete().eq('id', id)
    if (error) { logger.error('useWorkgroups.delete', error); throw new Error(friendlyError(error)) }
    await fetch()
  }

  async function addMember(workgroupId, profileId) {
    const { error } = await supabase.from('workgroup_members').insert({ workgroup_id: workgroupId, profile_id: profileId })
    if (error) { logger.error('useWorkgroups.addMember', error); throw new Error(friendlyError(error)) }
    await fetch()
  }

  async function removeMember(workgroupId, profileId) {
    const { error } = await supabase.from('workgroup_members').delete()
      .eq('workgroup_id', workgroupId).eq('profile_id', profileId)
    if (error) { logger.error('useWorkgroups.removeMember', error); throw new Error(friendlyError(error)) }
    await fetch()
  }

  return {
    allWorkgroups,
    myWorkgroups,
    myWorkgroupIds,
    workgroupIdsByProfile,
    workgroupsForProfile,
    loading,
    refetch: fetch,
    createWorkgroup,
    updateWorkgroup,
    deleteWorkgroup,
    addMember,
    removeMember,
  }
}
