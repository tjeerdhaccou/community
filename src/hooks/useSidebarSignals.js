import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { canDo } from '../lib/permissions'
import { useUnreviewedMemberUploads } from './useUnreviewedMemberUploads'
import { useSignatureRequestCount } from './useSignatureRequestCount'
import { useSupportConversation } from './useSupportConversation'
import { useUnreadIndicators, markSeen as markSeenLocal } from './useUnreadIndicators'

/**
 * Eén centrale bron voor alle sidebar-signalen. Twee semantische categorieën:
 *
 *   actions  — "jij moet iets doen": numerieke badge.
 *   unread   — "nieuw sinds vorige keer": blauwe dot, geen getal.
 *
 * Elk sidebar-item hoort in exact één categorie. Wie iets toevoegt: pas de
 * shape hieronder aan, niet de Sidebar-component.
 */
export function useSidebarSignals() {
  const { user } = useAuth()
  const { project, role, featureEnabled } = useProject()
  const isProfessional = role === 'professional'

  // ---- Actions: intake-aanmeldingen (admins/moderators + ledenwerving-module aan)
  const [intakePendingCount, setIntakePendingCount] = useState(0)
  const canSeeIntakeBadge = !!project?.id && canDo(role, 'manage_intake') && featureEnabled('ledenwerving')
  useEffect(() => {
    if (!canSeeIntakeBadge) { setIntakePendingCount(0); return }
    function fetchCount() {
      supabase
        .from('intake_responses')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .eq('status', 'pending')
        .then(({ count }) => setIntakePendingCount(count || 0))
    }
    fetchCount()
    const ch = supabase
      .channel(`signals-intake-${project.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'intake_responses',
        filter: `project_id=eq.${project.id}`,
      }, fetchCount)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [canSeeIntakeBadge, project?.id])

  // ---- Actions: leden met ongelezen zelf-uploads (admin-signaal)
  const { memberCount: unreviewedUploadCount } = useUnreviewedMemberUploads()

  // ---- Actions: documentverzoeken op de user (upload/inzage/tekenen-via-verzoek)
  const [docRequestCount, setDocRequestCount] = useState(0)
  useEffect(() => {
    if (!project?.id || !user?.id || isProfessional) { setDocRequestCount(0); return }
    function fetchCount() {
      supabase
        .from('document_requests')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .eq('profile_id', user.id)
        .eq('status', 'pending')
        .then(({ count }) => setDocRequestCount(count || 0))
    }
    fetchCount()
    const ch = supabase
      .channel(`signals-doc-req-${project.id}-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'document_requests',
        filter: `profile_id=eq.${user.id}`,
      }, fetchCount)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [project?.id, user?.id, isProfessional])

  // ---- Actions: tekenverzoeken
  const signatureRequestCount = useSignatureRequestCount()

  // ---- Actions: ongelezen support-chat
  const { unreadCount: chatUnread } = useSupportConversation()

  // ---- Unread dots: prikbord, projectnieuws, events (cross-device via useUnreadIndicators)
  const { hasNewBoard, hasNewUpdates, hasNewEvents } = useUnreadIndicators(project?.id)

  return {
    actions: {
      leden: intakePendingCount + unreviewedUploadCount,
      dossier: docRequestCount + signatureRequestCount,
      chat: chatUnread,
    },
    unread: {
      board: hasNewBoard,
      updates: hasNewUpdates,
      events: hasNewEvents,
    },
    // Helper doorgeschoven voor consumers die willen "markeren als gezien"
    // (bv. Board.jsx, Updates.jsx, Events.jsx bij mount van de view).
    markSeen: markSeenLocal,
  }
}
