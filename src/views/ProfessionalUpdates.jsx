import { useState, useMemo } from 'react'
import { useProject } from '../contexts/ProjectContext'
import { useAuth } from '../contexts/AuthContext'
import { canDo } from '../lib/permissions'
import { PROJECT_PHASES, PROFESSIONAL_TYPES, PROFESSIONAL_LABELS, PROFESSIONAL_COLORS } from '../lib/constants'
import { useProfessionalUpdates } from '../hooks/useProfessionalUpdates'
import { useProfessionalInvites } from '../hooks/useProfessionalInvites'
import ProfessionalUpdateCard from '../components/ProfessionalUpdateCard'
import ProfessionalUpdateModal from '../components/ProfessionalUpdateModal'
import DocumentsGrid from '../components/DocumentsGrid'
import InviteSheet from '../components/InviteSheet'
import FilterDropdown from '../components/FilterDropdown'

const MILESTONE_TO_PHASE = {
  'Ontwerp': 'SO', 'Vergunning': 'VERG', 'Bouw': 'BOUW',
}

export default function ProfessionalUpdates() {
  const { role, milestones } = useProject()
  const { profile } = useAuth()
  const { updates, loading, createUpdate } = useProfessionalUpdates()
  const { invites, createInvite, revokeInvite } = useProfessionalInvites()

  const activePhaseKey = useMemo(() => {
    const active = milestones.find(m => m.status === 'active')
    return active ? (MILESTONE_TO_PHASE[active.label] || 'ALG') : 'ALG'
  }, [milestones])

  // Filter groups
  const phaseFilterGroups = useMemo(() => [{
    label: 'Fase',
    options: PROJECT_PHASES.map(p => ({
      key: p.key,
      label: p.label,
      active: p.key === activePhaseKey,
    })),
  }], [activePhaseKey])

  const rolFilterGroups = useMemo(() => [{
    label: 'Rol',
    options: PROFESSIONAL_TYPES.map(t => ({
      key: t,
      label: PROFESSIONAL_LABELS[t],
      dot: `var(--tag-brand-text, ${PROFESSIONAL_COLORS[t]})`,
    })),
  }], [])

  const [viewMode, setViewMode] = useState('timeline')
  const [phaseFilter, setPhaseFilter] = useState(activePhaseKey)
  const [rolFilter, setRolFilter] = useState('Alles')
  const [modalOpen, setModalOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)

  const isProfessional = !!profile?.professional_type

  const filtered = useMemo(() => {
    let result = updates
    if (phaseFilter !== 'Alles') {
      result = result.filter(u => u.phase === phaseFilter)
    }
    if (rolFilter !== 'Alles') {
      result = result.filter(u => u.author?.professional_type === rolFilter)
    }
    return result
  }, [updates, phaseFilter, rolFilter])

  return (
    <div className="view-pro-updates">
      <div className="view-header">
        <div className="view-header__row">
          <div>
            <h1>Documenten</h1>
          </div>
          <div className="view-header__actions">
            {isProfessional && (
              <button className="btn-primary" onClick={() => setModalOpen(true)}>
                <i className="fa-solid fa-plus" /> Nieuwe update
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Controls: segment + two filters */}
      <div className="pro-controls">
        <div className="segment-control">
          <button
            className={`segment-control__btn ${viewMode === 'timeline' ? 'segment-control__btn--active' : ''}`}
            onClick={() => setViewMode('timeline')}
          >
            <i className="fa-solid fa-stream" /> Tijdlijn
          </button>
          <button
            className={`segment-control__btn ${viewMode === 'documents' ? 'segment-control__btn--active' : ''}`}
            onClick={() => setViewMode('documents')}
          >
            <i className="fa-solid fa-folder-open" /> Documenten
          </button>
        </div>

        <div className="pro-filters">
          <FilterDropdown
            groups={phaseFilterGroups}
            value={phaseFilter}
            onChange={setPhaseFilter}
            allLabel="Alle fasen"
          />
          <FilterDropdown
            groups={rolFilterGroups}
            value={rolFilter}
            onChange={setRolFilter}
            allLabel="Alle rollen"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="loading-inline"><p>Laden...</p></div>
      ) : viewMode === 'timeline' ? (
        filtered.length === 0 ? (
          <div className="empty-inline">
            <i className="fa-solid fa-hard-hat" />
            <p>Nog geen updates{(phaseFilter !== 'Alles' || rolFilter !== 'Alles') ? ' in deze selectie' : ' van adviseurs'}.</p>
          </div>
        ) : (
          <div className="pro-updates-list">
            {filtered.map(u => (
              <ProfessionalUpdateCard key={u.id} update={u} />
            ))}
          </div>
        )
      ) : (
        <DocumentsGrid updates={filtered} />
      )}

      {modalOpen && (
        <ProfessionalUpdateModal
          activePhase={activePhaseKey}
          onSave={createUpdate}
          onClose={() => setModalOpen(false)}
        />
      )}
      {inviteOpen && (
        <InviteSheet
          invites={invites}
          onInvite={createInvite}
          onRevoke={revokeInvite}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </div>
  )
}
