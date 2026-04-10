import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { uploadImage } from '../lib/storage'
import { getIntakeUrl, getPublicSiteUrl, getProjectBaseUrl } from '../lib/subdomain'
import useIntakeQuestions from '../hooks/useIntakeQuestions'
import IntakeQuestionEditor from './IntakeQuestionEditor'

export default function ProjectDashboardCard({ project, onSaved }) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)

  const admins = project.admins || []

  return (
    <div className="org-project-card">
      <div className="org-project-card__body" onClick={() => window.location.href = getProjectBaseUrl({ ...project, id: project.project_id })}>
        {/* Section 1: Header — logo, naam, locatie + actions rechtsboven */}
        <div className="org-project-card__top">
          <div className="org-project-card__header">
            {project.project_logo_url ? (
              <img src={project.project_logo_url} alt={project.project_name ? project.project_name + ' logo' : ''} className="org-project-card__logo" />
            ) : (
              <div className="org-project-card__logo org-project-card__logo--placeholder">
                {(project.project_name || 'P')[0]}
              </div>
            )}
            <div className="org-project-card__info">
              <h3 className="org-project-card__name">{project.project_name}</h3>
              <div className="org-project-card__meta">
                {project.project_location && (
                  <span className="org-project-card__location">
                    <i className="fa-solid fa-location-dot" /> {project.project_location}
                  </span>
                )}
                {project.project_tagline && (
                  <span className="org-project-card__tagline">{project.project_tagline}</span>
                )}
              </div>
            </div>
          </div>
          <div className="org-project-card__actions" onClick={e => e.stopPropagation()}>
            <button className="org-project-card__action-btn" onClick={() => setEditing(!editing)} title="Instellingen">
              <i className="fa-solid fa-gear" />
            </button>
            <button className="org-project-card__action-btn" onClick={() => window.location.href = getProjectBaseUrl({ ...project, id: project.project_id })} title="Naar project">
              <i className="fa-solid fa-arrow-right" />
            </button>
          </div>
        </div>

        {/* Section 2: Admins + Stats — same row */}
        <div className="org-project-card__bottom">
          {admins.length > 0 && (
            <div className="org-project-card__admins">
              <div className="org-project-card__admin-avatars">
                {admins.slice(0, 4).map((a, i) => (
                  a.avatar_url
                    ? <img key={i} src={a.avatar_url} alt={a.full_name} className="org-project-card__admin-avatar" />
                    : <div key={i} className="org-project-card__admin-avatar org-project-card__admin-avatar--placeholder">
                        {(a.full_name || '?')[0]}
                      </div>
                ))}
              </div>
              <span className="org-project-card__admin-names">
                {admins.slice(0, 3).map(a => a.full_name?.split(' ')[0]).join(', ')}
                {admins.length > 3 && ` +${admins.length - 3}`}
              </span>
            </div>
          )}
          <div className="org-project-card__stats">
            <Stat icon="fa-solid fa-users" color="var(--accent-primary)" value={project.member_count} trend={project.new_members_week} label="Leden" />
            <Stat icon="fa-solid fa-bullhorn" color="var(--accent-yellow)" value={project.update_count} trend={project.new_updates_week} label="Updates" />
            <Stat icon="fa-solid fa-comments" color="var(--accent-green)" value={project.post_count} trend={project.new_posts_week} label="Posts" />
            <Stat icon="fa-solid fa-helmet-safety" color="var(--accent-orange)" value={project.advisor_count} label="Adviseurs" />
          </div>
        </div>
      </div>

      {/* Expandable edit section */}
      {editing && (
        <ProjectEditForm
          project={project}
          onClose={() => setEditing(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}

function Stat({ icon, color, value, trend, label }) {
  return (
    <div className="org-project-card__stat">
      <i className={icon} style={{ color }} />
      <span className="org-project-card__stat-value">{value || 0}</span>
      {trend > 0 && <span className="org-project-card__stat-trend">+{trend}</span>}
      <span className="org-project-card__stat-label">{label}</span>
    </div>
  )
}

function ProjectEditForm({ project, onClose, onSaved }) {
  const [name, setName] = useState(project.project_name || '')
  const [tagline, setTagline] = useState(project.project_tagline || '')
  const [location, setLocation] = useState(project.project_location || '')
  const [description, setDescription] = useState(project.project_description || '')
  const [logoUrl, setLogoUrl] = useState(project.project_logo_url || '')
  const [logoPreview, setLogoPreview] = useState(project.project_logo_url || '')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [coverImageUrl, setCoverImageUrl] = useState(project.project_cover_image_url || '')
  const [coverPreview, setCoverPreview] = useState(project.project_cover_image_url || '')
  const [uploadingCover, setUploadingCover] = useState(false)
  const [intakeEnabled, setIntakeEnabled] = useState(project.intake_enabled || false)
  const [intakeIntro, setIntakeIntro] = useState(project.intake_intro_text || '')
  const [isPublic, setIsPublic] = useState(project.is_public || false)
  const [slug, setSlug] = useState(project.slug || '')
  const [publicDescription, setPublicDescription] = useState(project.public_description || '')
  const [publicContactEmail, setPublicContactEmail] = useState(project.public_contact_email || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const logoRef = useRef(null)
  const coverRef = useRef(null)
  const { questions, addQuestion, updateQuestion, deleteQuestion, reorderQuestions } = useIntakeQuestions(project.project_id)

  async function handleLogoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoPreview(URL.createObjectURL(file))
    setUploadingLogo(true)
    try {
      const url = await uploadImage(file)
      setLogoUrl(url)
    } catch (err) {
      console.error('Logo upload failed:', err)
      setLogoPreview(logoUrl || '')
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleCoverSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverPreview(URL.createObjectURL(file))
    setUploadingCover(true)
    try {
      const url = await uploadImage(file)
      setCoverImageUrl(url)
    } catch (err) {
      console.error('Cover upload failed:', err)
      setCoverPreview(coverImageUrl || '')
    } finally {
      setUploadingCover(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase
      .from('projects')
      .update({
        name, tagline, location, description,
        logo_url: logoUrl || null,
        cover_image_url: coverImageUrl || null,
        intake_enabled: intakeEnabled,
        intake_intro_text: intakeIntro.trim() || null,
        is_public: isPublic,
        slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') || null,
        public_description: publicDescription.trim() || null,
        public_contact_email: publicContactEmail.trim() || null,
      })
      .eq('id', project.project_id)

    if (error) {
      console.error('Error saving:', error)
    } else {
      setSaved(true)
      setTimeout(() => { setSaved(false); onSaved?.() }, 1500)
    }
    setSaving(false)
  }

  const intakeUrl = getIntakeUrl({ ...project, id: project.project_id })

  return (
    <form className="org-project-card__edit" onSubmit={handleSave}>
      {/* Project info */}
      <div className="org-edit__section">
        <h4 className="org-edit__title"><i className="fa-solid fa-circle-info" style={{ color: 'var(--accent-primary)' }} /> Project informatie</h4>
        <div className="org-edit__grid">
          <div className="form-group">
            <label>Naam</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Locatie</label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Stad, buurt" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Tagline</label>
            <input type="text" value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Korte omschrijving" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Beschrijving</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Uitgebreide beschrijving" />
          </div>
        </div>
      </div>

      {/* Afbeeldingen */}
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
                  {uploadingLogo ? 'Uploaden...' : logoPreview ? 'Wijzigen' : 'Logo kiezen'}
                </button>
                {logoPreview && (
                  <button type="button" className="btn-secondary btn-sm" onClick={() => { setLogoUrl(''); setLogoPreview('') }} style={{ color: 'var(--accent-red)' }}>
                    Verwijderen
                  </button>
                )}
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
                  {uploadingCover ? 'Uploaden...' : coverPreview ? 'Wijzigen' : 'Cover kiezen'}
                </button>
                {coverPreview && (
                  <button type="button" className="btn-secondary btn-sm" onClick={() => { setCoverImageUrl(''); setCoverPreview('') }} style={{ color: 'var(--accent-red)' }}>
                    Verwijderen
                  </button>
                )}
              </div>
            </div>
            <input ref={coverRef} type="file" accept="image/*" onChange={handleCoverSelect} style={{ display: 'none' }} />
          </div>
        </div>
      </div>

      {/* Intake */}
      <div className="org-edit__section">
        <h4 className="org-edit__title"><i className="fa-solid fa-clipboard-list" style={{ color: 'var(--accent-orange)' }} /> Intake formulier</h4>
        <label className="intake-toggle">
          <input type="checkbox" checked={intakeEnabled} onChange={e => setIntakeEnabled(e.target.checked)} />
          <span>Intake formulier actief</span>
        </label>
        {intakeEnabled && (
          <div className="org-edit__grid" style={{ marginTop: 16 }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Formulier URL</label>
              <div className="intake-url-row">
                <input type="text" readOnly value={intakeUrl} className="intake-url-input" />
                <button type="button" className="btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(intakeUrl)}>
                  <i className="fa-solid fa-copy" /> Kopieer
                </button>
              </div>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Introductietekst</label>
              <textarea value={intakeIntro} onChange={e => setIntakeIntro(e.target.value)} rows={2} placeholder="Welkomstbericht boven het formulier..." />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Vragen</label>
              <IntakeQuestionEditor
                questions={questions}
                onAdd={addQuestion}
                onUpdate={updateQuestion}
                onDelete={deleteQuestion}
                onReorder={reorderQuestions}
              />
            </div>
          </div>
        )}
      </div>

      {/* Publieke pagina */}
      <div className="org-edit__section">
        <h4 className="org-edit__title"><i className="fa-solid fa-globe" style={{ color: 'var(--accent-green)' }} /> Publieke projectpagina</h4>
        <p className="form-hint" style={{ marginBottom: 12 }}>
          Een openbare pagina voor omwonenden en geïnteresseerden.
        </p>
        <label className="intake-toggle">
          <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
          <span>Publieke pagina actief</span>
        </label>
        {isPublic && (
          <div className="org-edit__grid" style={{ marginTop: 16 }}>
            <div className="form-group">
              <label>URL-slug</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>/project/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="vlinderhaven"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Contact e-mail (publiek)</label>
              <input
                type="email"
                value={publicContactEmail}
                onChange={e => setPublicContactEmail(e.target.value)}
                placeholder="info@project.nl"
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Publieke beschrijving</label>
              <textarea
                value={publicDescription}
                onChange={e => setPublicDescription(e.target.value)}
                placeholder="Korte beschrijving voor bezoekers die het project nog niet kennen..."
                rows={3}
              />
              <span className="form-hint">Laat leeg om de standaard projectbeschrijving te gebruiken.</span>
            </div>
            {slug && (
              <p style={{ gridColumn: '1 / -1', fontSize: 13, color: 'var(--text-tertiary)' }}>
                <i className="fa-solid fa-link" style={{ marginRight: 6 }} />
                Pagina zichtbaar op: <strong>{getPublicSiteUrl({ ...project, slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') })}</strong>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="org-edit__footer">
        <button type="button" className="btn-secondary" onClick={onClose}>Annuleren</button>
        <button type="submit" className="btn-primary" disabled={saving || uploadingCover}>
          {saving ? 'Opslaan...' : saved ? '✓ Opgeslagen' : 'Wijzigingen opslaan'}
        </button>
      </div>
    </form>
  )
}
