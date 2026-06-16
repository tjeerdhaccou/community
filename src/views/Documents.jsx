import { useState, useMemo, useRef, useEffect } from 'react'
import { useProject } from '../contexts/ProjectContext'
import { useAuth } from '../contexts/AuthContext'
import { canDo } from '../lib/permissions'
import { useAllDocuments } from '../hooks/useAllDocuments'
import { useWorkgroups } from '../hooks/useWorkgroups'
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
  const { role } = useProject()
  const { profile } = useAuth()
  const {
    gebouwDocs, infoDocs, otherPublicDocs, memberDocs,
    getDocsForWorkgroup, vergaderingDocs, loading,
  } = useAllDocuments()
  const { myWorkgroups, loading: wgLoading } = useWorkgroups()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [meetingCat, setMeetingCat] = useState('all')

  const isProfessional = role === 'professional'

  // Build tabs dynamically based on role and workgroup membership
  const tabs = useMemo(() => {
    const t = []

    // Public tabs — visible to everyone
    t.push({ key: 'gebouw', label: 'Het gebouw', icon: 'fa-solid fa-building' })
    t.push({ key: 'info', label: 'Praktische info', icon: 'fa-solid fa-circle-info' })

    // Vergaderingen — aspirant+
    if (canDo(role, 'view_meetings')) {
      t.push({ key: 'vergaderingen', label: 'Vergaderingen', icon: 'fa-solid fa-users' })
    }

    // Projectdossier — aspirant+ (all member-visibility docs)
    if (canDo(role, 'view_all_docs')) {
      t.push({ key: 'dossier', label: 'Projectdossier', icon: 'fa-solid fa-folder-open' })
    }

    // Dynamic workgroup tabs — for groups the user belongs to
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
  }, [role, myWorkgroups])

  // Default to first available tab
  const [tab, setTab] = useState(tabs[0]?.key || 'gebouw')

  // Ensure selected tab is valid
  const activeTab = tabs.find(t => t.key === tab) ? tab : (tabs[0]?.key || 'gebouw')

  // Get docs for current tab
  const tabDocs = useMemo(() => {
    switch (activeTab) {
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
  }, [activeTab, gebouwDocs, infoDocs, otherPublicDocs, vergaderingDocs, memberDocs, getDocsForWorkgroup])

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
          <h1>Documenten</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="seg-tabs">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`seg-tab ${activeTab === t.key ? 'seg-tab--active' : ''}`}
            onClick={() => { setTab(t.key); setCategoryFilter('all'); setMeetingCat('all') }}
          >
            {t.label}
            {(counts[t.key] || 0) > 0 && <span className="seg-tab__count">{counts[t.key]}</span>}
          </button>
        ))}
      </div>

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
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CollapsibleTagFilter({ children }) {
  const ref = useRef(null)
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [children])

  return (
    <div className="tag-filter-wrap">
      <div
        ref={ref}
        className={`tag-filter ${expanded ? 'tag-filter--expanded' : 'tag-filter--collapsed'}`}
      >
        {children}
      </div>
      {(overflowing || expanded) && (
        <button
          type="button"
          className="tag-filter__toggle"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? 'Minder' : 'Meer'}
          <i className={`fa-solid ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'}`} />
        </button>
      )}
    </div>
  )
}

function emptyMessage(tab) {
  switch (tab) {
    case 'gebouw': return 'Nog geen gebouwtekeningen of visualisaties'
    case 'info': return 'Nog geen praktische informatie'
    case 'vergaderingen': return 'Nog geen vergaderdocumenten'
    case 'dossier': return 'Nog geen projectdocumenten'
    default: return 'Nog geen documenten in deze groep'
  }
}

// ===== Document Row =====
function DocumentRow({ doc, showCategory }) {
  const isLink = doc.doc_type === 'link'
  const link = isLink ? linkInfo(doc.url) : null
  const href = isLink ? doc.url : doc.file_path

  return (
    <div className="doc-row">
      <div className="doc-row__icon">
        {isLink
          ? <i className={link.icon} style={{ color: link.color }} />
          : <i className={fileIcon(doc.file_type)} style={{ color: fileIconColor(doc.file_type) }} />
        }
      </div>
      <div className="doc-row__info">
        <a href={href} target="_blank" rel="noopener noreferrer" className="doc-row__title">
          {doc.title || doc.file_name}
          {isLink && <i className="fa-solid fa-arrow-up-right-from-square doc-row__external" />}
        </a>
        <div className="doc-row__meta">
          {showCategory && doc.category && (
            <span className="doc-row__source" style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>
              {CATEGORY_LABELS[doc.category] || doc.category}
            </span>
          )}
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
        {isLink ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="doc-row__btn" title="Openen">
            <i className="fa-solid fa-arrow-up-right-from-square" />
          </a>
        ) : (
          <a href={href} download className="doc-row__btn" title="Download">
            <i className="fa-solid fa-download" />
          </a>
        )}
      </div>
    </div>
  )
}
