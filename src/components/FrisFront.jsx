import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import { navColor } from '../lib/navigation'
import { timeAgo } from '../lib/constants'
import BuuurWord from './BuuurWord'

const DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
const DAYS_SHORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']

function greetingFor(hour) {
  if (hour < 6) return 'Goedenacht'
  if (hour < 12) return 'Goedemorgen'
  if (hour < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t - yearStart) / 86400000 + 1) / 7)
}

function relativeDay(date, now) {
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOf(date) - startOf(now)) / 86400000)
  if (days === 0) return 'Vandaag'
  if (days === 1) return 'Morgen'
  if (days < 7) return DAYS[date.getDay()].replace(/^./, (c) => c.toUpperCase())
  return null
}

const pad = (n) => String(n).padStart(2, '0')

/**
 * Voorpagina van het dashboard in de "Fris"-look, opgezet als buurtkrant:
 * kop met projectnaam, een openingsalinea, een genummerde inhoudsopgave van
 * wat er voor jou klaarligt en een agenda-kolom.
 */
export default function FrisFront({ project, phaseName, firstName, basePath, actionItems, feed }) {
  const navigate = useNavigate()
  const now = new Date()
  const [agenda, setAgenda] = useState([])

  useEffect(() => {
    if (!project?.id) return
    let stale = false
    const until = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14)
    supabase
      .from('meetings')
      .select('id, title, date, location')
      .eq('project_id', project.id)
      .gte('date', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString())
      .lt('date', until.toISOString())
      .order('date', { ascending: true })
      .limit(5)
      .then(({ data, error }) => {
        if (stale) return
        if (error) { logger.error('FrisFront: agenda laden mislukt', error); return }
        setAgenda(data || [])
      })
    return () => { stale = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id])

  const go = (to) => navigate(to === '' ? (basePath || '/') : `${basePath}/${to}`)

  const index = actionItems.map((a) => ({
    key: a.id,
    kicker: a.kicker || 'Voor jou',
    color: a.color || navColor('mijn-dossier'),
    title: a.title,
    sub: a.subtitle,
    onClick: a.onClick,
    onDismiss: a.onDismiss,
  }))
  if (feed.latestUpdate) {
    index.push({ key: 'upd', kicker: 'Projectnieuws', color: navColor('updates'), title: feed.latestUpdate.title, sub: `${feed.latestUpdate.author?.full_name || ''} · ${timeAgo(feed.latestUpdate.created_at)}`, onClick: () => go('updates') })
  }
  if (feed.latestPosts?.[0]) {
    const p = feed.latestPosts[0]
    const text = p.text || ''
    index.push({ key: 'post', kicker: 'Prikbord', color: navColor('community'), title: text.length > 90 ? `${text.slice(0, 90)}…` : text, sub: `${p.author?.full_name || 'Een buur'} · ${timeAgo(p.created_at)}`, onClick: () => go('community') })
  }
  if (feed.newMembers?.length > 0) {
    const names = feed.newMembers.slice(0, 3).map((m) => (m.profile?.full_name || '').split(' ')[0]).filter(Boolean)
    if (names.length) {
      index.push({ key: 'members', kicker: 'Nieuwe buren', color: navColor('members'), title: `Welkom ${names.join(', ').replace(/, ([^,]*)$/, ' en $1')}`, sub: 'Zeg even hallo', onClick: () => go('members') })
    }
  }

  const waiting = actionItems.length
  const nextSoon = agenda.find((e) => relativeDay(new Date(e.date), now))
  const lead = [
    `${greetingFor(now.getHours())}${firstName ? `, ${firstName}` : ''}.`,
    waiting === 0
      ? 'Er ligt niets op je te wachten, dus lees rustig bij.'
      : waiting === 1
        ? 'Er ligt één ding voor je klaar.'
        : `Er liggen ${waiting} dingen voor je klaar.`,
  ]

  return (
    <div className="fris-front">
      <header className="fris-mast">
        <div className="fris-mast__kicker">
          <span className="fris-mast__hey">Hé <BuuurWord /></span>
          <span className="fris-mast__week">week {isoWeek(now)}</span>
        </div>
        <h1 className="fris-mast__title">{project.name}</h1>
        <p className="fris-mast__edition">
          {DAYS[now.getDay()]} {now.getDate()} {MONTHS[now.getMonth()]} {now.getFullYear()}
          {phaseName && <> · fase {phaseName}</>}
        </p>
      </header>

      <p className="fris-lead">
        {lead.join(' ')}
        {nextSoon && <> {relativeDay(new Date(nextSoon.date), now)} is <em>{nextSoon.title}</em>.</>}
      </p>

      <div className="fris-cols">
        <section className="fris-col" aria-labelledby="fris-index-h">
          <h2 id="fris-index-h" className="fris-col__head">In deze editie</h2>
          {index.length === 0 ? (
            <p className="fris-empty">Nog geen nieuws. Het eerste bericht op het prikbord maakt de krant.</p>
          ) : (
            <ol className="fris-index">
              {index.map((it, i) => (
                <li key={it.key} className="fris-index__item" style={{ '--fris-delay': `${200 + i * 60}ms` }}>
                  <button type="button" className="fris-index__btn" onClick={it.onClick}>
                    <span className="fris-index__num" style={{ color: it.color }}>{pad(i + 1)}</span>
                    <span className="fris-index__body">
                      <span className="fris-index__kicker">{it.kicker}</span>
                      <span className="fris-index__title">{it.title}</span>
                      {it.sub && <span className="fris-index__sub">{it.sub}</span>}
                    </span>
                    <i className="fa-solid fa-arrow-right fris-index__arrow" aria-hidden="true" />
                  </button>
                  {it.onDismiss && (
                    <button type="button" className="fris-index__dismiss" onClick={it.onDismiss} aria-label="Verbergen" title="Verbergen">
                      <i className="fa-solid fa-xmark" />
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="fris-col fris-col--side" aria-labelledby="fris-agenda-h">
          <h2 id="fris-agenda-h" className="fris-col__head">Agenda</h2>
          {agenda.length === 0 ? (
            <p className="fris-empty">De komende twee weken staat er niets gepland.</p>
          ) : (
            <ul className="fris-agenda">
              {agenda.map((e, i) => {
                const d = new Date(e.date)
                return (
                  <li key={e.id} style={{ '--fris-delay': `${260 + i * 60}ms` }}>
                    <button type="button" className="fris-agenda__btn" onClick={() => navigate(`${basePath}/events?open=${e.id}`)}>
                      <span className="fris-agenda__date">
                        <span className="fris-agenda__dow">{DAYS_SHORT[d.getDay()]}</span>
                        <span className="fris-agenda__day">{d.getDate()}</span>
                      </span>
                      <span className="fris-agenda__body">
                        <span className="fris-agenda__title">{e.title}</span>
                        <span className="fris-agenda__meta">
                          {d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                          {e.location && ` · ${e.location}`}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <button type="button" className="fris-more" onClick={() => go('events')}>
            Hele agenda <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </button>
        </section>
      </div>
    </div>
  )
}
