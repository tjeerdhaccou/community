import { useState, useRef } from 'react'
import { useMyDocuments } from '../hooks/useMyDocuments'
import { useAuth } from '../contexts/AuthContext'
import { formatFileSize, fileIcon, fileIconColor, timeAgo } from '../lib/constants'

const CATEGORY_LABELS = {
  contract: 'Contract',
  formulier: 'Formulier',
  correspondentie: 'Correspondentie',
  identiteit: 'Identiteitsbewijs',
  financieel: 'Financieel',
  overig: 'Overig',
}

export default function MyDocuments() {
  const { user } = useAuth()
  const { files, loading, download, upload, remove } = useMyDocuments()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      await upload(file)
    } catch (err) {
      setError(err.message || 'Upload mislukt')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (loading) {
    return (
      <div className="view-container">
        <div className="view-header">
          <h1 className="view-title">Mijn documenten</h1>
        </div>
        <div className="empty-state">
          <p className="empty-state__text">Laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <div className="view-header__row">
          <div>
            <h1 className="view-title">Mijn documenten</h1>
            <p className="view-subtitle">
              Bestanden van het projectteam en je eigen uploads
            </p>
          </div>
          <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <i className={`fa-solid ${uploading ? 'fa-spinner fa-spin' : 'fa-upload'}`} />
            {uploading ? 'Uploaden...' : 'Bestand uploaden'}
          </button>
          <input ref={fileRef} type="file" onChange={handleUpload} style={{ display: 'none' }} />
        </div>
      </div>

      {error && (
        <div style={{ padding: '8px 16px', background: 'rgba(229,62,62,0.08)', borderRadius: 8, color: 'var(--accent-red)', fontSize: 14, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {files.length === 0 ? (
        <div className="empty-state">
          <i className="fa-solid fa-folder-open empty-state__icon" />
          <h3 className="empty-state__title">Geen documenten</h3>
          <p className="empty-state__text">
            Er zijn nog geen documenten. Upload zelf een bestand of wacht tot het projectteam bestanden klaarzet.
          </p>
        </div>
      ) : (
        <div className="doc-list">
          {files.map((file) => {
            const icon = fileIcon(file.file_type || file.file_name)
            const iconColor = fileIconColor(file.file_type || file.file_name)
            const isMine = file.uploaded_by === user?.id
            return (
              <div
                key={file.id}
                className="doc-row"
                style={{ cursor: 'pointer' }}
                onClick={() => download(file.file_path, file.file_name)}
              >
                <div className="doc-row__icon" style={{ color: iconColor }}>
                  <i className={icon} />
                </div>
                <div className="doc-row__info">
                  <span className="doc-row__title">{file.title}</span>
                  <div className="doc-row__meta">
                    <span
                      className="doc-row__source"
                      style={{
                        background: isMine ? 'rgba(59, 210, 105, 0.12)' : 'var(--accent-primary-light, rgba(74, 144, 217, 0.12))',
                        color: isMine ? '#3BD269' : 'var(--accent-primary, #4A90D9)',
                      }}
                    >
                      {isMine ? 'Eigen upload' : (CATEGORY_LABELS[file.category] || file.category)}
                    </span>
                    {file.file_size > 0 && <span>{formatFileSize(file.file_size)}</span>}
                    <span>{timeAgo(file.created_at)}</span>
                  </div>
                  {file.description && (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {file.description}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {isMine && (
                    <button
                      className="btn-icon-sm"
                      onClick={e => { e.stopPropagation(); remove(file.id) }}
                      title="Verwijderen"
                      style={{ color: 'var(--accent-red)' }}
                    >
                      <i className="fa-solid fa-trash" />
                    </button>
                  )}
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 16 }}>
                    <i className="fa-solid fa-download" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
