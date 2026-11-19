import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'

/**
 * Is de ingelogde gebruiker beoordelaar van dit project?
 *
 * Alleen beoordelaars zien financiële stukken en identiteitscontroles
 * (migratie 128). De database dwingt dat af; deze hook is er om de juiste
 * knoppen te tonen. In het demoproject geldt het hele team als beoordelaar.
 */
export function useIsProjectReviewer() {
  const { user } = useAuth()
  const { project } = useProject()
  const [isReviewer, setIsReviewer] = useState(false)

  useEffect(() => {
    if (!user?.id || !project?.id) { setIsReviewer(false); return }
    if (project.is_demo) { setIsReviewer(true); return }
    let cancelled = false
    supabase
      .from('project_reviewers')
      .select('id')
      .eq('project_id', project.id)
      .eq('profile_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setIsReviewer(!!data) })
    return () => { cancelled = true }
  }, [user?.id, project?.id, project?.is_demo])

  return isReviewer
}
