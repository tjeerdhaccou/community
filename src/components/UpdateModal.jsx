import { useState, useEffect, useRef } from 'react'
import { UPDATE_TAGS } from '../lib/constants'
import { uploadImage } from '../lib/storage'
import ImageCropper from './ImageCropper'

export default function UpdateModal({ update, onSave, onClose }) {
  const isEdit = !!update?.id
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tag, setTag] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [imageUrl, setImageUrl] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cropSrc, setCropSrc] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (update) {
      setTitle(update.title || '')
      setBody(update.body || '')
      setTag(update.tag || '')
      setIsPublic(update.is_public || false)
      setImageUrl(update.image_url || null)
      setImagePreview(update.image_url || null)
    }
  }, [update])

  function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
    e.target.value = ''
  }

  async function handleCropComplete(blob) {
    const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' })
    setCropSrc(null)
    setImagePreview(URL.createObjectURL(blob))
    setUploading(true)
    try {
      const url = await uploadImage(file)
      setImageUrl(url)
    } catch (err) {
      console.error('Error uploading image:', err)
      alert('Afbeelding uploaden mislukt.')
      setImagePreview(null)
    } finally {
      setUploading(false)
    }
  }

  function removeImage() {
    setImageUrl(null)
    setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return

    setSaving(true)
    try {
      await onSave({
        ...(isEdit ? { id: update.id } : {}),
        title: title.trim(),
        body: body.trim(),
        tag: tag || null,
        is_public: isPublic,
        image_url: imageUrl,
      })
      onClose()
    } catch (err) {
      console.error('Error saving update:', err)
      alert('Er ging iets mis bij het opslaan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Update bewerken' : 'Nieuwe update'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Sluiten">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="update-title">Titel</label>
            <input
              id="update-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Titel van de update"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="update-body">Bericht</label>
            <textarea
              id="update-body"
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Schrijf hier je update..."
              rows={5}
              required
            />
          </div>

          {/* Image preview or upload */}
          {imagePreview ? (
            <div className="post-image-preview">
              <img src={imagePreview} alt="Preview" />
              <button type="button" className="post-image-remove" onClick={removeImage} aria-label="Verwijderen">
                <i className="fa-solid fa-xmark" />
              </button>
              {uploading && <div className="post-image-uploading">Uploaden...</div>}
            </div>
          ) : null}

          <div className="form-row">
            <div className="form-group form-group--half">
              <label htmlFor="update-tag">Tag</label>
              <select id="update-tag" value={tag} onChange={e => setTag(e.target.value)}>
                <option value="">Geen tag</option>
                {UPDATE_TAGS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="form-group form-group--half">
              <label>Zichtbaarheid</label>
              <button
                type="button"
                className={`toggle-btn ${isPublic ? 'toggle-btn--active' : ''}`}
                onClick={() => setIsPublic(!isPublic)}
              >
                <i className={`fa-solid ${isPublic ? 'fa-eye' : 'fa-lock'}`} />
                {isPublic ? 'Openbaar' : 'Alleen leden'}
              </button>
            </div>
          </div>

          <div className="modal-actions modal-actions--spread">
            <button
              type="button"
              className="btn-icon"
              onClick={() => fileRef.current?.click()}
              title="Afbeelding toevoegen"
              aria-label="Afbeelding toevoegen"
            >
              <i className="fa-solid fa-image" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            <div className="modal-actions__right">
              <button type="button" className="btn-secondary" onClick={onClose}>Annuleren</button>
              <button type="submit" className="btn-primary" disabled={saving || uploading || !title.trim() || !body.trim()}>
                {saving ? 'Opslaan...' : isEdit ? 'Opslaan' : 'Publiceren'}
              </button>
            </div>
          </div>
        </form>

        {cropSrc && (
          <ImageCropper
            imageSrc={cropSrc}
            aspect={16 / 9}
            round={false}
            onComplete={handleCropComplete}
            onCancel={() => setCropSrc(null)}
          />
        )}
      </div>
    </div>
  )
}
