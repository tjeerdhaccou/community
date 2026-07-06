import { useState, useRef, useEffect } from 'react'
import { POST_TAG_COLORS, timeAgoShort, REACTIONS, REACTION_MAP } from '../lib/constants'
import Linkify from './Linkify'

export default function PostCard({ post, onReaction, onFollow, onVotePoll, onDelete, onEdit, onPin, canModerate, currentUserId, onClick }) {
  const [showReactions, setShowReactions] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)
  const isAuthor = post.author_id === currentUserId
  const canManage = isAuthor || canModerate
  const tagStyle = POST_TAG_COLORS[post.tag]
  const isPoll = post.post_type === 'poll'

  useEffect(() => {
    if (!showMenu) return
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showMenu])

  return (
    <article className="feed-card" onClick={onClick}>
      {post.is_pinned && (
        <div className="feed-card__pinned">
          <i className="fa-solid fa-thumbtack" /> Vastgepind
        </div>
      )}

      {/* Author row */}
      <div className="feed-card__author">
        {post.author?.avatar_url ? (
          <img src={post.author.avatar_url} alt={post.author.full_name || ''} className="feed-card__avatar" />
        ) : (
          <div className="feed-card__avatar feed-card__avatar--placeholder">
            {(post.author?.full_name || 'U')[0]}
          </div>
        )}
        <div className="feed-card__author-info">
          <span className="feed-card__name">{post.author?.full_name || 'Onbekend'}</span>
          <span className="feed-card__time">{timeAgoShort(post.created_at)}</span>
        </div>
        {post.workgroup_name && (
          <span className="feed-card__group-tag" title={`Alleen zichtbaar voor groep ${post.workgroup_name}`}>
            <i className="fa-solid fa-users" /> {post.workgroup_name}
          </span>
        )}
        {post.tag && (
          <span className="feed-card__tag" style={{ color: tagStyle?.color, background: tagStyle?.bg }}>
            {post.tag}
          </span>
        )}

        {/* Post menu */}
        {canManage && (
          <div className="feed-card__menu-wrap" ref={menuRef} onClick={e => e.stopPropagation()}>
            <button className="feed-card__menu-btn" onClick={() => setShowMenu(!showMenu)} aria-label="Menu">
              <i className="fa-solid fa-ellipsis" />
            </button>
            {showMenu && (
              <div className="feed-card__menu">
                {isAuthor && !isPoll && (
                  <button onClick={() => { onEdit?.(post); setShowMenu(false) }}>
                    <i className="fa-solid fa-pen" /> Bewerken
                  </button>
                )}
                {canModerate && (
                  <button onClick={() => { onPin?.(post.id); setShowMenu(false) }}>
                    <i className="fa-solid fa-thumbtack" /> {post.is_pinned ? 'Losmaken' : 'Vastpinnen'}
                  </button>
                )}
                <button className="feed-card__menu-danger" onClick={() => { onDelete?.(post.id); setShowMenu(false) }}>
                  <i className="fa-solid fa-trash" /> Verwijderen
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Text */}
      <div className="feed-card__text"><Linkify text={post.text} /></div>

      {/* Image */}
      {post.image_url && (
        <div className="feed-card__image">
          <img
            src={post.image_url}
            alt=""
            loading="lazy"
            onLoad={e => {
              const { naturalWidth, naturalHeight } = e.target
              e.target.style.objectFit = naturalHeight > naturalWidth ? 'contain' : 'cover'
            }}
          />
        </div>
      )}

      {/* Inline poll */}
      {isPoll && post.pollOptions?.length > 0 && (
        <div className="feed-poll" onClick={e => e.stopPropagation()}>
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

      {/* Actions bar: left = comments + follow, right = reactions */}
      <div className="feed-card__actions" onClick={e => e.stopPropagation()}>
        <div className="feed-card__actions-left">
          {/* Comments */}
          <button className="feed-card__action-btn" onClick={onClick}>
            <i className={`${post.comment_count > 0 ? 'fa-solid' : 'fa-regular'} fa-comment`} />
            {post.comment_count > 0 && <span>{post.comment_count}</span>}
          </button>

          {/* Follow */}
          <button
            className={`feed-card__action-btn ${post.is_followed ? 'feed-card__action-btn--followed' : ''}`}
            onClick={() => onFollow?.(post.id)}
            title={post.is_followed ? 'Niet meer volgen' : 'Volgen'}
          >
            <i className={`${post.is_followed ? 'fa-solid' : 'fa-regular'} fa-circle-check`} />
          </button>
        </div>

        <div className="feed-card__actions-right">
          {/* Inline reaction summary */}
          {post.totalReactions > 0 && (
            <div className="feed-card__reaction-summary">
              {Object.entries(post.reactions || {}).filter(([, c]) => c > 0).map(([emoji]) => {
                const r = REACTION_MAP[emoji]
                return r ? <i key={emoji} className={`${r.icon} feed-card__reaction-icon`} style={{ color: r.color }} /> : null
              })}
              <span className="feed-card__reaction-count">{post.totalReactions}</span>
            </div>
          )}

          {/* Reaction picker toggle */}
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
    </article>
  )
}
