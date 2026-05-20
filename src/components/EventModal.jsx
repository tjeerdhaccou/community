import { useState, useRef, useEffect } from 'react'
import { uploadPostImage } from '../hooks/usePosts'
import { EVENT_TYPES } from '../lib/constants'
import AudienceSelector from './AudienceSelector'
import { useToast } from './Toast'

const DRAFT_KEY = 'ev-draft-new'

export default function EventModal({ event, onSave, onClose, onDelete }) {
  const isEdit = !!event

  // Parse existing event data for edit mode
  const existingDate = event ? new Date(event.date) : null
  const existingDateStr = existingDate ? existingDate.toISOString().split('T')[0] : ''
  const existingTime = existingDate ? existingDate.toTimeString().slice(0, 5) : ''
  const existingEndDate = existingDate && event?.duration_hours
    ? new Date(existingDate.getTime() + event.duration_hours * 60 * 60 * 1000)
    : null
  const existingEndTime = existingEndDate ? existingEndDate.toTimeString().slice(0, 5) : ''

  // For new events: restore draft from localStorage if available
  const draft = !isEdit ? (() => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') } catch { return null } })() : null

  const [title, setTitle] = useState(draft?.title ?? event?.title ?? '')
  const [description, setDescription] = useState(draft?.description ?? event?.description ?? '')
  const [eventType, setEventType] = useState(draft?.eventType ?? event?.event_type ?? 'overig')
  const [date, setDate] = useState(draft?.date ?? existingDateStr)
  const [time, setTime] = useState(draft?.time ?? existingTime)
  const [endTime, setEndTime] = useState(draft?.endTime ?? existingEndTime)
  const [locationType, setLocationType] = useState(draft?.locationType ?? (event?.online_url ? 'online' : 'physical'))
  const [location, setLocation] = useState(draft?.location ?? event?.location ?? '')
  const [onlineUrl, setOnlineUrl] = useState(draft?.onlineUrl ?? event?.online_url ?? '')
  const [maxAttendees, setMaxAttendees] = useState(draft?.maxAttendees ?? (event?.max_attendees ? String(event.max_attendees) : ''))
  const [visibility, setVisibility] = useState(draft?.visibility ?? event?.visibility ?? 'members')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(event?.image_url || null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const mouseDownOnOverlay = useRef(false)
  const draftTimerRef = useRef(null)
  const toast = useToast()

  // Persist draft to localStorage with debounce (new events only)
  useEffect(() => {
    if (isEdit) return
    clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, description, eventType, date, time, endTime, locationType, location, onlineUrl, maxAttendees, visibility }))
    }, 400)
    return () => clearTimeout(draftTimerRef.current)
  }, [isEdit, title, description, eventType, date, time, endTime, locationType, location, onlineUrl, maxAttendees, visibility])

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY)
  }

  // Track object URLs we create so we can revoke them to prevent memory leaks
  const objectUrlRef = useRef(null)

  function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setImageFile(file)
    setImagePreview(url)
  }

  // Revoke object URL on unmount
  useEffect(() => {
    return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current) }
  }, [])

  function removeImage() {
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null }
    setImageFile(null)
    setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || !date) return

    setSaving(true)
    try {
      let image_url = isEdit ? event.image_url : null
      if (imageFile) {
        image_url = await uploadPostImage(imageFile)
      } else if (!imagePreview) {
        image_url = null // user removed the image
      }

      const dateTime = time ? `${date}T${time}` : `${date}T00:00`

      // Calculate duration from start/end time
      let durationHours = 2
      if (time && endTime) {
        const [sh, sm] = time.split(':').map(Number)
        const [eh, em] = endTime.split(':').map(Number)
        durationHours = Math.max(0.5, (eh * 60 + em - sh * 60 - sm) / 60)
      }

      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        date: dateTime,
        location: locationType === 'physical' ? location.trim() || null : (locationType === 'online' ? 'Online' : null),
        online_url: locationType === 'online' ? onlineUrl.trim() || null : null,
        max_attendees: maxAttendees ? parseInt(maxAttendees) : null,
        duration_hours: durationHours,
        event_type: eventType,
        visibility,
        image_url,
      })
      clearDraft()
      onClose()
    } catch (err) {
      console.error('Error saving event:', err)
      toast.error(err.message || 'Er ging iets mis bij het opslaan.')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    clearDraft()
    onClose()
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={e => { mouseDownOnOverlay.current = e.target === e.currentTarget }}
      onClick={e => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) handleCancel() }}
    >
      <div className="modal-card modal-card--event">
        <div className="modal-header">
          <h2>{isEdit ? 'Event bewerken' : 'Nieuw event'}</h2>
          <button className="modal-close" onClick={handleCancel} aria-label="Sluiten">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Titel</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Naam van het event" required autoFocus />
          </div>

          <div className="form-group">
            <label>Type</label>
            <select value={eventType} onChange={e => setEventType(e.target.value)}>
              {EVENT_TYPES.map(t => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>

          <AudienceSelector value={visibility} onChange={setVisibility} />


          <div className="form-group">
            <label>Beschrijving</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Waar gaat het event over?" rows={3} />
          </div>

          <div className="form-group">
            <label>Datum</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="form-row">
            <div className="form-group form-group--half">
              <label>Begintijd</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
            <div className="form-group form-group--half">
              <label>Eindtijd</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>

          {/* Location type toggle */}
          <div className="form-group">
            <label>Type locatie</label>
            <div className="location-toggle">
              <button type="button" className={`location-toggle__btn ${locationType === 'physical' ? 'location-toggle__btn--active' : ''}`} onClick={() => setLocationType('physical')}>
                <i className="fa-solid fa-location-dot" /> Fysiek
              </button>
              <button type="button" className={`location-toggle__btn ${locationType === 'online' ? 'location-toggle__btn--active' : ''}`} onClick={() => setLocationType('online')}>
                <i className="fa-solid fa-video" /> Online
              </button>
            </div>
          </div>

          {locationType === 'physical' ? (
            <div className="form-group">
              <label>Adres</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Straat, stad" />
            </div>
          ) : (
            <div className="form-group">
              <label>Meeting link</label>
              <input type="url" value={onlineUrl} onChange={e => setOnlineUrl(e.target.value)} placeholder="https://meet.google.com/... of https://zoom.us/..." />
            </div>
          )}

          <div className="form-group">
            <label>Max. deelnemers</label>
            <input type="number" value={maxAttendees} onChange={e => setMaxAttendees(e.target.value)} placeholder="Onbeperkt" min={1} />
          </div>

          {/* Image */}
          <div className="form-group">
            <label>Afbeelding</label>
            {imagePreview ? (
              <div className="post-image-preview">
                <img src={imagePreview} alt="Preview" />
                <button type="button" className="post-image-remove" onClick={removeImage} aria-label="Verwijderen">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            ) : (
              <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
                <i className="fa-solid fa-image" /> Afbeelding toevoegen
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />

          <div className="modal-actions">
            {isEdit && onDelete && (
              <button
                type="button"
                className="btn-danger"
                onClick={() => onDelete(event)}
                style={{ marginRight: 'auto' }}
              >
                <i className="fa-solid fa-trash" /> Verwijderen
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={handleCancel}>Annuleren</button>
            <button type="submit" className="btn-primary" disabled={saving || !title.trim() || !date}>
              {saving ? 'Opslaan...' : isEdit ? 'Opslaan' : 'Aanmaken'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
