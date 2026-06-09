import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { logger, friendlyError } from '../lib/logger'
import { logAudit } from '../lib/audit'
import { useProject } from '../contexts/ProjectContext'

async function sendMemberEmail(type, { memberName, memberEmail, projectName, reason }) {
  try {
    const { error } = await supabase.functions.invoke('send-member-email', {
      body: { type, memberName, memberEmail, projectName, reason },
    })
    if (error) logger.error('useMembers.sendEmail', error)
  } catch (err) {
    // Email is best-effort — don't block the action
    logger.error('useMembers.sendEmail', err)
  }
}

export function useMembers() {
  const { project } = useProject()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  const projectId = project?.id

  const fetchMembers = useCallback(async () => {
    if (!projectId) return
    setLoading(true)

    const { data, error } = await supabase
      .from('memberships')
      .select('*, profile:profiles(id, full_name, avatar_url, email, is_platform_admin, company, bio, phone, website, professional_type)')
      .eq('project_id', projectId)
      .order('joined_at', { ascending: true })
    // funnel_stage is on memberships table directly

    if (error) {
      logger.error('useMembers.fetch', error)
    } else {
      setMembers(data || [])
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const WELCOME_TARGET_ROLES = ['aspirant', 'member', 'moderator', 'admin']

  async function updateRole(membershipId, newRole) {
    const member = members.find(m => m.id === membershipId)
    const oldRole = member?.role
    if (oldRole === newRole) return

    // Optimistische update: UI verandert direct, DB-call op de achtergrond
    setMembers(prev => prev.map(m => m.id === membershipId ? { ...m, role: newRole } : m))

    const { error } = await supabase
      .from('memberships')
      .update({ role: newRole })
      .eq('id', membershipId)

    if (error) {
      // Rollback bij fout
      setMembers(prev => prev.map(m => m.id === membershipId ? { ...m, role: oldRole } : m))
      logger.error('useMembers.updateRole', error)
      throw new Error(friendlyError(error))
    }

    // Welkomstmail bij promotie uit guest naar een echte lid-rol
    if (oldRole === 'guest' && WELCOME_TARGET_ROLES.includes(newRole) && member?.profile) {
      sendMemberEmail('welcome', {
        memberName: member.profile.full_name,
        memberEmail: member.profile.email,
        projectName: project?.name,
      })
    }
  }

  async function removeMember(membershipId) {
    const { error } = await supabase
      .from('memberships')
      .delete()
      .eq('id', membershipId)

    if (error) { logger.error('useMembers.removeMember', error); throw new Error(friendlyError(error)) }
    setMembers(prev => prev.filter(m => m.id !== membershipId))
  }

  async function approveMember(membershipId) {
    await updateRole(membershipId, 'aspirant')
  }

  async function rejectMember(membershipId, reason) {
    const member = members.find(m => m.id === membershipId)

    // Send rejection email before deleting
    if (member?.profile) {
      await sendMemberEmail('rejection', {
        memberName: member.profile.full_name,
        memberEmail: member.profile.email,
        projectName: project?.name,
        reason,
      })
    }

    await removeMember(membershipId)
  }

  async function updateFunnelStage(membershipId, newStage) {
    const member = members.find(m => m.id === membershipId)
    const oldStage = member?.funnel_stage

    setMembers(prev => prev.map(m => m.id === membershipId ? { ...m, funnel_stage: newStage } : m))

    const { error } = await supabase
      .from('memberships')
      .update({ funnel_stage: newStage })
      .eq('id', membershipId)

    if (error) {
      setMembers(prev => prev.map(m => m.id === membershipId ? { ...m, funnel_stage: oldStage } : m))
      logger.error('useMembers.updateFunnelStage', error)
      throw new Error(friendlyError(error))
    }
  }

  return { members, loading, updateRole, updateFunnelStage, removeMember, approveMember, rejectMember, refetch: fetchMembers }
}
