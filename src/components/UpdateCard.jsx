import { useState } from 'react'
import { useProject } from '../contexts/ProjectContext'
import { canDo } from '../lib/permissions'
import { UPDATE_TAG_COLORS, timeAgo, REACTIONS, REACTION_MAP } from '../lib/constants'

export default function UpdateCard({ update, onEdit, onReaction, onClick }) {
  const { role } = useProject()
  const [showReactions, setShowReactions] = useState(false)
  const tagStyle = UPDATE_TAG_COLORS[update.tag] || { bg: 'var(--bg-hover)', color: 'var(--text-secondary)' }

  return (
    <article className="update-card" onClick={onClick} style={{ cursor: 'pointer' }}>
      {update.image_url && (
        <div className="update-card__image">
          <img src={update.image_url} alt={update.title || ''} />
        </div>
      )}
      <div className="update-card__body">
        <div className="update-card__meta">
          {update.tag && (
            <span className="update-tag" style={{ background: tagStyle.bg, color: tagStyle.color }}>
              {update.tag}
            </span>
          )}
          <span className="update-card__visibility">
            <i className={`fa-solid ${update.is_public ? 'fa-eye' : 'fa-lock'}`} />
            {update.is_public ? 'Openbaar' : 'Intern'}
          </span>
        </div>

        <h3 className="update-card__title">{update.title}</h3>
        <p className="update-card__text">{update.body}</p>

        <div className="update-card__footer">
          <div className="update-card__author">
            {update.author?.avatar_url ? (
              <img src={update.author.avatar_url} alt={update.author.full_name || ''} className="update-card__avatar" />
            ) : (
              <div className="update-card__avatar update-card__avatar--placeholder">
                {(update.author?.full_name || 'U')[0]}
              </div>
            )}
            <span>{update.author?.full_name || 'Onbekend'}</span>
          </div>
          <div className="update-card__date">{timeAgo(update.created_at)}</div>
        </div>

        {/* Reactions + comments bar */}
        <div className="update-card__actions" onClick={e => e.stopPropagation()}>
          <div className="update-card__actions-left">
            {/* Comment count */}
            <span className="feed-card__action-btn" onClick={onClick}>
              <i className={`${update.comment_count > 0 ? 'fa-solid' : 'fa-regular'} fa-comment`} />
              {update.comment_count > 0 && <span>{update.comment_count}</span>}
            </span>
            {/* Attachment count */}
            {update.attachment_count > 0 && (
              <span className="feed-card__action-btn" onClick={onClick} title={`${update.attachment_count} bijlage${update.attachment_count !== 1 ? 'n' : ''}`}>
                <i className="fa-solid fa-paperclip" />
                <span>{update.attachment_count}</span>
              </span>
            )}
          </div>

          <div className="update-card__actions-right">
            {/* Reaction summary */}
            {update.totalReactions > 0 && (
              <div className="feed-card__reaction-summary">
                {Object.entries(update.reactions || {}).filter(([, c]) => c > 0).map(([emoji]) => {
                  const r = REACTION_MAP[emoji]
                  return r ? <i key={emoji} className={`${r.icon} feed-card__reaction-icon`} style={{ color: r.color }} /> : null
                })}
                <span className="feed-card__reaction-count">{update.totalReactions}</span>
              </div>
            )}

            {/* Reaction picker */}
            <div className="feed-reaction-picker-wrap">
              <button
                className="feed-card__action-btn"
                onClick={() => setShowReactions(!showReactions)}
                title="Reageer"
              >
                <i className="fa-regular fa-face-smile" />
              </button>
              {showReactions && (
                <div className="feed-reaction-picker">
                  {REACTIONS.map(r => (
                    <button
                      key={r.key}
                      className={`feed-reaction-picker__btn ${update.myReactions?.has(r.key) ? 'feed-reaction-picker__btn--active' : ''}`}
                      onClick={() => { onReaction?.(update.id, r.key); setShowReactions(false) }}
                      title={r.label}
                    >
                      <i className={r.icon} style={{ color: r.color }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {canDo(role, 'publish_update') && onEdit && (
          <button className="update-card__edit" onClick={(e) => { e.stopPropagation(); onEdit(update) }} aria-label="Bewerken">
            <i className="fa-solid fa-pen" />
          </button>
        )}
      </div>
    </article>
  )
}
