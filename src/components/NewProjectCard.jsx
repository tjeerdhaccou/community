import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { uploadImage } from '../lib/storage'
import { useAuth } from '../contexts/AuthContext'
import ImageCropper from './ImageCropper'

export default function NewProjectCard({ orgId, onCreated, onCancel }) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [coverUrl, setCoverUrl] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [saving, setSaving] = useState(false)
  const logoRef = useRef(null)
  const coverRef = useRef(null)

  const [cropSrc, setCropSrc] = useState(null)
  const [cropAspect, setCropAspect] = useState(1)
  const [cropRound, setCropRound] = useState(false)
  const [cropTarget, setCropTarget] = useState(null)

  function handleLogoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
    setCropAspect(1)
    setCropRound(false)
    setCropTarget('logo')
    e.target.value = ''
  }

  function handleCoverSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
    setCropAspect(16 / 9)
    setCropRound(false)
    setCropTarget('cover')
    e.target.value = ''
  }

  async function handleCropComplete(blob) {
    const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' })
    setCropSrc(null)

    if (cropTarget === 'logo') {
      setLogoPreview(URL.createObjectURL(blob))
      setUploadingLogo(true)
      try { setLogoUrl(await uploadImage(file)) }
      catch { setLogoPreview(null) }
      finally { setUploadingLogo(false) }
    } else if (cropTarget === 'cover') {
      setCoverPreview(URL.createObjectURL(blob))
      setUploadingCover(true)
      try { setCoverUrl(await uploadImage(file)) }
      catch { setCoverPreview(null) }
      finally { setUploadingCover(false) }
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          organization_id: orgId,
          name: name.trim(),
          slug,
          location: location.trim() || null,
          tagline: tagline.trim() || null,
          description: description.trim() || null,
          logo_url: logoUrl,
          cover_image_url: coverUrl,
        })
        .select()
        .single()
      if (error) throw error

      // Auto-add creator as admin member
      await supabase.from('memberships').insert({
        profile_id: user.id,
        project_id: project.id,
        role: 'admin',
      })

      // Setup subdomain in background (non-blocking)
      supabase.functions.invoke('setup-project-domain', {
        body: { slug, project_id: project.id },
      }).catch(err => console.warn('Domain setup deferred:', err))

      onCreated()
    } catch (err) {
      console.error('Error creating project:', err)
    } finally {
      setSaving(false)
    }
  }

  const uploading = uploadingLogo || uploadingCover

  return (
    <div className="org-project-card org-project-card--new">
      <div className="org-project-card__body">
        <div className="org-project-card__top">
          <div className="org-project-card__header">
            <div className="org-project-card__logo org-project-card__logo--placeholder">
              <i className="fa-solid fa-plus" />
            </div>
            <div className="org-project-card__info">
              <h3 className="org-project-card__name">Nieuw project</h3>
            </div>
          </div>
          <div className="org-project-card__actions">
            <button className="org-project-card__action-btn" onClick={onCancel} title="Annuleren" aria-label="Sluiten">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        </div>
      </div>

      <form className="org-project-card__edit" onSubmit={handleSave}>
        <div className="org-edit__section">
          <h4 className="org-edit__title"><i className="fa-solid fa-circle-info" style={{ color: 'var(--accent-primary)' }} /> Project informatie</h4>
          <div className="org-edit__grid">
            <div className="form-group">
              <label>Naam *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Projectnaam" required autoFocus />
            </div>
            <div className="form-group">
              <label>Locatie</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Stad, wijk" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Tagline</label>
              <input type="text" value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Korte beschrijving" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Beschrijving</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Uitgebreide beschrijving" />
            </div>
          </div>
        </div>

        <div className="org-edit__section">
          <h4 className="org-edit__title"><i className="fa-solid fa-image" style={{ color: 'var(--accent-purple)' }} /> Afbeeldingen</h4>
          <div className="org-edit__grid">
            <div className="form-group">
              <label>Project logo</label>
              <div className="org-edit__image-row">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="org-edit__logo-preview" />
                ) : (
                  <div className="org-edit__logo-preview org-edit__logo-preview--empty">
                    <i className="fa-solid fa-building" />
                  </div>
                )}
                <div className="org-edit__image-actions">
                  <button type="button" className="btn-secondary btn-sm" onClick={() => logoRef.current?.click()} disabled={uploadingLogo}>
                    {uploadingLogo ? 'Uploaden...' : 'Logo kiezen'}
                  </button>
                </div>
              </div>
              <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoSelect} style={{ display: 'none' }} />
            </div>
            <div className="form-group">
              <label>Cover afbeelding</label>
              <div className="org-edit__image-row">
                {coverPreview ? (
                  <img src={coverPreview} alt="Cover" className="org-edit__cover-preview" />
                ) : (
                  <div className="org-edit__cover-preview org-edit__cover-preview--empty">
                    <i className="fa-solid fa-panorama" />
                  </div>
                )}
                <div className="org-edit__image-actions">
                  <button type="button" className="btn-secondary btn-sm" onClick={() => coverRef.current?.click()} disabled={uploadingCover}>
                    {uploadingCover ? 'Uploaden...' : 'Cover kiezen'}
                  </button>
                </div>
              </div>
              <input ref={coverRef} type="file" accept="image/*" onChange={handleCoverSelect} style={{ display: 'none' }} />
            </div>
          </div>
        </div>

        <div className="org-edit__footer">
          <button type="button" className="btn-secondary" onClick={onCancel}>Annuleren</button>
          <button type="submit" className="btn-primary" disabled={saving || uploading || !name.trim()}>
            {saving ? 'Aanmaken...' : 'Project aanmaken'}
          </button>
        </div>

        {cropSrc && (
          <ImageCropper
            imageSrc={cropSrc}
            aspect={cropAspect}
            round={cropRound}
            onComplete={handleCropComplete}
            onCancel={() => setCropSrc(null)}
          />
        )}
      </form>
    </div>
  )
}
