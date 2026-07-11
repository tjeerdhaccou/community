import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { safeStorage } from '../lib/safeStorage'

// "Nieuw sinds je laatste bezoek"-indicatoren voor Prikbord en Projectnieuws.
// Per device opgeslagen in localStorage; bewust geen DB-tabel — een dot in de
// sidebar is geen kritieke staat en cross-device sync is hier niet nodig.

const KEYS = {
  board: pid => `lastSeen:board:${pid}`,
  updates: pid => `lastSeen:updates:${pid}`,
}

const CHANGE_EVENT = 'unread-marker-changed'

function readMarker(projectId, kind) {
  if (!projectId) return null
  return safeStorage.getItem(KEYS[kind](projectId))
}

export function markSeen(projectId, kind) {
  if (!projectId || !KEYS[kind]) return
  safeStorage.setItem(KEYS[kind](projectId), new Date().toISOString())
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

export function useUnreadIndicators(projectId) {
  const [latestBoardAt, setLatestBoardAt] = useState(null)
  const [latestUpdateAt, setLatestUpdateAt] = useState(null)
  const [markerTick, setMarkerTick] = useState(0)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false

    // Bestaande gebruikers niet ineens een dot geven voor oud spul: bij eerste
    // bezoek (geen marker) zetten we de marker op 'nu', zodat alleen content
    // die na dit moment binnenkomt als nieuw geldt.
    ;['board', 'updates'].forEach(kind => {
      if (!safeStorage.getItem(KEYS[kind](projectId))) {
        safeStorage.setItem(KEYS[kind](projectId), new Date().toISOString())
      }
    })

    Promise.all([
      supabase.from('posts').select('created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('updates').select('created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]).then(([postRes, updRes]) => {
      if (cancelled) return
      setLatestBoardAt(postRes.data?.created_at || null)
      setLatestUpdateAt(updRes.data?.created_at || null)
    })

    const channel = supabase
      .channel(`unread-${projectId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts', filter: `project_id=eq.${projectId}` },
        payload => setLatestBoardAt(payload.new.created_at))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'updates', filter: `project_id=eq.${projectId}` },
        payload => setLatestUpdateAt(payload.new.created_at))
      .subscribe()

    const onMarkerChange = () => setMarkerTick(t => t + 1)
    window.addEventListener(CHANGE_EVENT, onMarkerChange)

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
      window.removeEventListener(CHANGE_EVENT, onMarkerChange)
    }
  }, [projectId])

  // Marker uit localStorage opnieuw lezen bij elke render. Goedkoop, en zo
  // pakt elke consument de laatste markSeen-write op via markerTick.
  void markerTick
  const boardSeenAt = readMarker(projectId, 'board')
  const updatesSeenAt = readMarker(projectId, 'updates')

  return {
    hasNewBoard: !!latestBoardAt && (!boardSeenAt || latestBoardAt > boardSeenAt),
    hasNewUpdates: !!latestUpdateAt && (!updatesSeenAt || latestUpdateAt > updatesSeenAt),
  }
}
