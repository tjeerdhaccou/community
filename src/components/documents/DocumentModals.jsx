import { useMemo, useRef, useState } from 'react'
import { useToast } from '../Toast'
import { fileIcon, fileIconColor, formatFileSize, isGoogleLink, linkInfo, normalizeDocUrl } from '../../lib/constants'

export const AUDIENCES = [
  { key: 'group', label: 'Alleen de beheergroep', hint: 'Standaard voor een commissiemap' },
  { key: 'members', label: 'Alle leden', hint: 'Zonder aspirant-leden en gasten' },
  { key: 'aspirants', label: 'Leden en aspirant-leden', hint: 'Iedereen die zich als aspirant heeft aangemeld' },
  { key: 'public', label: 'Iedereen, ook gasten', hint: 'Ook wie het project alleen volgt' },
]

export function audienceText(map) {
  switch (map?.audience) {
    case 'group': return `Alleen zichtbaar voor ${map.owner?.name || 'de beheergroep'}`
    case 'members': return 'Zichtbaar voor alle leden, zonder aspirant-leden'
    case 'aspirants': return 'Zichtbaar voor leden en aspirant-leden'
    case 'public': return 'Zichtbaar voor iedereen, ook gasten'
    default: return ''
  }
}

function Modal({ title, onClose, children, onSubmit }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }} role="dialog" aria-label={title}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Sluiten">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="modal-form">{children}</form>
      </div>
    </div>
  )
}

function useSubmit(onClose) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  async function run(fn, success) {
    setSaving(true)
    try {
      await fn()
      if (success) toast.success(success)
      onClose()
    } catch (err) {
      toast.error(err.message)
      setSaving(false)
    }
  }
  return [saving, run]
}

function FolderSelect({ id, folders, value, onChange }) {
  return (
    <select id={id} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Geen submap</option>
      {folders.map(f => <option key={f.id} value={f.id}>{f.name}{f.group_only ? ' (alleen beheergroep)' : ''}</option>)}
    </select>
  )
}

// ===== Toevoegen: link of bestand =====
export function AddDocumentModal({ maps, folders, defaultMapId, defaultFolderId, onAddFile, onAddLink, onClose }) {
  const fileRef = useRef(null)
  const [mode, setMode] = useState('link')
  const [rawUrl, setRawUrl] = useState('')
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [mapId, setMapId] = useState(maps.some(m => m.id === defaultMapId) ? defaultMapId : (maps[0]?.id || ''))
  const [folderId, setFolderId] = useState(defaultMapId === mapId && defaultFolderId ? defaultFolderId : '')
  const [pinned, setPinned] = useState(false)
  const [saving, run] = useSubmit(onClose)

  const url = normalizeDocUrl(rawUrl)
  const urlInvalid = rawUrl.trim() && !url
  const link = url ? linkInfo(url) : null
  const map = maps.find(m => m.id === mapId)
  const mapFolders = folders.filter(f => f.map_id === mapId)

  function pickFile(e) {
    const f = e.target.files?.[0] || null
    setFile(f)
    if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  const ready = title.trim() && mapId && (mode === 'link' ? !!url : !!file)

  function submit(e) {
    e.preventDefault()
    if (!ready) return
    const base = { title: title.trim(), description: description.trim(), mapId, folderId: folderId || null, pinned }
    run(() => (mode === 'link' ? onAddLink({ ...base, url }) : onAddFile({ ...base, file })), 'Document toegevoegd')
  }

  return (
    <Modal title="Document toevoegen" onClose={onClose} onSubmit={submit}>
      <div className="seg-tabs docs-seg" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'link'} className={`seg-tab ${mode === 'link' ? 'seg-tab--active' : ''}`} onClick={() => setMode('link')}>Link plakken</button>
        <button type="button" role="tab" aria-selected={mode === 'file'} className={`seg-tab ${mode === 'file' ? 'seg-tab--active' : ''}`} onClick={() => setMode('file')}>Bestand uploaden</button>
      </div>

      {mode === 'link' ? (
        <>
          <div className="form-group">
            <label htmlFor="doc-url">Link</label>
            <input id="doc-url" type="text" inputMode="url" autoComplete="off" value={rawUrl}
              onChange={e => setRawUrl(e.target.value)} placeholder="Plak hier een link, bijvoorbeeld van Google Docs" />
            {urlInvalid && <p className="form-error">Dit lijkt geen werkende link. Kopieer hem opnieuw uit de adresbalk.</p>}
            {link && (
              <p className="docs-hint docs-hint--ok">
                <i className={link.icon} style={{ color: link.color }} />
                {link.label === 'Link' ? 'Link herkend.' : `Herkend als ${link.label}.`} Hij opent als {url.replace(/^https?:\/\//, '').slice(0, 48)}{url.length > 56 ? '…' : ''}
              </p>
            )}
          </div>
          {url && isGoogleLink(url) && (
            <div className="docs-warn" role="note">
              <i className="fa-solid fa-circle-info" />
              <div>
                <strong>Kan iedereen het bestand openen?</strong>
                <p>Zet in Google bij Delen de algemene toegang op <em>Iedereen met de link</em>. Anders moeten leden eerst om toegang vragen. Gevoelige stukken kun je beter uploaden.</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="form-group">
          <label>Bestand</label>
          {file ? (
            <div className="file-selected">
              <i className={fileIcon(file.type)} style={{ color: fileIconColor(file.type) }} />
              <span>{file.name}</span>
              <span className="file-selected__size">{formatFileSize(file.size)}</span>
              <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }} aria-label="Bestand weghalen">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
              <i className="fa-solid fa-cloud-arrow-up" /> Bestand kiezen, tot 10 MB
            </button>
          )}
          <input ref={fileRef} type="file" onChange={pickFile} style={{ display: 'none' }} />
        </div>
      )}

      <div className="form-group">
        <label htmlFor="doc-title">Titel</label>
        <input id="doc-title" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Naam van het document" required />
      </div>

      <div className="docs-form-row">
        <div className="form-group">
          <label htmlFor="doc-map">Map</label>
          <select id="doc-map" value={mapId} onChange={e => { setMapId(e.target.value); setFolderId('') }}>
            {maps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="doc-folder">Submap</label>
          <FolderSelect id="doc-folder" folders={mapFolders} value={folderId} onChange={setFolderId} />
        </div>
      </div>
      {map && (
        <p className="docs-hint"><i className="fa-solid fa-lock" /> {audienceText(map)}. Je ziet hier alleen de mappen waar je iets in mag zetten.</p>
      )}

      <div className="form-group">
        <label htmlFor="doc-desc">Toelichting <span className="docs-optional">(mag leeg)</span></label>
        <textarea id="doc-desc" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
      </div>

      <label className="docs-check">
        <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} />
        Vastzetten bovenaan de map
      </label>

      <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Annuleren</button>
        <button type="submit" className="btn-primary" disabled={saving || !ready}>
          {saving ? (mode === 'file' ? 'Uploaden...' : 'Toevoegen...') : 'Toevoegen'}
        </button>
      </div>
    </Modal>
  )
}

// ===== Map maken of instellen =====
export function MapSettingsModal({ map, ownerOptions, allowNoOwner, docCount, onSave, onDelete, onClose }) {
  const isFixed = !!map?.kind
  const [name, setName] = useState(map?.name || '')
  const [owner, setOwner] = useState(map?.owner_workgroup_id || (allowNoOwner ? '' : ownerOptions[0]?.id || ''))
  const [audience, setAudience] = useState(map?.audience || (allowNoOwner ? 'aspirants' : 'group'))
  const [saving, run] = useSubmit(onClose)
  const ownerName = ownerOptions.find(o => o.id === owner)?.name

  function submit(e) {
    e.preventDefault()
    if (!name.trim() || (audience === 'group' && !owner)) return
    run(() => onSave({ name, ownerWorkgroupId: owner || null, audience }), map ? 'Map opgeslagen' : 'Map gemaakt')
  }

  return (
    <Modal title={map ? `Map ${map.name}` : 'Nieuwe map'} onClose={onClose} onSubmit={submit}>
      <div className="form-group">
        <label htmlFor="map-name">Naam</label>
        <input id="map-name" type="text" value={name} onChange={e => setName(e.target.value)} maxLength={80} required />
      </div>

      <div className="form-group">
        <label htmlFor="map-owner">Beheerd door</label>
        <select id="map-owner" value={owner} onChange={e => { setOwner(e.target.value); if (!e.target.value && audience === 'group') setAudience('aspirants') }}>
          {allowNoOwner && <option value="">Moderators en beheerders</option>}
          {ownerOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <p className="docs-hint">Wie de map beheert zet er stukken in, maakt submappen en ruimt op.</p>
      </div>

      <fieldset className="form-group docs-audience" disabled={isFixed}>
        <legend>Wie mag de map lezen</legend>
        {AUDIENCES.map(a => {
          const disabled = a.key === 'group' && !owner
          return (
            <label key={a.key} className={`docs-audience__opt ${audience === a.key ? 'is-on' : ''} ${disabled ? 'is-disabled' : ''}`}>
              <input type="radio" name="audience" value={a.key} checked={audience === a.key} disabled={disabled}
                onChange={() => setAudience(a.key)} />
              <span>
                <strong>{a.key === 'group' && ownerName ? `Alleen ${ownerName}` : a.label}</strong>
                <small>{a.hint}</small>
              </span>
            </label>
          )
        })}
        {isFixed && <p className="docs-hint">Dit is een vaste map van het project; de zichtbaarheid ligt vast.</p>}
      </fieldset>

      <div className="modal-actions">
        {map && !isFixed && onDelete && (
          <button type="button" className="btn-danger docs-actions-left" disabled={saving || docCount > 0}
            title={docCount > 0 ? 'Verplaats of verwijder eerst de documenten' : undefined}
            onClick={() => run(onDelete, 'Map verwijderd')}>
            Map verwijderen
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={onClose}>Annuleren</button>
        <button type="submit" className="btn-primary" disabled={saving || !name.trim()}>Opslaan</button>
      </div>
    </Modal>
  )
}

// ===== Submap maken of hernoemen =====
export function FolderModal({ folder, map, onSave, onDelete, onClose }) {
  const [name, setName] = useState(folder?.name || '')
  const [groupOnly, setGroupOnly] = useState(!!folder?.group_only)
  const [saving, run] = useSubmit(onClose)
  const canRestrict = !!map?.owner_workgroup_id && map.audience !== 'group'

  function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    run(() => onSave({ name, groupOnly: canRestrict && groupOnly }), folder ? 'Submap opgeslagen' : 'Submap gemaakt')
  }

  return (
    <Modal title={folder ? 'Submap aanpassen' : `Nieuwe submap in ${map?.name}`} onClose={onClose} onSubmit={submit}>
      <div className="form-group">
        <label htmlFor="folder-name">Naam</label>
        <input id="folder-name" type="text" value={name} onChange={e => setName(e.target.value)} maxLength={80} required autoFocus />
      </div>
      {canRestrict && (
        <label className="docs-check">
          <input type="checkbox" checked={groupOnly} onChange={e => setGroupOnly(e.target.checked)} />
          Alleen voor {map.owner?.name}, bijvoorbeeld voor concepten
        </label>
      )}
      <div className="modal-actions">
        {folder && onDelete && (
          <button type="button" className="btn-danger docs-actions-left" disabled={saving}
            onClick={() => run(onDelete, 'Submap verwijderd')}>
            Verwijderen
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={onClose}>Annuleren</button>
        <button type="submit" className="btn-primary" disabled={saving || !name.trim()}>Opslaan</button>
      </div>
    </Modal>
  )
}

// ===== Document verplaatsen =====
export function MoveModal({ doc, maps, folders, onMove, onClose }) {
  const startMap = maps.some(m => m.id === doc.map_id) ? doc.map_id : (maps[0]?.id || '')
  const [mapId, setMapId] = useState(startMap)
  const [folderId, setFolderId] = useState(doc.map_id === startMap ? (doc.folder_id || '') : '')
  const [saving, run] = useSubmit(onClose)
  const mapFolders = useMemo(() => folders.filter(f => f.map_id === mapId), [folders, mapId])
  const map = maps.find(m => m.id === mapId)

  function submit(e) {
    e.preventDefault()
    run(() => onMove({ map_id: mapId, folder_id: folderId || null }), 'Document verplaatst')
  }

  return (
    <Modal title={`${doc.title} verplaatsen`} onClose={onClose} onSubmit={submit}>
      <div className="docs-form-row">
        <div className="form-group">
          <label htmlFor="move-map">Map</label>
          <select id="move-map" value={mapId} onChange={e => { setMapId(e.target.value); setFolderId('') }}>
            {maps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="move-folder">Submap</label>
          <FolderSelect id="move-folder" folders={mapFolders} value={folderId} onChange={setFolderId} />
        </div>
      </div>
      {map && <p className="docs-hint"><i className="fa-solid fa-lock" /> {audienceText(map)}.</p>}
      <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Annuleren</button>
        <button type="submit" className="btn-primary" disabled={saving || !mapId}>Verplaatsen</button>
      </div>
    </Modal>
  )
}
