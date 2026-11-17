import { useState, useMemo, useRef } from 'react'
import { useProject } from '../contexts/ProjectContext'
import { useAuth } from '../contexts/AuthContext'
import { canDo, canManageGroupDocs } from '../lib/permissions'
import { useAllDocuments } from '../hooks/useAllDocuments'
import { useWorkgroups } from '../hooks/useWorkgroups'
import CollapsibleTagFilter from '../components/CollapsibleTagFilter'
import { openProjectFile } from '../lib/storage'
import { getDocumentShareUrl } from '../lib/subdomain'
import { useToast } from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import {
  PROJECT_PHASES, formatFileSize, fileIcon, fileIconColor, linkInfo, timeAgo,
} from '../lib/constants'

const CATEGORY_LABELS = {
  ontwerp_visualisatie: 'Ontwerp & Visualisatie',
  juridisch: 'Juridisch',
  vergunning_technisch: 'Vergunning & Technisch',
  financieel: 'Financieel',
  verkoop_informatie: 'Verkoop & Informatie',
  vergadering: 'Vergadering',
  overig: 'Overig',
}

const MEETING_FILE_CATS = [
  { key: 'all', label: 'Alles' },
  { key: 'agenda', label: 'Agenda' },
  { key: 'minutes', label: 'Notulen' },
  { key: 'presentation', label: 'Presentatie' },
  { key: 'attachment', label: 'Bijlage' },
]

export default function Documents() {
  const { role, isLightProject, readOnly } = useProject()
  const { user } = useAuth()
  const toast = useToast()
  const {
    allDocuments, gebouwDocs, infoDocs, otherPublicDocs, memberDocs,
    getDocsForWorkgroup, vergaderingDocs, loading, uploadDocument, removeDoc,
  } = useAllDocuments()
  const { allWorkgroups, myWorkgroups, loading: wgLoading } = useWorkgroups()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [meetingCat, setMeetingCat] = useState('all')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)

  // Spiegelt de RLS van migratie 064: moderators+ delen met iedereen of met een
  // groep, commissieleden alleen met hun eigen commissie.
  const isModerator = canDo(role, 'manage_workgroups')
  const myCommissies = useMemo(() => myWorkgroups.filter(wg => wg.type === 'commissie'), [myWorkgroups])
  const canUpload = !readOnly && canManageGroupDocs(role, myCommissies.length > 0)
  const shareGroups = isModerator ? allWorkgroups : myCommissies

  function canDelete(doc) {
    if (readOnly || doc.source !== 'document') return false
    return role === 'admin' || (doc.author?.id === user?.id && myCommissies.length > 0)
  }

  async function handleDelete() {
    const doc = confirmDel
    setConfirmDel(null)
    try {
      await removeDoc(doc.id, doc.source, doc.doc_type === 'link' ? null : doc.file_path)
      toast.success('Document verwijderd')
    } catch (err) {
      toast.error(err.message)
    }
  }

  // Een light-groep heeft één lijst: de indeling in tabs volgt categorieën die
  // alleen aan de beheerkant te kiezen zijn.
  const tabs = useMemo(() => {
    if (isLightProject) return []
    const t = []

    t.push({ key: 'gebouw', label: 'Ontwerp', icon: 'fa-solid fa-building' })
    t.push({ key: 'info', label: 'Praktische info', icon: 'fa-solid fa-circle-info' })

    if (canDo(role, 'view_meetings')) {
      t.push({ key: 'vergaderingen', label: 'Vergaderingen', icon: 'fa-solid fa-users' })
    }

    if (canDo(role, 'view_all_docs')) {
      t.push({ key: 'dossier', label: 'Voor alle leden', icon: 'fa-solid fa-folder-open' })
    }

    if (canDo(role, 'join_workgroup')) {
      for (const wg of myWorkgroups) {
        t.push({
          key: `wg-${wg.id}`,
          label: wg.name,
          icon: wg.type === 'commissie' ? 'fa-solid fa-people-group' : 'fa-solid fa-users-rectangle',
          workgroupId: wg.id,
        })
      }
    }

    return t
  }, [role, myWorkgroups, isLightProject])

  // Default to first available tab
  const [tab, setTab] = useState(tabs[0]?.key || 'gebouw')

  // Ensure selected tab is valid
  const activeTab = isLightProject ? 'alles' : tabs.find(t => t.key === tab) ? tab : (tabs[0]?.key || 'gebouw')

  // Get docs for current tab
  const tabDocs = useMemo(() => {
    switch (activeTab) {
      case 'alles':
        return allDocuments
      case 'gebouw':
        return gebouwDocs
      case 'info':
        return [...infoDocs, ...otherPublicDocs]
      case 'vergaderingen':
        return vergaderingDocs
      case 'dossier':
        return memberDocs
      default:
        if (activeTab.startsWith('wg-')) {
          const wgId = activeTab.replace('wg-', '')
          return getDocsForWorkgroup(wgId)
        }
        return []
    }
  }, [activeTab, allDocuments, gebouwDocs, infoDocs, otherPublicDocs, vergaderingDocs, memberDocs, getDocsForWorkgroup])

  // Apply filters
  const filtered = useMemo(() => {
    let result = tabDocs

    // Category filter (dossier tab)
    if (activeTab === 'dossier' && categoryFilter !== 'all') {
      result = result.filter(d => d.category === categoryFilter)
    }

    // Meeting category filter
    if (activeTab === 'vergaderingen' && meetingCat !== 'all') {
      result = result.filter(d => d.subcategory === meetingCat)
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(d =>
        d.file_name?.toLowerCase().includes(q) ||
        d.title?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.author?.full_name?.toLowerCase().includes(q) ||
        d.meeting_title?.toLowerCase().includes(q)
      )
    }

    return result
  }, [tabDocs, activeTab, categoryFilter, meetingCat, search])

  // Count per tab
  const counts = useMemo(() => {
    const c = {
      gebouw: gebouwDocs.length,
      info: infoDocs.length + otherPublicDocs.length,
      vergaderingen: vergaderingDocs.length,
      dossier: memberDocs.length,
    }
    for (const wg of myWorkgroups) {
      c[`wg-${wg.id}`] = getDocsForWorkgroup(wg.id).length
    }
    return c
  }, [gebouwDocs, infoDocs, otherPublicDocs, vergaderingDocs, memberDocs, myWorkgroups, getDocsForWorkgroup])

  return (
    <div className="view-documents-unified">
      <div className="view-header">
        <div className="view-header__row">
          <h1>Projectdossier</h1>
          {canUpload && (
            <button className="btn-primary" onClick={() => setUploadOpen(true)}>
              <i className="fa-solid fa-plus" /> Document toevoegen
            </button>
          )}
        </div>
      </div>

      {tabs.length > 0 && <div className="seg-tabs">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`seg-tab ${activeTab === t.key ? 'seg-tab--active' : ''}`}
            data-tour={`doc-tab-${t.key}`}
            onClick={() => { setTab(t.key); setCategoryFilter('all'); setMeetingCat('all') }}
          >
            {t.label}
            {(counts[t.key] || 0) > 0 && <span className="seg-tab__count">{counts[t.key]}</span>}
          </button>
        ))}
      </div>}

      {/* Search */}
      <div className="search-bar">
        <i className="fa-solid fa-magnifying-glass search-bar__icon" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Zoeken in documenten..."
          className="search-bar__input"
          aria-label="Zoeken"
        />
        {search && (
          <button className="search-bar__clear" onClick={() => setSearch('')} aria-label="Wissen">
            <i className="fa-solid fa-xmark" />
          </button>
        )}
      </div>

      {/* Filter pills */}
      {activeTab === 'dossier' && (
        <CollapsibleTagFilter>
          {[{ key: 'all', label: 'Alle categorieën' }, ...Object.entries(CATEGORY_LABELS).map(([key, label]) => ({ key, label }))].map(c => (
            <button
              key={c.key}
              className={`tag-filter__pill ${categoryFilter === c.key ? 'tag-filter__pill--active' : ''}`}
              onClick={() => setCategoryFilter(c.key)}
            >
              {c.label}
            </button>
          ))}
        </CollapsibleTagFilter>
      )}
      {activeTab === 'vergaderingen' && (
        <CollapsibleTagFilter>
          {MEETING_FILE_CATS.map(c => (
            <button
              key={c.key}
              className={`tag-filter__pill ${meetingCat === c.key ? 'tag-filter__pill--active' : ''}`}
              onClick={() => setMeetingCat(c.key)}
            >
              {c.label}
            </button>
          ))}
        </CollapsibleTagFilter>
      )}

      {/* Document list */}
      {loading || wgLoading ? (
        <div className="loading-inline"><p>Documenten laden...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-inline">
          <i className="fa-solid fa-folder-open" />
          <p>{search ? `Geen resultaten voor "${search}"` : emptyMessage(activeTab)}</p>
        </div>
      ) : (
        <div className="doc-list">
          {filtered.map(doc => (
            <DocumentRow
              key={`${doc.source}-${doc.id}`}
              doc={doc}
              showCategory={activeTab === 'dossier'}
              groupNames={activeTab === 'alles' ? groupNamesFor(doc, allWorkgroups) : null}
              onDelete={canDelete(doc) ? () => setConfirmDel(doc) : undefined}
            />
          ))}
        </div>
      )}

      {uploadOpen && (
        <UploadModal
          canShareWithAll={isModerator}
          groups={shareGroups}
          defaultGroupId={activeTab.startsWith('wg-') ? activeTab.replace('wg-', '') : null}
          onSave={uploadDocument}
          onClose={() => setUploadOpen(false)}
        />
      )}
      {confirmDel && (
        <ConfirmModal
          message={`"${confirmDel.title || confirmDel.file_name}" verwijderen? Dit kan niet ongedaan worden gemaakt.`}
          confirmLabel="Verwijderen"
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  )
}

function groupNamesFor(doc, workgroups) {
  if (doc.visibility !== 'groups') return null
  const names = workgroups.filter(wg => doc.workgroup_ids?.includes(wg.id)).map(wg => wg.name)
  return names.length > 0 ? names.join(', ') : null
}

function emptyMessage(tab) {
  switch (tab) {
    case 'alles': return 'Nog geen documenten'
    case 'gebouw': return 'Nog geen ontwerpdocumenten'
    case 'info': return 'Nog geen praktische informatie'
    case 'vergaderingen': return 'Nog geen vergaderdocumenten'
    case 'dossier': return 'Nog geen projectdocumenten'
    default: return 'Nog geen documenten in deze groep'
  }
}

// ===== Document Row =====
function DocumentRow({ doc, showCategory, groupNames, onDelete }) {
  const toast = useToast()
  const isLink = doc.doc_type === 'link'
  const link = isLink ? linkInfo(doc.url) : null
  const href = isLink ? doc.url : doc.file_path
  // External links open directly; stored files resolve a short-lived signed URL.
  const openFile = isLink ? undefined : (e) => { e.preventDefault(); openProjectFile(doc.file_path) }

  async function copyShareLink(e) {
    e.preventDefault()
    try {
      await navigator.clipboard.writeText(getDocumentShareUrl(doc.share_code))
      toast.success('Deellink gekopieerd')
    } catch {
      toast.error('Kopiëren mislukt')
    }
  }

  return (
    <div className="doc-row">
      <div className="doc-row__icon">
        {isLink
          ? <i className={link.icon} style={{ color: link.color }} />
          : <i className={fileIcon(doc.file_type)} style={{ color: fileIconColor(doc.file_type) }} />
        }
      </div>
      <div className="doc-row__info">
        <a href={href} onClick={openFile} target="_blank" rel="noopener noreferrer" className="doc-row__title">
          {doc.title || doc.file_name}
          {isLink && <i className="fa-solid fa-arrow-up-right-from-square doc-row__external" />}
        </a>
        <div className="doc-row__meta">
          {showCategory && doc.category && (
            <span className="doc-row__source" style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>
              {CATEGORY_LABELS[doc.category] || doc.category}
            </span>
          )}
          {groupNames && <span className="doc-row__badge">{groupNames}</span>}
          {isLink && <span className="doc-row__badge">{link.label}</span>}
          {doc.phase && <span className="doc-row__badge">{doc.phase}</span>}
          {doc.subcategory && doc.source === 'vergadering' && (
            <span className="doc-row__badge">{doc.subcategory}</span>
          )}
          {doc.meeting_title && <span>{doc.meeting_title}</span>}
          {doc.author?.full_name && <span>{doc.author.full_name}</span>}
          {!isLink && doc.file_size > 0 && <span>{formatFileSize(doc.file_size)}</span>}
          <span>{timeAgo(doc.created_at)}</span>
        </div>
      </div>
      <div className="doc-row__actions">
        {doc.share_code && (
          <button type="button" onClick={copyShareLink} className="doc-row__btn" title="Kopieer deellink">
            <i className="fa-solid fa-link" />
          </button>
        )}
        {isLink ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="doc-row__btn" title="Openen">
            <i className="fa-solid fa-arrow-up-right-from-square" />
          </a>
        ) : (
          <a href={href} onClick={openFile} className="doc-row__btn" title="Downloaden">
            <i className="fa-solid fa-download" />
          </a>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete} className="doc-row__btn doc-row__btn--danger" title="Verwijderen" aria-label="Verwijderen">
            <i className="fa-solid fa-trash" />
          </button>
        )}
      </div>
    </div>
  )
}

function UploadModal({ canShareWithAll, groups, defaultGroupId, onSave, onClose }) {
  const toast = useToast()
  const fileRef = useRef(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [audience, setAudience] = useState(
    defaultGroupId && groups.some(g => g.id === defaultGroupId) ? defaultGroupId
      : canShareWithAll ? 'members' : (groups[0]?.id || '')
  )
  const [saving, setSaving] = useState(false)

  function pickFile(e) {
    const f = e.target.files?.[0] || null
    setFile(f)
    if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || !file || !audience) return
    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        visibility: audience === 'members' ? 'members' : 'groups',
        groupIds: audience === 'members' ? [] : [audience],
        file,
      })
      toast.success('Document toegevoegd')
      onClose()
    } catch (err) {
      toast.error(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <h2>Document toevoegen</h2>
          <button className="modal-close" onClick={onClose} aria-label="Sluiten">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Bestand *</label>
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
                <i className="fa-solid fa-cloud-arrow-up" /> Bestand kiezen
              </button>
            )}
            <input ref={fileRef} type="file" onChange={pickFile} style={{ display: 'none' }} />
          </div>
          <div className="form-group">
            <label>Titel *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Naam van het document" required />
          </div>
          <div className="form-group">
            <label>Toelichting</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Optioneel" />
          </div>
          <div className="form-group">
            <label>Zichtbaar voor</label>
            <select value={audience} onChange={e => setAudience(e.target.value)}>
              {canShareWithAll && <option value="members">Alle leden</option>}
              {groups.map(g => <option key={g.id} value={g.id}>Alleen {g.name}</option>)}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Annuleren</button>
            <button type="submit" className="btn-primary" disabled={saving || !title.trim() || !file || !audience}>
              {saving ? 'Uploaden...' : 'Toevoegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
