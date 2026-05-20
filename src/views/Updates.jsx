import { useState } from 'react'
import { useProject } from '../contexts/ProjectContext'
import { useUpdates } from '../hooks/useUpdates'
import { canDo } from '../lib/permissions'
import UpdateCard from '../components/UpdateCard'
import UpdateModal from '../components/UpdateModal'
import UpdateDetail from '../components/UpdateDetail'

import { UPDATE_TAGS } from '../lib/constants'
const FILTER_TAGS = ['Alles', ...UPDATE_TAGS]

export default function Updates() {
  const { role } = useProject()
  const { updates, loading, createUpdate, editUpdate, toggleReaction } = useUpdates()
  const [activeTag, setActiveTag] = useState('Alles')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUpdate, setEditingUpdate] = useState(null)
  const [selectedUpdate, setSelectedUpdate] = useState(null)

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
      await editUpdate(data.id, data)
    } else {
      await createUpdate(data)
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

      <div className="tag-filter">
        {FILTER_TAGS.map(tag => (
          <button
            key={tag}
            className={`tag-filter__pill ${activeTag === tag ? 'tag-filter__pill--active' : ''}`}
            onClick={() => setActiveTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

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
          {filtered.map(update => (
            <UpdateCard
              key={update.id}
              update={update}
              onEdit={canDo(role, 'publish_update') ? handleEdit : undefined}
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
        />
      )}

      {activeSelected && (
        <UpdateDetail
          update={activeSelected}
          onClose={() => setSelectedUpdate(null)}
          onEdit={handleEdit}
          onReaction={toggleReaction}
          canEdit={canDo(role, 'publish_update')}
        />
      )}
    </div>
  )
}
