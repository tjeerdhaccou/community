import { useSearchParams } from 'react-router-dom'
import { useProject } from '../contexts/ProjectContext'
import { canDo } from '../lib/permissions'
import ClusterTabs from '../components/ClusterTabs'
import AdviseurTeam from './AdviseurTeam'
import Groepen from './Beheer/Groepen'

/**
 * Organisatie — clustert het adviseursteam en de groepen/commissies onder één
 * nav-item. Tabs verschijnen op basis van rechten: Team voor professional+,
 * Groepen voor moderators+ (manage_workgroups). Tab is deelbaar via
 * ?tab=team|groepen.
 */
export default function Organisatie() {
  const { role, featureEnabled } = useProject()
  const showTeam = canDo(role, 'view_team') && featureEnabled('team')
  const showGroepen = canDo(role, 'manage_workgroups')

  const tabs = [
    ...(showTeam ? [{ key: 'team', label: 'Team', icon: 'fa-solid fa-helmet-safety' }] : []),
    ...(showGroepen ? [{ key: 'groepen', label: 'Groepen', icon: 'fa-solid fa-people-group' }] : []),
  ]

  const defaultTab = tabs[0]?.key || 'team'
  const [searchParams, setSearchParams] = useSearchParams()
  const urlTab = searchParams.get('tab')
  const activeTab = tabs.find(t => t.key === urlTab) ? urlTab : defaultTab
  const setTab = (key) => setSearchParams(key === defaultTab ? {} : { tab: key }, { replace: true })

  return (
    <div className="cluster-view">
      <ClusterTabs tabs={tabs} value={activeTab} onChange={setTab} />
      {activeTab === 'team' && showTeam && <AdviseurTeam />}
      {activeTab === 'groepen' && showGroepen && <Groepen />}
    </div>
  )
}
