import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProject } from '../contexts/ProjectContext'
import { useAuth } from '../contexts/AuthContext'
import { useEvents } from '../hooks/useEvents'
import { canDo } from '../lib/permissions'
import { EVENT_TYPES } from '../lib/constants'
import EventCard from '../components/EventCard'
import EventModal from '../components/EventModal'
import EventDetail from '../components/EventDetail'

const FILTER_TYPES = [{ key: 'alles', label: 'Alles' }, ...EVENT_TYPES]

function groupByDate(events) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 86400000)
  const nextWeek = new Date(today.getTime() + 7 * 86400000)
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)

  const groups = []
  const buckets = {
    'Vandaag': [],
    'Morgen': [],
    'Deze week': [],
    'Volgende week': [],
  }
  const monthBuckets = {}

  events.forEach(e => {
    const d = new Date(e.date)
    if (d >= today && d < tomorrow) {
      buckets['Vandaag'].push(e)
    } else if (d >= tomorrow && d < new Date(tomorrow.getTime() + 86400000)) {
      buckets['Morgen'].push(e)
    } else if (d < nextWeek) {
      buckets['Deze week'].push(e)
    } else if (d < new Date(nextWeek.getTime() + 7 * 86400000)) {
      buckets['Volgende week'].push(e)
    } else {
      const monthKey = d.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
      if (!monthBuckets[monthKey]) monthBuckets[monthKey] = []
      monthBuckets[monthKey].push(e)
    }
  })

  Object.entries(buckets).forEach(([label, items]) => {
    if (items.length > 0) groups.push({ label, events: items })
  })
  Object.entries(monthBuckets).forEach(([label, items]) => {
    groups.push({ label: label.charAt(0).toUpperCase() + label.slice(1), events: items })
  })

  return groups
}

export default function Events() {
  const { role } = useProject()
  const { user } = useAuth()
  const { upcoming, past, loading, createEvent, updateEvent, rsvp } = useEvents()
  const [searchParams, setSearchParams] = useSearchParams()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [typeFilter, setTypeFilter] = useState('alles')
  const [tab, setTab] = useState('upcoming') // upcoming | past

  const allEvents = [...upcoming, ...past]
  const activeSelected = selectedEvent ? allEvents.find(e => e.id === selectedEvent.id) || selectedEvent : null

  // Auto-open event from ?open= query param
  useEffect(() => {
    const openId = searchParams.get('open')
    if (openId && allEvents.length > 0 && !selectedEvent) {
      const found = allEvents.find(e => e.id === openId)
      if (found) {
        setSelectedEvent(found)
        setSearchParams({}, { replace: true })
      }
    }
  }, [searchParams, allEvents, selectedEvent, setSearchParams])

  // Filter by visibility — public is voor iedereen, members vereist aspirant+
  const visibleUpcoming = useMemo(() => {
    return upcoming.filter(e => {
      if (!e.visibility || e.visibility === 'public') return true
      return canDo(role, 'view_events')
    })
  }, [upcoming, role])

  const visiblePast = useMemo(() => {
    return past.filter(e => {
      if (!e.visibility || e.visibility === 'public') return true
      return canDo(role, 'view_events')
    })
  }, [past, role])

  const filteredUpcoming = useMemo(() =>
    typeFilter === 'alles' ? visibleUpcoming : visibleUpcoming.filter(e => e.event_type === typeFilter)
  , [visibleUpcoming, typeFilter])

  const filteredPast = useMemo(() =>
    typeFilter === 'alles' ? visiblePast : visiblePast.filter(e => e.event_type === typeFilter)
  , [visiblePast, typeFilter])

  const dateGroups = useMemo(() => groupByDate(filteredUpcoming), [filteredUpcoming])

  function handleEdit(event) {
    setSelectedEvent(null)
    setEditingEvent(event)
  }

  async function handleSaveEdit(data) {
    await updateEvent(editingEvent.id, data)
    setEditingEvent(null)
  }

  return (
    <div className="view-events">
      <div className="view-header">
        <div className="view-header__row">
          <h1>Events</h1>
          {canDo(role, 'create_meeting') && (
            <button className="btn-primary" onClick={() => setModalOpen(true)}>
              <i className="fa-solid fa-plus" /> Nieuw event
            </button>
          )}
        </div>
      </div>

      {/* Tabs + type filter on one row */}
      <div className="events-filter-row">
        <div className="events-tabs">
          <button className={`events-tab ${tab === 'upcoming' ? 'events-tab--active' : ''}`} onClick={() => setTab('upcoming')}>
            Aankomend {visibleUpcoming.length > 0 && <span className="events-tab__count">{visibleUpcoming.length}</span>}
          </button>
          <button className={`events-tab ${tab === 'past' ? 'events-tab--active' : ''}`} onClick={() => setTab('past')}>
            Afgelopen {visiblePast.length > 0 && <span className="events-tab__count">{visiblePast.length}</span>}
          </button>
        </div>

        {(visibleUpcoming.length > 0 || visiblePast.length > 0) && (
          <div className="tag-filter">
            {FILTER_TYPES.map(t => (
              <button
                key={t.key}
                className={`tag-filter__pill ${typeFilter === t.key ? 'tag-filter__pill--active' : ''}`}
                onClick={() => setTypeFilter(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading-inline"><p>Events laden...</p></div>
      ) : tab === 'upcoming' ? (
        dateGroups.length === 0 ? (
          <div className="empty-inline">
            <i className="fa-solid fa-calendar-check" />
            <p>{typeFilter === 'alles' ? 'Geen aankomende events' : 'Geen events van dit type'}</p>
            {canDo(role, 'create_meeting') && typeFilter === 'alles' && (
              <button className="btn-secondary" onClick={() => setModalOpen(true)}>Eerste event aanmaken</button>
            )}
          </div>
        ) : (
          <div className="events-feed">
            {dateGroups.map(group => (
              <div key={group.label} className="events-feed__group">
                <h3 className="events-feed__group-label">{group.label}</h3>
                {group.events.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onRsvp={rsvp}
                    onClick={() => setSelectedEvent(event)}
                  />
                ))}
              </div>
            ))}
          </div>
        )
      ) : (
        filteredPast.length === 0 ? (
          <div className="empty-inline">
            <i className="fa-solid fa-clock-rotate-left" />
            <p>Geen afgelopen events</p>
          </div>
        ) : (
          <div className="events-feed">
            {filteredPast.map(event => (
              <EventCard key={event.id} event={event} onClick={() => setSelectedEvent(event)} />
            ))}
          </div>
        )
      )}

      {modalOpen && (
        <EventModal onSave={createEvent} onClose={() => setModalOpen(false)} />
      )}

      {editingEvent && (
        <EventModal event={editingEvent} onSave={handleSaveEdit} onClose={() => setEditingEvent(null)} />
      )}

      {activeSelected && (
        <EventDetail
          event={activeSelected}
          onClose={() => setSelectedEvent(null)}
          onRsvp={rsvp}
          onEdit={canDo(role, 'create_meeting') ? handleEdit : undefined}
        />
      )}
    </div>
  )
}
