import { useState, useRef } from 'react'
import { uploadPostImage } from '../hooks/usePosts'
import { POST_TAGS, isTouchDevice } from '../lib/constants'
import { useProject } from '../contexts/ProjectContext'
import { useWorkgroups } from '../hooks/useWorkgroups'
import AudienceSelector from './AudienceSelector'
import ImageCropper from './ImageCropper'

const GUEST_TAG = 'Even voorstellen'

export default function PostModal({ onSave, onClose, editPost }) {
  const { role } = useProject()
  const { myWorkgroups } = useWorkgroups()
  const isGuest = role === 'guest'
  const isEdit = !!editPost
  const [text, setText] = useState(editPost?.text || '')
  const [tag, setTag] = useState(editPost?.tag || (isGuest ? GUEST_TAG : ''))
  const [audience, setAudience] = useState(editPost?.audience || (isGuest ? 'public' : 'members'))
  const [workgroupId, setWorkgroupId] = useState(editPost?.workgroup_id || null)
  const [postType, setPostType] = useState(editPost?.post_type || 'post')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [cropSrc, setCropSrc] = useState(null)
  const fileRef = useRef(null)

  function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
    e.target.value = ''
  }

  function handleCropComplete(blob) {
    const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' })
    setCropSrc(null)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(blob))
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function updatePollOption(index, value) {
    setPollOptions(prev => prev.map((o, i) => i === index ? value : o))
  }

  function addPollOption() {
    if (pollOptions.length < 6) setPollOptions(prev => [...prev, ''])
  }

  function removePollOption(index) {
    if (pollOptions.length > 2) setPollOptions(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim()) return
    if (postType === 'poll' && pollOptions.filter(o => o.trim()).length < 2) return
    if (audience === 'workgroup' && !workgroupId) return

    setSaving(true)
    try {
      let image_url = null
      if (imageFile) {
        image_url = await uploadPostImage(imageFile)
      }
      await onSave({
        text: text.trim(),
        tag: tag || null,
        audience,
        workgroup_id: audience === 'workgroup' ? workgroupId : null,
        image_url,
        post_type: postType,
        poll_options: postType === 'poll' ? pollOptions.filter(o => o.trim()) : null,
      })
      onClose()
    } catch (err) {
      console.error('Error saving post:', err)
      alert('Er ging iets mis bij het plaatsen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card--composer" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Bericht bewerken' : (isGuest ? 'Stel jezelf voor' : 'Nieuw bericht')}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Sluiten">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Guests: helper-tekst */}
          {isGuest && !isEdit && (
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: 0 }}>
              Vertel de community kort iets over jezelf. Iedereen kan dit bericht lezen.
            </p>
          )}

          {/* Post type toggle (not for edit, not for guests) */}
          {!isEdit && !isGuest && (
            <div className="composer-type-toggle">
              <button
                type="button"
                className={`composer-type-btn ${postType === 'post' ? 'composer-type-btn--active' : ''}`}
                onClick={() => setPostType('post')}
              >
                <i className="fa-solid fa-pen" /> Bericht
              </button>
              <button
                type="button"
                className={`composer-type-btn ${postType === 'poll' ? 'composer-type-btn--active' : ''}`}
                onClick={() => setPostType('poll')}
              >
                <i className="fa-solid fa-square-poll-vertical" /> Poll
              </button>
            </div>
          )}

          {/* Tag chips (alleen voor aspirant+; guests posten verplicht onder 'Even voorstellen') */}
          {!isGuest && (
            <div className="post-tag-select">
              {POST_TAGS.map(t => (
                <button
                  key={t}
                  type="button"
                  className={`post-tag-option ${tag === t ? 'post-tag-option--active' : ''}`}
                  onClick={() => setTag(tag === t ? '' : t)}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* Audience (alleen voor aspirant+; guests posten verplicht 'public') */}
          {!isGuest && (
            <AudienceSelector
              value={audience}
              onChange={setAudience}
              workgroups={myWorkgroups}
              workgroupId={workgroupId}
              onWorkgroupChange={setWorkgroupId}
            />
          )}

          {/* Text */}
          <div className="form-group">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={postType === 'poll' ? 'Stel je vraag aan de community...' : 'Wat wil je delen met de community?'}
              rows={3}
              required
              autoFocus={!isTouchDevice}
            />
          </div>

          {/* Poll options */}
          {postType === 'poll' && (
            <div className="composer-poll">
              {pollOptions.map((opt, i) => (
                <div key={i} className="composer-poll__row">
                  <input
                    type="text"
                    value={opt}
                    onChange={e => updatePollOption(i, e.target.value)}
                    placeholder={`Optie ${i + 1}`}
                    className="composer-poll__input"
                  />
                  {pollOptions.length > 2 && (
                    <button type="button" className="composer-poll__remove" onClick={() => removePollOption(i)} aria-label="Verwijderen">
                      <i className="fa-solid fa-xmark" />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 6 && (
                <button type="button" className="btn-ghost" onClick={addPollOption}>
                  <i className="fa-solid fa-plus" /> Optie toevoegen
                </button>
              )}
            </div>
          )}

          {/* Image preview */}
          {imagePreview && (
            <div className="post-image-preview">
              <img src={imagePreview} alt="Preview" />
              <button type="button" className="post-image-remove" onClick={removeImage} aria-label="Verwijderen">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          )}

          {/* Bottom actions */}
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
              <button type="submit" className="btn-primary" disabled={saving || !text.trim() || (audience === 'workgroup' && !workgroupId)}>
                {saving ? (isEdit ? 'Opslaan...' : 'Plaatsen...') : (isEdit ? 'Opslaan' : 'Plaatsen')}
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
