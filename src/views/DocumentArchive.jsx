import { useState, useRef } from 'react'
import { useProject } from '../contexts/ProjectContext'
import { canDo } from '../lib/permissions'
import { useDocuments } from '../hooks/useDocuments'
import { formatFileSize, fileIcon, fileIconColor, timeAgo } from '../lib/constants'
import CollapsibleTagFilter from '../components/CollapsibleTagFilter'

const CATEGORIES = [
  { key: 'all', label: 'Alles' },
  { key: 'contract', label: 'Contracten' },
  { key: 'reglement', label: 'Reglementen' },
  { key: 'presentatie', label: 'Presentaties' },
  { key: 'handleiding', label: 'Handleidingen' },
  { key: 'overig', label: 'Overig' },
]

export default function DocumentArchive() {
  const { role } = useProject()
  const { documents, loading, uploadDocument, removeDocument } = useDocuments()
  const [filter, setFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = filter === 'all' ? documents : documents.filter(d => d.category === filter)

  return (
    <div className="view-documents">
      <div className="view-header">
        <div className="view-header__row">
          <h1>Dossier</h1>
          {canDo(role, 'moderate_board') && (
            <button className="btn-primary" onClick={() => setModalOpen(true)}>
              <i className="fa-solid fa-plus" /> Document toevoegen
            </button>
          )}
        </div>
      </div>

      <CollapsibleTagFilter>
        {CATEGORIES.map(cat => (
          <button key={cat.key}
            className={`tag-filter__pill ${filter === cat.key ? 'tag-filter__pill--active' : ''}`}
            onClick={() => setFilter(cat.key)}>
            {cat.label}
          </button>
        ))}
      </CollapsibleTagFilter>

      {loading ? (
        <div className="loading-inline"><p>Laden...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-inline">
          <i className="fa-solid fa-folder-open" />
          <p>Geen documenten{filter !== 'all' ? ' in deze categorie' : ''}</p>
        </div>
      ) : (
        <div className="doc-archive-list">
          {filtered.map(doc => (
            <div key={doc.id} className="doc-archive-item">
              <div className="doc-archive-item__icon">
                <i className={fileIcon(doc.file_type)} style={{ color: fileIconColor(doc.file_type) }} />
              </div>
              <div className="doc-archive-item__info">
                <a href={doc.file_path} target="_blank" rel="noopener noreferrer" className="doc-archive-item__title">
                  {doc.title}
                </a>
                {doc.description && <p className="doc-archive-item__desc">{doc.description}</p>}
                <div className="doc-archive-item__meta">
                  <span className="doc-archive-item__category">{CATEGORIES.find(c => c.key === doc.category)?.label || doc.category}</span>
                  <span>{formatFileSize(doc.file_size)}</span>
                  <span>{doc.uploader?.full_name}</span>
                  <span>{timeAgo(doc.created_at)}</span>
                </div>
              </div>
              <div className="doc-archive-item__actions">
                <a href={doc.file_path} download className="btn-icon" title="Download">
                  <i className="fa-solid fa-download" />
                </a>
                {canDo(role, 'moderate_board') && (
                  <button className="btn-icon btn-icon--danger" onClick={() => window.confirm('Document verwijderen?') && removeDocument(doc.id, doc.file_path)} title="Verwijder">
                    <i className="fa-solid fa-trash" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && <UploadModal onSave={uploadDocument} onClose={() => setModalOpen(false)} />}
    </div>
  )
}

function UploadModal({ onSave, onClose }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('overig')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || !file) return
    setSaving(true)
    try {
      await onSave({ title: title.trim(), description: description.trim(), category, file })
      onClose()
    } catch {
      alert('Er ging iets mis bij het uploaden.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Document toevoegen</h2>
          <button className="modal-close" onClick={onClose} aria-label="Sluiten"><i className="fa-solid fa-xmark" /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Titel</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Naam van het document" required autoFocus />
          </div>
          <div className="form-group">
            <label>Beschrijving</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optionele toelichting" rows={2} />
          </div>
          <div className="form-group">
            <label>Categorie</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="contract">Contract</option>
              <option value="reglement">Reglement</option>
              <option value="presentatie">Presentatie</option>
              <option value="handleiding">Handleiding</option>
              <option value="overig">Overig</option>
            </select>
          </div>
          <div className="form-group">
            <label>Bestand</label>
            {file ? (
              <div className="file-selected">
                <i className={fileIcon(file.type)} style={{ color: fileIconColor(file.type) }} />
                <span>{file.name}</span>
                <span className="file-selected__size">{formatFileSize(file.size)}</span>
                <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }} aria-label="Verwijderen">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            ) : (
              <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
                <i className="fa-solid fa-cloud-arrow-up" /> Bestand kiezen
              </button>
            )}
            <input ref={fileRef} type="file" onChange={e => setFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Annuleren</button>
            <button type="submit" className="btn-primary" disabled={saving || !title.trim() || !file}>
              {saving ? 'Uploaden...' : 'Toevoegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
