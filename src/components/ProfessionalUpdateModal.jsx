import { useState, useEffect, useRef } from 'react'
import { uploadImage, uploadFile } from '../lib/storage'
import { formatFileSize, PROJECT_PHASES, isTouchDevice } from '../lib/constants'
import ImageCropper from './ImageCropper'

export default function ProfessionalUpdateModal({ update, activePhase, onSave, onClose }) {
  const isEdit = !!update?.id
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [phase, setPhase] = useState(activePhase || 'ALG')
  const [imageUrl, setImageUrl] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const imageRef = useRef(null)
  const fileRef = useRef(null)
  const [cropSrc, setCropSrc] = useState(null)

  useEffect(() => {
    if (update) {
      setTitle(update.title || '')
      setBody(update.body || '')
      setPhase(update.phase || activePhase || 'ALG')
      setImageUrl(update.image_url || null)
      setImagePreview(update.image_url || null)
    }
  }, [update, activePhase])

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
      console.error('Image upload failed:', err)
      setImagePreview(null)
    } finally {
      setUploading(false)
    }
  }

  function removeImage() {
    setImageUrl(null)
    setImagePreview(null)
    if (imageRef.current) imageRef.current.value = ''
  }

  async function handleFilesSelect(e) {
    const newFiles = Array.from(e.target.files || [])
    if (!newFiles.length) return

    const additions = newFiles.map(f => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: f,
      file_name: f.name,
      file_size: f.size,
      file_type: f.type,
      uploading: true,
      file_path: null,
    }))

    setPendingFiles(prev => [...prev, ...additions])

    for (const item of additions) {
      try {
        const { path } = await uploadFile(item.file)
        setPendingFiles(prev =>
          prev.map(f => f.id === item.id ? { ...f, uploading: false, file_path: path } : f)
        )
      } catch (err) {
        console.error('File upload failed:', err)
        setPendingFiles(prev => prev.filter(f => f.id !== item.id))
      }
    }

    if (fileRef.current) fileRef.current.value = ''
  }

  function removePendingFile(id) {
    setPendingFiles(prev => prev.filter(f => f.id !== id))
  }

  const anyUploading = uploading || pendingFiles.some(f => f.uploading)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    try {
      const files = pendingFiles
        .filter(f => f.file_path)
        .map(f => ({
          file_name: f.file_name,
          file_path: f.file_path,
          file_size: f.file_size,
          file_type: f.file_type,
        }))

      await onSave({
        ...(isEdit ? { id: update.id } : {}),
        title: title.trim(),
        body: body.trim(),
        phase,
        image_url: imageUrl,
        files,
      })
      onClose()
    } catch (err) {
      console.error('Error saving:', err)
      alert('Er ging iets mis bij het opslaan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card--lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Update bewerken' : 'Nieuwe update'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Sluiten">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Phase selector */}
          <div className="form-group">
            <label>Fase</label>
            <div className="phase-select">
              {PROJECT_PHASES.map(p => (
                <button
                  key={p.key}
                  type="button"
                  className={`phase-select__btn ${phase === p.key ? 'phase-select__btn--active' : ''}`}
                  onClick={() => setPhase(p.key)}
                >
                  {p.short}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="pro-title">Titel</label>
            <input
              id="pro-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Titel van de update"
              required
              autoFocus={!isTouchDevice}
            />
          </div>

          <div className="form-group">
            <label htmlFor="pro-body">Toelichting</label>
            <textarea
              id="pro-body"
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Beschrijf de update..."
              rows={4}
            />
          </div>

          {imagePreview ? (
            <div className="post-image-preview">
              <img src={imagePreview} alt="Preview" />
              <button type="button" className="post-image-remove" onClick={removeImage} aria-label="Verwijderen">
                <i className="fa-solid fa-xmark" />
              </button>
              {uploading && <div className="post-image-uploading">Uploaden...</div>}
            </div>
          ) : null}

          {pendingFiles.length > 0 && (
            <div className="pending-files">
              {pendingFiles.map(f => (
                <div key={f.id} className="pending-file">
                  <i className="fa-solid fa-file pending-file__icon" />
                  <span className="pending-file__name">{f.file_name}</span>
                  <span className="pending-file__size">{formatFileSize(f.file_size)}</span>
                  {f.uploading ? (
                    <span className="pending-file__status">Uploaden...</span>
                  ) : (
                    <button type="button" className="pending-file__remove" onClick={() => removePendingFile(f.id)} aria-label="Verwijderen">
                      <i className="fa-solid fa-xmark" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="modal-actions modal-actions--spread">
            <div className="modal-actions__left">
              <button type="button" className="btn-icon" onClick={() => imageRef.current?.click()} title="Afbeelding" aria-label="Afbeelding toevoegen">
                <i className="fa-solid fa-image" />
              </button>
              <button type="button" className="btn-icon" onClick={() => fileRef.current?.click()} title="Bestanden" aria-label="Bestanden toevoegen">
                <i className="fa-solid fa-paperclip" />
              </button>
            </div>
            <input ref={imageRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
            <input ref={fileRef} type="file" multiple onChange={handleFilesSelect} style={{ display: 'none' }} />
            <div className="modal-actions__right">
              <button type="button" className="btn-secondary" onClick={onClose}>Annuleren</button>
              <button type="submit" className="btn-primary" disabled={saving || anyUploading || !title.trim()}>
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
