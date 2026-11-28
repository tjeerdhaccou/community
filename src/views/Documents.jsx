import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProject } from '../contexts/ProjectContext'
import { canDo } from '../lib/permissions'
import { useDocumentMaps } from '../hooks/useDocumentMaps'
import { useWorkgroups } from '../hooks/useWorkgroups'
import { supabase } from '../lib/supabase'
import { toStoragePath } from '../lib/storage'
import { getDocumentShareUrl } from '../lib/subdomain'
import { logger } from '../lib/logger'
import { useToast } from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import { DocRow, DocTile, isImageDoc } from '../components/documents/DocRow'
import {
  AddDocumentModal, FolderModal, MapSettingsModal, MoveModal, audienceText,
} from '../components/documents/DocumentModals'

const MAX_TILES = 4
const MEETINGS = 'vergaderingen'

const byPinnedThenNew = (a, b) =>
  Number(!!b.pinned) - Number(!!a.pinned) || new Date(b.created_at) - new Date(a.created_at)

// Ondertekende links voor voorbeelden van plaatjes (een uur geldig).
function useThumbs(docs) {
  const [urls, setUrls] = useState({})
  const paths = useMemo(() => [...new Set(
    docs.filter(isImageDoc).map(d => toStoragePath(d.file_path)).filter(Boolean)
  )].slice(0, 100), [docs])
  const key = paths.join('|')
  useEffect(() => {
    const missing = paths.filter(p => !urls[p])
    if (!missing.length) return
    let cancelled = false
    supabase.storage.from('project-files').createSignedUrls(missing, 3600).then(({ data, error }) => {
      if (error) { logger.error('Documents.thumbs', error); return }
      if (cancelled) return
      setUrls(prev => {
        const next = { ...prev }
        for (const r of data || []) if (r.signedUrl && r.path) next[r.path] = r.signedUrl
        return next
      })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return (doc) => (isImageDoc(doc) ? urls[toStoragePath(doc.file_path)] || null : null)
}

export default function Documents() {
  const { role, readOnly } = useProject()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const {
    maps, folders, docs, meetingFiles, loading, mapById, folderById, membersMap,
    docsInMap, placeOf, addFile, addLink, updateDoc, removeDoc,
    saveMap, deleteMap, saveFolder, deleteFolder,
  } = useDocumentMaps()
  const { allWorkgroups, myWorkgroups, loading: wgLoading } = useWorkgroups()

  const mapId = params.get('map')
  const subId = params.get('sub')
  const query = params.get('q') || ''
  const currentMap = mapId ? mapById[mapId] : null
  const currentFolder = subId && subId !== MEETINGS ? folderById[subId] : null

  const [showAllTiles, setShowAllTiles] = useState(false)
  const [switchOpen, setSwitchOpen] = useState(false)
  const [modal, setModal] = useState(null) // { type, ... }
  const [confirmDel, setConfirmDel] = useState(null)
  const [layout, setLayout] = useState(null) // 'list' | 'grid' | null = vanzelf

  const isModerator = !readOnly && canDo(role, 'manage_workgroups')
  const myGroupIds = useMemo(() => new Set(myWorkgroups.map(w => w.id)), [myWorkgroups])
  const canView = (action) => canDo(role, action)
  const canManage = (map) => !!map && !readOnly && (
    isModerator || (!!map.owner_workgroup_id && myGroupIds.has(map.owner_workgroup_id) && canView('view_all_docs'))
  )
  const manageableMaps = maps.filter(canManage)
  const canCreateMap = !readOnly && (isModerator || (myWorkgroups.length > 0 && canView('view_all_docs')))
  const showMeetings = canView('view_meetings')
  const getThumb = useThumbs(docs)

  // Een map uit de url die er niet (meer) is: terug naar het overzicht.
  useEffect(() => {
    if (!loading && mapId && !currentMap) setParams({}, { replace: true })
  }, [loading, mapId, currentMap, setParams])

  function go(next) {
    setSwitchOpen(false)
    setLayout(null)
    const p = {}
    if (next.map) p.map = next.map
    if (next.sub) p.sub = next.sub
    if (next.q) p.q = next.q
    setParams(p)
  }

  const countFor = (map) => docsInMap(map).length + (map.kind === 'members' && showMeetings ? meetingFiles.length : 0)

  function subsOf(map) {
    const list = folders.filter(f => f.map_id === map.id)
      .map(f => ({ id: f.id, name: f.name, groupOnly: f.group_only }))
    if (map.kind === 'members' && showMeetings) list.push({ id: MEETINGS, name: 'Uit vergaderingen', auto: true })
    return list
  }

  function actionsFor(doc) {
    const list = []
    if (doc.source === 'document') {
      const map = placeOf(doc)?.map
      const may = canManage(map) || (!doc.map_id && !readOnly && isModerator)
      if (may) {
        list.push({ label: doc.pinned ? 'Losmaken' : 'Vastzetten', icon: 'fa-solid fa-thumbtack',
          onClick: () => updateDoc(doc.id, { pinned: !doc.pinned }).catch(e => toast.error(e.message)) })
        if (manageableMaps.length) list.push({ label: 'Verplaatsen', icon: 'fa-solid fa-folder-tree', onClick: () => setModal({ type: 'move', doc }) })
      }
      if (doc.share_code) list.push({ label: 'Kopieer deellink', icon: 'fa-solid fa-link', onClick: () => copyShare(doc) })
      if (may) list.push({ label: 'Verwijderen', icon: 'fa-solid fa-trash', danger: true, onClick: () => setConfirmDel(doc) })
    }
    return list
  }

  async function copyShare(doc) {
    try {
      await navigator.clipboard.writeText(getDocumentShareUrl(doc.share_code))
      toast.success('Deellink gekopieerd')
    } catch {
      toast.error('Kopiëren mislukt')
    }
  }

  async function handleDelete() {
    const doc = confirmDel
    setConfirmDel(null)
    try {
      await removeDoc(doc)
      toast.success('Document verwijderd')
    } catch (err) {
      toast.error(err.message)
    }
  }

  function rows(list, { withPlace = false } = {}) {
    return (
      <div className="doc-list docs-list">
        {list.map(doc => {
          const place = withPlace ? placeOf(doc) : null
          return (
            <DocRow key={`${doc.source}-${doc.id}`} doc={doc} thumb={getThumb(doc)}
              place={place?.label}
              onPlace={place ? () => go({ map: place.map.id, sub: place.folderId }) : undefined}
              actions={actionsFor(doc)} />
          )
        })}
      </div>
    )
  }

  // ===== Mappenmenu (links, en in het paneel op een smal scherm) =====
  const tree = (
    <div className="docs-tree__list">
      <button type="button" className={`docs-tree__item ${!currentMap && !query ? 'is-active' : ''}`} onClick={() => go({})}>
        <span className="docs-tree__name">Overzicht</span>
      </button>
      <div className="docs-label docs-tree__label">Mappen</div>
      {maps.map(m => {
        const open = currentMap?.id === m.id
        return (
          <div key={m.id}>
            <button type="button" className={`docs-tree__item ${open && !subId ? 'is-active' : ''} ${open ? 'is-open' : ''}`}
              onClick={() => go({ map: m.id })} aria-expanded={open}>
              <i className={`fa-${open ? 'solid fa-folder-open' : 'regular fa-folder'}`} />
              <span className="docs-tree__name">{m.name}</span>
              {m.audience === 'group' && <i className="fa-solid fa-lock docs-tree__lock" aria-label="Alleen de beheergroep" />}
              <span className="docs-tree__count">{countFor(m) || ''}</span>
            </button>
            {open && subsOf(m).length > 0 && (
              <div className="docs-tree__subs">
                {subsOf(m).map(s => (
                  <button key={s.id} type="button" className={`docs-tree__sub ${subId === s.id ? 'is-active' : ''}`}
                    onClick={() => go({ map: m.id, sub: s.id })}>
                    {s.name}
                    {s.groupOnly && <i className="fa-solid fa-lock docs-tree__lock" aria-label="Alleen de beheergroep" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {canCreateMap && (
        <button type="button" className="docs-tree__item docs-tree__new" onClick={() => setModal({ type: 'map' })}>
          <i className="fa-solid fa-plus" /> <span className="docs-tree__name">Nieuwe map</span>
        </button>
      )}
    </div>
  )

  const whereLabel = query ? 'Zoeken'
    : !currentMap ? 'Overzicht'
    : subId ? `${currentMap.name} / ${subId === MEETINGS ? 'Uit vergaderingen' : currentFolder?.name || ''}`
    : currentMap.name

  // ===== Inhoud =====
  let content
  if (loading || wgLoading) {
    content = <div className="loading-inline"><p>Documenten laden...</p></div>
  } else if (query) {
    const q = query.toLowerCase()
    const found = [...docs, ...(showMeetings ? meetingFiles : [])].filter(d =>
      [d.title, d.file_name, d.description, d.author?.full_name, d.meeting_title]
        .some(v => v?.toLowerCase().includes(q))
    ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    content = found.length
      ? <>{<div className="docs-label">{found.length} {found.length === 1 ? 'resultaat' : 'resultaten'}</div>}{rows(found, { withPlace: true })}</>
      : <Empty text={`Niets gevonden voor "${query}". Probeer een ander woord.`} />
  } else if (!currentMap) {
    const pinned = docs.filter(d => d.pinned).slice(0, 8)
    const recent = [...docs, ...(showMeetings ? meetingFiles : [])]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8)
    const tiles = showAllTiles ? maps : maps.slice(0, MAX_TILES)
    content = (
      <>
        {pinned.length > 0 && (
          <section className="docs-section">
            <div className="docs-label">Vastgezet</div>
            {rows(pinned, { withPlace: true })}
          </section>
        )}
        <section className="docs-section">
          <div className="docs-tiles" data-tour="docs-maps">
            {tiles.map(m => (
              <button key={m.id} type="button" className="docs-maptile" onClick={() => go({ map: m.id })}>
                <span className="docs-maptile__name">{m.name}</span>
                <span className="docs-maptile__who">{audienceText(m)}</span>
                <span className="docs-maptile__meta">
                  {countFor(m)} {countFor(m) === 1 ? 'document' : 'documenten'}
                  {subsOf(m).length > 0 && ` · ${subsOf(m).map(s => s.name).join(', ')}`}
                </span>
              </button>
            ))}
          </div>
          {maps.length > MAX_TILES && (
            <button type="button" className="docs-more" onClick={() => setShowAllTiles(v => !v)} aria-expanded={showAllTiles}>
              {showAllTiles ? 'Minder tonen' : `Nog ${maps.length - MAX_TILES} ${maps.length - MAX_TILES === 1 ? 'map' : 'mappen'}`}
              <i className={`fa-solid fa-chevron-${showAllTiles ? 'up' : 'down'}`} />
            </button>
          )}
        </section>
        <section className="docs-section">
          <div className="docs-label">Recent toegevoegd</div>
          {recent.length ? rows(recent, { withPlace: true }) : <Empty text="Nog geen documenten. Voeg een link of bestand toe om te beginnen." />}
        </section>
      </>
    )
  } else if (!subId) {
    const inMap = docsInMap(currentMap)
    const subs = subsOf(currentMap)
    const loose = inMap.filter(d => !d.folder_id || !folderById[d.folder_id] || folderById[d.folder_id].map_id !== currentMap.id).sort(byPinnedThenNew)
    content = (
      <>
        {subs.length > 0 && (
          <div className="docs-folders">
            {subs.map(s => {
              const n = s.id === MEETINGS ? meetingFiles.length : inMap.filter(d => d.folder_id === s.id).length
              return (
                <button key={s.id} type="button" className={`docs-folder ${s.auto ? 'docs-folder--auto' : ''}`}
                  onClick={() => go({ map: currentMap.id, sub: s.id })}>
                  <span className="docs-folder__icon"><i className={s.auto ? 'fa-solid fa-people-group' : 'fa-regular fa-folder'} /></span>
                  <span className="docs-folder__text">
                    <span className="docs-folder__name">{s.name}</span>
                    <span className="docs-folder__meta">{n} {n === 1 ? 'document' : 'documenten'}{s.auto ? ', vult zichzelf' : ''}</span>
                    {s.groupOnly && <span className="docs-lock"><i className="fa-solid fa-lock" /> Alleen {currentMap.owner?.name || 'beheergroep'}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        )}
        {loose.length > 0 && (
          <section className="docs-section">
            <div className="docs-label">{subs.length ? 'Los in deze map' : 'Documenten'}</div>
            {rows(loose)}
          </section>
        )}
        {!subs.length && !loose.length && (
          <Empty text={canManage(currentMap) ? 'Deze map is nog leeg. Voeg een document toe of maak een submap.' : 'Deze map is nog leeg.'} />
        )}
      </>
    )
  } else {
    const list = subId === MEETINGS ? meetingFiles : docsInMap(currentMap).filter(d => d.folder_id === subId).sort(byPinnedThenNew)
    const auto = list.length > 0 && list.filter(isImageDoc).length * 2 >= list.length ? 'grid' : 'list'
    const mode = layout || auto
    content = list.length === 0 ? <Empty text="Deze submap is nog leeg." /> : mode === 'grid' ? (
      <div className="docs-grid">
        {list.map(doc => <DocTile key={`${doc.source}-${doc.id}`} doc={doc} thumb={getThumb(doc)} actions={actionsFor(doc)} />)}
      </div>
    ) : rows(list)
    content = (
      <>
        <div className="docs-subbar">
          <div className="seg-tabs docs-seg" role="tablist" aria-label="Weergave">
            <button type="button" role="tab" aria-selected={mode === 'list'} className={`seg-tab ${mode === 'list' ? 'seg-tab--active' : ''}`} onClick={() => setLayout('list')}>Lijst</button>
            <button type="button" role="tab" aria-selected={mode === 'grid'} className={`seg-tab ${mode === 'grid' ? 'seg-tab--active' : ''}`} onClick={() => setLayout('grid')}>Raster</button>
          </div>
        </div>
        {content}
      </>
    )
  }

  const subTitle = subId === MEETINGS ? 'Uit vergaderingen' : currentFolder?.name

  return (
    <div className="view-documents-unified docs-view">
      <div className="view-header">
        <div className="view-header__row">
          <h1>Documenten</h1>
          {manageableMaps.length > 0 && (
            <button className="btn-primary" onClick={() => setModal({ type: 'add' })}>
              <i className="fa-solid fa-plus" /> Toevoegen
            </button>
          )}
        </div>
        <p className="docs-intro">Elke map is gedeeld met een vaste groep. Plak een Google-link of upload een bestand, en zet het waar het hoort.</p>
      </div>

      <div className="docs-layout">
        <div className="docs-layout__inner">
        <nav className="docs-tree" aria-label="Mappen">{tree}</nav>

        <div className="docs-main">
          <div className="docs-switch">
            <button type="button" className="docs-switch__btn" onClick={() => setSwitchOpen(o => !o)} aria-expanded={switchOpen}>
              <i className="fa-regular fa-folder" /> <span>{whereLabel}</span>
              <i className={`fa-solid fa-chevron-${switchOpen ? 'up' : 'down'}`} />
            </button>
            {switchOpen && <div className="docs-switch__panel">{tree}</div>}
          </div>

          <form className="search-bar docs-search" role="search" onSubmit={e => e.preventDefault()}>
            <i className="fa-solid fa-magnifying-glass search-bar__icon" />
            <input type="search" value={query} placeholder="Zoek in alle mappen" aria-label="Zoek in alle mappen"
              className="search-bar__input"
              onChange={e => setParams(e.target.value ? { q: e.target.value } : (currentMap ? { map: currentMap.id, ...(subId ? { sub: subId } : {}) } : {}), { replace: true })} />
            {query && (
              <button type="button" className="search-bar__clear" onClick={() => go({})} aria-label="Wissen">
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </form>

          {currentMap && !query && (
            <div className="docs-head">
              <div className="docs-head__text">
                <div className="docs-crumbs">
                  <button type="button" onClick={() => go({})}>Documenten</button> /{' '}
                  {subId
                    ? <><button type="button" onClick={() => go({ map: currentMap.id })}>{currentMap.name}</button> /</>
                    : null}
                </div>
                <h2>{subId ? subTitle : currentMap.name}</h2>
                <div className="docs-who">
                  <span className="docs-who__owner">
                    <span className="docs-avatar">{initials(currentMap.owner?.name || 'Moderators')}</span>
                    Beheerd door <strong>{currentMap.owner?.name || 'moderators en beheerders'}</strong>
                  </span>
                  <span><i className="fa-solid fa-lock" /> {currentFolder?.group_only ? `Alleen zichtbaar voor ${currentMap.owner?.name}` : audienceText(currentMap)}</span>
                </div>
              </div>
              {canManage(currentMap) && (
                <div className="docs-head__actions">
                  {!subId && (
                    <button type="button" className="btn-secondary" onClick={() => setModal({ type: 'folder' })}>Nieuwe submap</button>
                  )}
                  {currentFolder && (
                    <button type="button" className="btn-secondary" onClick={() => setModal({ type: 'folder', folder: currentFolder })}>Submap aanpassen</button>
                  )}
                  {!subId && (
                    <button type="button" className="btn-icon" aria-label="Instellingen van de map" title="Instellingen van de map"
                      onClick={() => setModal({ type: 'map', map: currentMap })}>
                      <i className="fa-solid fa-gear" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {content}
        </div>
        </div>
      </div>

      {modal?.type === 'add' && (
        <AddDocumentModal maps={manageableMaps} folders={folders}
          defaultMapId={currentMap?.id} defaultFolderId={currentFolder?.id}
          onAddFile={addFile} onAddLink={addLink} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'map' && (
        <MapSettingsModal map={modal.map}
          ownerOptions={isModerator ? allWorkgroups : myWorkgroups}
          allowNoOwner={isModerator}
          docCount={modal.map ? docsInMap(modal.map).length : 0}
          onSave={async (v) => { const id = await saveMap(modal.map?.id, v); if (!modal.map) go({ map: id }) }}
          onDelete={modal.map ? async () => { await deleteMap(modal.map.id); go({}) } : null}
          onClose={() => setModal(null)} />
      )}
      {modal?.type === 'folder' && currentMap && (
        <FolderModal folder={modal.folder} map={currentMap}
          onSave={(v) => saveFolder(modal.folder?.id, { ...v, mapId: currentMap.id })}
          onDelete={modal.folder ? async () => { await deleteFolder(modal.folder.id); go({ map: currentMap.id }) } : null}
          onClose={() => setModal(null)} />
      )}
      {modal?.type === 'move' && (
        <MoveModal doc={modal.doc} maps={manageableMaps} folders={folders}
          onMove={(patch) => updateDoc(modal.doc.id, patch)} onClose={() => setModal(null)} />
      )}
      {confirmDel && (
        <ConfirmModal
          message={`"${confirmDel.title || confirmDel.file_name}" verwijderen? Dit kan niet ongedaan worden gemaakt.`}
          confirmLabel="Verwijderen" danger
          onConfirm={handleDelete} onCancel={() => setConfirmDel(null)} />
      )}
    </div>
  )
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function Empty({ text }) {
  return (
    <div className="empty-inline">
      <i className="fa-solid fa-folder-open" />
      <p>{text}</p>
    </div>
  )
}
