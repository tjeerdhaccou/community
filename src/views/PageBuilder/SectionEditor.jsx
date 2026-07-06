import { useState } from 'react'
import { SECTION_TYPES, COLOR_THEMES, getThemeSwatches } from './constants'

/* --- Section Editor --- */
export default function SectionEditor({ section, index, total, colorTheme, projectMembers, onUpdate, onDelete, onMove, onImageUpload, onCarouselAdd, onCarouselRemove, onCardImageUpload, onConceptSave }) {
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
