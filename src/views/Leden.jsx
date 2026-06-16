import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProject } from '../contexts/ProjectContext'
import { canDo } from '../lib/permissions'
import { supabase } from '../lib/supabase'
import ClusterTabs from '../components/ClusterTabs'
import Members from './Members'
import Ledenwerving from './Ledenwerving'

/**
 * Leden — clustert de ledenlijst en ledenwerving onder één nav-item.
 * De Ledenwerving-tab verschijnt alleen voor moderators+ (manage_intake).
 * Tab is deelbaar via ?tab=leden|werving.
 */
export default function Leden() {
  const { project, role } = useProject()
  const canIntake = canDo(role, 'manage_intake')
  const [pendingCount, setPendingCount] = useState(0)

  // Aantal openstaande aanmeldingen — toont een badge op de Ledenwerving-tab
  // (spiegelt de badge op het Leden-nav-item in de sidebar). Live bijgewerkt
  // zodat de badge meteen daalt wanneer een aanmelding wordt goed-/afgekeurd.
  useEffect(() => {
    if (!project?.id || !canIntake) return
    function fetchCount() {
      supabase
        .from('intake_responses')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .eq('status', 'pending')
        .then(({ count }) => setPendingCount(count || 0))
    }
    fetchCount()
    const channel = supabase
      .channel(`leden-intake-pending-${project.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'intake_responses',
        filter: `project_id=eq.${project.id}`,
      }, fetchCount)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [project?.id, canIntake])

  const tabs = [
    { key: 'leden', label: 'Leden', icon: 'fa-solid fa-users' },
    ...(canIntake ? [{ key: 'werving', label: 'Ledenwerving', icon: 'fa-solid fa-clipboard-list', count: pendingCount }] : []),
  ]

  const [searchParams, setSearchParams] = useSearchParams()
  const urlTab = searchParams.get('tab')
  const activeTab = tabs.find(t => t.key === urlTab) ? urlTab : 'leden'
  const setTab = (key) => setSearchParams(key === 'leden' ? {} : { tab: key }, { replace: true })

  return (
    <div className="cluster-view">
      <ClusterTabs tabs={tabs} value={activeTab} onChange={setTab} />
      {activeTab === 'leden' && <Members />}
      {activeTab === 'werving' && <Ledenwerving />}
    </div>
  )
}
