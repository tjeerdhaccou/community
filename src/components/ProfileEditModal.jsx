import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { uploadImage } from '../lib/storage'
import { getIntakeField } from '../lib/intakeFields'
import ImageCropper from './ImageCropper'

const HOUSEHOLD_OPTIONS = getIntakeField('household').options

export default function ProfileEditModal({ profile, onSave, onClose, mandatory = false }) {
  const [fullName, setFullName] = useState(profile.full_name || '')
  const [company, setCompany] = useState(profile.company || '')
  const [phone, setPhone] = useState(profile.phone || '')
  const [website, setWebsite] = useState(profile.website || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [birthYear, setBirthYear] = useState(profile.birth_year || '')
  const [household, setHousehold] = useState(profile.household || '')
  const [housingDream, setHousingDream] = useState(profile.housing_dream || '')
  const [photoUrls, setPhotoUrls] = useState(profile.photo_urls || [])
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || null)
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar_url || null)
  const [uploading, setUploading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const photoRef = useRef(null)

  const [cropSrc, setCropSrc] = useState(null)

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

  async function handleGalleryPhoto(e) {
    const file = e.target.files?.[0]
    if (!file || photoUrls.length >= 6) return
    setUploadingPhoto(true)
    try {
      const url = await uploadImage(file)
      setPhotoUrls(prev => [...prev, url])
    } catch (err) {
      console.error('Gallery photo upload failed:', err)
    } finally {
      setUploadingPhoto(false)
      if (photoRef.current) photoRef.current.value = ''
    }
  }

  function removeGalleryPhoto(index) {
    setPhotoUrls(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!fullName.trim()) return
    setSaving(true)
    try {
      const updates = {
        full_name: fullName.trim(),
        company: company.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        bio: bio.trim() || null,
        birth_year: birthYear ? parseInt(birthYear, 10) : null,
        household: household.trim() || null,
        housing_dream: housingDream.trim() || null,
        photo_urls: photoUrls.length > 0 ? photoUrls : null,
        avatar_url: avatarUrl,
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id)

      if (error) throw error
      onSave({ ...profile, ...updates })
    } catch (err) {
      console.error('Error saving profile:', err)
      alert('Profiel opslaan mislukt.')
    } finally {
      setSaving(false)
    }
  }

  const initials = (fullName || profile.full_name || 'A').split(' ').map(n => n[0]).join('').slice(0, 2)
  const canClose = !mandatory || fullName.trim()
  const handleOverlayClick = canClose ? onClose : undefined
  const handleCloseClick = canClose ? onClose : undefined

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-card modal-card--profile-edit" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mandatory ? 'Vul je profiel aan' : 'Profiel bewerken'}</h2>
          {canClose && (
            <button className="modal-close" onClick={handleCloseClick} aria-label="Sluiten">
              <i className="fa-solid fa-xmark" />
            </button>
          )}
        </div>

        {mandatory && (
          <p className="modal-form__intro">
            Voordat je verder kunt, vragen we je naam. Een profielfoto is optioneel maar maakt je herkenbaar voor de leden van je organisatie.
          </p>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Avatar */}
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

          {/* Naam */}
          <div className="form-group">
            <label htmlFor="prof-name">Naam <span className="form-required">*</span></label>
            <input
              id="prof-name"
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Voornaam Achternaam"
              required
              autoFocus={mandatory}
            />
          </div>

          {/* Bio */}
          <div className="form-group">
            <label htmlFor="prof-bio">Over mij</label>
            <textarea id="prof-bio" value={bio} onChange={e => setBio(e.target.value)} placeholder="Korte beschrijving over jezelf..." rows={2} />
          </div>

          {/* Personal info */}
          <div className="form-row">
            <div className="form-group form-group--half">
              <label htmlFor="prof-birth-year">Geboortejaar</label>
              <input id="prof-birth-year" type="number" value={birthYear} onChange={e => setBirthYear(e.target.value)} placeholder="bijv. 1985" min="1920" max={new Date().getFullYear()} />
            </div>
            <div className="form-group form-group--half">
              <label htmlFor="prof-household">Gezinssamenstelling</label>
              <select id="prof-household" value={household} onChange={e => setHousehold(e.target.value)}>
                <option value="">Kies…</option>
                {HOUSEHOLD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Housing dream */}
          <div className="form-group">
            <label htmlFor="prof-dream">Woondroom</label>
            <textarea id="prof-dream" value={housingDream} onChange={e => setHousingDream(e.target.value)} placeholder="Beschrijf je ideale woonsituatie..." rows={3} />
          </div>

          {/* Company & contact */}
          <div className="form-group">
            <label htmlFor="prof-company">Bedrijf</label>
            <input id="prof-company" type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Bedrijfsnaam" />
          </div>

          <div className="form-row">
            <div className="form-group form-group--half">
              <label htmlFor="prof-phone">Telefoon</label>
              <input id="prof-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+31 6..." />
            </div>
            <div className="form-group form-group--half">
              <label htmlFor="prof-website">Website</label>
              <input id="prof-website" type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
            </div>
          </div>

          {/* Photo gallery */}
          <div className="form-group">
            <label>Foto's <span className="form-hint">({photoUrls.length}/6)</span></label>
            <div className="profile-edit__gallery">
              {photoUrls.map((url, i) => (
                <div key={i} className="profile-edit__gallery-item">
                  <img src={url} alt="" />
                  <button type="button" className="profile-edit__gallery-remove" onClick={() => removeGalleryPhoto(i)} aria-label="Verwijderen">
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              ))}
              {photoUrls.length < 6 && (
                <button type="button" className="profile-edit__gallery-add" onClick={() => photoRef.current?.click()}>
                  {uploadingPhoto ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-plus" />}
                </button>
              )}
            </div>
            <input ref={photoRef} type="file" accept="image/*" onChange={handleGalleryPhoto} style={{ display: 'none' }} />
          </div>

          <div className="modal-actions">
            {canClose && (
              <button type="button" className="btn-secondary" onClick={onClose}>Annuleren</button>
            )}
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || uploading || uploadingPhoto || !fullName.trim()}
            >
              {saving ? 'Opslaan...' : mandatory ? 'Profiel opslaan' : 'Opslaan'}
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
