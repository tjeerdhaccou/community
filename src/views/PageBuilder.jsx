import { useState, useEffect } from 'react'
import { useProject } from '../contexts/ProjectContext'
import { supabase } from '../lib/supabase'
import { uploadImage } from '../lib/storage'
import { useToast } from '../components/Toast'
import { getPublicSiteUrl } from '../lib/subdomain'

const SECTION_TYPES = [
  { value: 'text-image-left', label: 'Tekst links, beeld rechts', icon: 'fa-solid fa-table-columns' },
  { value: 'text-image-right', label: 'Tekst rechts, beeld links', icon: 'fa-solid fa-table-columns' },
  { value: 'text-only', label: 'Alleen tekst', icon: 'fa-solid fa-align-left' },
  { value: 'image-full', label: 'Volledig beeld', icon: 'fa-solid fa-image' },
  { value: 'image-carousel', label: 'Beeldcarousel', icon: 'fa-solid fa-images' },
  { value: 'cards', label: 'Kaarten in kolommen', icon: 'fa-solid fa-table-cells-large' },
  { value: 'members', label: 'Leden showcase', icon: 'fa-solid fa-users' },
  { value: 'agenda', label: 'Volgend evenement', icon: 'fa-solid fa-calendar-check' },
  { value: 'updates', label: 'Laatste updates', icon: 'fa-solid fa-newspaper' },
  { value: 'footer', label: 'Footerblok', icon: 'fa-solid fa-grip-lines' },
]

const FONT_THEMES = [
  { value: 'clean', label: 'Clean', heading: 'Inter', body: 'Inter' },
  { value: 'editorial', label: 'Editorial', heading: 'Playfair Display', body: 'Source Sans 3' },
  { value: 'modern', label: 'Modern', heading: 'Space Grotesk', body: 'DM Sans' },
  { value: 'warm', label: 'Warm', heading: 'Lora', body: 'Nunito' },
  { value: 'bold', label: 'Bold', heading: 'Ubuntu', body: 'Kreon' },
]

export const COLOR_THEMES = {
  clean:     { label: 'Clean',    primary: '#3B82F6', secondary: '#64748B', accent: '#EF4444', muted: '#E2E8F0', background: '#FAFBFC', text: '#0F172A' },
  designer:  { label: 'Designer', primary: '#F43F5E', secondary: '#0857D0', accent: '#18B34D', highlight: '#FED348', muted: '#FEF3D6', background: '#FEFCFB', text: '#1A1A2E' },
  botanical: { label: 'Botanical',primary: '#126842', secondary: '#5CA484', accent: '#F48B9A', muted: '#CFB177', background: '#F5F3EE', text: '#0E2E1E' },
  classic:   { label: 'Classic',  primary: '#1E3A5F', secondary: '#B8860B', accent: '#8B2252', muted: '#E8E4DD', background: '#FAF8F5', text: '#1A1A1A' },
  sunrise:   { label: 'Sunrise',  primary: '#E35B23', secondary: '#FE8340', accent: '#A2DDFD', muted: '#FED348', background: '#FFF8ED', text: '#3D1F0A' },
  terra:     { label: 'Terra',    primary: '#C2623B', secondary: '#8B7355', accent: '#7A8B4A', muted: '#E8DDD0', background: '#F9F5F0', text: '#3B2E25' },
}

// Swatches for block bg picker: all theme colors excluding 'text' + white
export function getThemeSwatches(themeKey) {
  const theme = COLOR_THEMES[themeKey] || COLOR_THEMES.clean
  return [
    { key: 'white', color: '#ffffff', label: 'Wit' },
    ...Object.entries(theme)
      .filter(([k]) => k !== 'label' && k !== 'text')
      .map(([key, color]) => ({ key, color, label: key.charAt(0).toUpperCase() + key.slice(1) })),
  ]
}

function tempId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

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
  async function publishAll() {
    setPublishing(true)
    try {
      // Save project-level fields
      await supabase.from('projects').update({ font_theme: fontTheme, cta_text: ctaText, cta_btn_color: ctaBtnColor, color_theme: colorTheme }).eq('id', project.id)

      // Delete removed sections
      if (pendingDeletes.length) {
        await supabase.from('public_sections').delete().in('id', pendingDeletes)
      }

      // Separate new (temp) sections from existing ones
      const toInsert = []
      const toUpdate = []
      sections.forEach((section, idx) => {
        // eslint-disable-next-line no-unused-vars
        const { id, btn_color: _btn, ...data } = section
        data.sort_order = idx
        if (id.startsWith('temp-')) {
          toInsert.push({ tempId: id, data })
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

      // Batch update existing sections (still individual calls — Supabase doesn't support multi-row update)
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

      // Save project-level fields
      await supabase.from('projects')
        .update({ font_theme: fontTheme, cta_text: ctaText, cta_btn_color: ctaBtnColor, color_theme: colorTheme })
        .eq('id', project.id)

      setPendingDeletes([])
      setIsDirty(false)
      setIsConceptSaved(false)
      if (draftKey) localStorage.removeItem(draftKey)
      if (previewKey) localStorage.removeItem(previewKey)
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

  // --- Save concept to localStorage (not live for visitors, no DB column needed) ---
  const previewKey = project?.id ? `pb-preview-${project.id}` : null

  function saveConceptToDB() {
    if (!previewKey) return
    setConceptSaving(true)
    try {
      const previewData = { sections, fontTheme, ctaText, ctaBtnColor, colorTheme }
      localStorage.setItem(previewKey, JSON.stringify(previewData))
      setIsDirty(false)
      setIsConceptSaved(true)
      if (draftKey) localStorage.removeItem(draftKey)
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

/* --- Section Editor --- */
function SectionEditor({ section, index, total, colorTheme, projectMembers, onUpdate, onDelete, onMove, onImageUpload, onCarouselAdd, onCarouselRemove, onCardImageUpload, onConceptSave }) {
  const collapseKey = `pb-collapsed-${section.id}`
  const savedCollapse = sessionStorage.getItem(collapseKey)
  const [collapsed, setCollapsed] = useState(savedCollapse !== null ? savedCollapse === 'true' : true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave(e) {
    e.stopPropagation()
    setSaving(true)
    await onConceptSave?.()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function toggleCollapsed() {
    setCollapsed(c => {
      sessionStorage.setItem(collapseKey, String(!c))
      return !c
    })
  }

  const swatches = getThemeSwatches(colorTheme)
  const activeTheme = COLOR_THEMES[colorTheme] || COLOR_THEMES.clean
  const typeInfo = SECTION_TYPES.find(t => t.value === section.section_type) || SECTION_TYPES[0]

  return (
    <div className={`pb-block ${collapsed ? 'pb-block--collapsed' : ''}`}>
      <div className="pb-block__header" onClick={toggleCollapsed} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <i className={typeInfo.icon} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          {collapsed ? (
            <span className="pb-block__collapsed-label">
              <strong>{typeInfo.label}</strong>
              {section.title && <span className="pb-block__collapsed-title"> — {section.title}</span>}
            </span>
          ) : (
            <select
              value={section.section_type}
              onChange={e => {
                e.stopPropagation()
                const newType = e.target.value
                onUpdate(section.id, 'section_type', newType)
                if (newType === 'cards' && (section.images || []).filter(c => c && typeof c === 'object').length === 0) {
                  onUpdate(section.id, 'images', [{ title: '', body: '' }])
                }
              }}
              onClick={e => e.stopPropagation()}
              className="pb-block__type-select"
            >
              {SECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          )}
        </div>
        <div className="pb-block__actions" onClick={e => e.stopPropagation()}>
          <button type="button" className="btn-icon btn-sm" onClick={() => onMove(index, -1)} disabled={index === 0} title="Omhoog">
            <i className="fa-solid fa-arrow-up" />
          </button>
          <button type="button" className="btn-icon btn-sm" onClick={() => onMove(index, 1)} disabled={index === total - 1} title="Omlaag">
            <i className="fa-solid fa-arrow-down" />
          </button>
          <button type="button" className="btn-icon btn-sm" onClick={handleSave} title="Concept opslaan" disabled={saving}>
            <i className={saved ? 'fa-solid fa-check' : saving ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-floppy-disk'} style={{ color: saved ? 'var(--accent-green, #3BD269)' : undefined }} />
          </button>
          <button type="button" className="btn-icon btn-sm" onClick={() => onDelete(section.id)} title="Verwijderen" style={{ color: 'var(--accent-red)' }}>
            <i className="fa-solid fa-trash" />
          </button>
          <button type="button" className="btn-icon btn-sm pb-block__toggle" onClick={e => { e.stopPropagation(); toggleCollapsed() }} title={collapsed ? 'Uitklappen' : 'Inklappen'}>
            <i className={`fa-solid fa-chevron-${collapsed ? 'down' : 'up'}`} />
          </button>
        </div>
      </div>

      {!collapsed && <div className="pb-block__body">
        {['text-image-left', 'text-image-right', 'text-only', 'footer'].includes(section.section_type) && (
          <div className="pb-block__fields">
            <div className="form-group">
              <label>Titel</label>
              <input type="text" value={section.title || ''} onChange={e => onUpdate(section.id, 'title', e.target.value)} placeholder="Sectie titel" />
            </div>
            <div className="form-group">
              <label>Tekst</label>
              <textarea value={section.body || ''} onChange={e => onUpdate(section.id, 'body', e.target.value)} rows={4} placeholder="Beschrijving, uitleg, visie..." />
            </div>
            {section.section_type === 'text-only' && (
              <div className="form-group">
                <label>Uitlijning</label>
                <div className="pb-align-options">
                  {[
                    { value: 'left', icon: 'fa-solid fa-align-left' },
                    { value: 'center', icon: 'fa-solid fa-align-center' },
                    { value: 'right', icon: 'fa-solid fa-align-right' },
                  ].map(opt => (
                    <button key={opt.value} type="button" className={`btn-icon btn-sm ${(section.text_align || 'left') === opt.value ? 'pb-align--active' : ''}`} onClick={() => onUpdate(section.id, 'text_align', opt.value)}>
                      <i className={opt.icon} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {section.section_type === 'text-only' && (
              <div className="form-group">
                <label>Tekstgrootte</label>
                <div className="pb-text-size-toggle">
                  <button
                    type="button"
                    className={`pb-text-size-btn ${(section.text_size || 'normal') === 'normal' ? 'pb-text-size-btn--active' : ''}`}
                    onClick={() => onUpdate(section.id, 'text_size', 'normal')}
                  >
                    <span style={{ fontSize: 13 }}>Aa</span> Normaal
                  </button>
                  <button
                    type="button"
                    className={`pb-text-size-btn ${section.text_size === 'large' ? 'pb-text-size-btn--active' : ''}`}
                    onClick={() => onUpdate(section.id, 'text_size', 'large')}
                  >
                    <span style={{ fontSize: 18 }}>Aa</span> Groot
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {['text-image-left', 'text-image-right', 'image-full'].includes(section.section_type) && (
          <div className="pb-block__media">
            <label>Afbeelding</label>
            {section.image_url ? (
              <div className="pb-block__img-container">
                <img src={section.image_url} alt="" className="pb-block__img-preview" />
                <div className="pb-block__img-actions">
                  <label className="btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                    <i className="fa-solid fa-refresh" /> Vervangen
                    <input type="file" accept="image/*" onChange={e => onImageUpload(section.id, e)} style={{ display: 'none' }} />
                  </label>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => onUpdate(section.id, 'image_url', null)} style={{ color: 'var(--accent-red)' }}>
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              </div>
            ) : (
              <label className="pb-block__img-upload">
                <i className="fa-solid fa-cloud-arrow-up" />
                <span>Afbeelding uploaden</span>
                <input type="file" accept="image/*" onChange={e => onImageUpload(section.id, e)} style={{ display: 'none' }} />
              </label>
            )}
          </div>
        )}

        {section.section_type === 'image-carousel' && (
          <div className="pb-block__carousel-editor">
            <label>Afbeeldingen ({(section.images || []).length})</label>
            <div className="pb-carousel-grid">
              {(section.images || []).map((url, imgIdx) => (
                <div key={imgIdx} className="pb-carousel-grid__item">
                  <img src={url} alt="" />
                  <button type="button" className="pb-carousel-grid__remove" onClick={() => onCarouselRemove(section.id, imgIdx)}>
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              ))}
              <label className="pb-carousel-grid__add">
                <i className="fa-solid fa-plus" />
                <input type="file" accept="image/*" onChange={e => onCarouselAdd(section.id, e)} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        )}

        {section.section_type === 'updates' && (
          <div className="pb-block__auto-info">
            <i className="fa-solid fa-magic" />
            <p>Dit blok toont automatisch de laatste publieke updates van je project.</p>
          </div>
        )}

        {section.section_type === 'agenda' && (
          <div className="pb-block__auto-info">
            <i className="fa-solid fa-calendar-check" />
            <p>Dit blok toont automatisch het eerstvolgende publieke evenement van je project.</p>
          </div>
        )}

        {section.section_type === 'footer' && (
          <div className="pb-block__auto-info" style={{ paddingBottom: 0 }}>
            <i className="fa-solid fa-grip-lines" />
            <p>Slotsectie van de pagina — handig voor contactgegevens, adres of een afsluittekst.</p>
          </div>
        )}
        {section.section_type === 'footer' && (
          <div className="pb-block__fields" style={{ paddingTop: 0 }}>
            <div className="form-group">
              <label>Knoptekst <span className="form-hint" style={{ display: 'inline' }}>(optioneel)</span></label>
              <input type="text" value={section.cta_label || ''} onChange={e => onUpdate(section.id, 'cta_label', e.target.value)} placeholder="Bijv. Neem contact op" />
            </div>
            {section.cta_label && (
              <>
                <div className="form-group">
                  <label>Knop URL</label>
                  <input type="url" value={section.cta_url || ''} onChange={e => onUpdate(section.id, 'cta_url', e.target.value)} placeholder="https://..." />
                </div>
                <div className="form-group">
                  <label>Knopkleur</label>
                  <div className="pb-swatches">
                    {swatches.map(({ key, color, label }) => (
                      <button key={key} type="button"
                        className={`pb-swatch ${(section.cta_btn_color || null) === (key === 'white' ? null : color) ? 'pb-swatch--active' : ''}`}
                        style={{ background: color }} title={label}
                        onClick={() => onUpdate(section.id, 'cta_btn_color', key === 'white' ? null : color)}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {section.section_type === 'members' && (
          <div className="pb-block__fields">
            <div className="form-group">
              <label>Sectie titel</label>
              <input type="text" value={section.title || ''} onChange={e => onUpdate(section.id, 'title', e.target.value)} placeholder="Bijv. Ons team" />
            </div>
            <div className="form-group">
              <label>Intro tekst <span className="form-hint" style={{ display: 'inline' }}>(bijv. aantal leden)</span></label>
              <input type="text" value={section.body || ''} onChange={e => onUpdate(section.id, 'body', e.target.value)} placeholder="Bijv. 47 mensen bouwen samen aan dit project" />
            </div>
            <div className="form-group">
              <label>Uitgelichte leden</label>
              <div className="pb-members-picker">
                {(projectMembers || []).map(m => {
                  const featured = (section.images || []).filter(x => x && typeof x === 'object')
                  const isSelected = featured.some(f => f.profile_id === m.profile_id)
                  return (
                    <button
                      key={m.profile_id}
                      type="button"
                      className={`pb-member-chip ${isSelected ? 'pb-member-chip--selected' : ''}`}
                      onClick={() => {
                        const current = (section.images || []).filter(x => x && typeof x === 'object')
                        if (isSelected) {
                          onUpdate(section.id, 'images', current.filter(f => f.profile_id !== m.profile_id))
                        } else {
                          onUpdate(section.id, 'images', [...current, {
                            profile_id: m.profile_id,
                            name: m.profile?.full_name || '',
                            avatar_url: m.profile?.avatar_url || null,
                            label: '',
                          }])
                        }
                      }}
                    >
                      {m.profile?.avatar_url
                        ? <img src={m.profile.avatar_url} alt="" className="pb-member-chip__avatar" />
                        : <span className="pb-member-chip__initials">{(m.profile?.full_name || '?').charAt(0)}</span>
                      }
                      <span>{m.profile?.full_name || 'Onbekend'}</span>
                      {isSelected && <i className="fa-solid fa-check" style={{ marginLeft: 'auto', color: 'var(--accent-primary)' }} />}
                    </button>
                  )
                })}
                {(projectMembers || []).length === 0 && (
                  <p className="form-hint">Geen leden gevonden.</p>
                )}
              </div>
            </div>
            {/* Per-member label */}
            {((section.images || []).filter(x => x && typeof x === 'object')).length > 0 && (
              <div className="form-group">
                <label>Omschrijving per lid <span className="form-hint" style={{ display: 'inline' }}>(optioneel)</span></label>
                <div className="pb-member-labels">
                  {(section.images || []).filter(x => x && typeof x === 'object').map((m, i) => (
                    <div key={m.profile_id} className="pb-member-label-row">
                      {m.avatar_url
                        ? <img src={m.avatar_url} alt="" className="pb-member-chip__avatar" />
                        : <span className="pb-member-chip__initials">{(m.name || '?').charAt(0)}</span>
                      }
                      <span className="pb-member-label-row__name">{m.name}</span>
                      <input
                        type="text"
                        value={m.label || ''}
                        placeholder="Rol of omschrijving"
                        onChange={e => {
                          const updated = [...(section.images || []).filter(x => x && typeof x === 'object')]
                          updated[i] = { ...updated[i], label: e.target.value }
                          onUpdate(section.id, 'images', updated)
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {section.section_type === 'cards' && (
          <div className="pb-block__fields">
            <div className="form-group">
              <label>Sectie titel (optioneel)</label>
              <input
                type="text"
                value={section.title || ''}
                onChange={e => onUpdate(section.id, 'title', e.target.value)}
                placeholder="Bijv. Onze voordelen"
              />
            </div>
            <div className="form-group">
              <label>Aantal kolommen</label>
              <div className="pb-columns-picker">
                {[2, 3, 4].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`pb-columns-btn ${(section.card_columns || 3) === n ? 'pb-columns-btn--active' : ''}`}
                    onClick={() => onUpdate(section.id, 'card_columns', n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="pb-cards-list">
              {((section.images || []).filter(c => c && typeof c === 'object')).map((card, i) => (
                <div key={i} className="pb-card-editor">
                  <div className="pb-card-editor__header">
                    <span>Kaart {i + 1}</span>
                    <button
                      type="button"
                      className="btn-icon btn-sm"
                      style={{ color: 'var(--accent-red)' }}
                      onClick={() => {
                        const updated = (section.images || []).filter((_, idx) => idx !== i)
                        onUpdate(section.id, 'images', updated)
                      }}
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>
                  {/* Card image */}
                  <div className="pb-card-editor__image-row">
                    {card.image_url ? (
                      <div className="pb-card-editor__img-wrap">
                        <img src={card.image_url} alt="" />
                        <button type="button" className="pb-card-editor__img-remove" onClick={() => {
                          const updated = [...(section.images || [])]
                          updated[i] = { ...updated[i], image_url: null }
                          onUpdate(section.id, 'images', updated)
                        }}>
                          <i className="fa-solid fa-xmark" />
                        </button>
                      </div>
                    ) : (
                      <label className="pb-card-editor__img-upload">
                        <i className="fa-solid fa-image" /> Afbeelding toevoegen
                        <input type="file" accept="image/*" onChange={e => onCardImageUpload(section.id, i, e)} style={{ display: 'none' }} />
                      </label>
                    )}
                  </div>
                  {/* Card color */}
                  <div className="form-group">
                    <label>Kaartkleur</label>
                    <div className="pb-swatches">
                      {swatches.map(({ key, color, label }) => (
                        <button
                          key={key}
                          type="button"
                          className={`pb-swatch ${(card.bg_color || null) === (key === 'white' ? null : color) ? 'pb-swatch--active' : ''}`}
                          style={{ background: color }}
                          title={label}
                          onClick={() => {
                            const updated = [...(section.images || [])]
                            updated[i] = { ...updated[i], bg_color: key === 'white' ? null : color }
                            onUpdate(section.id, 'images', updated)
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <input
                      type="text"
                      value={card.title || ''}
                      placeholder="Kaart titel"
                      onChange={e => {
                        const updated = [...(section.images || [])]
                        updated[i] = { ...updated[i], title: e.target.value }
                        onUpdate(section.id, 'images', updated)
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <textarea
                      value={card.body || ''}
                      placeholder="Kaart tekst"
                      rows={3}
                      onChange={e => {
                        const updated = [...(section.images || [])]
                        updated[i] = { ...updated[i], body: e.target.value }
                        onUpdate(section.id, 'images', updated)
                      }}
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => onUpdate(section.id, 'images', [...(section.images || []).filter(c => c && typeof c === 'object'), { title: '', body: '' }])}
              >
                <i className="fa-solid fa-plus" /> Kaart toevoegen
              </button>
            </div>
          </div>
        )}
      </div>}

      {!collapsed && <div className="pb-block__footer">
          <div className="pb-block__style-row">
            <div className="pb-block__color-group">
              <label>Achtergrond</label>
              <div className="pb-swatches">
                {swatches.map(({ key, color, label }) => (
                  <button
                    key={key}
                    type="button"
                    className={`pb-swatch ${(section.bg_color || null) === (key === 'white' ? null : color) ? 'pb-swatch--active' : ''}`}
                    style={{ background: color }}
                    title={label}
                    onClick={() => onUpdate(section.id, 'bg_color', key === 'white' ? null : color)}
                  />
                ))}
              </div>
            </div>
            <div className="pb-block__color-group">
              <label>Tekstkleur</label>
              <div className="pb-text-color-toggle">
                <button
                  type="button"
                  className={`pb-text-color-btn ${(section.text_color || 'dark') === 'dark' ? 'pb-text-color-btn--active' : ''}`}
                  onClick={() => onUpdate(section.id, 'text_color', 'dark')}
                >
                  <span className="pb-text-color-dot" style={{ background: activeTheme.text }} /> Donker
                </button>
                <button
                  type="button"
                  className={`pb-text-color-btn ${section.text_color === 'light' ? 'pb-text-color-btn--active' : ''}`}
                  onClick={() => onUpdate(section.id, 'text_color', 'light')}
                >
                  <span className="pb-text-color-dot" style={{ background: '#ffffff', border: '1px solid #ccc' }} /> Licht
                </button>
              </div>
            </div>
          </div>
        </div>}
    </div>
  )
}

/* --- Add Section Button --- */
function AddSectionButton({ onAdd }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="pb-add-section">
      {open ? (
        <div className="pb-add-section__menu">
          {SECTION_TYPES.map(t => (
            <button key={t.value} type="button" className="pb-add-section__option" onClick={() => { onAdd(t.value); setOpen(false) }}>
              <i className={t.icon} />
              <span>{t.label}</span>
            </button>
          ))}
          <button type="button" className="pb-add-section__cancel" onClick={() => setOpen(false)}>Annuleren</button>
        </div>
      ) : (
        <button type="button" className="page-builder__add-btn" onClick={() => setOpen(true)}>
          <i className="fa-solid fa-plus" /> Sectie toevoegen
        </button>
      )}
    </div>
  )
}
