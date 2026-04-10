import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { uploadImage } from '../lib/storage'
import { isProjectDomain, isOrgDomain } from '../lib/subdomain'

export default function NewProject({ orgId: orgIdProp }) {
  const params = useParams()
  const orgSlug = params.orgSlug
  const orgId = orgIdProp
  const navigate = useNavigate()
  const backPath = isOrgDomain() ? '/' : `/org/${orgSlug || orgId}`

  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const logoRef = useRef(null)

  async function handleLogoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      const url = await uploadImage(file)
      setLogoUrl(url)
    } catch (err) {
      console.error('Logo upload failed:', err)
      setLogoPreview(null)
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    try {
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          organization_id: orgId,
          name: name.trim(),
          location: location.trim() || null,
          tagline: tagline.trim() || null,
          description: description.trim() || null,
          logo_url: logoUrl,
        })
        .select()
        .single()

      if (error) throw error
      navigate(isProjectDomain() ? '/' : `/p/${project.slug || project.id}`)
    } catch (err) {
      console.error('Error creating project:', err)
      alert('Project aanmaken mislukt.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="org-dashboard">
      <header className="org-topbar">
        <div className="org-topbar__left">
          <button className="btn-icon" onClick={() => navigate(backPath)}>
            <i className="fa-solid fa-arrow-left" />
          </button>
          <h1 className="org-topbar__name">Nieuw project</h1>
        </div>
      </header>

      <main className="org-content org-content--narrow">
        <form onSubmit={handleSubmit} className="profile-form">
          {/* Basic info */}
          <div className="profile-section">
            <h3 className="profile-section__title">Project</h3>
            <div className="form-group">
              <label htmlFor="proj-name">Naam *</label>
              <input id="proj-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Projectnaam" required autoFocus />
            </div>
            <div className="form-group">
              <label htmlFor="proj-location">Locatie</label>
              <input id="proj-location" type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Stad, wijk" />
            </div>
            <div className="form-group">
              <label htmlFor="proj-tagline">Tagline</label>
              <input id="proj-tagline" type="text" value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Korte beschrijving" />
            </div>
            <div className="form-group">
              <label htmlFor="proj-desc">Beschrijving</label>
              <textarea id="proj-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Uitgebreide beschrijving..." rows={4} />
            </div>
          </div>

          {/* Logo */}
          <div className="profile-section">
            <h3 className="profile-section__title">Logo</h3>
            <div className="profile-logo-row">
              {logoPreview ? (
                <img src={logoPreview} alt="Project logo" className="profile-logo" />
              ) : (
                <div className="profile-logo profile-logo--placeholder">
                  <i className="fa-solid fa-image" />
                </div>
              )}
              <button type="button" className="btn-secondary btn-sm" onClick={() => logoRef.current?.click()}>
                {uploading ? 'Uploaden...' : 'Logo uploaden'}
              </button>
              <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoSelect} style={{ display: 'none' }} />
            </div>
          </div>

          {/* Submit */}
          <div className="profile-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate(backPath)}>Annuleren</button>
            <button type="submit" className="btn-primary" disabled={saving || uploading || !name.trim()}>
              {saving ? 'Aanmaken...' : 'Project aanmaken'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
