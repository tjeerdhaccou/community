import { useState, useEffect, useRef } from 'react'
import { UPDATE_TAGS, isTouchDevice } from '../lib/constants'
import { uploadImage } from '../lib/storage'
import AudienceSelector from './AudienceSelector'
import ImageCropper from './ImageCropper'

function fileIcon(fileName = '', fileType = '') {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (fileType?.includes('pdf') || ext === 'pdf') return 'fa-file-pdf'
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return 'fa-file-word'
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'fa-file-excel'
  if (['ppt', 'pptx'].includes(ext)) return 'fa-file-powerpoint'
  if (['zip', 'rar'].includes(ext)) return 'fa-file-zipper'
  if (fileType?.startsWith('image/')) return 'fa-file-image'
  return 'fa-file-lines'
}

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UpdateModal({ update, onSave, onClose, onDelete, onAddAttachment, onRemoveAttachment }) {
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
  const [attachments, setAttachments] = useState([]) // existing attachments (edit mode)
  const [pendingFiles, setPendingFiles] = useState([]) // new files chosen, not yet uploaded
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const fileRef = useRef(null)
  const attachmentRef = useRef(null)

  useEffect(() => {
    if (update) {
      setTitle(update.title || '')
      setBody(update.body || '')
      setTag(update.tag || '')
      setIsPublic(update.is_public || false)
      setImageUrl(update.image_url || null)
      setImagePreview(update.image_url || null)
      setAttachments(update.attachments || [])
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

  async function handleAttachmentSelect(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    e.target.value = ''
    if (isEdit && onAddAttachment) {
      // Edit mode: upload immediately so the user sees it in the list
      setUploadingAttachment(true)
      try {
        for (const file of files) {
          const data = await onAddAttachment(update.id, file)
          if (data) setAttachments(prev => [...prev, data])
        }
      } catch (err) {
        alert(err.message || 'Bijlage uploaden mislukt.')
      } finally {
        setUploadingAttachment(false)
      }
    } else {
      // New update: keep files in memory; upload after the update is created
      setPendingFiles(prev => [...prev, ...files])
    }
  }

  function removePendingFile(idx) {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function removeExistingAttachment(att) {
    if (!onRemoveAttachment) return
    try {
      await onRemoveAttachment(update.id, att.id, att.file_path)
      setAttachments(prev => prev.filter(a => a.id !== att.id))
    } catch (err) {
      alert(err.message || 'Bijlage verwijderen mislukt.')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return

    setSaving(true)
    try {
      const saved = await onSave({
        ...(isEdit ? { id: update.id } : {}),
        title: title.trim(),
        body: body.trim(),
        tag: tag || null,
        is_public: isPublic,
        image_url: imageUrl,
      })
      // For new updates: upload any pending attachments now that we have an id.
      const newId = saved?.id || update?.id
      if (!isEdit && pendingFiles.length > 0 && newId && onAddAttachment) {
        for (const file of pendingFiles) {
          try {
            await onAddAttachment(newId, file)
          } catch (err) {
            console.error('Attachment upload failed:', err)
            alert(`Bijlage "${file.name}" uploaden mislukt: ${err.message}`)
          }
        }
      }
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
              autoFocus={!isTouchDevice}
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

          <div className="form-group">
            <label htmlFor="update-tag">Tag</label>
            <select id="update-tag" value={tag} onChange={e => setTag(e.target.value)}>
              <option value="">Geen tag</option>
              {UPDATE_TAGS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <AudienceSelector
            value={isPublic ? 'public' : 'members'}
            onChange={v => setIsPublic(v === 'public')}
          />

          {/* Attachments */}
          {(attachments.length > 0 || pendingFiles.length > 0 || uploadingAttachment) && (
            <div className="form-group">
              <label>Bijlagen</label>
              <div className="update-attachments-list">
                {attachments.map(a => (
                  <div key={a.id} className="update-attachment-row">
                    <i className={`fa-regular ${fileIcon(a.file_name, a.file_type)} update-attachment-row__icon`} />
                    <a href={a.file_path} target="_blank" rel="noopener noreferrer" className="update-attachment-row__name">
                      {a.file_name}
                    </a>
                    <span className="update-attachment-row__size">{formatBytes(a.file_size)}</span>
                    {onRemoveAttachment && (
                      <button
                        type="button"
                        className="update-attachment-row__remove"
                        onClick={() => removeExistingAttachment(a)}
                        aria-label="Verwijderen"
                        title="Verwijderen"
                      >
                        <i className="fa-solid fa-xmark" />
                      </button>
                    )}
                  </div>
                ))}
                {pendingFiles.map((f, i) => (
                  <div key={`pending-${i}`} className="update-attachment-row update-attachment-row--pending">
                    <i className={`fa-regular ${fileIcon(f.name, f.type)} update-attachment-row__icon`} />
                    <span className="update-attachment-row__name">{f.name}</span>
                    <span className="update-attachment-row__size">{formatBytes(f.size)}</span>
                    <button
                      type="button"
                      className="update-attachment-row__remove"
                      onClick={() => removePendingFile(i)}
                      aria-label="Verwijderen"
                      title="Verwijderen"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>
                ))}
                {uploadingAttachment && (
                  <div className="update-attachment-row update-attachment-row--uploading">
                    <i className="fa-solid fa-spinner fa-spin update-attachment-row__icon" />
                    <span className="update-attachment-row__name">Bijlage uploaden...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="modal-actions modal-actions--spread">
            <div className="modal-actions__left">
              <button
                type="button"
                className="btn-icon"
                onClick={() => fileRef.current?.click()}
                title="Afbeelding toevoegen"
                aria-label="Afbeelding toevoegen"
              >
                <i className="fa-solid fa-image" />
              </button>
              <button
                type="button"
                className="btn-icon"
                onClick={() => attachmentRef.current?.click()}
                title="Bijlage toevoegen (PDF, DOC, Excel, etc.)"
                aria-label="Bijlage toevoegen"
                disabled={uploadingAttachment}
              >
                <i className="fa-solid fa-paperclip" />
              </button>
              {isEdit && onDelete && (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => onDelete(update)}
                  title="Verwijderen"
                  style={{ marginLeft: 'var(--space-2)' }}
                >
                  <i className="fa-solid fa-trash" /> Verwijderen
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            <input
              ref={attachmentRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.zip"
              multiple
              onChange={handleAttachmentSelect}
              style={{ display: 'none' }}
            />
            <div className="modal-actions__right">
              <button type="button" className="btn-secondary" onClick={onClose}>Annuleren</button>
              <button type="submit" className="btn-primary" disabled={saving || uploading || uploadingAttachment || !title.trim() || !body.trim()}>
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
