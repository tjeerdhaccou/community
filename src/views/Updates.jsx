import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProject } from '../contexts/ProjectContext'
import { useAuth } from '../contexts/AuthContext'
import { useUpdates } from '../hooks/useUpdates'
import { markSeen } from '../hooks/useUnreadIndicators'
import { canDo } from '../lib/permissions'
import UpdateCard from '../components/UpdateCard'
import UpdateModal from '../components/UpdateModal'
import UpdateDetail from '../components/UpdateDetail'
import ConfirmModal from '../components/ConfirmModal'
import { useToast } from '../components/Toast'

import { UPDATE_TAGS } from '../lib/constants'
import CollapsibleTagFilter from '../components/CollapsibleTagFilter'
const FILTER_TAGS = ['Alles', ...UPDATE_TAGS]

export default function Updates() {
  const { project, role } = useProject()
  const { user } = useAuth()
  const { updates, loading, createUpdate, editUpdate, deleteUpdate, togglePin, toggleReaction, addAttachment, removeAttachment } = useUpdates()

  // Markeer 'Projectnieuws' als gezien zodra je hier bent en bij nieuwe updates.
  useEffect(() => {
    if (project?.id) markSeen(project.id, 'updates')
  }, [project?.id, updates.length])
  const [activeTag, setActiveTag] = useState('Alles')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUpdate, setEditingUpdate] = useState(null)
  const [selectedUpdate, setSelectedUpdate] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()

  // Deep-link: ?item=<id> (bijv. vanuit de zoekfunctie) opent direct de detail-modal.
  useEffect(() => {
    const itemId = searchParams.get('item')
    if (!itemId || loading) return
    const found = updates.find(u => u.id === itemId)
    if (found) setSelectedUpdate(found)
    searchParams.delete('item')
    setSearchParams(searchParams, { replace: true })
  }, [searchParams, loading, updates, setSearchParams])

  // Professional role only sees public updates
  const visibleUpdates = role === 'professional' ? updates.filter(u => u.is_public) : updates

  const filtered = activeTag === 'Alles'
    ? visibleUpdates
    : visibleUpdates.filter(u => u.tag === activeTag)

  // Keep selected update in sync with latest data
  const activeSelected = selectedUpdate ? updates.find(u => u.id === selectedUpdate.id) || selectedUpdate : null

  function handleNew() {
    setEditingUpdate(null)
    setModalOpen(true)
  }

  function handleEdit(update) {
    setSelectedUpdate(null)
    setEditingUpdate(update)
    setModalOpen(true)
  }

  async function handleSave(data) {
    if (data.id) {
      return await editUpdate(data.id, data)
    } else {
      return await createUpdate(data)
    }
  }

  // Admin verwijdert alles, andere rollen (moderator) alleen eigen.
  function canDeleteUpdate(update) {
    if (!update) return false
    if (role === 'admin') return true
    return update.author_id === user?.id
  }

  function handleDeleteRequest(update) {
    setEditingUpdate(null)
    setConfirmDelete(update)
  }

  async function handleTogglePin(update) {
    try {
      await togglePin(update.id, !!update.is_pinned)
      toast.success(update.is_pinned ? 'Update losgemaakt' : 'Update vastgepind')
    } catch (err) {
      toast.error(err.message || 'Vastpinnen mislukt')
    }
  }

  async function confirmDeleteUpdate() {
    if (!confirmDelete) return
    try {
      await deleteUpdate(confirmDelete.id)
      if (selectedUpdate?.id === confirmDelete.id) setSelectedUpdate(null)
      toast.success('Update verwijderd')
    } catch (err) {
      toast.error(err.message || 'Verwijderen mislukt')
    } finally {
      setConfirmDelete(null)
    }
  }

  return (
    <div className="view-updates">
      <div className="view-header">
        <div className="view-header__row">
          <h1>Projectnieuws</h1>
          {canDo(role, 'publish_update') && (
            <button className="btn-primary" onClick={handleNew}>
              <i className="fa-solid fa-plus" /> Nieuwe update
            </button>
          )}
        </div>
        <p className="view-header__subtitle">
          Belangrijk nieuws vanuit het projectteam — mijlpalen, besluiten en verslagen.
        </p>
      </div>

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
      </CollapsibleTagFilter>

      {loading ? (
        <div className="loading-inline"><p>Projectnieuws laden...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-inline">
          <i className="fa-solid fa-bullhorn" />
          <p>Nog geen projectnieuws{activeTag !== 'Alles' ? ` met tag "${activeTag}"` : ''}</p>
          {canDo(role, 'publish_update') && (
            <button className="btn-secondary" onClick={handleNew}>Eerste update plaatsen</button>
          )}
        </div>
      ) : (
        <div className="updates-list">
          {filtered.map((update, i) => (
            <UpdateCard
              key={update.id}
              update={update}
              featured={i === 0 && !!update.image_url}
              onEdit={canDo(role, 'publish_update') ? handleEdit : undefined}
              onTogglePin={canDo(role, 'publish_update') ? handleTogglePin : undefined}
              onReaction={toggleReaction}
              onClick={() => setSelectedUpdate(update)}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <UpdateModal
          update={editingUpdate}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
          onDelete={canDeleteUpdate(editingUpdate) ? handleDeleteRequest : undefined}
          onAddAttachment={addAttachment}
          onRemoveAttachment={removeAttachment}
        />
      )}

      {activeSelected && (
        <UpdateDetail
          update={activeSelected}
          onClose={() => setSelectedUpdate(null)}
          onEdit={handleEdit}
          onTogglePin={canDo(role, 'publish_update') ? handleTogglePin : undefined}
          onReaction={toggleReaction}
          canEdit={canDo(role, 'publish_update')}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          message={`Weet je zeker dat je de update "${confirmDelete.title}" wilt verwijderen? Bijlagen en reacties worden ook verwijderd. Deze actie kan niet ongedaan worden gemaakt.`}
          confirmLabel="Verwijderen"
          danger
          onConfirm={confirmDeleteUpdate}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
