import { useSearchParams } from 'react-router-dom'
import { useProject } from '../contexts/ProjectContext'
import { canDo } from '../lib/permissions'
import ClusterTabs from '../components/ClusterTabs'
import Members from './Members'
import Ledenwerving from './Ledenwerving'

/**
 * Leden — clustert de ledenlijst en ledenwerving onder één nav-item.
 * De Ledenwerving-tab verschijnt alleen voor moderators+ (manage_intake).
 * Tab is deelbaar via ?tab=leden|werving.
 */
export default function Leden() {
  const { role } = useProject()
  const canIntake = canDo(role, 'manage_intake')

  const tabs = [
    { key: 'leden', label: 'Leden', icon: 'fa-solid fa-users' },
    ...(canIntake ? [{ key: 'werving', label: 'Ledenwerving', icon: 'fa-solid fa-clipboard-list' }] : []),
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
