import { useState, useEffect, useRef } from 'react'
import { useProject } from '../contexts/ProjectContext'
import { supabase } from '../lib/supabase'
import { uploadImage } from '../lib/storage'
import { getIntakeUrl, getPublicSiteUrl } from '../lib/subdomain'
import { exportProjectData, exportMembersCSV } from '../lib/dataExport'
import useIntakeQuestions from '../hooks/useIntakeQuestions'
import IntakeQuestionEditor from '../components/IntakeQuestionEditor'
import ImageCropper from '../components/ImageCropper'
import { useLocation } from 'react-router-dom'
import { parseHex } from '../lib/brandAccent'

export default function Settings() {
  const { project, milestones, loading: projectLoading, isLightProject, refreshProject } = useProject()
  const { hash } = useLocation()
  // Eigen kleuren (buuur light): leeg = de standaardkleuren van buuur.
  const [appAccent, setAppAccent] = useState('')
  const [appStructure, setAppStructure] = useState('')
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#4A90D9')
  const [accentColor, setAccentColor] = useState('#3BD269')
  const [defaultTheme, setDefaultTheme] = useState('warm')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoPreview, setLogoPreview] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoRef = useRef(null)
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [coverPreview, setCoverPreview] = useState('')
  const [uploadingCover, setUploadingCover] = useState(false)
  const coverRef = useRef(null)
  const [intakeEnabled, setIntakeEnabled] = useState(false)
  const [intakeIntro, setIntakeIntro] = useState('')
  const [inviteIntro, setInviteIntro] = useState('')
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
      setAppAccent(project.app_accent_color || '')
      setAppStructure(project.app_structure_color || '')
      setDefaultTheme(project.default_theme === 'light' ? 'warm' : (project.default_theme || 'inherit'))
      setLogoUrl(project.logo_url || '')
      setLogoPreview(project.logo_url || '')
      setCoverImageUrl(project.cover_image_url || '')
      setCoverPreview(project.cover_image_url || '')
      setIntakeEnabled(project.intake_enabled || false)
      setIntakeIntro(project.intake_intro_text || '')
      setInviteIntro(project.invite_intro_text || '')
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
      try {
        const url = await uploadImage(file)
        setLogoUrl(url)
      } catch (err) {
        console.error('Logo upload failed:', err)
        setLogoPreview(logoUrl || '')
      } finally {
        setUploadingLogo(false)
      }
    } else if (cropTarget === 'cover') {
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

  // Deeplink vanuit "Aan de slag" (settings#branding, settings#aanmeldformulier).
  useEffect(() => {
    if (!hash || projectLoading) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash, projectLoading])

  const accentInvalid = !!appAccent && !parseHex(appAccent)
  const structureInvalid = !!appStructure && !parseHex(appStructure)

  async function handleSave(e) {
    e.preventDefault()
    if (isLightProject && (accentInvalid || structureInvalid)) {
      alert('Een van de kleuren is geen geldige hexkleur, bijvoorbeeld #2F6BFF.')
      return
    }
    setSaving(true)
    setSaved(false)

    const { error } = await supabase
      .from('projects')
      .update({
        name, tagline, location, description,
        brand_primary_color: primaryColor,
        brand_accent_color: accentColor,
        logo_url: logoUrl || null,
        cover_image_url: coverImageUrl || null,
        intake_enabled: intakeEnabled,
        intake_intro_text: intakeIntro.trim() || null,
        invite_intro_text: inviteIntro.trim() || null,
        is_public: isPublic,
        slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') || null,
        public_description: publicDescription.trim() || null,
        public_contact_email: publicContactEmail.trim() || null,
        // Kleuren beheert een light-groep zelf; bij pro doet de organisatie dat in het CMS.
        ...(isLightProject ? {
          app_accent_color: normalizeHex(appAccent),
          app_structure_color: normalizeHex(appStructure),
        } : {}),
      })
      .eq('id', project.id)

    if (error) {
      console.error('Error saving settings:', error)
      alert('Er ging iets mis bij het opslaan.')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      // Nieuwe stand doorgeven aan de rest van de app (kleuren, sidebar, Aan de slag).
      await refreshProject()
    }
    setSaving(false)
  }

  if (projectLoading) return <div className="loading-inline"><p>Laden...</p></div>

  return (
    <div className="view-settings">
      <div className="view-header">
        <h1>Instellingen</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
          Hier regel je hoe jullie groep heet, eruitziet en gevonden wordt. Wijzigingen gaan pas in nadat je
          onderaan op <strong>Wijzigingen opslaan</strong> klikt.
        </p>
      </div>

      <form onSubmit={handleSave} className="settings-form">
        {/* Project info */}
        <section className="settings-section">
          <h2>Project informatie</h2>
          <p className="form-hint" style={{ marginBottom: 16 }}>
            De naam en tagline staan in de zijbalk en op je publieke pagina. De beschrijving zien leden op het dashboard.
          </p>

          <div className="form-group">
            <label>Naam</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div className="form-group">
            <label>Slogan</label>
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
        <section className="settings-section" id="branding">
          <h2>Logo en uitstraling</h2>
          <p className="form-hint" style={{ marginBottom: 16 }}>
            Een logo{isLightProject ? ' en een eigen kleur maken' : ' maakt'} de omgeving herkenbaar als die van jullie.
          </p>

          <div className="form-group">
            <label>Projectlogo</label>
            <p className="form-hint">Vierkant logo, wordt getoond in de zijbalk en op kaarten.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 24, fontWeight: 700 }}>
                  {(name || 'P')[0]}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn-secondary btn-sm" onClick={() => logoRef.current?.click()} disabled={uploadingLogo}>
                  {uploadingLogo ? 'Uploaden...' : logoPreview ? 'Wijzigen' : 'Logo kiezen'}
                </button>
                {logoPreview && (
                  <button type="button" className="btn-secondary btn-sm" onClick={() => { setLogoUrl(''); setLogoPreview('') }} style={{ color: 'var(--accent-red)' }}>
                    Verwijderen
                  </button>
                )}
              </div>
              <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoSelect} style={{ display: 'none' }} />
            </div>
          </div>

          <div className="form-group">
            <label>Omslagfoto</label>
            <p className="form-hint">Wordt getoond op de aanmeldpagina en het aanmeldformulier.</p>
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
                <i className="fa-solid fa-image" /> {uploadingCover ? 'Uploaden...' : 'Omslagfoto kiezen'}
              </button>
            )}
            <input ref={coverRef} type="file" accept="image/*" onChange={handleCoverSelect} style={{ display: 'none' }} />
          </div>
        </section>

        {isLightProject && (
          <section className="settings-section">
            <h2>Kleuren</h2>
            <p className="form-hint" style={{ marginBottom: 16 }}>
              Kies een kleur uit jullie logo of huisstijl. Wij zorgen dat tekst erop leesbaar blijft, ook in donkere modus.
              Laat leeg om de standaardkleuren van buuur te houden.
            </p>
            <ColorField
              label="Actiekleur"
              hint="Voor knoppen en de belangrijkste acties."
              value={appAccent}
              onChange={setAppAccent}
              invalid={accentInvalid}
            />
            <ColorField
              label="Structuurkleur"
              hint="Voor labels, iconen en links. Leeg laten betekent: volgt de actiekleur."
              value={appStructure}
              onChange={setAppStructure}
              invalid={structureInvalid}
            />
          </section>
        )}

        {/* Public project page */}
        <section className="settings-section">
          <h2>Publieke projectpagina</h2>
          <p className="form-hint" style={{ marginBottom: 16 }}>
            Een openbare pagina voor omwonenden en geïnteresseerden. De inhoud bouw je in de Paginabouwer; hier zet je de pagina aan of uit.
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
                <label htmlFor="set-slug">Webadres</label>
                <input
                  id="set-slug"
                  type="text"
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="vlinderhaven"
                />
                {slug && (
                  <span className="form-hint" style={{ marginTop: 6 }}>
                    <i className="fa-solid fa-link" style={{ marginRight: 4 }} />
                    {getPublicSiteUrl({ ...project, slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  </span>
                )}
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
                <label htmlFor="set-pub-email">Contact-e-mail (openbaar)</label>
                <input
                  id="set-pub-email"
                  type="email"
                  value={publicContactEmail}
                  onChange={e => setPublicContactEmail(e.target.value)}
                  placeholder="info@project.nl"
                />
              </div>
            </>
          )}

        </section>

        {/* Intake form */}
        <section className="settings-section" id="aanmeldformulier">
          <h2>Aanmeldformulier</h2>
          <p className="form-hint" style={{ marginBottom: 16 }}>
            Een publiek formulier waarmee geïnteresseerden zich aanmelden. Deel de link op je website of social media;
            aanmeldingen komen binnen bij Leden, onder Ledenwerving.
          </p>

          <label className="intake-toggle">
            <input
              type="checkbox"
              checked={intakeEnabled}
              onChange={e => setIntakeEnabled(e.target.checked)}
            />
            <span>Aanmeldformulier actief</span>
          </label>

          {intakeEnabled && (
            <>
              <div className="intake-url-box">
                <label>Link naar extern formulier</label>
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

        <section className="settings-section">
          <h2>Uitnodigingsmail</h2>
          <p className="form-hint" style={{ marginBottom: 16 }}>
            De tekst die nieuwe leden in hun uitnodigingsmail zien, vóór de inlogknop.
            Laat leeg om de standaardtekst van je organisatie te gebruiken.
          </p>

          <div className="form-group">
            <label>Persoonlijke uitnodigingstekst</label>
            <textarea
              value={inviteIntro}
              onChange={e => setInviteIntro(e.target.value)}
              rows={5}
              placeholder={'Bijvoorbeeld:\n\nWelkom bij {projectnaam}! We zijn een collectief dat samen werkt aan duurzame woningen. Leuk dat je interesse hebt.'}
            />
            <p className="form-hint" style={{ marginTop: 8 }}>
              Variabelen: <code>{'{naam}'}</code> = naam van de uitgenodigde, <code>{'{projectnaam}'}</code> = naam van het project.
              Lege regel tussen alinea&apos;s.
            </p>
          </div>
        </section>


        <div className="settings-save">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Opslaan...' : saved ? '✓ Opgeslagen' : 'Wijzigingen opslaan'}
          </button>
        </div>
      </form>

      <DataExportSection projectId={project?.id} projectSlug={project?.slug} />

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

// '#abc' of 'aabbcc' → '#aabbcc'; leeg of ongeldig → null.
function normalizeHex(value) {
  const rgb = parseHex(value)
  return rgb ? '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('') : null
}

function ColorField({ label, hint, value, onChange, invalid }) {
  const id = `set-color-${label.toLowerCase()}`
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <p className="form-hint">{hint}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <input
          type="color"
          aria-label={`${label} kiezen`}
          value={normalizeHex(value) || '#2F6BFF'}
          onChange={e => onChange(e.target.value)}
          style={{ width: 44, height: 36, padding: 2, border: 'none', background: 'none', cursor: 'pointer', flex: 'none' }}
        />
        <input
          id={id}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Bijvoorbeeld #2F6BFF"
          style={{ maxWidth: 180 }}
        />
        {value && (
          <button type="button" className="btn-secondary btn-sm" onClick={() => onChange('')}>Wissen</button>
        )}
      </div>
      {invalid && <p className="form-hint" style={{ color: 'var(--accent-red)' }}>Geen geldige hexkleur.</p>}
    </div>
  )
}

function DataExportSection({ projectId, projectSlug }) {
  const [exporting, setExporting] = useState(null) // 'full' | 'csv' | null
  const [result, setResult] = useState(null)

  async function handleExportFull() {
    setExporting('full')
    setResult(null)
    try {
      const res = await exportProjectData(projectId, projectSlug)
      setResult(res.counts)
    } catch {
      setResult('error')
    } finally {
      setExporting(null)
    }
  }

  async function handleExportCSV() {
    setExporting('csv')
    setResult(null)
    try {
      const res = await exportMembersCSV(projectId, projectSlug)
      setResult({ csv: res.count })
    } catch {
      setResult('error')
    } finally {
      setExporting(null)
    }
  }

  return (
    <section className="settings-section" style={{ marginTop: 32 }}>
      <h2><i className="fa-solid fa-download" style={{ marginRight: 8 }} />Data-export</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
        Exporteer alle projectdata conform de AVG (Art. 20 dataportabiliteit).
        De organisatie is eigenaar van alle data in dit project.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          className="btn-secondary"
          onClick={handleExportFull}
          disabled={exporting}
        >
          <i className={exporting === 'full' ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-file-arrow-down'} />{' '}
          {exporting === 'full' ? 'Exporteren...' : 'Volledige export (JSON)'}
        </button>
        <button
          className="btn-secondary"
          onClick={handleExportCSV}
          disabled={exporting}
        >
          <i className={exporting === 'csv' ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-table'} />{' '}
          {exporting === 'csv' ? 'Exporteren...' : 'Ledenlijst (CSV)'}
        </button>
      </div>

      {result && result !== 'error' && !result.csv && (
        <p style={{ marginTop: 12, fontSize: 14, color: 'var(--accent-green)' }}>
          <i className="fa-solid fa-check" /> Export gedownload: {result.leden} leden, {result.prikbord} berichten, {result.updates} nieuwsberichten, {result.evenementen} events, {result.documenten} documenten, {result.intake_reacties} aanmeldingen
        </p>
      )}
      {result?.csv && (
        <p style={{ marginTop: 12, fontSize: 14, color: 'var(--accent-green)' }}>
          <i className="fa-solid fa-check" /> CSV gedownload met {result.csv} leden
        </p>
      )}
      {result === 'error' && (
        <p style={{ marginTop: 12, fontSize: 14, color: 'var(--accent-red)' }}>
          <i className="fa-solid fa-triangle-exclamation" /> Export mislukt. Probeer het opnieuw.
        </p>
      )}
    </section>
  )
}
