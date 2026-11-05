import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import { navColor } from '../lib/navigation'

const LABELS = ['MA', 'DI', 'WO', 'DO', 'VR', 'ZA', 'ZO']
const DAYS_LONG = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']

function startOfWeek(d) {
  const day = (d.getDay() + 6) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
}

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/**
 * Weekstrip van de "Fris"-look: maandag t/m zondag van deze week, een stip op
 * dagen met een event, en onder de strip wat er op de gekozen dag gepland staat.
 */
export default function FrisWeek({ projectId, basePath }) {
  const navigate = useNavigate()
  const today = useMemo(() => new Date(), [])
  const monday = useMemo(() => startOfWeek(today), [today])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)), [monday])
  const todayIndex = days.findIndex((d) => sameDay(d, today))
  const [selected, setSelected] = useState(todayIndex)
  const [flip, setFlip] = useState(0)
  const [events, setEvents] = useState([])

  useEffect(() => {
    if (!projectId) return
    let stale = false
    const end = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7)
    supabase
      .from('meetings')
      .select('id, title, date, location')
      .eq('project_id', projectId)
      .gte('date', monday.toISOString())
      .lt('date', end.toISOString())
      .order('date', { ascending: true })
      .then(({ data, error }) => {
        if (stale) return
        if (error) { logger.error('FrisWeek: events laden mislukt', error); return }
        setEvents(data || [])
      })
    return () => { stale = true }
  }, [projectId, monday])

  const dayEvents = events.filter((e) => sameDay(new Date(e.date), days[selected]))

  function pick(i) {
    if (i === selected) return
    setSelected(i)
    setFlip((f) => f + 1)
  }

  return (
    <section className="fris-week" aria-label="Deze week">
      <div className="fris-week__strip" role="tablist">
        <span className="fris-week__marker" style={{ '--slot': selected }} aria-hidden="true" />
        {days.map((d, i) => {
          const hasEvent = events.some((e) => sameDay(new Date(e.date), d))
          return (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === selected}
              aria-label={`${DAYS_LONG[i]} ${d.getDate()}${hasEvent ? ', er is iets gepland' : ''}`}
              className={`fris-week__day ${i === selected ? 'fris-week__day--selected' : ''} ${i === todayIndex ? 'fris-week__day--today' : ''}`}
              onClick={() => pick(i)}
            >
              <span className="fris-week__num">{d.getDate()}</span>
              <span className="fris-week__label">{LABELS[i]}</span>
              <span className={`fris-week__dot ${hasEvent ? 'fris-week__dot--on' : ''}`} style={{ '--dot-c': navColor('events') }} />
            </button>
          )
        })}
      </div>

      <div className={`fris-week__list ${flip % 2 ? 'fris-week__list--b' : ''}`} role="tabpanel">
        {dayEvents.length === 0 ? (
          <p className="fris-week__empty">
            {selected === todayIndex ? 'Vandaag' : `Op ${DAYS_LONG[selected]}`} staat er niets gepland.
          </p>
        ) : (
          dayEvents.map((e, i) => (
            <button
              key={e.id}
              type="button"
              className="fris-week__row"
              style={{ '--fris-delay': `${i * 50}ms` }}
              onClick={() => navigate(`${basePath}/events?open=${e.id}`)}
            >
              <i className="fa-solid fa-calendar-check fris-week__ic" style={{ color: navColor('events') }} aria-hidden="true" />
              <span className="fris-week__title">{e.title}</span>
              <span className="fris-week__meta">
                {new Date(e.date).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <i className="fa-solid fa-chevron-right fris-week__chev" aria-hidden="true" />
            </button>
          ))
        )}
      </div>
    </section>
  )
}
