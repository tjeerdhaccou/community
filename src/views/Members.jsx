import { useState } from 'react'
import { useProject } from '../contexts/ProjectContext'
import { useAuth } from '../contexts/AuthContext'
import { useMembers } from '../hooks/useMembers'
import { useMemberInvites } from '../hooks/useMemberInvites'
import useIntakeResponses from '../hooks/useIntakeResponses'
import useIntakeQuestions from '../hooks/useIntakeQuestions'
import { canDo } from '../lib/permissions'
import { ROLE_LABELS, ROLE_COLORS, PROFESSIONAL_LABELS, PROFESSIONAL_COLORS, FUNNEL_LABELS, FUNNEL_COLORS } from '../lib/constants'
import { getIntakeUrl, getProjectBaseUrl } from '../lib/subdomain'
import MemberProfile from '../components/MemberProfile'
import RejectModal from '../components/RejectModal'
import IntakeResponseDetail from '../components/IntakeResponseDetail'

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000

export default function Members() {
  const { project, role } = useProject()
  const { user, isPlatformAdmin, isOrgAdmin, orgMemberships } = useAuth()
  // Alleen org/platform admins mogen project-admins promoveren/demoteren of verwijderen
  const isAdminOfProjectOrg = isOrgAdmin && project?.organization_id && orgMemberships.some(om =>
    om.organization_id === project.organization_id && om.role === 'admin'
  )
  const canManageAdmins = isPlatformAdmin || isAdminOfProjectOrg
  const { members: allMembers, loading, updateRole, updateFunnelStage, removeMember, approveMember, rejectMember } = useMembers()
  // Stealth mode: platform admins zijn onzichtbaar voor andere project-leden.
  // Alleen platform admins zelf zien medeplatform-admins in de ledenlijst.
  const members = isPlatformAdmin
    ? allMembers
    : allMembers.filter(m => !m.profile?.is_platform_admin)
  const { pending: intakeResponses, updateStatus: updateIntakeStatus } = useIntakeResponses(project?.id, project?.name, getProjectBaseUrl(project))
  const { questions: intakeQuestions } = useIntakeQuestions(project?.id)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState(null)
  // Derive selectedMember from members list, zo blijft 'ie in sync na role-updates
  const selectedMember = selectedMemberId ? members.find(m => m.id === selectedMemberId) : null
  const setSelectedMember = (m) => setSelectedMemberId(m?.id ?? null)
  const [showInvite, setShowInvite] = useState(false)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [selectedIntake, setSelectedIntake] = useState(null)

  const guests = members.filter(m => m.role === 'guest')
  const active = members.filter(m => m.role !== 'guest' && m.role !== 'professional')
  const aspirants = active.filter(m => m.role === 'aspirant')

  const filtered = (filter === 'all' ? active
    : filter === 'pending' ? guests
    : active.filter(m => m.role === filter)
  ).filter(m => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const p = m.profile
    return (p?.full_name || '').toLowerCase().includes(q)
      || (p?.company || '').toLowerCase().includes(q)
  })

  return (
    <div className="view-members">
      <div className="view-header">
        <div className="view-header__row">
          <div>
            <h1>Leden</h1>
            <p className="view-header__subtitle">{active.length} leden{guests.length > 0 && canDo(role, 'invite_members') ? ` · ${guests.length} geïnteresseerd` : ''}</p>
          </div>
          {canDo(role, 'invite_members') && (
            <button className="btn-primary" onClick={() => setShowInvite(true)}>
              <i className="fa-solid fa-user-plus" /> Uitnodigen
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="members-search">
        <i className="fa-solid fa-magnifying-glass members-search__icon" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Zoek op naam of bedrijf..."
          className="members-search__input"
          aria-label="Zoeken"
        />
        {search && (
          <button className="members-search__clear" onClick={() => setSearch('')} aria-label="Sluiten">
            <i className="fa-solid fa-xmark" />
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="tag-filter">
        {[
          { key: 'all', label: `Alle (${active.length})` },
          ...(guests.length > 0 && canDo(role, 'invite_members') ? [{ key: 'pending', label: `Geïnteresseerden (${guests.length})` }] : []),
          { key: 'admin', label: 'Admins' },
          { key: 'moderator', label: 'Moderators' },
          { key: 'member', label: 'Leden' },
          ...(aspirants.length > 0 ? [{ key: 'aspirant', label: `Aspirant-leden (${aspirants.length})` }] : []),
          ...(intakeResponses.length > 0 && canDo(role, 'invite_members') ? [{ key: 'intake', label: `Aanmeldingen (${intakeResponses.length})` }] : []),
        ].map(f => (
          <button
            key={f.key}
            className={`tag-filter__pill ${filter === f.key ? 'tag-filter__pill--active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Geïnteresseerden banner */}
      {filter !== 'pending' && guests.length > 0 && canDo(role, 'invite_members') && (
        <div className="members-pending-banner">
          <i className="fa-solid fa-user-clock" />
          <span>{guests.length} {guests.length === 1 ? 'geïnteresseerde' : 'geïnteresseerden'} in dit project</span>
          <button className="members-pending-banner__btn" onClick={() => setFilter('pending')}>
            Bekijk <i className="fa-solid fa-arrow-right" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading-inline"><p>Leden laden...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-inline">
          <i className="fa-solid fa-users" />
          <p>{search ? 'Geen leden gevonden voor je zoekopdracht' : 'Geen leden gevonden'}</p>
        </div>
      ) : filter === 'intake' ? (
        /* Intake responses */
        <div className="members-list">
          {intakeResponses.length === 0 ? (
            <div className="empty-inline">
              <i className="fa-solid fa-envelope-open" />
              <p>Geen nieuwe aanmeldingen</p>
            </div>
          ) : intakeResponses.map(r => (
            <div key={r.id} className="member-row" onClick={() => setSelectedIntake(r)} role="button" tabIndex={0}>
              <div className="member-row__left">
                <div className="member-row__avatar member-row__avatar--placeholder">
                  {r.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <span className="member-row__name">{r.name}</span>
                  <span className="member-row__meta">{r.email} · {new Date(r.created_at).toLocaleDateString('nl-NL')}</span>
                </div>
              </div>
              <div className="member-row__right">
                <span className="intake-pill intake-pill--pending">Nieuw</span>
              </div>
            </div>
          ))}
        </div>
      ) : filter === 'pending' ? (
        /* Pending guests: keep as list with approve buttons */
        <div className="members-list">
          {filtered.map(m => (
            <PendingRow
              key={m.id}
              membership={m}
              onApprove={async () => { try { await approveMember(m.id) } catch (err) { console.error('Approve error:', err); alert('Goedkeuren mislukt: ' + (err.message || err)) } }}
              onReject={() => setRejectTarget(m)}
              onSelect={() => setSelectedMember(m)}
            />
          ))}
        </div>
      ) : (
        /* Active members: card grid */
        <div className="members-grid">
          {filtered.map(m => {
            const canViewProfile = canDo(role, 'view_member_profiles') || m.role === 'admin' || m.role === 'moderator' || m.profile_id === user?.id
            return (
              <MemberCard
                key={m.id}
                membership={m}
                isMe={m.profile_id === user?.id}
                onClick={canViewProfile ? () => setSelectedMember(m) : undefined}
                showFunnel={canDo(role, 'assign_roles')}
              />
            )
          })}
        </div>
      )}

      {selectedMember && (
        <MemberProfile
          profileId={selectedMember.profile_id}
          membership={selectedMember}
          onClose={() => setSelectedMember(null)}
          isMe={selectedMember.profile_id === user?.id}
          canManage={canDo(role, 'assign_roles') && selectedMember.profile_id !== user?.id
            && (selectedMember.role !== 'admin' || canManageAdmins)}
          canRemove={canDo(role, 'remove_members') && selectedMember.profile_id !== user?.id
            && (selectedMember.role !== 'admin' || canManageAdmins)}
          canAssignAdminRole={canManageAdmins}
          canApprove={canDo(role, 'invite_members') && selectedMember.role === 'guest'}
          onRoleChange={updateRole}
          onFunnelChange={updateFunnelStage}
          onRemove={removeMember}
          onApprove={approveMember}
          onReject={() => { setSelectedMember(null); setRejectTarget(selectedMember) }}
        />
      )}

      {showInvite && (
        <InviteModal projectName={project?.name} project={project} onClose={() => setShowInvite(false)} />
      )}

      {selectedIntake && (
        <IntakeResponseDetail
          response={selectedIntake}
          questions={intakeQuestions}
          onClose={() => setSelectedIntake(null)}
          onInvite={async () => { await updateIntakeStatus(selectedIntake.id, 'invited') }}
          onReject={async () => { await updateIntakeStatus(selectedIntake.id, 'rejected'); setSelectedIntake(null) }}
        />
      )}

      {rejectTarget && (
        <RejectModal
          memberName={rejectTarget.profile?.full_name || 'Onbekend'}
          onReject={async (reason) => { await rejectMember(rejectTarget.id, reason); setRejectTarget(null) }}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </div>
  )
}

function InviteModal({ projectName, project, onClose }) {
  const [tab, setTab] = useState('personal')
  const { invites, createInvite, revokeInvite, resendInvite } = useMemberInvites()

  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: '10vh' }}>
      <div className="modal-card modal-card--invite" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Lid uitnodigen</h2>
          <button className="modal-close" onClick={onClose} aria-label="Sluiten">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="tag-filter" style={{ padding: '12px 24px 20px', marginBottom: 0 }}>
          <button
            className={`tag-filter__pill ${tab === 'personal' ? 'tag-filter__pill--active' : ''}`}
            onClick={() => setTab('personal')}
          >
            Persoonlijk
          </button>
          <button
            className={`tag-filter__pill ${tab === 'link' ? 'tag-filter__pill--active' : ''}`}
            onClick={() => setTab('link')}
          >
            Open link
          </button>
        </div>

        {tab === 'personal' ? (
          <PersonalInvite
            projectName={projectName}
            invites={invites}
            onInvite={createInvite}
            onRevoke={revokeInvite}
            onResend={resendInvite}
          />
        ) : (
          <OpenLinkInvite projectName={projectName} project={project} />
        )}
      </div>
    </div>
  )
}

function PersonalInvite({ projectName, invites, onInvite, onRevoke, onResend }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [personalMessage, setPersonalMessage] = useState('')
  const [assignedRole, setAssignedRole] = useState('guest')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [resending, setResending] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setError(null)
    setSaving(true)
    try {
      await onInvite({ email: email.trim(), name: name.trim(), personalMessage: personalMessage.trim(), assignedRole })
      setEmail('')
      setName('')
      setPersonalMessage('')
      setAssignedRole('guest')
    } catch (err) {
      setError(err.message || 'Uitnodiging versturen mislukt.')
    } finally {
      setSaving(false)
    }
  }

  async function handleResend(invite) {
    setResending(invite.id)
    try {
      await onResend(invite)
    } catch (err) {
      setError(err.message || 'Opnieuw versturen mislukt.')
    } finally {
      setResending(null)
    }
  }

  const visibleInvites = invites.filter(i => i.status !== 'revoked')

  return (
    <div className="invite-modal__content">
      <p className="invite-modal__desc">
        Stuur een persoonlijke uitnodiging naar iemand die je wil toevoegen aan <strong>{projectName}</strong>. Ze krijgen een e-mail met een directe inloglink.
      </p>

      <form onSubmit={handleSubmit} className="modal-form">
        <div className="form-group">
          <label htmlFor="invite-email">E-mailadres</label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="naam@voorbeeld.nl"
            required
            autoFocus
          />
        </div>

        <div className="form-group">
          <label htmlFor="invite-name">Naam <span style={{ color: 'var(--color-text-muted)', fontWeight: 'normal' }}>(optioneel)</span></label>
          <input
            id="invite-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Volledige naam"
          />
        </div>

        <div className="form-group">
          <label htmlFor="invite-personal-message">
            Persoonlijk bericht <span style={{ color: 'var(--color-text-muted)', fontWeight: 'normal' }}>(optioneel)</span>
          </label>
          <textarea
            id="invite-personal-message"
            value={personalMessage}
            onChange={e => setPersonalMessage(e.target.value)}
            placeholder="Bijvoorbeeld: 'Hoi Jan, leuk je te ontmoeten gisteren. Hier de uitnodiging voor onze community.'"
            rows={3}
          />
        </div>

        <div className="form-group">
          <label htmlFor="invite-role">Rol na registratie</label>
          <select
            id="invite-role"
            value={assignedRole}
            onChange={e => setAssignedRole(e.target.value)}
            className="form-select"
          >
            <option value="guest">Gast (wacht op goedkeuring)</option>
            <option value="aspirant">Aspirant-lid</option>
            <option value="member">Lid</option>
            <option value="moderator">Moderator</option>
          </select>
          <span className="form-hint">De uitgenodigde kan deze rol zelf niet aanpassen.</span>
        </div>

        {error && <p style={{ color: 'var(--accent-red)', fontSize: '14px' }}>{error}</p>}

        <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
          <button type="submit" className="btn-primary" disabled={saving || !email.trim()}>
            <i className="fa-solid fa-paper-plane" /> {saving ? 'Versturen...' : 'Uitnodiging versturen'}
          </button>
        </div>
      </form>

      {visibleInvites.length > 0 && (
        <div className="invite-list">
          <h3 className="invite-list__title">Uitgenodigd</h3>
          {visibleInvites.map(inv => (
            <div key={inv.id} className="invite-row">
              <div className="invite-row__avatar" style={{ background: 'var(--accent-blue)' }}>
                {(inv.name || inv.email)[0].toUpperCase()}
              </div>
              <div className="invite-row__info">
                <span className="invite-row__name">{inv.name || inv.email}</span>
                {inv.name && <span className="invite-row__email">{inv.email}</span>}
              </div>
              {inv.assigned_role && inv.assigned_role !== 'guest' && (
                <span className="invite-role-badge" style={{ background: `${ROLE_COLORS[inv.assigned_role]}14`, color: ROLE_COLORS[inv.assigned_role] }}>
                  {ROLE_LABELS[inv.assigned_role]}
                </span>
              )}
              {inv.status === 'accepted' ? (
                <span className="invite-status invite-status--accepted">Aangemeld</span>
              ) : (
                <>
                  <button
                    className="btn-icon-sm"
                    onClick={() => handleResend(inv)}
                    disabled={resending === inv.id}
                    title="Opnieuw versturen"
                    aria-label="Opnieuw versturen"
                  >
                    <i className={`fa-solid ${resending === inv.id ? 'fa-spinner fa-spin' : 'fa-rotate-right'}`} />
                  </button>
                  <button
                    className="btn-icon-sm"
                    onClick={() => onRevoke(inv.id)}
                    title="Intrekken"
                    aria-label="Intrekken"
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function OpenLinkInvite({ projectName, project }) {
  const [copied, setCopied] = useState(false)
  const intakeUrl = getIntakeUrl(project)

  function copyLink() {
    navigator.clipboard.writeText(intakeUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="invite-modal__content">
      <p className="invite-modal__desc">
        Deel deze link met geïnteresseerden voor <strong>{projectName}</strong>. Ze vullen eerst het intake-formulier in — jij bepaalt daarna wie je uitnodigt.
      </p>

      <div className="invite-modal__link-row">
        <input type="text" value={intakeUrl} readOnly className="invite-modal__link-input" />
        <button className="btn-primary" onClick={copyLink}>
          <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} />
          {copied ? 'Gekopieerd' : 'Kopieer'}
        </button>
      </div>

      <div className="invite-modal__share-row">
        <a
          href={`mailto:?subject=${encodeURIComponent(`Aanmelden voor ${projectName}`)}&body=${encodeURIComponent(`Wil je meer weten over ${projectName}? Meld je aan via: ${intakeUrl}`)}`}
          className="btn-secondary invite-modal__share-btn"
        >
          <i className="fa-solid fa-envelope" /> Via e-mail
        </a>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Wil je meer weten over ${projectName}? Meld je aan via: ${intakeUrl}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary invite-modal__share-btn"
        >
          <i className="fa-brands fa-whatsapp" /> WhatsApp
        </a>
      </div>
    </div>
  )
}

function MemberCard({ membership, isMe, onClick, showFunnel }) {
  const p = membership.profile
  const roleColor = ROLE_COLORS[membership.role] || '#9ba1b0'
  const proLabel = PROFESSIONAL_LABELS[p?.professional_type]
  const proColor = PROFESSIONAL_COLORS[p?.professional_type]
  const isNew = Date.now() - new Date(membership.joined_at).getTime() < FOURTEEN_DAYS
  const funnelColor = FUNNEL_COLORS[membership.funnel_stage]
  const funnelLabel = FUNNEL_LABELS[membership.funnel_stage]

  return (
    <div className={`member-card ${onClick ? '' : 'member-card--no-click'}`} onClick={onClick}>
      <div className="member-card__top">
        {p?.avatar_url ? (
          <img src={p.avatar_url} alt={p.full_name || ''} className="member-card__avatar" />
        ) : (
          <div className="member-card__avatar member-card__avatar--placeholder">
            {(p?.full_name || 'U')[0]}
          </div>
        )}
        {proLabel && p?.company_logo_url && (
          <img src={p.company_logo_url} alt={p.company ? p.company + ' logo' : ''} className="member-card__company-logo" />
        )}
      </div>

      <h3 className="member-card__name">
        {p?.full_name || 'Onbekend'}
        {isMe && <span className="member-card__you">jij</span>}
      </h3>

      {p?.company && (
        <p className="member-card__company">{p.company}</p>
      )}

      <div className="member-card__badges">
        <span className="member-card__badge" style={{ background: `${roleColor}14`, color: roleColor }}>
          {ROLE_LABELS[membership.role]}
        </span>
        {proLabel && (
          <span className="member-card__badge" style={{ background: `${proColor}14`, color: proColor }}>
            {proLabel}
          </span>
        )}
        {showFunnel && funnelLabel && membership.funnel_stage !== 'nieuw' && (
          <span className="member-card__badge" style={{ background: `${funnelColor}14`, color: funnelColor }}>
            {funnelLabel}
          </span>
        )}
        {isNew && <span className="member-card__badge member-card__badge--new">Nieuw</span>}
      </div>
    </div>
  )
}

function PendingRow({ membership, onApprove, onReject, onSelect }) {
  const p = membership.profile

  return (
    <div className="member-row" onClick={onSelect} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
      <div className="member-row__left">
        {p?.avatar_url ? (
          <img src={p.avatar_url} alt={p.full_name || ''} className="member-row__avatar" />
        ) : (
          <div className="member-row__avatar member-row__avatar--placeholder">
            {(p?.full_name || 'U')[0]}
          </div>
        )}
        <div className="member-row__info">
          <span className="member-row__name">{p?.full_name || 'Onbekend'}</span>
          <span className="member-row__joined">Wil lid worden</span>
        </div>
      </div>
      <div className="member-row__right">
        <button className="btn-sm btn-sm--danger" onClick={e => { e.stopPropagation(); onReject() }} title="Afwijzen" aria-label="Afwijzen">
          <i className="fa-solid fa-xmark" />
        </button>
        <button className="btn-sm btn-sm--green" onClick={e => { e.stopPropagation(); onApprove() }}>
          <i className="fa-solid fa-check" /> Goedkeuren
        </button>
      </div>
    </div>
  )
}
