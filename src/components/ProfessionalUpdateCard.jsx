import { PROFESSIONAL_LABELS, PROFESSIONAL_COLORS, timeAgo, tagStyle } from '../lib/constants'
import { useAuth } from '../contexts/AuthContext'
import FileRow from './FileRow'

export default function ProfessionalUpdateCard({ update, onEdit }) {
  const { user } = useAuth()
  const proType = update.author?.professional_type
  const color = PROFESSIONAL_COLORS[proType] || '#9ba1b0'
  const label = update.author?.professional_label || PROFESSIONAL_LABELS[proType] || 'Professional'
  const initials = (update.author?.full_name || 'P').split(' ').map(n => n[0]).join('').slice(0, 2)
  const isAuthor = user?.id === update.author_id

  return (
    <article className="pro-update-card">
      <div className="pro-update-card__body">
        <div className="pro-update-card__author">
          {update.author?.avatar_url ? (
            <img src={update.author.avatar_url} alt={update.author.full_name || ''} className="pro-update-card__avatar" />
          ) : (
            <div className="pro-update-card__avatar" style={{ background: color }}>
              {initials}
            </div>
          )}
          <span className="pro-update-card__name">{update.author?.full_name || 'Onbekend'}</span>
          <span className="pro-badge" style={tagStyle(color)}>{label}</span>
          {update.phase && update.phase !== 'ALG' && (
            <span className="phase-badge">{update.phase}</span>
          )}
          <span className="pro-update-card__date">{timeAgo(update.created_at)}</span>
        </div>

        <h3 className="pro-update-card__title">{update.title}</h3>
        {update.body && <p className="pro-update-card__text">{update.body}</p>}

        {update.files?.length > 0 && (
          <div className="pro-update-card__files">
            {update.files.map(file => (
              <FileRow key={file.id} file={file} />
            ))}
          </div>
        )}

        {isAuthor && onEdit && (
          <button className="pro-update-card__edit" onClick={() => onEdit(update)} aria-label="Bewerken">
            <i className="fa-solid fa-pen" />
          </button>
        )}
      </div>
    </article>
  )
}
