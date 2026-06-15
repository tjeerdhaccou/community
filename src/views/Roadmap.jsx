import { useState } from 'react'
import { useProject } from '../contexts/ProjectContext'
import { useRoadmap } from '../hooks/useRoadmap'

const TAG_MAP = {
  workshop:  { label: 'Workshop',  cls: 'roadmap-tag--blue' },
  milestone: { label: 'Milestone', cls: 'roadmap-tag--orange' },
  key:       { label: 'Mijlpaal',  cls: 'roadmap-tag--pink' },
  formeel:   { label: 'Formeel',   cls: 'roadmap-tag--green' },
  team:      { label: 'Team',      cls: 'roadmap-tag--muted' },
  special:   { label: 'Document',  cls: 'roadmap-tag--green' },
}

const STATUS_OPTIONS = [
  { value: 'done', label: 'Afgerond', color: '#3BD269' },
  { value: 'active', label: 'Actief', color: '#4A90D9' },
  { value: 'pending', label: 'Gepland', color: '#9ba1b0' },
]

function RoadmapItem({ item }) {
  const [open, setOpen] = useState(false)
  const tag = TAG_MAP[item.type] || TAG_MAP.milestone
  const dotCls = item.type === 'key' ? 'roadmap-dot--key' : item.type === 'milestone' ? 'roadmap-dot--milestone' : 'roadmap-dot--step'

  return (
    <div className={`roadmap-item ${open ? 'roadmap-item--open' : ''} ${item.is_done ? 'roadmap-item--done' : ''}`} onClick={() => setOpen(!open)}>
      <div className={`roadmap-dot ${item.type === 'special' ? 'roadmap-dot--special' : dotCls} ${item.is_done ? 'roadmap-dot--done' : ''}`} />
      <div className="roadmap-item__content">
        <div className="roadmap-item__top">
          <span className={`roadmap-item__title ${item.type === 'key' ? 'roadmap-item__title--key' : ''} ${item.is_done ? 'roadmap-item__title--done' : ''}`}>
            {item.title}
          </span>
          <span className={`roadmap-tag ${tag.cls}`}>{tag.label}</span>
        </div>
        {item.snippet && <div className="roadmap-item__snippet">{item.snippet}</div>}
        {open && item.description && (
          <div className="roadmap-item__detail">{item.description}</div>
        )}
      </div>
      <i className={`fa-solid fa-chevron-down roadmap-item__chevron ${open ? 'roadmap-item__chevron--open' : ''}`} />
    </div>
  )
}

function RoadmapPhase({ phase }) {
  const [open, setOpen] = useState(phase.status === 'active')

  const doneItems = phase.items?.filter(i => i.is_done).length || 0
  const totalItems = phase.items?.length || 0
  const statusInfo = STATUS_OPTIONS.find(s => s.value === phase.status) || STATUS_OPTIONS[2]

  return (
    <div className={`roadmap-phase ${open ? 'roadmap-phase--open' : ''} roadmap-phase--${phase.status}`}>
      <div className="roadmap-phase__head" onClick={() => setOpen(!open)}>
        <div className="roadmap-phase__num" style={{ background: phase.color }}>{phase.num}</div>
        <div className="roadmap-phase__info">
          <div className="roadmap-phase__name">
            {phase.name}{phase.subtitle ? ` — ${phase.subtitle}` : ''}
          </div>
          <div className="roadmap-phase__period">
            {phase.period}
            {totalItems > 0 && (
              <span className="roadmap-phase__progress"> · {doneItems}/{totalItems} afgerond</span>
            )}
          </div>
        </div>
        <div className="roadmap-phase__meta">
          <span className="roadmap-phase__status" style={{ color: statusInfo.color }}>{statusInfo.label}</span>
          {phase.expected_members && (
            <span className="roadmap-phase__members">
              <i className="fa-solid fa-users" /> {phase.expected_members}
            </span>
          )}
          <i className={`fa-solid fa-chevron-down roadmap-phase__chevron ${open ? 'roadmap-phase__chevron--open' : ''}`} />
        </div>
      </div>

      {open && (
        <div className="roadmap-phase__body">
          {(phase.items || []).map(item => (
            <RoadmapItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Roadmap() {
  const { project } = useProject()
  const { phases, loading } = useRoadmap(project?.id)

  if (loading) return <div className="skeleton-page" style={{ padding: 32 }}><div className="skeleton-line" style={{ width: 200, height: 26 }} /><div style={{ height: 16 }} />{[1,2,3].map(i => <div key={i} className="skeleton-card" style={{ marginBottom: 12 }}><div className="skeleton-line" style={{ width: '60%', height: 18 }} /><div className="skeleton-line" style={{ width: '40%' }} /></div>)}</div>

  return (
    <div className="view-roadmap">
      <div className="view-header">
        <div className="view-header__row">
          <div>
            <span className="view-header__eyebrow">Ontwikkeltraject</span>
            <h1>Roadmap</h1>
          </div>
        </div>
        <p className="view-header__subtitle">
          Van structuurontwerp tot oplevering — workshops, milestones en formele stappen in {phases.length} fasen.
        </p>
      </div>

      {phases.length === 0 ? (
        <div className="empty-inline">
          <i className="fa-solid fa-route" />
          <p>Het stappenplan wordt vanuit het CMS ingericht.</p>
        </div>
      ) : (
        <div className="roadmap-phases">
          {phases.map((phase, i) => (
            <div key={phase.id}>
              {i > 0 && <div className="roadmap-connector" />}
              <RoadmapPhase phase={phase} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
