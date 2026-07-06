import { useState } from 'react'
import { useComments } from '../hooks/usePosts'
import { useAuth } from '../contexts/AuthContext'
import { POST_TAG_COLORS, timeAgo, REACTIONS, REACTION_MAP } from '../lib/constants'
import Linkify from './Linkify'

export default function PostDetail({ post, onClose, onLike, onReaction, onFollow, onVotePoll, onEdit, onDelete, onPin, canModerate }) {
  const { profile } = useAuth()
  const { comments, loading, addComment } = useComments(post.id)
  const [replyText, setReplyText] = useState('')
  const [replyTo, setReplyTo] = useState(null) // { id, name }
  const [sending, setSending] = useState(false)
  const [followToast, setFollowToast] = useState(null)
  const [showReactions, setShowReactions] = useState(false)
  const isPoll = post.post_type === 'poll'
  const isAuthor = post.author_id === profile?.id
  const canManage = isAuthor || canModerate

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

  function handleFollow() {
    onFollow?.(post.id)
    const willFollow = !post.is_followed
    setFollowToast(willFollow ? 'Je volgt dit bericht' : 'Je volgt dit bericht niet meer')
    setTimeout(() => setFollowToast(null), 2500)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="post-detail-card" onClick={e => e.stopPropagation()}>
        <div className="modal-detail-actions">
          {canManage && (
            <>
              {isAuthor && !isPoll && (
                <button onClick={() => { onEdit?.(post); onClose() }} title="Bewerken" aria-label="Bewerken">
                  <i className="fa-solid fa-pen" />
                </button>
              )}
              {canModerate && (
                <button onClick={() => onPin?.(post.id)} title={post.is_pinned ? 'Losmaken' : 'Vastpinnen'} aria-label={post.is_pinned ? 'Losmaken' : 'Vastpinnen'}>
                  <i className={`fa-solid fa-thumbtack${post.is_pinned ? ' feed-card__pin--active' : ''}`} />
                </button>
              )}
              <button className="modal-detail-actions__danger" onClick={() => { onDelete?.(post.id); onClose() }} title="Verwijderen" aria-label="Verwijderen">
                <i className="fa-solid fa-trash" />
              </button>
            </>
          )}
          <button onClick={onClose} aria-label="Sluiten">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Post content */}
        <div className="post-detail-content">
          <div className="feed-card__author">
            {post.author?.avatar_url ? (
              <img src={post.author.avatar_url} alt={post.author.full_name || ''} className="feed-card__avatar" />
            ) : (
              <div className="feed-card__avatar feed-card__avatar--placeholder">
                {(post.author?.full_name || 'U')[0]}
              </div>
            )}
            <div className="feed-card__author-info">
              <span className="feed-card__name">{post.author?.full_name}</span>
              <span className="feed-card__time">{timeAgo(post.created_at)}</span>
            </div>
            {post.tag && <span className="feed-card__tag" style={{ color: POST_TAG_COLORS[post.tag]?.color, background: POST_TAG_COLORS[post.tag]?.bg }}>{post.tag}</span>}
          </div>

          <div className="post-detail-text"><Linkify text={post.text} /></div>

          {post.image_url && (
            <div className="post-detail-image">
              <img src={post.image_url} alt="Bijlage bij bericht" />
            </div>
          )}

          {/* Inline poll */}
          {isPoll && post.pollOptions?.length > 0 && (
            <div className="feed-poll">
              {post.pollOptions.map(opt => {
                const pct = post.totalVotes > 0 ? Math.round((opt.vote_count / post.totalVotes) * 100) : 0
                return (
                  <button
                    key={opt.id}
                    className={`feed-poll__option ${opt.my_vote ? 'feed-poll__option--voted' : ''}`}
                    onClick={() => onVotePoll?.(opt.id)}
                  >
                    <span className="feed-poll__bar" style={{ width: `${pct}%` }} />
                    <span className="feed-poll__text">{opt.text}</span>
                    <span className="feed-poll__pct">{post.hasVoted ? `${pct}%` : ''}</span>
                  </button>
                )
              })}
              <span className="feed-poll__total">{post.totalVotes} {post.totalVotes === 1 ? 'stem' : 'stemmen'}</span>
            </div>
          )}

          {/* Actions: left = comments + follow, right = reactions */}
          <div className="feed-card__actions">
            <div className="feed-card__actions-left">
              <span className="feed-card__action-btn">
                <i className={`${comments.length > 0 ? 'fa-solid' : 'fa-regular'} fa-comment`} />
                <span>{comments.length}</span>
              </span>

              <button
                className={`feed-card__action-btn ${post.is_followed ? 'feed-card__action-btn--followed' : ''}`}
                onClick={handleFollow}
              >
                <i className={`${post.is_followed ? 'fa-solid' : 'fa-regular'} fa-circle-check`} />
                <span>{post.is_followed ? 'Volgend' : 'Volgen'}</span>
              </button>
            </div>

            <div className="feed-card__actions-right">
              {/* Reaction summary */}
              {post.totalReactions > 0 && (
                <div className="feed-card__reaction-summary">
                  {Object.entries(post.reactions || {}).filter(([, c]) => c > 0).map(([emoji]) => {
                    const r = REACTION_MAP[emoji]
                    return r ? <i key={emoji} className={`${r.icon} feed-card__reaction-icon`} style={{ color: r.color }} /> : null
                  })}
                  <span className="feed-card__reaction-count">{post.totalReactions}</span>
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
                        className={`feed-reaction-picker__btn ${post.myReactions?.has(r.key) ? 'feed-reaction-picker__btn--active' : ''}`}
                        onClick={() => { onReaction?.(post.id, r.key); setShowReactions(false) }}
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

        {/* Follow toast */}
        {followToast && (
          <div className="post-detail-toast">
            <i className={`fa-solid ${followToast.includes('niet') ? 'fa-circle-xmark' : 'fa-circle-check'}`} />
            {followToast}
          </div>
        )}

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
                  {/* Reply-to indicator */}
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
