import { fileIcon, fileIconColor, formatFileSize, timeAgo, PROFESSIONAL_LABELS, PROFESSIONAL_COLORS } from '../lib/constants'
import { openProjectFile } from '../lib/storage'

export default function DocumentsGrid({ updates }) {
  // Flatten all files from all updates
  const allFiles = updates.flatMap(u =>
    (u.files || []).map(f => ({
      ...f,
      author: u.author,
      updateDate: u.created_at,
    }))
  )

  if (allFiles.length === 0) {
    return (
      <div className="empty-inline">
        <i className="fa-solid fa-folder-open" />
        <p>Nog geen documenten gedeeld.</p>
      </div>
    )
  }

  return (
    <div className="docs-grid">
      {allFiles.map(file => {
        const icon = fileIcon(file.file_type)
        const color = fileIconColor(file.file_type)
        const proType = file.author?.professional_type
        const proColor = PROFESSIONAL_COLORS[proType] || '#9ba1b0'

        return (
          <a
            key={file.id}
            className="docs-grid__card"
            href={file.file_path}
            onClick={(e) => { e.preventDefault(); openProjectFile(file.file_path) }}
            target="_blank"
            rel="noopener noreferrer"
          >
            <i className={`docs-grid__icon ${icon}`} style={{ color }} />
            <div className="docs-grid__name">{file.file_name}</div>
            <div className="docs-grid__meta">
              <span style={{ color: proColor }}>{file.author?.full_name}</span>
              <span>{timeAgo(file.updateDate)}</span>
              {file.file_size > 0 && <span>{formatFileSize(file.file_size)}</span>}
            </div>
          </a>
        )
      })}
    </div>
  )
}
