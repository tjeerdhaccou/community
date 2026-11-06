import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useProject } from '../contexts/ProjectContext'
import { useAuth } from '../contexts/AuthContext'
import { logger } from '../lib/logger'

/**
 * Voorstellen van het project + wat er op mijn reactie wacht + besluitenlijst.
 * RLS bepaalt wat je ziet: concepten alleen voor de indienende groep en
 * moderators. Live via realtime op proposals (response_count telt mee).
 */
export function useProposals() {
  const { project, featureEnabled } = useProject()
  const { user } = useAuth()
  const enabled = !!project?.id && featureEnabled('decisions')
  const [proposals, setProposals] = useState([])
  const [pendingIds, setPendingIds] = useState(new Set())
  const [eligibleIds, setEligibleIds] = useState(new Set())
  const [log, setLog] = useState([])
  const [rules, setRules] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!enabled) { setLoading(false); return }
    const [pRes, pendingRes, logRes, eligRes] = await Promise.all([
      supabase
        .from('proposals')
        .select(`
          id, form, status, title, summary, deadline, published_at, closed_at, created_at,
          electorate_size, response_count, is_heavy, version, outcome, workgroup_id, created_by,
          workgroup:workgroups!proposals_workgroup_id_fkey(id, name, is_board),
          author:profiles!proposals_created_by_fkey(id, full_name, avatar_url)
        `)
        .eq('project_id', project.id)
        .order('created_at', { ascending: false }),
      supabase.rpc('my_pending_proposals', { p_project_id: project.id }),
      supabase
        .from('decision_log')
        .select('*')
        .eq('project_id', project.id)
        .order('decided_at', { ascending: false }),
      // Voorstellen waarvoor ik (of mijn huishouden) stemgerechtigd ben.
      user?.id
        ? supabase.from('proposal_electorate').select('proposal_id').contains('member_ids', [user.id])
        : Promise.resolve({ data: [] }),
    ])
    if (pRes.error) logger.error('useProposals.fetch', pRes.error)
    if (pendingRes.error) logger.error('useProposals.pending', pendingRes.error)
    if (logRes.error) logger.error('useProposals.log', logRes.error)
    setProposals(pRes.data || [])
    setPendingIds(new Set((pendingRes.data || []).map(p => p.id)))
    setLog(logRes.data || [])
    setEligibleIds(new Set((eligRes.data || []).map(e => e.proposal_id)))
    setLoading(false)
  }, [enabled, project?.id, user?.id])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Regels apart (leeskopie voor de uitleg onder voorstellen).
  useEffect(() => {
    if (!enabled) return
    supabase.rpc('ensure_decision_rules', { p_project_id: project.id }).then(({ data, error }) => {
      if (error) logger.error('useProposals.rules', error)
      else setRules(data)
    })
  }, [enabled, project?.id])

  useEffect(() => {
    if (!enabled) return
    const channel = supabase
      .channel(`proposals-${project.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'proposals', filter: `project_id=eq.${project.id}`,
      }, () => fetchAll())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [enabled, project?.id, fetchAll])

  return { proposals, pendingIds, eligibleIds, log, rules, loading, refresh: fetchAll }
}

/**
 * Alleen het aantal voorstellen dat op mijn reactie wacht (sidebar-badge,
 * dashboard). Lichtgewicht: één RPC + realtime op proposals.
 */
export function usePendingProposals() {
  const { project, featureEnabled } = useProject()
  const enabled = !!project?.id && featureEnabled('decisions')
  const [pending, setPending] = useState([])

  useEffect(() => {
    if (!enabled) { setPending([]); return }
    let active = true
    function fetchPending() {
      supabase.rpc('my_pending_proposals', { p_project_id: project.id }).then(({ data, error }) => {
        if (!active) return
        if (error) logger.error('usePendingProposals', error)
        setPending(data || [])
      })
    }
    fetchPending()
    const channel = supabase
      .channel(`pending-proposals-${project.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'proposals', filter: `project_id=eq.${project.id}`,
      }, fetchPending)
      .subscribe()
    // Na eigen reactie (custom event uit useProposal) direct bijwerken.
    window.addEventListener('proposals:responded', fetchPending)
    return () => {
      active = false
      supabase.removeChannel(channel)
      window.removeEventListener('proposals:responded', fetchPending)
    }
  }, [enabled, project?.id])

  return pending
}
