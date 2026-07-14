import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { safeStorage } from '../lib/safeStorage'

// "Nieuw sinds je laatste bezoek"-indicatoren voor Prikbord, Projectnieuws en
// Events. Sinds migratie 092 wordt de gezien-marker in public.user_seen_markers
// bijgehouden zodat de dot cross-device meedaalt: bekijk je iets op je laptop,
// dan verdwijnt de indicator ook op je telefoon. localStorage blijft als
// snelheids-cache en als fallback voor pre-migratie environments.

const LS_KEYS = {
  board: pid => `lastSeen:board:${pid}`,
  updates: pid => `lastSeen:updates:${pid}`,
  events: pid => `lastSeen:events:${pid}`,
}

const KINDS = ['board', 'updates', 'events']
const CHANGE_EVENT = 'unread-marker-changed'

function readLocal(projectId, kind) {
  if (!projectId) return null
  return safeStorage.getItem(LS_KEYS[kind](projectId))
}

function writeLocal(projectId, kind, iso) {
  if (!projectId || !LS_KEYS[kind]) return
  safeStorage.setItem(LS_KEYS[kind](projectId), iso)
}

export async function markSeen(projectId, kind) {
  if (!projectId || !KINDS.includes(kind)) return
  const nowIso = new Date().toISOString()
  // Direct in localStorage: consumers zien de update meteen zonder round-trip.
  writeLocal(projectId, kind, nowIso)
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  // DB-upsert async; als het faalt (bv. tabel nog niet gemigreerd, offline)
  // blijft de localStorage-write staan en werkt de UI op dit device door.
  try {
    const { data: sess } = await supabase.auth.getSession()
    const uid = sess?.session?.user?.id
    if (!uid) return
    await supabase
      .from('user_seen_markers')
      .upsert({ user_id: uid, project_id: projectId, kind, seen_at: nowIso }, {
        onConflict: 'user_id,project_id,kind',
      })
  } catch {
    // Silent fallback: tabel bestaat nog niet, of geen netwerk. De
    // localStorage-write hierboven blijft leidend op dit device.
  }
}

export function useUnreadIndicators(projectId) {
  const [latestBoardAt, setLatestBoardAt] = useState(null)
  const [latestUpdateAt, setLatestUpdateAt] = useState(null)
  // Voor events kijken we niet naar created_at maar naar de eerstvolgende
  // event-datum die nog niet is geweest — een event dat morgen plaatsvindt is
  // relevant, ongeacht wanneer het is aangemaakt.
  const [nextEventAt, setNextEventAt] = useState(null)
  const [markerTick, setMarkerTick] = useState(0)
  // Server-side markers per kind. null = nog niet geladen (of niet aanwezig).
  const dbMarkersRef = useRef({ board: null, updates: null, events: null })

  useEffect(() => {
    if (!projectId) return
    let cancelled = false

    // Bestaande gebruikers niet ineens een dot geven voor oud spul: bij eerste
    // bezoek (geen marker) zetten we een lokale marker op 'nu'. De DB-marker
    // wordt pas geschreven zodra de user daadwerkelijk iets als gezien
    // markeert (voorkomt onnodige rijen voor bezoekers die nooit klikken).
    const nowIsoInit = new Date().toISOString()
    KINDS.forEach(kind => {
      if (!safeStorage.getItem(LS_KEYS[kind](projectId))) {
        safeStorage.setItem(LS_KEYS[kind](projectId), nowIsoInit)
      }
    })

    const nowIso = new Date().toISOString()
    Promise.all([
      supabase.from('posts').select('created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('updates').select('created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('meetings').select('created_at, date').eq('project_id', projectId).gte('date', nowIso).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]).then(([postRes, updRes, evRes]) => {
      if (cancelled) return
      setLatestBoardAt(postRes.data?.created_at || null)
      setLatestUpdateAt(updRes.data?.created_at || null)
      setNextEventAt(evRes.data?.created_at || null)
    })

    // Server-markers ophalen. Faalt de query (tabel bestaat nog niet in deze
    // env, of RLS blokkeert), dan blijven de refs op null en vallen we
    // stilzwijgend terug op de localStorage-markers.
    supabase.auth.getSession().then(({ data: sess }) => {
      const uid = sess?.session?.user?.id
      if (!uid) return
      supabase
        .from('user_seen_markers')
        .select('kind, seen_at')
        .eq('user_id', uid)
        .eq('project_id', projectId)
        .in('kind', KINDS)
        .then(({ data, error }) => {
          if (cancelled || error || !data) return
          const next = { board: null, updates: null, events: null }
          for (const row of data) {
            next[row.kind] = row.seen_at
            // Cache in localStorage zodat volgende page-loads instant zijn.
            writeLocal(projectId, row.kind, row.seen_at)
          }
          dbMarkersRef.current = next
          setMarkerTick(t => t + 1)
        })
    })

    const channel = supabase
      .channel(`unread-${projectId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts', filter: `project_id=eq.${projectId}` },
        payload => setLatestBoardAt(payload.new.created_at))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'updates', filter: `project_id=eq.${projectId}` },
        payload => setLatestUpdateAt(payload.new.created_at))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meetings', filter: `project_id=eq.${projectId}` },
        payload => {
          // Alleen als het event nog niet voorbij is — voorkomt dat een historisch
          // ingevoerd event als "nieuw" opduikt.
          if (payload.new.date && payload.new.date > new Date().toISOString()) {
            setNextEventAt(payload.new.created_at)
          }
        })
      .subscribe()

    // Cross-device: als een ander device een marker upsertet, propaget die
    // hier terug via realtime en clearet de dot.
    let markerChannel = null
    supabase.auth.getSession().then(({ data: sess }) => {
      const uid = sess?.session?.user?.id
      if (!uid || cancelled) return
      markerChannel = supabase
        .channel(`seen-markers-${projectId}-${uid}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_seen_markers',
          filter: `user_id=eq.${uid}`,
        }, payload => {
          const row = payload.new || payload.old
          if (!row || row.project_id !== projectId) return
          if (payload.new) {
            dbMarkersRef.current = { ...dbMarkersRef.current, [payload.new.kind]: payload.new.seen_at }
            writeLocal(projectId, payload.new.kind, payload.new.seen_at)
          }
          setMarkerTick(t => t + 1)
        })
        .subscribe()
    })

    const onMarkerChange = () => setMarkerTick(t => t + 1)
    window.addEventListener(CHANGE_EVENT, onMarkerChange)

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
      if (markerChannel) supabase.removeChannel(markerChannel)
      window.removeEventListener(CHANGE_EVENT, onMarkerChange)
    }
  }, [projectId])

  // Marker uit DB (indien geladen) of localStorage lezen bij elke render.
  // Goedkoop, en zo pakt elke consument de laatste markSeen-write op via
  // markerTick.
  void markerTick
  const boardSeenAt = dbMarkersRef.current.board || readLocal(projectId, 'board')
  const updatesSeenAt = dbMarkersRef.current.updates || readLocal(projectId, 'updates')
  const eventsSeenAt = dbMarkersRef.current.events || readLocal(projectId, 'events')

  return {
    hasNewBoard: !!latestBoardAt && (!boardSeenAt || latestBoardAt > boardSeenAt),
    hasNewUpdates: !!latestUpdateAt && (!updatesSeenAt || latestUpdateAt > updatesSeenAt),
    hasNewEvents: !!nextEventAt && (!eventsSeenAt || nextEventAt > eventsSeenAt),
  }
}
