import { useNavigate } from 'react-router-dom'
import { navColor } from '../lib/navigation'

const DAYS_SHORT = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
const DAYS_LONG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']

function greetingFor(hour) {
  if (hour < 6) return 'Goedenacht'
  if (hour < 12) return 'Goedemorgen'
  if (hour < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`
}

function joinNl(parts) {
  if (parts.length <= 1) return parts
  const out = []
  parts.forEach((p, i) => {
    if (i > 0) out.push(i === parts.length - 1 ? ' en ' : ', ')
    out.push(p)
  })
  return out
}

function eventLead(date, now) {
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOf(date) - startOf(now)) / 86400000)
  if (days === 0) return 'Vandaag'
  if (days === 1) return 'Morgen'
  if (days < 7) return DAYS_LONG[date.getDay()].replace(/^./, (c) => c.toUpperCase())
  return `Op ${date.getDate()} ${MONTHS[date.getMonth()]}`
}

/**
 * Begroeting van het dashboard in de "Fris"-look: de dag groot, en één zin die
 * samenvat wat er voor deze persoon klaarstaat. Elk onderdeel van de zin is
 * een knop naar de plek waar het hoort.
 */
export default function FrisGreeting({ projectName, firstName, basePath, signatureCount, docRequests, paymentCount, unread, nextEvent }) {
  const navigate = useNavigate()
  const now = new Date()
  const go = (to) => navigate(to === '' ? (basePath || '/') : `${basePath}/${to}`)

  const chips = []
  if (paymentCount > 0) chips.push({ key: 'pay', icon: 'fa-euro-sign', color: 'var(--accent-orange)', text: plural(paymentCount, 'betaalverzoek', 'betaalverzoeken'), to: 'mijn-dossier' })
  if (signatureCount > 0) chips.push({ key: 'sig', icon: 'fa-signature', color: navColor('mijn-dossier'), text: plural(signatureCount, 'tekenverzoek', 'tekenverzoeken'), to: 'mijn-dossier' })
  if (docRequests > 0) chips.push({ key: 'doc', icon: 'fa-file-circle-question', color: navColor('mijn-dossier'), text: plural(docRequests, 'documentverzoek', 'documentverzoeken'), to: 'mijn-dossier' })
  if (unread?.updates) chips.push({ key: 'upd', icon: 'fa-bullhorn', color: navColor('updates'), text: 'nieuw projectnieuws', to: 'updates' })
  if (unread?.board) chips.push({ key: 'board', icon: 'fa-thumbtack', color: navColor('community'), text: 'nieuwe berichten op het prikbord', to: 'community' })

  const chipEls = chips.map((c, i) => (
    <button
      key={c.key}
      type="button"
      className="fris-chip"
      style={{ '--fris-delay': `${360 + i * 100}ms` }}
      onClick={() => go(c.to)}
    >
      <i className={`fa-solid ${c.icon} fris-chip__ic`} style={{ color: c.color }} aria-hidden="true" />
      {c.text}
    </button>
  ))

  const eventDate = nextEvent ? new Date(nextEvent.date) : null

  return (
    <header className="fris-greeting">
      <div className="fris-greeting__top">
        <span className="fris-greeting__project">{projectName}</span>
      </div>
      <div className="fris-greeting__day">
        <h1 className="fris-greeting__weekday">
          {DAYS_SHORT[now.getDay()]}
          <span className="fris-greeting__dot" aria-hidden="true" />
        </h1>
        <p className="fris-greeting__date">{now.getDate()} {MONTHS[now.getMonth()]}<br />{now.getFullYear()}</p>
      </div>
      <p className="fris-greeting__sentence">
        {greetingFor(now.getHours())}
        {firstName ? <>, <em className="fris-ink" style={{ '--fris-delay': '240ms' }}>{firstName}</em></> : null}.{' '}
        {chips.length > 0
          ? <>Je hebt {joinNl(chipEls)}.</>
          : <>Je bent helemaal bij.</>}
        {eventDate && (
          <>
            {' '}{eventLead(eventDate, now)} is{' '}
            <button
              type="button"
              className="fris-chip"
              style={{ '--fris-delay': `${360 + chips.length * 100}ms` }}
              onClick={() => navigate(`${basePath}/events?open=${nextEvent.id}`)}
            >
              <i className="fa-solid fa-calendar-check fris-chip__ic" style={{ color: navColor('events') }} aria-hidden="true" />
              {nextEvent.title}
            </button>.
          </>
        )}
      </p>
    </header>
  )
}
