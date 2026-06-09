import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { uploadImage } from '../lib/storage'
import ImageCropper from './ImageCropper'
import { useRef } from 'react'

export default function ProfileCompletionGuard({ children }) {
  const { profile, reload } = useAuth()
  const [completed, setCompleted] = useState(false)

  if (completed || !profile) return children

  const needsCompletion = !profile.full_name?.trim()

  if (!needsCompletion) return children

  return (
    <ProfileCompletionModal
      profile={profile}
      onComplete={() => { reload(); setCompleted(true) }}
    />
  )
}

function ProfileCompletionModal({ profile, onComplete }) {
  const [fullName, setFullName] = useState(profile.full_name || '')
  const [phone, setPhone] = useState(profile.phone || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || null)
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar_url || null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [cropSrc, setCropSrc] = useState(null)
  const fileRef = useRef(null)

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
    e.target.value = ''
  }

  async function handleCropComplete(blob) {
    const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' })
    setCropSrc(null)
    setAvatarPreview(URL.createObjectURL(blob))
    setUploading(true)
    try {
      const url = await uploadImage(file)
      setAvatarUrl(url)
    } catch (err) {
      console.error('Photo upload failed:', err)
      setAvatarPreview(profile.avatar_url || null)
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!fullName.trim()) return
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          bio: bio.trim() || null,
          avatar_url: avatarUrl,
        })
        .eq('id', profile.id)

      if (err) throw err
      onComplete()
    } catch (err) {
      console.error('Error saving profile:', err)
      setError('Profiel opslaan mislukt. Probeer het opnieuw.')
    } finally {
      setSaving(false)
    }
  }

  const initials = (fullName || 'A').split(' ').map(n => n[0]).join('').slice(0, 2)

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-card modal-card--profile-edit" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Welkom! Maak je profiel aan</h2>
        </div>

        <p className="modal-form__intro">
          Voordat je verder kunt, vragen we je om je profiel in te vullen. Zo weten de andere leden wie je bent.
        </p>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="profile-edit__avatar-row">
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="profile-edit__avatar" />
            ) : (
              <div className="profile-edit__avatar profile-edit__avatar--placeholder">{initials}</div>
            )}
            <button type="button" className="btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
              {uploading ? 'Uploaden...' : avatarPreview ? 'Foto wijzigen' : 'Foto toevoegen'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />
          </div>

          <div className="form-group">
            <label htmlFor="guard-name">Naam <span className="form-required">*</span></label>
            <input
              id="guard-name"
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Voornaam Achternaam"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="guard-phone">Telefoonnummer</label>
            <input
              id="guard-phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+31 6..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="guard-bio">Stel je kort voor</label>
            <textarea
              id="guard-bio"
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Wie ben je en wat breng je mee?"
              rows={2}
            />
          </div>

          {error && <p style={{ color: 'var(--accent-red)', fontSize: '14px' }}>{error}</p>}

          <div className="modal-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || uploading || !fullName.trim()}
            >
              {saving ? 'Opslaan...' : 'Profiel opslaan en verder'}
            </button>
          </div>
        </form>

        {cropSrc && (
          <ImageCropper
            imageSrc={cropSrc}
            aspect={1}
            round={true}
            onComplete={handleCropComplete}
            onCancel={() => setCropSrc(null)}
          />
        )}
      </div>
    </div>
  )
}
