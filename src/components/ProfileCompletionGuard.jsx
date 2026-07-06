import { useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { uploadImage } from '../lib/storage'
import { logAudit } from '../lib/audit'
import { CONSENT_VERSION } from '../lib/constants'
import ImageCropper from './ImageCropper'

export default function ProfileCompletionGuard({ children }) {
  const { profile, reload } = useAuth()
  const [completed, setCompleted] = useState(false)

  if (completed || !profile) return children

  // Bewust minimaal: we vragen alleen voor- en achternaam, zodat niemand
  // anoniem in de community staat. Het platform dwingt verder niets af —
  // het verrijken van het profiel (adres, huishouden, motivatie) loopt via
  // een intake-formulier dat de initiatiefnemer zelf op een gekozen moment
  // verstuurt. full_name dekt bestaande accounts af zonder gesplitste naam.
  const hasName = !!(profile.first_name?.trim() || profile.full_name?.trim())
  const hasLastName = !!profile.last_name?.trim()
  // AVG: expliciete toestemming op de actuele versie van de voorwaarden.
  const hasConsent = !!profile.terms_accepted_at && profile.terms_version === CONSENT_VERSION
  const needsCompletion = !hasName || !hasLastName || !hasConsent

  if (!needsCompletion) return children

  return (
    <ProfileCompletionModal
      profile={profile}
      onComplete={() => { reload(); setCompleted(true) }}
    />
  )
}

function ProfileCompletionModal({ profile, onComplete }) {
  // full_name terugsplitsen voor bestaande accounts zonder first/last.
  const nameParts = (profile.full_name || '').trim().split(' ')
  const [firstName, setFirstName] = useState(profile.first_name || nameParts[0] || '')
  const [lastName, setLastName] = useState(profile.last_name || nameParts.slice(1).join(' ') || '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || null)
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar_url || null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [cropSrc, setCropSrc] = useState(null)
  const alreadyConsented = !!profile.terms_accepted_at && profile.terms_version === CONSENT_VERSION
  const [consent, setConsent] = useState(alreadyConsented)
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

  const canSubmit = firstName.trim() && lastName.trim() && consent

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const fn = firstName.trim()
      const ln = lastName.trim()
      const { error: err } = await supabase
        .from('profiles')
        .update({
          first_name: fn,
          last_name: ln,
          full_name: `${fn} ${ln}`.trim(),
          avatar_url: avatarUrl,
          terms_accepted_at: new Date().toISOString(),
          terms_version: CONSENT_VERSION,
        })
        .eq('id', profile.id)

      if (err) throw err
      logAudit('user.consent_accepted', 'profile', { resourceId: profile.id, version: CONSENT_VERSION })
      onComplete()
    } catch (err) {
      console.error('Error saving profile:', err)
      setError('Profiel opslaan mislukt. Probeer het opnieuw.')
    } finally {
      setSaving(false)
    }
  }

  const initials = `${firstName} ${lastName}`.trim().split(' ').map(n => n[0]).join('').slice(0, 2) || 'A'

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-card modal-card--profile-edit" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Welkom! Maak je profiel aan</h2>
        </div>

        <p className="modal-form__intro">
          Hoe mogen we je noemen? Met je naam weten de andere leden wie je bent.
          De rest van je profiel vul je later in je eigen tempo aan.
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

          <div className="form-row">
            <div className="form-group form-group--half">
              <label htmlFor="guard-first">Voornaam <span className="form-required">*</span></label>
              <input
                id="guard-first"
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Voornaam"
                required
                autoFocus
              />
            </div>
            <div className="form-group form-group--half">
              <label htmlFor="guard-last">Achternaam <span className="form-required">*</span></label>
              <input
                id="guard-last"
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Achternaam"
                required
              />
            </div>
          </div>

          <label className="guard-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
            />
            <span>
              Ik ga akkoord met de{' '}
              <a href="/voorwaarden" target="_blank" rel="noopener noreferrer">algemene voorwaarden</a>{' '}
              en de{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">privacyverklaring</a>.
            </span>
          </label>

          {error && <p style={{ color: 'var(--accent-red)', fontSize: '14px' }}>{error}</p>}

          <div className="modal-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || uploading || !canSubmit}
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
