import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { logger } from '../lib/logger'

// Aantal tekenverzoeken dat nog actie van de huidige user vraagt:
// signer-status pending of viewed, op een verzoek dat nog 'open' is en bij
// het huidige project hoort. Realtime: ververst zichzelf op DB-changes.
export function useSignatureRequestCount() {
  const { user } = useAuth()
  const { project } = useProject()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!user?.id || !project?.id) {
      setCount(0)
      return
    }
    let stale = false

    async function fetchCount() {
      // !inner join filtert op signature_requests-velden zodat we alleen
      // openstaande verzoeken in dit project tellen — niet cancelled/completed
      // of verzoeken uit andere projecten.
      const { count: c, error } = await supabase
        .from('signature_request_signers')
        .select('id, signature_requests!inner(status, project_id)', { count: 'exact', head: true })
        .eq('profile_id', user.id)
        .in('status', ['pending', 'viewed'])
        .eq('signature_requests.status', 'open')
        .eq('signature_requests.project_id', project.id)
      if (stale) return
      if (error) {
        logger.error('useSignatureRequestCount.fetch', error)
        setCount(0)
        return
      }
      setCount(c ?? 0)
    }

    fetchCount()

    // Realtime: zowel signer-rij changes (status updates) als request-changes
    // (cancel door admin) moeten de teller verversen.
    const ch = supabase
      .channel(`sig-count-${project.id}-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'signature_request_signers',
        filter: `profile_id=eq.${user.id}`,
      }, fetchCount)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'signature_requests',
        filter: `project_id=eq.${project.id}`,
      }, fetchCount)
      .subscribe()

    return () => {
      stale = true
      supabase.removeChannel(ch)
    }
  }, [user?.id, project?.id])

  return count
}
