import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { canDo } from '../lib/permissions'
import { logger } from '../lib/logger'

/**
 * Voor admins: welke leden hebben zelf-uploads staan die het team nog niet
 * gezien heeft? Terug: map van profile_id → count + helpers.
 *
 * Zelf-upload = member_files-rij waar uploaded_by = profile_id (dus het lid
 * heeft het bestand zelf toegevoegd, niet iemand van het team). reviewed_at
 * IS NULL betekent 'nog niet door team gezien'.
 *
 * Gated op assign_roles (admin) — spiegelt canManage in Members.jsx, dat
 * bepaalt of het Dossier-tab überhaupt zichtbaar is.
 */
export function useUnreviewedMemberUploads() {
  const { user } = useAuth()
  const { project, role } = useProject()
  const [byProfile, setByProfile] = useState({}) // { profileId: count }

  const canSee = !!(user?.id && project?.id && canDo(role, 'assign_roles'))

  const fetch = useCallback(async () => {
    if (!canSee) { setByProfile({}); return }
    // Supabase JS ondersteunt geen "col = col" filter, dus we halen alle
    // ongelezen rijen op en filteren client-side op uploaded_by = profile_id.
    // Dataset is per project en beperkt tot ongelezen rijen — verwaarloosbaar.
    const { data, error } = await supabase
      .from('member_files')
      .select('profile_id, uploaded_by')
      .eq('project_id', project.id)
      .is('reviewed_at', null)
    if (error) {
      logger.error('useUnreviewedMemberUploads.fetch', error)
      return
    }
    const counts = {}
    for (const r of data || []) {
      if (r.uploaded_by === r.profile_id) {
        counts[r.profile_id] = (counts[r.profile_id] || 0) + 1
      }
    }
    setByProfile(counts)
  }, [canSee, project?.id])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    if (!canSee) return
    // Unieke channel-naam per hook-instance zodat Sidebar/Members/MemberProfile
    // niet dezelfde Supabase-channel proberen te delen (elk krijgt eigen sub).
    const chId = `unreviewed-uploads-${project.id}-${Math.random().toString(36).slice(2, 8)}`
    const ch = supabase
      .channel(chId)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'member_files',
        filter: `project_id=eq.${project.id}`,
      }, fetch)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [canSee, project?.id, fetch])

  const memberCount = Object.keys(byProfile).length
  const hasUnreviewed = (profileId) => (byProfile[profileId] || 0) > 0

  async function markReviewed(profileId) {
    if (!canSee || !profileId) return
    // Alle ongelezen zelf-uploads van dit lid in dit project markeren als gezien.
    const { error } = await supabase
      .from('member_files')
      .update({ reviewed_at: new Date().toISOString() })
      .eq('project_id', project.id)
      .eq('profile_id', profileId)
      .eq('uploaded_by', profileId)
      .is('reviewed_at', null)
    if (error) {
      logger.error('useUnreviewedMemberUploads.markReviewed', error)
      return
    }
    setByProfile(prev => {
      const next = { ...prev }
      delete next[profileId]
      return next
    })
  }

  return { byProfile, memberCount, hasUnreviewed, markReviewed }
}
