import { useState, useEffect, useRef } from 'react'
import { useProject } from '../contexts/ProjectContext'
import { supabase } from '../lib/supabase'
import { uploadImage } from '../lib/storage'
import { getIntakeUrl, getPublicSiteUrl } from '../lib/subdomain'
import useIntakeQuestions from '../hooks/useIntakeQuestions'
import IntakeQuestionEditor from '../components/IntakeQuestionEditor'
import ImageCropper from '../components/ImageCropper'

export default function Settings() {
  const { project, milestones, loading: projectLoading } = useProject()
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#4A90D9')
  const [accentColor, setAccentColor] = useState('#3BD269')
  const [defaultTheme, setDefaultTheme] = useState('light')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [coverPreview, setCoverPreview] = useState('')
  const [uploadingCover, setUploadingCover] = useState(false)
  const coverRef = useRef(null)
  const [intakeEnabled, setIntakeEnabled] = useState(false)
  const [intakeIntro, setIntakeIntro] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [slug, setSlug] = useState('')
  const [publicDescription, setPublicDescription] = useState('')
  const [publicContactEmail, setPublicContactEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { questions, addQuestion, updateQuestion, deleteQuestion, reorderQuestions } = useIntakeQuestions(project?.id)

  useEffect(() => {
    if (project) {
      setName(project.name || '')
      setTagline(project.tagline || '')
      setLocation(project.location || '')
      setDescription(project.description || '')
      setPrimaryColor(project.brand_primary_color || '#4A90D9')
      setAccentColor(project.brand_accent_color || '#3BD269')
      setDefaultTheme(project.default_theme || 'light')
      setCoverImageUrl(project.cover_image_url || '')
      setCoverPreview(project.cover_image_url || '')
      setIntakeEnabled(project.intake_enabled || false)
      setIntakeIntro(project.intake_intro_text || '')
      setIsPublic(project.is_public || false)
      setSlug(project.slug || '')
      setPublicDescription(project.public_description || '')
      setPublicContactEmail(project.public_contact_email || '')
    }
  }, [project])

  const [cropSrc, setCropSrc] = useState(null)
  const [cropAspect, setCropAspect] = useState(16 / 9)
  const [cropRound, setCropRound] = useState(false)
  const [cropTarget, setCropTarget] = useState(null) // 'cover'

  function handleCoverSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
    setCropAspect(16 / 9)
    setCropRound(false)
    setCropTarget('cover')
    e.target.value = '' // reset file input
  }

  async function handleCropComplete(blob) {
    const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' })
    setCropSrc(null)

    if (cropTarget === 'cover') {
      setCoverPreview(URL.createObjectURL(blob))
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
  }

  function handleRemoveCover() {
    setCoverImageUrl('')
    setCoverPreview('')
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)

    const { error } = await supabase
      .from('projects')
      .update({
        name, tagline, location, description,
        brand_primary_color: primaryColor,
        brand_accent_color: accentColor,
        default_theme: defaultTheme,
        cover_image_url: coverImageUrl || null,
        intake_enabled: intakeEnabled,
        intake_intro_text: intakeIntro.trim() || null,
        is_public: isPublic,
        slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') || null,
        public_description: publicDescription.trim() || null,
        public_contact_email: publicContactEmail.trim() || null,
      })
      .eq('id', project.id)

    if (error) {
      console.error('Error saving settings:', error)
      alert('Er ging iets mis bij het opslaan.')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  if (projectLoading) return <div className="loading-inline"><p>Laden...</p></div>

  return (
    <div className="view-settings">
      <div className="view-header">
        <h1>Instellingen</h1>
      </div>

      <form onSubmit={handleSave} className="settings-form">
        {/* Project info */}
        <section className="settings-section">
          <h2>Project informatie</h2>

          <div className="form-group">
            <label>Naam</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div className="form-group">
            <label>Tagline</label>
            <input type="text" value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Korte omschrijving" />
          </div>

          <div className="form-group">
            <label>Locatie</label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Stad, buurt" />
          </div>

          <div className="form-group">
            <label>Beschrijving</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="Uitgebreide beschrijving van het project" />
          </div>
        </section>

        {/* Branding */}
        <section className="settings-section">
          <h2>Branding</h2>

          <div className="form-group" style={{ marginBottom: 24 }}>
            <label>Standaard thema</label>
            <div className="theme-select">
              {[
                { value: 'light', icon: 'fa-sun', label: 'Licht' },
                { value: 'warm', icon: 'fa-cloud-sun', label: 'Warm' },
                { value: 'dark', icon: 'fa-moon', label: 'Donker' },
                { value: 'contrast', icon: 'fa-eye', label: 'Hoog contrast' },
              ].map(t => (
                <button
                  key={t.value}
                  type="button"
                  className={`theme-select__btn ${defaultTheme === t.value ? 'theme-select__btn--active' : ''}`}
                  onClick={() => setDefaultTheme(t.value)}
                >
                  <i className={`fa-solid ${t.icon}`} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Cover afbeelding</label>
            <p className="form-hint">Wordt getoond op de aanmeldpagina en het intake formulier.</p>
            {coverPreview ? (
              <div className="settings-cover-preview">
                <img src={coverPreview} alt="Cover preview" />
                <div className="settings-cover-preview__actions">
                  <button type="button" className="btn-secondary btn-sm" onClick={() => coverRef.current?.click()} disabled={uploadingCover}>
                    {uploadingCover ? 'Uploaden...' : 'Wijzigen'}
                  </button>
                  <button type="button" className="btn-secondary btn-sm" onClick={handleRemoveCover} style={{ color: 'var(--accent-red)' }}>
                    Verwijderen
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn-secondary" onClick={() => coverRef.current?.click()} disabled={uploadingCover}>
                <i className="fa-solid fa-image" /> {uploadingCover ? 'Uploaden...' : 'Cover afbeelding kiezen'}
              </button>
            )}
            <input ref={coverRef} type="file" accept="image/*" onChange={handleCoverSelect} style={{ display: 'none' }} />
          </div>
        </section>

        {/* Public project page */}
        <section className="settings-section">
          <h2>Publieke projectpagina</h2>
          <p className="form-hint" style={{ marginBottom: 16 }}>
            Een openbare pagina voor omwonenden en geïnteresseerden. Toont projectinfo, tijdlijn, publieke updates en events.
          </p>

          <label className="intake-toggle">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={e => setIsPublic(e.target.checked)}
            />
            <span>Publieke pagina actief</span>
          </label>

          {isPublic && (
            <>
              <div className="form-group">
                <label htmlFor="set-slug">URL-slug</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>/project/</span>
                  <input
                    id="set-slug"
                    type="text"
                    value={slug}
                    onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    placeholder="vlinderhaven"
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="set-pub-desc">Publieke beschrijving</label>
                <textarea
                  id="set-pub-desc"
                  value={publicDescription}
                  onChange={e => setPublicDescription(e.target.value)}
                  placeholder="Korte beschrijving voor bezoekers die het project nog niet kennen..."
                  rows={4}
                />
                <span className="form-hint">Laat leeg om de standaard projectbeschrijving te gebruiken.</span>
              </div>
              <div className="form-group">
                <label htmlFor="set-pub-email">Contact e-mail (publiek)</label>
                <input
                  id="set-pub-email"
                  type="email"
                  value={publicContactEmail}
                  onChange={e => setPublicContactEmail(e.target.value)}
                  placeholder="info@project.nl"
                />
              </div>
              {slug && (
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 8 }}>
                  <i className="fa-solid fa-link" style={{ marginRight: 6 }} />
                  Pagina zichtbaar op: <strong>{getPublicSiteUrl({ ...project, slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') })}</strong>
                </p>
              )}
            </>
          )}

        </section>

        {/* Intake form */}
        <section className="settings-section">
          <h2>Intake formulier</h2>
          <p className="form-hint" style={{ marginBottom: 16 }}>
            Een publiek aanmeldformulier dat je kunt delen op je website of social media.
          </p>

          <label className="intake-toggle">
            <input
              type="checkbox"
              checked={intakeEnabled}
              onChange={e => setIntakeEnabled(e.target.checked)}
            />
            <span>Intake formulier actief</span>
          </label>

          {intakeEnabled && (
            <>
              <div className="intake-url-box">
                <label>Formulier URL</label>
                <div className="intake-url-row">
                  <input
                    type="text"
                    readOnly
                    value={getIntakeUrl(project)}
                    className="intake-url-input"
                  />
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => navigator.clipboard.writeText(getIntakeUrl(project))}
                  >
                    <i className="fa-solid fa-copy" /> Kopieer
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Introductietekst</label>
                <textarea
                  value={intakeIntro}
                  onChange={e => setIntakeIntro(e.target.value)}
                  rows={3}
                  placeholder="Welkomstbericht dat boven het formulier verschijnt..."
                />
              </div>

              <div className="form-group">
                <label>Vragen</label>
                <IntakeQuestionEditor
                  questions={questions}
                  onAdd={addQuestion}
                  onUpdate={updateQuestion}
                  onDelete={deleteQuestion}
                  onReorder={reorderQuestions}
                />
              </div>
            </>
          )}
        </section>


        <div className="settings-save">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Opslaan...' : saved ? '✓ Opgeslagen' : 'Wijzigingen opslaan'}
          </button>
        </div>
      </form>

      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          aspect={cropAspect}
          round={cropRound}
          onComplete={handleCropComplete}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  )
}
