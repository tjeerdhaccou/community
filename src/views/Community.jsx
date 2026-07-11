import { useState, useEffect } from 'react'
import { useProject } from '../contexts/ProjectContext'
import { useAuth } from '../contexts/AuthContext'
import { usePosts } from '../hooks/usePosts'
import { useWorkgroups } from '../hooks/useWorkgroups'
import { markSeen } from '../hooks/useUnreadIndicators'
import { canDo } from '../lib/permissions'
import PostCard from '../components/PostCard'
import PostModal from '../components/PostModal'
import PostDetail from '../components/PostDetail'
import ConfirmModal from '../components/ConfirmModal'

import { POST_TAGS } from '../lib/constants'
import CollapsibleTagFilter from '../components/CollapsibleTagFilter'
const FILTER_TAGS = ['Alles', ...POST_TAGS]

export default function Community() {
  const { project, role } = useProject()
  const { profile } = useAuth()
  const { posts, loading, createPost, toggleLike, toggleReaction, toggleFollow, votePoll, deletePost, updatePost, togglePin } = usePosts()
  const { myWorkgroups } = useWorkgroups()
  const [activeTag, setActiveTag] = useState('Alles')
  const [modalOpen, setModalOpen] = useState(false)
  const [editPost, setEditPost] = useState(null) // post object for editing
  const [selectedPostId, setSelectedPostId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null) // postId to delete
  const selectedPost = posts.find(p => p.id === selectedPostId) || null
  const isModerator = canDo(role, 'moderate_board')

  const filtered = activeTag === 'Alles'
    ? posts
    : activeTag.startsWith('wg:')
      ? posts.filter(p => p.workgroup_id === activeTag.slice(3))
      : posts.filter(p => p.tag === activeTag)

  const isGroupFilter = activeTag.startsWith('wg:')
  const activeFilterLabel = isGroupFilter
    ? (myWorkgroups.find(wg => `wg:${wg.id}` === activeTag)?.name ?? 'deze groep')
    : activeTag

  // Markeer 'Prikbord' als gezien wanneer de gebruiker hier is en zodra er
  // een nieuwe post bij komt terwijl die hier is — voorkomt dat een dot in
  // de sidebar verschijnt voor je eigen net-geposte bericht.
  useEffect(() => {
    if (project?.id) markSeen(project.id, 'board')
  }, [project?.id, posts.length])

  // Trending: top 3 posts by engagement this week
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const trending = [...posts]
    .filter(p => new Date(p.created_at) > weekAgo && !p.is_pinned)
    .sort((a, b) => (b.totalReactions + b.comment_count + b.like_count) - (a.totalReactions + a.comment_count + a.like_count))
    .slice(0, 3)

  function handleDelete(postId) {
    setConfirmDelete(postId)
  }

  async function confirmDeletePost() {
    if (!confirmDelete) return
    await deletePost(confirmDelete)
    setConfirmDelete(null)
    if (selectedPostId === confirmDelete) setSelectedPostId(null)
  }

  function handleEdit(post) {
    setEditPost(post)
    setModalOpen(true)
  }

  async function handleSave(data) {
    if (editPost) {
      await updatePost(editPost.id, {
        text: data.text,
        tag: data.tag,
        audience: data.audience,
        workgroup_id: data.audience === 'workgroup' ? data.workgroup_id : null,
        image_url: data.image_url,
      })
    } else {
      await createPost(data)
    }
  }

  function closeModal() {
    setModalOpen(false)
    setEditPost(null)
  }

  return (
    <div className="view-community">
      <div className="view-header">
        <div className="view-header__row">
          <h1>Prikbord</h1>
        </div>
        <p className="view-header__subtitle">
          Praat met je medeleden — stel een vraag, deel een idee of begin een gesprek.
        </p>
      </div>

      {/* Inline composer prompt */}
      {canDo(role, 'post_on_board') && (
        <div className="feed-composer-prompt" onClick={() => { setEditPost(null); setModalOpen(true) }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="feed-composer-prompt__avatar" />
          ) : (
            <div className="feed-composer-prompt__avatar feed-composer-prompt__avatar--placeholder">
              {(profile?.full_name || 'U')[0]}
            </div>
          )}
          <span className="feed-composer-prompt__text">Wat wil je delen met de community?</span>
          <div className="feed-composer-prompt__actions">
            <i className="fa-solid fa-image" title="Afbeelding" />
            <i className="fa-solid fa-square-poll-vertical" title="Poll" />
          </div>
        </div>
      )}

      {/* Tag filters — geen per-tag teller meer; 'nieuw'-signaal staat nu
          in de sidebar (zie useUnreadIndicators) en verdwijnt bij bezoek. */}
      <CollapsibleTagFilter>
        {FILTER_TAGS.map(tag => (
          <button
            key={tag}
            className={`tag-filter__pill ${activeTag === tag ? 'tag-filter__pill--active' : ''}`}
            onClick={() => setActiveTag(tag)}
          >
            {tag}
          </button>
        ))}
        {myWorkgroups.length > 0 && (
          <>
            <span className="tag-filter__divider" aria-hidden="true" />
            {myWorkgroups.map(wg => (
              <button
                key={wg.id}
                className={`tag-filter__pill ${activeTag === `wg:${wg.id}` ? 'tag-filter__pill--active' : ''}`}
                onClick={() => setActiveTag(`wg:${wg.id}`)}
              >
                <i className="fa-solid fa-users" style={{ marginRight: '5px', fontSize: '11px' }} /> {wg.name}
              </button>
            ))}
          </>
        )}
      </CollapsibleTagFilter>

      <div className="feed-layout">
        {/* Main feed — single column */}
        <div className="feed-main">
          {loading ? (
            <div className="loading-inline"><p>Berichten laden...</p></div>
          ) : filtered.length === 0 ? (
            <div className="feed-empty">
              <div className="feed-empty__icon">
                <i className="fa-solid fa-comments" />
              </div>
              <h3>
                {activeTag === 'Alles'
                  ? 'Het prikbord is nog leeg'
                  : isGroupFilter
                    ? `Nog geen berichten in ${activeFilterLabel}`
                    : `Nog geen berichten met tag "${activeFilterLabel}"`
                }
              </h3>
              <p>
                {activeTag === 'Alles'
                  ? 'Deel een vraag, idee of update met de community.'
                  : isGroupFilter
                    ? 'Wees de eerste die iets deelt met deze groep!'
                    : 'Wees de eerste die iets deelt in deze categorie!'
                }
              </p>
              {canDo(role, 'post_on_board') && (
                <button className="btn-primary" onClick={() => setModalOpen(true)}>
                  <i className="fa-solid fa-pen" /> Eerste bericht plaatsen
                </button>
              )}
            </div>
          ) : (
            <div className="feed-list">
              {filtered.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  onReaction={toggleReaction}
                  onFollow={toggleFollow}
                  onVotePoll={votePoll}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onPin={togglePin}
                  canModerate={isModerator}
                  currentUserId={profile?.id}
                  onClick={() => setSelectedPostId(post.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar — trending (desktop only) */}
        {trending.length > 0 && (
          <aside className="feed-sidebar">
            <h3 className="feed-sidebar__title">
              <i className="fa-solid fa-fire" /> Populair deze week
            </h3>
            {trending.map((p, i) => (
              <div
                key={p.id}
                className="feed-trending-item"
                onClick={() => setSelectedPostId(p.id)}
                role="button"
                tabIndex={0}
              >
                <span className="feed-trending-item__rank">{i + 1}</span>
                <div className="feed-trending-item__content">
                  <p className="feed-trending-item__text">{p.text.slice(0, 80)}{p.text.length > 80 ? '...' : ''}</p>
                  <span className="feed-trending-item__meta">
                    {p.author?.full_name} · {p.totalReactions + p.comment_count + p.like_count} interacties
                  </span>
                </div>
              </div>
            ))}
          </aside>
        )}
      </div>

      {modalOpen && (
        <PostModal
          onSave={handleSave}
          onClose={closeModal}
          editPost={editPost}
        />
      )}

      {selectedPost && (
        <PostDetail
          post={selectedPost}
          onClose={() => setSelectedPostId(null)}
          onLike={toggleLike}
          onReaction={toggleReaction}
          onFollow={toggleFollow}
          onVotePoll={votePoll}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onPin={togglePin}
          canModerate={isModerator}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          message="Weet je zeker dat je dit bericht wilt verwijderen?"
          confirmLabel="Verwijderen"
          danger
          onConfirm={confirmDeletePost}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
