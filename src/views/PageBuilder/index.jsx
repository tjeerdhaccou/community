import { useState, useEffect } from 'react'
import { useProject } from '../../contexts/ProjectContext'
import { supabase } from '../../lib/supabase'
import { uploadImage } from '../../lib/storage'
import { useToast } from '../../components/Toast'
import { getPublicSiteUrl } from '../../lib/subdomain'
import { SECTION_TYPES, FONT_THEMES, COLOR_THEMES, getThemeSwatches, tempId } from './constants'
import SectionEditor from './SectionEditor'
import AddSectionButton from './AddSectionButton'

export { COLOR_THEMES }

export default function PageBuilder() {
  const { project } = useProject()
  const toast = useToast()
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [projectMembers, setProjectMembers] = useState([])
  const [fontTheme, setFontTheme] = useState('clean')
  const [isPublic, setIsPublic] = useState(project?.is_public || false)
  const [ctaText, setCtaText] = useState('')
  const [ctaBtnColor, setCtaBtnColor] = useState(null)
  const [colorTheme, setColorTheme] = useState('clean')
  const [isDirty, setIsDirty] = useState(false)
  const [pendingDeletes, setPendingDeletes] = useState([])
  const [publishing, setPublishing] = useState(false)
  const [conceptSaving, setConceptSaving] = useState(false)
  const [isConceptSaved, setIsConceptSaved] = useState(false)
  const scrollKey = project?.id ? `pb-scroll-${project.id}` : null

  const draftKey = project?.id ? `pb-draft-${project.id}` : null

  // Persist draft to localStorage on every change
  useEffect(() => {
    if (!draftKey || !isDirty) return
    const draft = { sections, fontTheme, ctaText, ctaBtnColor, colorTheme, pendingDeletes }
    localStorage.setItem(draftKey, JSON.stringify(draft))
  }, [sections, fontTheme, ctaText, ctaBtnColor, colorTheme, pendingDeletes, isDirty, draftKey])

  // Save & restore scroll position via the .main-content scrollable container
  useEffect(() => {
    if (!scrollKey) return
    const scroller = document.getElementById('main-content')
    if (!scroller) return

    const onScroll = () => sessionStorage.setItem(scrollKey, scroller.scrollTop)
    scroller.addEventListener('scroll', onScroll, { passive: true })

    // Restore on mount (after data finishes loading)
    if (!loading) {
      const saved = sessionStorage.getItem(scrollKey)
      if (saved) scroller.scrollTop = parseInt(saved, 10)
    }

    return () => scroller.removeEventListener('scroll', onScroll)
  }, [loading, scrollKey])

  useEffect(() => {
    if (!project?.id) return

    // Check for a saved draft first
    const savedDraft = draftKey && localStorage.getItem(draftKey)
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft)
        setSections(draft.sections || [])
        setFontTheme(draft.fontTheme || 'clean')
        setCtaText(draft.ctaText || '')
        setCtaBtnColor(draft.ctaBtnColor || null)
        setColorTheme(draft.colorTheme || 'clean')
        setPendingDeletes(draft.pendingDeletes || [])
        setIsDirty(true)
        setLoading(false)
        return
      } catch { /* corrupt draft — fall through to DB load */ }
    }

    setFontTheme(project.font_theme || 'clean')
    setCtaText(project.cta_text || '')
    setCtaBtnColor(project.cta_btn_color || null)
    setColorTheme(project.color_theme || 'clean')

    Promise.all([
      supabase.from('public_sections').select('*').eq('project_id', project.id).order('sort_order'),
      supabase.from('memberships').select('profile_id, role, profile:profiles(full_name, avatar_url)').eq('project_id', project.id).neq('role', 'guest'),
    ]).then(([sectionsRes, membersRes]) => {
      const rows = sectionsRes.data || []
      setProjectMembers(membersRes.data || [])
      setSections(rows)
      setLoading(false)
      // Auto-create hero in local state if missing
      if (!rows.find(s => s.section_type === 'hero')) {
        setSections([{
          id: tempId(),
          project_id: project.id,
          sort_order: -2,
          section_type: 'hero',
          title: project.name || '',
          body: project.tagline || '',
          image_url: project.cover_image_url || null,
          images: [], bg_color: null, text_color: 'dark', text_align: 'left',
          card_columns: 3, // NOT NULL in DB; default 3 — must be present or insert fails
          text_size: 'normal',
        }, ...rows])
      }
    })
  }, [project?.id])

  // --- Local state mutations (no DB) ---
  function updateSection(id, field, value) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
    setIsDirty(true)
  }

  // When color theme changes: remap existing block bg_colors to the new theme's palette
  function handleColorThemeChange(newTheme) {
    const oldPalette = COLOR_THEMES[colorTheme] || COLOR_THEMES.clean
    const newPalette = COLOR_THEMES[newTheme] || COLOR_THEMES.clean

    // Build mapping: old color hex → same semantic slot color in new theme
    const oldValues = Object.entries(oldPalette).filter(([k]) => k !== 'label')
    const newValues = Object.entries(newPalette).filter(([k]) => k !== 'label')
    const colorMap = {}
    oldValues.forEach(([, color], i) => {
      colorMap[color.toLowerCase()] = newValues[i]?.[1] || null
    })

    function remapColor(hex) {
      if (!hex) return hex
      return colorMap[hex.toLowerCase()] ?? hex
    }

    // Remap section bg_colors + card-level bg_colors inside cards blocks
    setSections(prev => prev.map(s => {
      const remapped = { ...s, bg_color: remapColor(s.bg_color) }
      if (s.section_type === 'cards' && Array.isArray(s.images)) {
        remapped.images = s.images.map(card =>
          card && typeof card === 'object'
            ? { ...card, bg_color: remapColor(card.bg_color) }
            : card
        )
      }
      return remapped
    }))

    // Remap CTA button color
    setCtaBtnColor(prev => remapColor(prev))

    setColorTheme(newTheme)
    setIsDirty(true)
  }

  function addSection(type = 'text-image-left') {
    setSections(prev => [...prev, {
      id: tempId(),
      project_id: project.id,
      sort_order: prev.length,
      section_type: type,
      title: '', body: '', image_url: null,
      images: type === 'cards' ? [{ title: '', body: '' }] : [],
      card_columns: 3,
      bg_color: null, text_color: 'dark', text_align: 'left', text_size: 'normal',
    }])
    setIsDirty(true)
  }

  function deleteSection(id) {
    setSections(prev => prev.filter(s => s.id !== id))
    if (!id.startsWith('temp-')) setPendingDeletes(prev => [...prev, id])
    setIsDirty(true)
  }

  function moveSection(fromIdx, direction) {
    const toIdx = fromIdx + direction
    if (toIdx < 0 || toIdx >= sections.length) return
    const updated = [...sections]
    ;[updated[fromIdx], updated[toIdx]] = [updated[toIdx], updated[fromIdx]]
    updated.forEach((s, i) => { s.sort_order = i })
    setSections(updated)
    setIsDirty(true)
  }

  function ensureCta() {
    setSections(prev => {
      if (prev.find(s => s.section_type === 'cta')) return prev
      const hero = prev.filter(s => s.section_type === 'hero')
      const rest = prev.filter(s => s.section_type !== 'hero')
      return [...hero, {
        id: tempId(),
        project_id: project.id,
        sort_order: -1,
        section_type: 'cta',
        title: 'Word lid van ons project',
        body: '', image_url: null, images: [],
        bg_color: null, text_color: 'dark', text_align: 'left',
        card_columns: 3, // NOT NULL in DB; default 3
        text_size: 'normal',
      }, ...rest]
    })
    setIsDirty(true)
  }

  // --- Image uploads (ok to upload immediately, URL stored in local state) ---
  async function handleImageUpload(sectionId, e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const url = await uploadImage(file)
      updateSection(sectionId, 'image_url', url)
    } catch (err) { console.error('Image upload failed:', err) }
  }

  async function handleCarouselImageAdd(sectionId, e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const url = await uploadImage(file)
      const section = sections.find(s => s.id === sectionId)
      updateSection(sectionId, 'images', [...(section.images || []), url])
    } catch (err) { console.error('Carousel image upload failed:', err) }
  }

  async function handleCardImageUpload(sectionId, cardIndex, e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const url = await uploadImage(file)
      const section = sections.find(s => s.id === sectionId)
      const updated = [...(section.images || [])]
      updated[cardIndex] = { ...updated[cardIndex], image_url: url }
      updateSection(sectionId, 'images', updated)
    } catch (err) { console.error('Card image upload failed:', err) }
  }

  function removeCarouselImage(sectionId, index) {
    const section = sections.find(s => s.id === sectionId)
    updateSection(sectionId, 'images', (section.images || []).filter((_, i) => i !== index))
  }

  // --- Publish: batch write everything to DB ---
  // Persist all section + project-level changes to the DB.
  // Shared by publishAll() and saveConceptToDB() — the only difference between the
  // two buttons is which toast is shown. Public visibility (Live/Concept) is a
  // separate concern controlled by the is_public toggle in the header.
  async function persistSections() {
    // Save project-level fields
    const { error: projectErr } = await supabase
      .from('projects')
      .update({ font_theme: fontTheme, cta_text: ctaText, cta_btn_color: ctaBtnColor, color_theme: colorTheme })
      .eq('id', project.id)
    if (projectErr) throw projectErr

    // Delete removed sections
    if (pendingDeletes.length) {
      const { error: delErr } = await supabase.from('public_sections').delete().in('id', pendingDeletes)
      if (delErr) throw delErr
    }

    // Separate new (temp) sections from existing ones.
    // Strip keys with null/undefined values for inserts — that way PG defaults
    // (e.g. card_columns DEFAULT 3 NOT NULL) actually kick in instead of failing
    // with a NOT-NULL violation.
    const toInsert = []
    const toUpdate = []
    sections.forEach((section, idx) => {
      // eslint-disable-next-line no-unused-vars
      const { id, btn_color: _btn, ...data } = section
      data.sort_order = idx
      if (id.startsWith('temp-')) {
        const clean = Object.fromEntries(
          Object.entries(data).filter(([, v]) => v !== null && v !== undefined)
        )
        toInsert.push({ tempId: id, data: clean })
      } else {
        toUpdate.push({ id, data })
      }
    })

    // Batch insert all new sections in one round-trip
    let insertedRows = []
    if (toInsert.length > 0) {
      const { data: rows, error: insertError } = await supabase
        .from('public_sections')
        .insert(toInsert.map(s => s.data))
        .select()
      if (insertError) throw insertError
      insertedRows = rows || []
    }

    // Batch update existing sections
    await Promise.all(
      toUpdate.map(({ id, data }) =>
        supabase.from('public_sections').update(data).eq('id', id).then(({ error }) => {
          if (error) throw error
        })
      )
    )

    // Map temp IDs to real IDs returned from insert
    const tempIdMap = {}
    toInsert.forEach((item, idx) => {
      if (insertedRows[idx]) tempIdMap[item.tempId] = insertedRows[idx]
    })

    setSections(prev => prev.map(s => tempIdMap[s.id] ?? s))
    setPendingDeletes([])
    setIsDirty(false)
    setIsConceptSaved(false)
    if (draftKey) localStorage.removeItem(draftKey)
    if (previewKey) localStorage.removeItem(previewKey)
  }

  async function publishAll() {
    setPublishing(true)
    try {
      await persistSections()
      toast.success('Pagina gepubliceerd')
    } catch (err) {
      console.error('Publish failed:', err)
      toast.error('Er ging iets mis bij het publiceren. Probeer het opnieuw.')
    } finally {
      setPublishing(false)
    }
  }

  // --- Discard: reload from DB ---
  async function discardChanges() {
    if (!confirm('Wijzigingen verwerpen?')) return
    setLoading(true)
    setPendingDeletes([])
    setFontTheme(project.font_theme || 'clean')
    setCtaText(project.cta_text || '')
    setCtaBtnColor(project.cta_btn_color || null)
    setColorTheme(project.color_theme || 'clean')
    if (draftKey) localStorage.removeItem(draftKey)
    const { data } = await supabase.from('public_sections').select('*').eq('project_id', project.id).order('sort_order')
    setSections(data || [])
    setIsDirty(false)
    setLoading(false)
  }

  // localStorage preview key — used by openPreview() for unsaved drafts only.
  const previewKey = project?.id ? `pb-preview-${project.id}` : null

  // "Concept opslaan" — persist to DB so changes survive refresh and devices.
  // Differs from "Publiceren" only in toast and that it does not toggle is_public.
  // Visibility is controlled by the Live/Concept switch in the header.
  async function saveConceptToDB() {
    setConceptSaving(true)
    try {
      await persistSections()
      toast.success('Concept opgeslagen')
    } catch (err) {
      console.error('Concept save failed:', err)
      toast.error('Opslaan mislukt. Probeer opnieuw.')
    } finally {
      setConceptSaving(false)
    }
  }

  // --- Open preview (saves concept first if needed) ---
  function openPreview() {
    if (!publicUrl) return
    if (isDirty) saveConceptToDB()
    window.open(`${publicUrl}?preview=1`, '_blank')
  }

  const publicUrl = project ? getPublicSiteUrl(project) : null
  const heroSection = sections.find(s => s.section_type === 'hero')
  const ctaSection = sections.find(s => s.section_type === 'cta')
  const contentSections = sections.filter(s => s.section_type !== 'hero' && s.section_type !== 'cta')

  if (loading) return <div className="page-builder"><div className="loading-inline"><p>Laden...</p></div></div>

  return (
    <div className="page-builder">
      {/* Header */}
      <div className="view-header">
        <div>
          <h1><i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 10, color: 'var(--accent-primary)' }} />Pagina bouwer</h1>
          <p className="view-header__sub">Bouw de publieke pagina voor je project</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label className="pb-toggle" title={isPublic ? 'Pagina is zichtbaar voor bezoekers' : 'Pagina is niet zichtbaar'}>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={async (e) => {
                const newValue = e.target.checked
                setIsPublic(newValue)
                const { error } = await supabase.from('projects').update({ is_public: newValue }).eq('id', project.id)
                if (error) {
                  setIsPublic(!newValue)
                  toast.error('Kon status niet wijzigen')
                } else {
                  toast.success(newValue ? 'Pagina gepubliceerd' : 'Pagina op concept gezet')
                }
              }}
            />
            <span className="pb-toggle__slider" />
            <span className="pb-toggle__label">{isPublic ? 'Live' : 'Concept'}</span>
          </label>
          {publicUrl && (
            <button type="button" className="btn-secondary" onClick={openPreview} disabled={publishing || conceptSaving} title="Bekijk concept zonder te publiceren">
              <i className="fa-solid fa-eye" /> Voorbeeld
            </button>
          )}
        </div>
      </div>

      {/* Publish bar — dirty state */}
      {isDirty && (
        <div className="pb-publish-bar pb-publish-bar--dirty">
          <div className="pb-publish-bar__msg">
            <i className="fa-solid fa-circle-dot" />
            Niet-opgeslagen wijzigingen
          </div>
          <div className="pb-publish-bar__actions">
            <button type="button" className="btn-secondary btn-sm" onClick={discardChanges} disabled={publishing || conceptSaving}>
              Verwerpen
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={saveConceptToDB} disabled={publishing || conceptSaving}>
              {conceptSaving ? <><i className="fa-solid fa-spinner fa-spin" /> Opslaan...</> : <><i className="fa-solid fa-floppy-disk" /> Concept opslaan</>}
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={publishAll} disabled={publishing || conceptSaving}>
              {publishing ? <><i className="fa-solid fa-spinner fa-spin" /> Publiceren...</> : <><i className="fa-solid fa-cloud-arrow-up" /> Publiceren</>}
            </button>
          </div>
        </div>
      )}

      {/* Publish bar — concept saved but not live */}
      {!isDirty && isConceptSaved && (
        <div className="pb-publish-bar pb-publish-bar--concept">
          <div className="pb-publish-bar__msg">
            <i className="fa-solid fa-circle-check" />
            Concept opgeslagen — nog niet zichtbaar voor bezoekers
          </div>
          <div className="pb-publish-bar__actions">
            <button type="button" className="btn-secondary btn-sm" onClick={openPreview} disabled={publishing}>
              <i className="fa-solid fa-eye" /> Voorbeeld bekijken
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={publishAll} disabled={publishing}>
              {publishing ? <><i className="fa-solid fa-spinner fa-spin" /> Publiceren...</> : <><i className="fa-solid fa-cloud-arrow-up" /> Publiceren</>}
            </button>
          </div>
        </div>
      )}

      {/* Color theme picker */}
      <div className="pb-theme-section">
        <div className="pb-theme-section__label">Kleurenthema</div>
        <div className="pb-color-theme-picker">
          {Object.entries(COLOR_THEMES).map(([key, theme]) => {
            const previewColors = Object.entries(theme).filter(([k]) => k !== 'label').slice(0, 5)
            return (
              <button
                key={key}
                type="button"
                className={`pb-color-theme-chip ${colorTheme === key ? 'pb-color-theme-chip--active' : ''}`}
                onClick={() => handleColorThemeChange(key)}
              >
                <div className="pb-color-theme-chip__swatches">
                  {previewColors.map(([k, color]) => (
                    <span key={k} className="pb-color-theme-chip__dot" style={{ background: color }} />
                  ))}
                </div>
                <span className="pb-color-theme-chip__name">{theme.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Font theme picker */}
      <div className="pb-font-picker">
        <label>Typografie thema</label>
        <div className="pb-font-picker__options">
          {FONT_THEMES.map(ft => (
            <button
              key={ft.value}
              type="button"
              className={`pb-font-chip ${fontTheme === ft.value ? 'pb-font-chip--active' : ''}`}
              onClick={() => { setFontTheme(ft.value); setIsDirty(true) }}
            >
              <span className="pb-font-chip__label" style={{ fontFamily: ft.heading }}>{ft.label}</span>
              <span className="pb-font-chip__preview">{ft.heading} + {ft.body}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Hero editor */}
      {heroSection && (
        <div className="pb-hero-editor">
          <div className="pb-hero-editor__label">
            <i className="fa-solid fa-panorama" /> Hero
          </div>
          <div className="pb-hero-editor__body">
            <div className="pb-hero-editor__image">
              {heroSection.image_url ? (
                <div className="pb-hero-editor__img-wrap">
                  <img src={heroSection.image_url} alt="" />
                  <div className="pb-hero-editor__img-overlay">
                    <label className="btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                      <i className="fa-solid fa-refresh" /> Vervangen
                      <input type="file" accept="image/*" onChange={e => handleImageUpload(heroSection.id, e)} style={{ display: 'none' }} />
                    </label>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => updateSection(heroSection.id, 'image_url', null)}>
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="pb-block__img-upload" style={{ minHeight: 160 }}>
                  <i className="fa-solid fa-cloud-arrow-up" />
                  <span>Header afbeelding uploaden</span>
                  <input type="file" accept="image/*" onChange={e => handleImageUpload(heroSection.id, e)} style={{ display: 'none' }} />
                </label>
              )}
            </div>
            <div className="pb-hero-editor__fields">
              <div className="form-group">
                <label>Heading</label>
                <input type="text" value={heroSection.title || ''} onChange={e => updateSection(heroSection.id, 'title', e.target.value)} placeholder="Projectnaam of headline" />
              </div>
              <div className="form-group">
                <label>Subtekst</label>
                <textarea value={heroSection.body || ''} onChange={e => updateSection(heroSection.id, 'body', e.target.value)} rows={3} placeholder="Tagline of korte introductie" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CTA banner editor */}
      <div className="pb-cta-editor">
        <div className="pb-cta-editor__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-bullhorn" />
            <span>CTA Banner</span>
          </div>
          {!ctaSection ? (
            <button type="button" className="btn-secondary btn-sm" onClick={ensureCta} disabled={!project?.intake_enabled}>
              <i className="fa-solid fa-plus" /> Toevoegen
            </button>
          ) : (
            <button type="button" className="btn-icon btn-sm" onClick={() => deleteSection(ctaSection.id)} title="Verwijderen" style={{ color: 'var(--accent-red)' }}>
              <i className="fa-solid fa-trash" />
            </button>
          )}
        </div>
        {!project?.intake_enabled && !ctaSection && (
          <p className="form-hint" style={{ padding: '0 16px 12px' }}>Zet eerst het intake formulier aan in Instellingen.</p>
        )}
        {ctaSection && (
          <div className="pb-cta-editor__body">
            {/* Rij 1: tekstvelden */}
            <div className="pb-cta-editor__text-row">
              <div className="form-group">
                <label>Tekst naast de knop</label>
                <input type="text" value={ctaSection.title || ''} onChange={e => updateSection(ctaSection.id, 'title', e.target.value)} placeholder="Bijv. Word lid van ons project" maxLength={60} />
                <span className="form-hint">{(ctaSection.title || '').length}/60 tekens</span>
              </div>
              <div className="form-group">
                <label>Knoptekst</label>
                <input type="text" value={ctaText} onChange={e => { setCtaText(e.target.value); setIsDirty(true) }} placeholder="Schrijf je in (standaard)" />
              </div>
            </div>
            {/* Rij 2: stijlopties */}
            <div className="pb-cta-editor__style-row">
              <div className="form-group">
                <label>Achtergrond</label>
                <div className="pb-swatches">
                  {getThemeSwatches(colorTheme).map(({ key, color, label }) => (
                    <button key={key} type="button" className={`pb-swatch ${(ctaSection.bg_color || null) === (key === 'white' ? null : color) ? 'pb-swatch--active' : ''}`} style={{ background: color }} title={label} onClick={() => updateSection(ctaSection.id, 'bg_color', key === 'white' ? null : color)} />
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Knopkleur</label>
                <div className="pb-swatches">
                  {getThemeSwatches(colorTheme).map(({ key, color, label }) => (
                    <button key={key} type="button" className={`pb-swatch ${(ctaBtnColor || null) === (key === 'white' ? null : color) ? 'pb-swatch--active' : ''}`} style={{ background: color }} title={label} onClick={() => { setCtaBtnColor(key === 'white' ? null : color); setIsDirty(true) }} />
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Tekstkleur</label>
                <div className="pb-text-color-toggle">
                  <button type="button" className={`pb-text-color-btn ${(ctaSection.text_color || 'dark') === 'dark' ? 'pb-text-color-btn--active' : ''}`} onClick={() => updateSection(ctaSection.id, 'text_color', 'dark')}>
                    <span className="pb-text-color-dot" style={{ background: (COLOR_THEMES[colorTheme] || COLOR_THEMES.clean).text }} /> Donker
                  </button>
                  <button type="button" className={`pb-text-color-btn ${ctaSection.text_color === 'light' ? 'pb-text-color-btn--active' : ''}`} onClick={() => updateSection(ctaSection.id, 'text_color', 'light')}>
                    <span className="pb-text-color-dot" style={{ background: '#ffffff', border: '1px solid #ccc' }} /> Licht
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content sections */}
      <div className="page-builder__sections">
        {contentSections.length === 0 && (
          <div className="page-builder__empty">
            <i className="fa-solid fa-layer-group" />
            <p>Nog geen secties. Voeg je eerste content blok toe.</p>
          </div>
        )}

        {contentSections.map((section, i) => (
          <SectionEditor
            key={section.id}
            section={section}
            index={i}
            total={contentSections.length}
            colorTheme={colorTheme}
            projectMembers={projectMembers}
            onUpdate={updateSection}
            onDelete={deleteSection}
            onMove={(idx, dir) => {
              const fullIdx = sections.indexOf(section)
              moveSection(fullIdx, dir)
            }}
            onImageUpload={handleImageUpload}
            onCarouselAdd={handleCarouselImageAdd}
            onCarouselRemove={removeCarouselImage}
            onCardImageUpload={handleCardImageUpload}
            onConceptSave={saveConceptToDB}
          />
        ))}

        <AddSectionButton onAdd={addSection} />
      </div>
    </div>
  )
}
