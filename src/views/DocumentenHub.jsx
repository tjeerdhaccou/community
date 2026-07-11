import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useProject } from '../contexts/ProjectContext'
import Documents from './Documents'

/**
 * DocumentenHub — was voorheen een tab-container met Projectdocumenten +
 * Mijn documenten. 'Mijn documenten' is nu een top-level nav-item (Mijn
 * dossier) geworden, dus deze hub bevat alleen nog de projectdocumenten.
 * We rendren direct Documents zonder tab-strip.
 *
 * Backwards compat: oude bookmarks met ?tab=mijn worden doorgestuurd naar
 * de nieuwe /mijn-dossier route.
 */
export default function DocumentenHub() {
  const { basePath } = useProject()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (searchParams.get('tab') === 'mijn') {
      navigate(`${basePath}/mijn-dossier`, { replace: true })
    }
  }, [searchParams, basePath, navigate])

  return (
    <div className="cluster-view">
      <Documents />
    </div>
  )
}
