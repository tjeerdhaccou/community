import { EVENT_TYPE_MAP, EVENT_VISIBILITY_MAP, tagStyle } from '../lib/constants'

const MONTHS_SHORT = ['JAN', 'FEB', 'MRT', 'APR', 'MEI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC']
const DAYS_SHORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']

export default function EventCard({ event, onRsvp, onClick }) {
  const date = new Date(event.date)
  const day = date.getDate()
  const month = MONTHS_SHORT[date.getMonth()]
  const dayName = DAYS_SHORT[date.getDay()]
  const startTime = date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  const endDate = new Date(date.getTime() + (event.duration_hours || 2) * 60 * 60 * 1000)
  const endTime = endDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  const isPast = date < new Date()
  const typeInfo = EVENT_TYPE_MAP[event.event_type]
  const visInfo = EVENT_VISIBILITY_MAP[event.visibility]

  const shortLocation = event.location
    ? event.location.split(',').slice(0, 1).join('').trim()
    : null

  const goingRsvps = (event.event_rsvps || []).filter(r => r.status === 'going')
  const avatarsToShow = goingRsvps.slice(0, 4)
  const extraCount = goingRsvps.length - avatarsToShow.length
  const spotsLeft = event.max_attendees ? event.max_attendees - (event.going_count || 0) : null
  const almostFull = spotsLeft !== null && spotsLeft <= 3 && spotsLeft > 0

  function handleQuickRsvp(e) {
    e.stopPropagation()
    if (!onRsvp) return
    if (event.my_rsvp === 'going') {
      onRsvp(event.id, null)
    } else {
      onRsvp(event.id, 'going')
    }
  }

  return (
    <article className={`event-card ${isPast ? 'event-card--past' : ''}`} onClick={onClick}>
      {/* Date badge */}
      <div className="event-card__date-col">
        <div className="event-card__date-badge">
          <span className="event-card__day">{day}</span>
          <span className="event-card__month">{month}</span>
        </div>
      </div>

      {/* Content */}
      <div className="event-card__body">
        {/* Top: title + meta + tags */}
        <h3 className="event-card__title">{event.title}</h3>

        <p className="event-card__meta-line">
          {dayName} {startTime}–{endTime}
          {event.online_url ? ' · Online' : shortLocation ? ` · ${shortLocation}` : ''}
        </p>

        <div className="event-card__tags">
          {typeInfo && (
            <span className="event-card__type-tag" style={tagStyle(typeInfo.color)}>
              {typeInfo.label}
            </span>
          )}
          {visInfo && event.visibility !== 'members' && (
            <span className="event-card__vis-tag">
              <i className={visInfo.icon} /> {event.visibility === 'public' ? 'Publiek' : 'Aspirant+'}
            </span>
          )}
          {almostFull && (
            <span className="event-card__spots-tag">
              Nog {spotsLeft} {spotsLeft === 1 ? 'plek' : 'plekken'}
            </span>
          )}
        </div>

        {/* Bottom: avatars + count pill left, rsvp right */}
        <div className="event-card__footer">
          <div className="event-card__footer-left">
            {avatarsToShow.length > 0 && (
              <div className="event-card__avatar-stack">
                {avatarsToShow.map((r, i) => (
                  r.profile?.avatar_url ? (
                    <img key={i} src={r.profile.avatar_url} alt="" className="event-card__avatar" />
                  ) : (
                    <div key={i} className="event-card__avatar event-card__avatar--placeholder">
                      {(r.profile?.full_name || '?')[0]}
                    </div>
                  )
                ))}
                {extraCount > 0 && (
                  <div className="event-card__avatar event-card__avatar--more">+{extraCount}</div>
                )}
              </div>
            )}
            <span className="event-card__count-pill">
              <i className="fa-solid fa-user" />
              {event.going_count || 0}{event.max_attendees ? ` / ${event.max_attendees}` : ''}
            </span>
            {event.file_count > 0 && (
              <span className="event-card__docs">
                <i className="fa-solid fa-paperclip" /> {event.file_count}
              </span>
            )}
          </div>

          {!isPast && (
            <button
              className={`event-card__rsvp-btn ${event.my_rsvp === 'going' ? 'event-card__rsvp-btn--going' : ''}`}
              onClick={handleQuickRsvp}
            >
              {event.my_rsvp === 'going' ? (
                <><i className="fa-solid fa-circle-check" /> Aangemeld</>
              ) : (
                <><i className="fa-solid fa-circle-plus" /> Aanmelden</>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
