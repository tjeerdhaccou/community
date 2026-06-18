import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useProject } from '../contexts/ProjectContext'
import { useAuth } from '../contexts/AuthContext'
import { canDo } from '../lib/permissions'
import { useConfirm } from './ConfirmDialog'
import { useEventDetail } from '../hooks/useEventDetail'
import { formatFileSize, fileIcon, fileIconColor } from '../lib/constants'
import { openProjectFile } from '../lib/storage'

const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
const MONTHS_SHORT = ['JAN', 'FEB', 'MRT', 'APR', 'MEI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC']
const DAYS_SHORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']

const TABS = [
  { key: 'info', label: 'Info', icon: 'fa-solid fa-circle-info' },
  { key: 'files', label: 'Bestanden', icon: 'fa-solid fa-paperclip' },
  { key: 'actions', label: 'Acties', icon: 'fa-solid fa-list-check' },
]

function buildGoogleCalUrl(event) {
  const date = new Date(event.date)
  const fmt = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const start = fmt(date)
  const end = fmt(new Date(date.getTime() + 2 * 60 * 60 * 1000))
  const loc = event.online_url || event.location || ''
  const params = new URLSearchParams({ action: 'TEMPLATE', text: event.title, dates: `${start}/${end}`, details: event.description || '', location: loc })
  return `https://calendar.google.com/calendar/render?${params}`
}

export default function EventDetail({ event, onClose, onRsvp, onEdit }) {
  const { role } = useProject()
  const [tab, setTab] = useState('info')
  const [attendees, setAttendees] = useState([])
  const [copied, setCopied] = useState(false)

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?event=${event.id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const confirm = useConfirm()
  const detail = useEventDetail(event.id)
  const canEdit = canDo(role, 'create_meeting')

  const date = new Date(event.date)
  const dayName = DAYS_SHORT[date.getDay()]
  const dateStr = `${dayName} ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
  const startTime = date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  const endDate = new Date(date.getTime() + (event.duration_hours || 2) * 60 * 60 * 1000)
  const endTime = endDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  const isPast = date < new Date()

  useEffect(() => {
    async function fetchAttendees() {
      const { data } = await supabase
        .from('event_rsvps')
        .select('status, profile:profiles(id, full_name, avatar_url)')
        .eq('meeting_id', event.id)
        .in('status', ['going', 'maybe'])
      setAttendees(data || [])
    }
    fetchAttendees()
  }, [event.id, event.going_count, event.maybe_count])

  const goingAttendees = attendees.filter(a => a.status === 'going')
  const maybeAttendees = attendees.filter(a => a.status === 'maybe')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="event-detail-card event-detail-card--tabbed" onClick={e => e.stopPropagation()}>
        <div className="modal-detail-actions">
          <button className={copied ? 'btn-icon--success' : ''} onClick={copyLink} title="Link kopiëren" aria-label="Link kopiëren">
            <i className={`fa-solid ${copied ? 'fa-check' : 'fa-link'}`} />
          </button>
          {onEdit && (
            <button onClick={() => onEdit(event)} title="Bewerken" aria-label="Bewerken">
              <i className="fa-solid fa-pen" />
            </button>
          )}
          <button onClick={onClose} aria-label="Sluiten">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Header */}
        <div className="event-detail-topbar">
          <div className="event-card__date-badge event-card__date-badge--lg">
            <span className="event-card__day">{date.getDate()}</span>
            <span className="event-card__month">{MONTHS_SHORT[date.getMonth()]}</span>
          </div>
          <div>
            <h2>{event.title}</h2>
            <div className="event-detail-meta">
              <span><i className="fa-regular fa-calendar" /> {dateStr}</span>
              <span><i className="fa-regular fa-clock" /> {startTime} – {endTime}</span>
              {event.online_url
                ? <span><i className="fa-solid fa-video" /> Online</span>
                : event.location
                  ? <span><i className="fa-solid fa-location-dot" /> {event.location}</span>
                  : null}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="event-tabs">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`event-tab ${tab === t.key ? 'event-tab--active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <i className={t.icon} />
              <span>{t.label}</span>
              {t.key === 'files' && detail.files.length > 0 && (
                <span className="event-tab__count">{detail.files.length}</span>
              )}
              {t.key === 'actions' && detail.actions.length > 0 && (
                <span className="event-tab__count">{detail.actions.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content — fixed min-height */}
        <div className="event-detail-content">
          {tab === 'info' && (
            <InfoTab
              event={event} dateStr={dateStr} isPast={isPast}
              goingAttendees={goingAttendees} maybeAttendees={maybeAttendees}
              onRsvp={onRsvp}
            />
          )}
          {tab === 'files' && (
            <FilesTab
              files={detail.files}
              canEdit={canEdit}
              onUpload={detail.uploadFile}
              onRemove={detail.removeFile}
            />
          )}
          {tab === 'actions' && (
            <ActionsTab
              items={detail.actions}
              canEdit={canEdit}
              onAdd={detail.addAction}
              onToggle={detail.toggleAction}
              onRemove={detail.removeAction}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ===== Info Tab ===== */
function InfoTab({ event, dateStr, isPast, goingAttendees, maybeAttendees, onRsvp }) {
  const rsvpButtons = [
    { status: 'going', label: 'Aanwezig', icon: 'fa-check' },
    { status: 'maybe', label: 'Misschien', icon: 'fa-question' },
    { status: 'not_going', label: 'Niet', icon: 'fa-xmark' },
  ]

  return (
    <div className="event-tab-content">
      {event.image_url && (
        <div className="event-detail-image"><img src={event.image_url} alt={event.title || ''} /></div>
      )}

      {event.online_url && (
        <a href={event.online_url} target="_blank" rel="noopener noreferrer" className="event-online-link">
          <i className="fa-solid fa-video" />
          <span>Deelnemen via {event.online_url.includes('zoom') ? 'Zoom' : event.online_url.includes('meet.google') ? 'Google Meet' : 'link'}</span>
          <i className="fa-solid fa-arrow-up-right-from-square" />
        </a>
      )}

      {event.description && (
        <p className="event-detail-desc">{event.description}</p>
      )}

      <a href={buildGoogleCalUrl(event)} target="_blank" rel="noopener noreferrer" className="event-cal-link">
        <i className="fa-solid fa-calendar-plus" /> Toevoegen aan Google Agenda
      </a>

      <div className="event-detail-stats">
        <div className="event-detail-stat">
          <strong>{event.going_count}</strong><span>Aanwezig</span>
        </div>
        <div className="event-detail-stat">
          <strong>{event.maybe_count}</strong><span>Misschien</span>
        </div>
        {event.max_attendees && (
          <div className="event-detail-stat">
            <strong>{event.max_attendees}</strong><span>Max</span>
          </div>
        )}
      </div>

      {goingAttendees.length > 0 && <AttendeeList title="Aanwezig" attendees={goingAttendees} />}
      {maybeAttendees.length > 0 && <AttendeeList title="Misschien" attendees={maybeAttendees} />}

      {!isPast && (
        <div className="event-detail-rsvp">
          <h4>Ben je erbij?</h4>
          <div className="rsvp-buttons">
            {rsvpButtons.map(btn => (
              <button
                key={btn.status}
                className={`rsvp-btn ${event.my_rsvp === btn.status ? `rsvp-btn--${btn.status}` : ''}`}
                onClick={() => onRsvp(event.id, event.my_rsvp === btn.status ? null : btn.status)}
              >
                <i className={`fa-solid ${btn.icon}`} /> {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AttendeeList({ title, attendees }) {
  return (
    <div className="event-attendees">
      <h4>{title} ({attendees.length})</h4>
      <div className="attendee-avatars">
        {attendees.map(a => (
          <div key={a.profile.id} className="attendee-chip" title={a.profile.full_name}>
            {a.profile.avatar_url
              ? <img src={a.profile.avatar_url} alt={a.profile.full_name || ''} className="attendee-avatar" />
              : <div className="attendee-avatar attendee-avatar--placeholder">{(a.profile.full_name || 'U')[0]}</div>}
            <span>{a.profile.full_name?.split(' ')[0]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ===== Files Tab (agenda, notulen, besluiten, presentaties, overige bestanden) ===== */
const FILE_CATEGORIES = [
  { key: 'agenda', label: 'Agenda', icon: 'fa-solid fa-list-ol' },
  { key: 'minutes', label: 'Notulen', icon: 'fa-solid fa-file-lines' },
  { key: 'presentation', label: 'Presentatie', icon: 'fa-solid fa-presentation-screen' },
  { key: 'attachment', label: 'Bijlage', icon: 'fa-solid fa-paperclip' },
]

function FilesTab({ files, canEdit, onUpload, onRemove }) {
  const confirm = useConfirm()
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [category, setCategory] = useState('attachment')

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    await onUpload(file, category)
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="event-tab-content">
      {files.length === 0 && !canEdit && (
        <p className="event-tab-empty">Nog geen bestanden toegevoegd</p>
      )}

      {files.length > 0 && (
        <div className="file-list">
          {files.map(f => {
            const catInfo = FILE_CATEGORIES.find(c => c.key === f.category) || FILE_CATEGORIES[3]
            return (
              <div key={f.id} className="file-row">
                <i className={fileIcon(f.file_type)} style={{ color: fileIconColor(f.file_type) }} />
                <div className="file-row__info">
                  <a href={f.file_path} onClick={(e) => { e.preventDefault(); openProjectFile(f.file_path) }} target="_blank" rel="noopener noreferrer" className="file-row__name">
                    {f.file_name}
                  </a>
                  <span className="file-row__meta">
                    <span className={`file-row__category file-row__category--${f.category}`}>{catInfo.label}</span>
                    {' · '}{formatFileSize(f.file_size)}
                    {f.uploader && ` · ${f.uploader.full_name}`}
                  </span>
                </div>
                <div className="file-row__actions">
                  <a href={f.file_path} onClick={(e) => { e.preventDefault(); openProjectFile(f.file_path) }} className="file-row__download" title="Download">
                    <i className="fa-solid fa-download" />
                  </a>
                  {canEdit && (
                    <button className="file-row__remove" onClick={async () => { if (await confirm('Dit bestand verwijderen?', { danger: true })) onRemove(f.id, f.file_path) }} title="Verwijder" aria-label="Verwijderen">
                      <i className="fa-solid fa-xmark" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {canEdit && (
        <div className="file-upload-section">
          <div className="file-upload-row">
            <select
              className="file-category-select"
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              {FILE_CATEGORIES.map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            <button
              className="btn-secondary"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <i className="fa-solid fa-cloud-arrow-up" />
              {uploading ? 'Uploaden...' : 'Bestand toevoegen'}
            </button>
          </div>
          <input ref={fileRef} type="file" onChange={handleUpload} style={{ display: 'none' }} />
        </div>
      )}
    </div>
  )
}

/* ===== Actions Tab (todo checklist) ===== */
function ActionsTab({ items, canEdit, onAdd, onToggle, onRemove }) {
  const [text, setText] = useState('')

  async function handleAdd(e) {
    e.preventDefault()
    if (!text.trim()) return
    await onAdd(text.trim())
    setText('')
  }

  const done = items.filter(a => a.is_done)
  const open = items.filter(a => !a.is_done)

  return (
    <div className="event-tab-content">
      {items.length === 0 && !canEdit && (
        <p className="event-tab-empty">Geen actiepunten</p>
      )}

      {open.length > 0 && (
        <div className="action-list">
          {open.map(a => (
            <ActionItem key={a.id} item={a} canEdit={canEdit} onToggle={onToggle} onRemove={onRemove} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <>
          <h4 className="action-section-title">Afgerond ({done.length})</h4>
          <div className="action-list">
            {done.map(a => (
              <ActionItem key={a.id} item={a} canEdit={canEdit} onToggle={onToggle} onRemove={onRemove} />
            ))}
          </div>
        </>
      )}

      {canEdit && (
        <form className="action-add" onSubmit={handleAdd}>
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Nieuw actiepunt toevoegen..."
            aria-label="Nieuw actiepunt"
          />
          <button type="submit" className="btn-small" disabled={!text.trim()} aria-label="Toevoegen">
            <i className="fa-solid fa-plus" />
          </button>
        </form>
      )}
    </div>
  )
}

function ActionItem({ item, canEdit, onToggle, onRemove }) {
  const confirm = useConfirm()
  return (
    <div className={`action-item ${item.is_done ? 'action-item--done' : ''}`}>
      <button className="action-item__check" onClick={() => onToggle(item.id, !item.is_done)} aria-label={item.is_done ? 'Markeer als open' : 'Markeer als afgerond'}>
        <i className={`fa-${item.is_done ? 'solid' : 'regular'} fa-circle-check`} />
      </button>
      <div className="action-item__content">
        <span className="action-item__text">{item.text}</span>
        {item.assignee && (
          <span className="action-item__assignee">
            <i className="fa-solid fa-user" /> {item.assignee.full_name}
          </span>
        )}
        {item.due_date && (
          <span className="action-item__due">
            <i className="fa-regular fa-calendar" /> {new Date(item.due_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
      {canEdit && (
        <button className="action-item__remove" onClick={async () => { if (await confirm('Dit actiepunt verwijderen?', { danger: true })) onRemove(item.id) }} aria-label="Verwijderen">
          <i className="fa-solid fa-xmark" />
        </button>
      )}
    </div>
  )
}
