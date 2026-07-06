import { useState } from 'react'
import { useUpdateComments } from '../hooks/useUpdates'
import { useAuth } from '../contexts/AuthContext'
import { UPDATE_TAG_COLORS, timeAgo, REACTIONS, REACTION_MAP } from '../lib/constants'
import Linkify from './Linkify'
import { openProjectFile } from '../lib/storage'

function attachmentIcon(fileName = '', fileType = '') {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (fileType?.includes('pdf') || ext === 'pdf') return 'fa-file-pdf'
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return 'fa-file-word'
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'fa-file-excel'
  if (['ppt', 'pptx'].includes(ext)) return 'fa-file-powerpoint'
  if (['zip', 'rar'].includes(ext)) return 'fa-file-zipper'
  if (fileType?.startsWith('image/')) return 'fa-file-image'
  return 'fa-file-lines'
}

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UpdateDetail({ update, onClose, onEdit, onReaction, canEdit }) {
  const { profile } = useAuth()
  const { comments, loading, addComment } = useUpdateComments(update.id)
  const [replyText, setReplyText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [sending, setSending] = useState(false)
  const [showReactions, setShowReactions] = useState(false)

  async function handleReply(e) {
    e.preventDefault()
    if (!replyText.trim()) return
    setSending(true)
    try {
      await addComment(replyText.trim(), replyTo?.id, replyTo?.name)
      setReplyText('')
      setReplyTo(null)
    } catch (err) {
      console.error('Error posting comment:', err)
    }
    setSending(false)
  }

  const tagColors = UPDATE_TAG_COLORS[update.tag]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="update-detail-card" onClick={e => e.stopPropagation()}>
        <div className="modal-detail-actions">
          {canEdit && (
            <button onClick={() => { onEdit?.(update); onClose() }} title="Bewerken" aria-label="Bewerken">
              <i className="fa-solid fa-pen" />
            </button>
          )}
          <button onClick={onClose} aria-label="Sluiten">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Update content */}
        <div className="post-detail-content">
          <div className="update-detail__header">
            {update.tag && tagColors && (
              <span className="update-detail__tag" style={{ background: tagColors.bg, color: tagColors.color }}>
                {update.tag}
              </span>
            )}
            {update.is_public ? (
              <span className="update-detail__vis"><i className="fa-solid fa-eye" /> Openbaar</span>
            ) : (
              <span className="update-detail__vis"><i className="fa-solid fa-lock" /> Intern</span>
            )}
          </div>

          <h2 className="update-detail__title">{update.title}</h2>

          <div className="feed-card__author" style={{ marginBottom: 16 }}>
            {update.author?.avatar_url ? (
              <img src={update.author.avatar_url} alt={update.author.full_name || ''} className="feed-card__avatar" />
            ) : (
              <div className="feed-card__avatar feed-card__avatar--placeholder">
                {(update.author?.full_name || 'U')[0]}
              </div>
            )}
            <div className="feed-card__author-info">
              <span className="feed-card__name">{update.author?.full_name}</span>
              <span className="feed-card__time">{timeAgo(update.created_at)}</span>
            </div>
          </div>

          {update.image_url && (
            <div className="post-detail-image">
              <img src={update.image_url} alt={update.title || ''} />
            </div>
          )}

          <div className="post-detail-text"><Linkify text={update.body} /></div>

          {update.attachments && update.attachments.length > 0 && (
            <div className="update-detail__attachments">
              <h4 className="update-detail__attachments-title">
                <i className="fa-solid fa-paperclip" /> Bijlagen ({update.attachments.length})
              </h4>
              <div className="update-attachments-list">
                {update.attachments.map(a => (
                  <a
                    key={a.id}
                    href={a.file_path}
                    onClick={(e) => { e.preventDefault(); openProjectFile(a.file_path) }}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="update-attachment-row update-attachment-row--link"
                  >
                    <i className={`fa-regular ${attachmentIcon(a.file_name, a.file_type)} update-attachment-row__icon`} />
                    <span className="update-attachment-row__name">{a.file_name}</span>
                    <span className="update-attachment-row__size">{formatBytes(a.file_size)}</span>
                    <i className="fa-solid fa-arrow-down update-attachment-row__download" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Reactions bar */}
          <div className="feed-card__actions">
            <div className="feed-card__actions-left">
              <span className="feed-card__action-btn">
                <i className={`${comments.length > 0 ? 'fa-solid' : 'fa-regular'} fa-comment`} />
                <span>{comments.length}</span>
              </span>
            </div>

            <div className="feed-card__actions-right">
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
                <button className="feed-card__action-btn" onClick={() => setShowReactions(!showReactions)} title="Reageer">
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
        </div>

        {/* Comments */}
        <div className="post-detail-comments">
          <h4>Reacties ({comments.length})</h4>

          {loading ? (
            <p className="post-detail-loading">Laden...</p>
          ) : comments.length === 0 ? (
            <p className="post-detail-empty">Nog geen reacties. Wees de eerste!</p>
          ) : (
            <div className="comments-list">
              {comments.map(c => (
                <div key={c.id} className="comment-item">
                  {c.reply_to_name && (
                    <div className="comment-reply-to">
                      <i className="fa-solid fa-reply" /> {c.reply_to_name}
                    </div>
                  )}
                  <div className="comment-header">
                    {c.author?.avatar_url ? (
                      <img src={c.author.avatar_url} alt="" className="comment-avatar" />
                    ) : (
                      <div className="comment-avatar comment-avatar--placeholder">
                        {(c.author?.full_name || 'U')[0]}
                      </div>
                    )}
                    <span className="comment-author">{c.author?.full_name}</span>
                    {c.author?.id === profile?.id && <span className="comment-you">jij</span>}
                    <span className="comment-time">{timeAgo(c.created_at)}</span>
                    <button
                      className="comment-reply-btn"
                      onClick={() => setReplyTo({ id: c.id, name: c.author?.full_name })}
                      title="Reageer"
                    >
                      <i className="fa-solid fa-reply" />
                    </button>
                  </div>
                  <p className="comment-text"><Linkify text={c.text} /></p>
                </div>
              ))}
            </div>
          )}

          {/* Reply form */}
          <form className="reply-form" onSubmit={handleReply}>
            {replyTo && (
              <div className="reply-form__replying-to">
                <i className="fa-solid fa-reply" /> Reageert op {replyTo.name}
                <button type="button" onClick={() => setReplyTo(null)} className="reply-form__cancel-reply" aria-label="Sluiten">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            )}
            <div className="reply-input-row">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="comment-avatar" />
              ) : (
                <div className="comment-avatar comment-avatar--placeholder">
                  {(profile?.full_name || 'U')[0]}
                </div>
              )}
              <input
                type="text"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={replyTo ? `Reageer op ${replyTo.name}...` : 'Schrijf een reactie...'}
                disabled={sending}
                aria-label="Reactie"
              />
              <button type="submit" className="reply-submit" disabled={sending || !replyText.trim()} aria-label="Versturen">
                <i className="fa-solid fa-paper-plane" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
