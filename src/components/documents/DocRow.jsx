import { useEffect, useRef, useState } from 'react'
import { openProjectFile } from '../../lib/storage'
import { fileIcon, fileIconColor, formatFileSize, linkInfo, timeAgo } from '../../lib/constants'

export function isImageDoc(doc) {
  return doc.doc_type !== 'link' && !!doc.file_type?.startsWith('image/')
}

export function openDoc(doc) {
  if (doc.doc_type === 'link') window.open(doc.url, '_blank', 'noopener,noreferrer')
  else openProjectFile(doc.file_path)
}

function kindLabel(doc) {
  if (doc.doc_type === 'link') return linkInfo(doc.url).label
  if (doc.source === 'vergadering') return null
  const ext = doc.file_name?.split('.').pop()
  return ext && ext.length <= 5 ? ext.toUpperCase() : null
}

// Een documentregel: icoon of voorbeeld, titel, wie en wanneer, en waar het staat.
export function DocRow({ doc, thumb, place, onPlace, actions }) {
  const isLink = doc.doc_type === 'link'
  const link = isLink ? linkInfo(doc.url) : null
  const label = kindLabel(doc)

  return (
    <div className="doc-row docs-row">
      {thumb ? (
        <button type="button" className="docs-row__thumb" onClick={() => openDoc(doc)} aria-label={`${doc.title} openen`}>
          <img src={thumb} alt="" loading="lazy" />
        </button>
      ) : (
        <div className="doc-row__icon">
          {isLink
            ? <i className={link.icon} style={{ color: link.color }} />
            : <i className={fileIcon(doc.file_type)} style={{ color: fileIconColor(doc.file_type) }} />}
        </div>
      )}
      <div className="doc-row__info">
        <a
          href={isLink ? doc.url : doc.file_path}
          onClick={(e) => { e.preventDefault(); openDoc(doc) }}
          target="_blank" rel="noopener noreferrer"
          className="doc-row__title"
        >
          {doc.pinned && <i className="fa-solid fa-thumbtack docs-row__pin" aria-label="Vastgezet" />}
          {doc.title || doc.file_name}
          {isLink && <i className="fa-solid fa-arrow-up-right-from-square doc-row__external" />}
        </a>
        <div className="doc-row__meta">
          {label && <span className="doc-row__badge">{label}</span>}
          {doc.meeting_title && <span>{doc.meeting_title}</span>}
          {doc.author?.full_name && <span>{doc.author.full_name}</span>}
          {!isLink && doc.file_size > 0 && <span>{formatFileSize(doc.file_size)}</span>}
          <span>{timeAgo(doc.created_at)}</span>
          {place && (
            <button type="button" className="docs-row__place" onClick={onPlace}>{place}</button>
          )}
        </div>
      </div>
      {actions?.length > 0 && <RowMenu actions={actions} title={doc.title} />}
    </div>
  )
}

function RowMenu({ actions, title }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  return (
    <div className="docs-menu" ref={ref}>
      <button type="button" className="doc-row__btn" aria-haspopup="menu" aria-expanded={open}
        aria-label={`Meer voor ${title}`} onClick={() => setOpen(o => !o)}>
        <i className="fa-solid fa-ellipsis" />
      </button>
      {open && (
        <div className="docs-menu__panel" role="menu">
          {actions.map(a => (
            <button key={a.label} type="button" role="menuitem"
              className={`docs-menu__item ${a.danger ? 'docs-menu__item--danger' : ''}`}
              onClick={() => { setOpen(false); a.onClick() }}>
              <i className={a.icon} /> {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Raster: grote voorbeelden voor plaatjes, een icoon voor de rest.
export function DocTile({ doc, thumb, actions }) {
  const isLink = doc.doc_type === 'link'
  const link = isLink ? linkInfo(doc.url) : null
  return (
    <div className="docs-tile">
      <button type="button" className="docs-tile__preview" onClick={() => openDoc(doc)} aria-label={`${doc.title} openen`}>
        {thumb
          ? <img src={thumb} alt="" loading="lazy" />
          : isLink
            ? <i className={link.icon} style={{ color: link.color }} />
            : <i className={fileIcon(doc.file_type)} style={{ color: fileIconColor(doc.file_type) }} />}
      </button>
      <div className="docs-tile__body">
        <div className="docs-tile__text">
          <div className="docs-tile__title">
            {doc.pinned && <i className="fa-solid fa-thumbtack docs-row__pin" aria-label="Vastgezet" />}
            {doc.title || doc.file_name}
          </div>
          <div className="docs-tile__meta">
            {[doc.author?.full_name, timeAgo(doc.created_at)].filter(Boolean).join(', ')}
          </div>
        </div>
        {actions?.length > 0 && <RowMenu actions={actions} title={doc.title} />}
      </div>
    </div>
  )
}
