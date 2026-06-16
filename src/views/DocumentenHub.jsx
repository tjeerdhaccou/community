import { useSearchParams } from 'react-router-dom'
import { useProject } from '../contexts/ProjectContext'
import ClusterTabs from '../components/ClusterTabs'
import Documents from './Documents'
import MyDocuments from './MyDocuments'

/**
 * DocumentenHub — clustert de projectdocumenten en de persoonlijke documenten
 * ('Mijn documenten') onder één nav-item. De Mijn documenten-tab is verborgen
 * voor adviseurs (professional), net als voorheen het losse nav-item. Tab is
 * deelbaar via ?tab=project|mijn.
 */
export default function DocumentenHub() {
  const { role, featureEnabled } = useProject()
  const isProfessional = role === 'professional'
  const showProject = featureEnabled('documents')

  const tabs = [
    ...(showProject ? [{ key: 'project', label: 'Projectdocumenten', icon: 'fa-solid fa-folder-open' }] : []),
    ...(!isProfessional ? [{ key: 'mijn', label: 'Mijn documenten', icon: 'fa-solid fa-file-shield' }] : []),
  ]

  const defaultTab = tabs[0]?.key || 'project'
  const [searchParams, setSearchParams] = useSearchParams()
  const urlTab = searchParams.get('tab')
  const activeTab = tabs.find(t => t.key === urlTab) ? urlTab : defaultTab
  const setTab = (key) => setSearchParams(key === defaultTab ? {} : { tab: key }, { replace: true })

  return (
    <div className="cluster-view">
      <ClusterTabs tabs={tabs} value={activeTab} onChange={setTab} />
      {activeTab === 'project' && showProject && <Documents />}
      {activeTab === 'mijn' && <MyDocuments />}
    </div>
  )
}
