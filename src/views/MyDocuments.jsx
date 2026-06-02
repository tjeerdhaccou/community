import { useMyDocuments } from '../hooks/useMyDocuments'
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
  const { files, loading, download } = useMyDocuments()

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
        <h1 className="view-title">Mijn documenten</h1>
        <p className="view-subtitle">
          Bestanden die door het projectteam voor jou zijn klaargezet
        </p>
      </div>

      {files.length === 0 ? (
        <div className="empty-state">
          <i className="fa-solid fa-folder-open empty-state__icon" />
          <h3 className="empty-state__title">Geen documenten</h3>
          <p className="empty-state__text">
            Er zijn nog geen documenten voor jou gedeeld.
            Zodra het projectteam bestanden klaarzet, verschijnen ze hier.
          </p>
        </div>
      ) : (
        <div className="doc-list">
          {files.map((file) => {
            const icon = fileIcon(file.file_type || file.file_name)
            const iconColor = fileIconColor(file.file_type || file.file_name)
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
                        background: 'var(--accent-primary-light, rgba(74, 144, 217, 0.12))',
                        color: 'var(--accent-primary, #4A90D9)',
                      }}
                    >
                      {CATEGORY_LABELS[file.category] || file.category}
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
                <div style={{ color: 'var(--text-tertiary)', fontSize: 16, flexShrink: 0 }}>
                  <i className="fa-solid fa-download" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
