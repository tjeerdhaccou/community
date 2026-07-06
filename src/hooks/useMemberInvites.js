import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { logger, friendlyError } from '../lib/logger'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { getProjectBaseUrl } from '../lib/subdomain'

async function sendInviteEmail({ email, name, projectId, projectName, projectUrl, personalMessage }) {
  const { error } = await supabase.functions.invoke('send-member-email', {
    body: {
      type: 'invite',
      memberEmail: email,
      memberName: name || null,
      projectId,
      projectName,
      projectUrl,
      personalMessage: personalMessage || null,
    },
  })
  if (error) throw error
}

export function useMemberInvites() {
  const { user } = useAuth()
  const { project } = useProject()
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)

  const projectId = project?.id

  const fetchInvites = useCallback(async () => {
    if (!projectId) return
    setLoading(true)

    const { data, error } = await supabase
      .from('member_invites')
      .select('*, inviter:profiles!invited_by(full_name)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('useMemberInvites.fetch', error)
    } else {
      setInvites(data || [])
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchInvites() }, [fetchInvites])

  async function createInvite({ email, name, personalMessage, assignedRole }) {
    const cleanEmail = email.toLowerCase().trim()
    const cleanMessage = personalMessage?.trim() || null
    const { data, error } = await supabase
      .from('member_invites')
      .insert({
        project_id: projectId,
        email: cleanEmail,
        name: name?.trim() || null,
        invited_by: user.id,
        personal_message: cleanMessage,
        assigned_role: assignedRole || 'guest',
      })
      .select('*, inviter:profiles!invited_by(full_name)')
      .single()

    if (error) { logger.error('useMemberInvites.createInvite', error); throw new Error(friendlyError(error)) }

    try {
      await sendInviteEmail({
        email: cleanEmail,
        name: name?.trim(),
        projectId,
        projectName: project?.name,
        projectUrl: getProjectBaseUrl(project),
        personalMessage: cleanMessage,
      })
    } catch (err) {
      logger.error('useMemberInvites.sendInviteEmail', err)
      throw new Error('Uitnodiging is opgeslagen maar de e-mail kon niet worden verstuurd.')
    }

    setInvites(prev => [data, ...prev])
    return data
  }

  async function revokeInvite(id) {
    const { error } = await supabase
      .from('member_invites')
      .update({ status: 'revoked' })
      .eq('id', id)

    if (error) { logger.error('useMemberInvites.revokeInvite', error); throw new Error(friendlyError(error)) }
    setInvites(prev => prev.map(i => i.id === id ? { ...i, status: 'revoked' } : i))
  }

  async function resendInvite(invite) {
    try {
      await sendInviteEmail({
        email: invite.email,
        name: invite.name,
        projectId,
        projectName: project?.name,
        projectUrl: getProjectBaseUrl(project),
        personalMessage: invite.personal_message,
      })
    } catch (err) {
      logger.error('useMemberInvites.resendInvite', err)
      throw new Error('De uitnodiging kon niet opnieuw worden verstuurd.')
    }
  }

  return { invites, loading, createInvite, revokeInvite, resendInvite, refetch: fetchInvites }
}
