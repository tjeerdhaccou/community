import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProject } from '../contexts/ProjectContext'
import { useAuth } from '../contexts/AuthContext'
import { useSignatureRequestCount } from '../hooks/useSignatureRequestCount'
import { supabase } from '../lib/supabase'
import ClusterTabs from '../components/ClusterTabs'
import Documents from './Documents'
import MyDocuments from './MyDocuments'

/**
 * DocumentenHub — clustert de projectdocumenten en de persoonlijke documenten
 * ('Mijn documenten') onder één nav-item. De Mijn documenten-tab is verborgen
 * voor adviseurs (professional), net als voorheen het losse nav-item. Tab is
 * deelbaar via ?tab=project|mijn.
 *
 * Op de Mijn documenten-tab tonen we een count-badge met openstaande acties
 * (documentverzoeken + tekenverzoeken samen) zodat het lid meteen ziet dat er
 * iets voor hen klaarstaat — ook als ze de tab nog niet geopend hebben.
 */
export default function DocumentenHub() {
  const { project, role, featureEnabled } = useProject()
  const { user } = useAuth()
  const isProfessional = role === 'professional'
  const showProject = featureEnabled('documents')

  const signatureCount = useSignatureRequestCount()
  const [docRequestCount, setDocRequestCount] = useState(0)

  useEffect(() => {
    if (!project?.id || !user?.id || isProfessional) return
    let stale = false
    function fetchCount() {
      supabase
        .from('document_requests')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .eq('profile_id', user.id)
        .eq('status', 'pending')
        .then(({ count }) => { if (!stale) setDocRequestCount(count || 0) })
    }
    fetchCount()
    const ch = supabase
      .channel(`hub-doc-req-${project.id}-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'document_requests',
        filter: `profile_id=eq.${user.id}`,
      }, fetchCount)
      .subscribe()
    return () => { stale = true; supabase.removeChannel(ch) }
  }, [project?.id, user?.id, isProfessional])

  const mijnCount = docRequestCount + signatureCount

  const tabs = [
    ...(showProject ? [{ key: 'project', label: 'Projectdocumenten', icon: 'fa-solid fa-folder-open' }] : []),
    ...(!isProfessional ? [{ key: 'mijn', label: 'Mijn documenten', icon: 'fa-solid fa-file-shield', count: mijnCount }] : []),
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
