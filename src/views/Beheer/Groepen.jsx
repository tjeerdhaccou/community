import { useState, useMemo } from 'react'
import { useProject } from '../../contexts/ProjectContext'
import { canDo } from '../../lib/permissions'
import { useWorkgroups } from '../../hooks/useWorkgroups'
import { useMembers } from '../../hooks/useMembers'
import { useToast } from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'

// Korte icoonnamen (consistent met bestaande workgroup-data in de DB).
const ICON_OPTIONS = [
  'people-group', 'hammer', 'coins', 'scale-balanced', 'seedling',
  'bullhorn', 'palette', 'leaf', 'handshake', 'users',
]

const TYPE_LABELS = { commissie: 'Commissie', doelgroep: 'Doelgroep' }

// Legacy korte namen die afwijken van Font Awesome 6.
const ICON_ALIAS = { megaphone: 'bullhorn' }

// Ondersteunt zowel korte namen ("building") als volledige FA-classes.
function wgIcon(icon) {
  if (!icon) return 'fa-solid fa-people-group'
  if (icon.includes('fa-')) return icon
  return `fa-solid fa-${ICON_ALIAS[icon] || icon}`
}

/**
 * "Groepen" — beheerview voor werkgroepen (commissies & doelgroepen).
 * Commissieleden krijgen via RLS (migratie 064) document-uploadrechten binnen
 * hun commissie; doelgroepen zijn segmenten zonder extra rechten.
 * Zichtbaar voor moderator+ (manage_workgroups).
 */
export default function Groepen() {
  const { role } = useProject()
  const {
    allWorkgroups, workgroupIdsByProfile, loading,
    createWorkgroup, updateWorkgroup, deleteWorkgroup, addMember, removeMember,
  } = useWorkgroups()
  const { members } = useMembers()
  const toast = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)

  const canManage = canDo(role, 'manage_workgroups')

  // Leden per werkgroep afleiden uit workgroupIdsByProfile + members
  const membersByWg = useMemo(() => {
    const map = {}
    for (const wg of allWorkgroups) map[wg.id] = []
    for (const m of members) {
      const pid = m.profile?.id
      const ids = pid ? workgroupIdsByProfile[pid] : null
      if (!ids) continue
      for (const wgId of ids) { if (map[wgId]) map[wgId].push(m) }
    }
    return map
  }, [allWorkgroups, members, workgroupIdsByProfile])

  if (!canManage) {
    return (
      <div className="empty-inline">
        <i className="fa-solid fa-lock" />
        <p>Deze pagina is alleen voor beheerders en moderators.</p>
      </div>
    )
  }

  const commissies = allWorkgroups.filter(w => w.type === 'commissie')
  const doelgroepen = allWorkgroups.filter(w => w.type === 'doelgroep')

  async function handleDelete() {
    try {
      await deleteWorkgroup(confirmDel.id)
      toast.success('Groep verwijderd')
    } catch (e) {
      toast.error(e.message)
    }
    setConfirmDel(null)
  }

  function renderSection(title, list, hint) {
    if (list.length === 0) return null
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <h2 style={{ fontSize: 'var(--text-h3, 18px)', fontWeight: 600 }}>{title}</h2>
          <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>{hint}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map(wg => (
            <WorkgroupCard
              key={wg.id}
              wg={wg}
              members={membersByWg[wg.id] || []}
              allMembers={members}
              expanded={expandedId === wg.id}
              onToggle={() => setExpandedId(expandedId === wg.id ? null : wg.id)}
              onEdit={() => { setEditing(wg); setModalOpen(true) }}
              onDelete={() => setConfirmDel(wg)}
              onAddMember={async (pid) => {
                try { await addMember(wg.id, pid) } catch (e) { toast.error(e.message) }
              }}
              onRemoveMember={async (pid) => {
                try { await removeMember(wg.id, pid) } catch (e) { toast.error(e.message) }
              }}
              canDelete={canDo(role, 'remove_members')}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="view-groepen">
      <div className="view-header">
        <div className="view-header__row">
          <h1>Groepen</h1>
          <button className="btn-primary" onClick={() => { setEditing(null); setModalOpen(true) }}>
            <i className="fa-solid fa-plus" /> Nieuwe groep
          </button>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
          Maak commissies (met eigen documentbeheer) of doelgroepen om je community te organiseren.
        </p>
      </div>

      {loading ? (
        <div className="loading-inline"><p>Groepen laden...</p></div>
      ) : allWorkgroups.length === 0 ? (
        <div className="empty-inline">
          <i className="fa-solid fa-people-group" />
          <p>Nog geen groepen. Maak je eerste commissie of doelgroep aan.</p>
        </div>
      ) : (
        <>
          {renderSection('Commissies', commissies, 'leden kunnen documenten beheren')}
          {renderSection('Doelgroepen', doelgroepen, 'segmenten voor zichtbaarheid')}
        </>
      )}

      {modalOpen && (
        <WorkgroupModal
          workgroup={editing}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSave={async (data) => {
            try {
              if (editing) await updateWorkgroup(editing.id, data)
              else await createWorkgroup(data)
              toast.success(editing ? 'Groep bijgewerkt' : 'Groep aangemaakt')
              setModalOpen(false); setEditing(null)
            } catch (e) {
              toast.error(e.message)
            }
          }}
        />
      )}

      {confirmDel && (
        <ConfirmModal
          message={`Groep "${confirmDel.name}" verwijderen? Documenten blijven bestaan, maar de koppeling met deze groep verdwijnt.`}
          confirmLabel="Verwijderen"
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  )
}

// ===== Werkgroep-kaart =====
function WorkgroupCard({ wg, members, allMembers, expanded, onToggle, onEdit, onDelete, onAddMember, onRemoveMember, canDelete }) {
  const memberIds = new Set(members.map(m => m.profile?.id))
  const addable = allMembers.filter(m => m.profile?.id && !memberIds.has(m.profile.id))

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-md, 12px)',
      boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16 }}>
        <div style={{
          flexShrink: 0, width: 38, height: 38, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-hover)', color: 'var(--accent-primary, #4A90D9)',
        }}>
          <i className={wgIcon(wg.icon)} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{wg.name}</div>
          {wg.description && (
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 2 }}>{wg.description}</div>
          )}
        </div>
        <span className="doc-row__source" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)', flexShrink: 0 }}>
          {TYPE_LABELS[wg.type] || wg.type}
        </span>
        <button className="btn-secondary btn-sm" onClick={onToggle} style={{ flexShrink: 0 }}>
          <i className="fa-solid fa-users" /> {members.length}
          <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'}`} style={{ marginLeft: 6, fontSize: 11 }} />
        </button>
        <button className="btn-secondary btn-sm" onClick={onEdit} title="Bewerken" style={{ flexShrink: 0 }}>
          <i className="fa-solid fa-pen" />
        </button>
        {canDelete && (
          <button className="btn-secondary btn-sm" onClick={onDelete} title="Verwijderen" style={{ flexShrink: 0, color: 'var(--accent-red)' }}>
            <i className="fa-solid fa-trash" />
          </button>
        )}
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--bg-hover)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {members.length === 0 ? (
              <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>Nog geen leden in deze groep.</p>
            ) : members.map(m => (
              <div key={m.profile?.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {m.profile?.avatar_url ? (
                  <img src={m.profile.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {(m.profile?.full_name || '?')[0]}
                  </div>
                )}
                <span style={{ flex: 1, fontSize: 'var(--text-body, 14px)', color: 'var(--text-primary)' }}>{m.profile?.full_name || 'Onbekend'}</span>
                <button className="btn-secondary btn-sm" onClick={() => onRemoveMember(m.profile.id)} title="Uit groep halen">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            ))}
          </div>

          {addable.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <select
                value=""
                onChange={e => { if (e.target.value) onAddMember(e.target.value) }}
                style={{ width: '100%' }}
              >
                <option value="">+ Lid toevoegen…</option>
                {addable.map(m => (
                  <option key={m.profile.id} value={m.profile.id}>{m.profile.full_name || m.profile.email}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ===== Aanmaak/bewerk-modal =====
function WorkgroupModal({ workgroup, onClose, onSave }) {
  const isEdit = !!workgroup
  const [name, setName] = useState(workgroup?.name || '')
  const [description, setDescription] = useState(workgroup?.description || '')
  const [type, setType] = useState(workgroup?.type || 'commissie')
  const [icon, setIcon] = useState(workgroup?.icon || ICON_OPTIONS[0])
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name, description, type, icon })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <h2>{isEdit ? 'Groep bewerken' : 'Nieuwe groep'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Sluiten">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Naam *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Bijv. Financiën-commissie" required autoFocus />
          </div>

          <div className="form-group">
            <label>Type</label>
            <select value={type} onChange={e => setType(e.target.value)}>
              <option value="commissie">Commissie — leden mogen documenten beheren</option>
              <option value="doelgroep">Doelgroep — segment zonder extra rechten</option>
            </select>
          </div>

          <div className="form-group">
            <label>Beschrijving</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Waar gaat deze groep over?" />
          </div>

          <div className="form-group">
            <label>Icoon</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ICON_OPTIONS.map(opt => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setIcon(opt)}
                  style={{
                    width: 40, height: 40, borderRadius: 'var(--radius-sm, 8px)', cursor: 'pointer',
                    border: 'none',
                    background: icon === opt ? 'var(--accent-primary, #4A90D9)' : 'var(--bg-hover)',
                    color: icon === opt ? '#fff' : 'var(--text-secondary)',
                  }}
                  aria-label={opt}
                >
                  <i className={`fa-solid fa-${opt}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Annuleren</button>
            <button type="submit" className="btn-primary" disabled={saving || !name.trim()}>
              {saving ? 'Opslaan…' : (isEdit ? 'Opslaan' : 'Groep aanmaken')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
