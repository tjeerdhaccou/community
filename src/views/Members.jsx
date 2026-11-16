import { useState } from 'react'
import { useProject } from '../contexts/ProjectContext'
import { useAuth } from '../contexts/AuthContext'
import { useMembers } from '../hooks/useMembers'
import { useMemberInvites } from '../hooks/useMemberInvites'
import { useWorkgroups } from '../hooks/useWorkgroups'
import useIntakeResponses from '../hooks/useIntakeResponses'
import useIntakeQuestions from '../hooks/useIntakeQuestions'
import { canDo } from '../lib/permissions'
import { ROLE_LABELS, ROLE_COLORS, PROFESSIONAL_LABELS, PROFESSIONAL_COLORS, FUNNEL_LABELS, FUNNEL_COLORS, tagStyle, funnelStyle } from '../lib/constants'
import { getIntakeUrl, getProjectBaseUrl } from '../lib/subdomain'
import CollapsibleTagFilter from '../components/CollapsibleTagFilter'
import MemberProfile from '../components/MemberProfile'
import RejectModal from '../components/RejectModal'
import IntakeResponseDetail from '../components/IntakeResponseDetail'
import { useUnreviewedMemberUploads } from '../hooks/useUnreviewedMemberUploads'
import LightQuotaBanner from '../components/LightQuotaBanner'

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
  // Eén bron voor uitnodigingen: de lijst hieronder en het uitnodigingsvenster
  // delen dezelfde stand, zodat een nieuwe uitnodiging er meteen tussen staat.
  const inviteApi = useMemberInvites()
  const pendingInvites = canDo(role, 'invite_members') ? inviteApi.invites.filter(i => i.status === 'pending') : []
  const [inviteBusy, setInviteBusy] = useState(null)
  const [inviteNotice, setInviteNotice] = useState(null)
  const { pending: intakeResponses, updateStatus: updateIntakeStatus } = useIntakeResponses(project?.id, project?.name, getProjectBaseUrl(project))
  const { questions: intakeQuestions } = useIntakeQuestions(project?.id)
  const { allWorkgroups, workgroupIdsByProfile, workgroupsForProfile } = useWorkgroups()
  const { hasUnreviewed: hasUnreviewedUploads, markReviewed: markUploadsReviewed, memberCount: unreviewedUploadCount } = useUnreviewedMemberUploads()
  const canReviewUploads = canDo(role, 'assign_roles')
  const commissies = allWorkgroups.filter(wg => wg.type === 'commissie')
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
    : filter === 'uploads' ? active.filter(m => hasUnreviewedUploads(m.profile_id))
    : filter.startsWith('wg:') ? active.filter(m => (workgroupIdsByProfile[m.profile_id] || new Set()).has(filter.slice(3)))
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
            <p className="view-header__subtitle">{active.length} leden{guests.length > 0 && canDo(role, 'invite_members') ? ` · ${guests.length} geïnteresseerd` : ''}{pendingInvites.length > 0 ? ` · ${pendingInvites.length} uitgenodigd` : ''}</p>
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
      <CollapsibleTagFilter>
        {[
          { key: 'all', label: `Alle (${active.length})` },
          ...(guests.length > 0 && canDo(role, 'invite_members') ? [{ key: 'pending', label: `Geïnteresseerden (${guests.length})` }] : []),
          ...(pendingInvites.length > 0 ? [{ key: 'invited', label: `Uitgenodigd (${pendingInvites.length})` }] : []),
          ...(unreviewedUploadCount > 0 && canReviewUploads ? [{ key: 'uploads', label: `Nieuwe uploads (${unreviewedUploadCount})` }] : []),
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
        {commissies.length > 0 && (
          <>
            <span className="tag-filter__divider" aria-hidden="true" />
            {commissies.map(c => (
              <button
                key={c.id}
                className={`tag-filter__pill ${filter === `wg:${c.id}` ? 'tag-filter__pill--active' : ''}`}
                onClick={() => setFilter(`wg:${c.id}`)}
              >
                <i className="fa-solid fa-users" style={{ marginRight: '5px', fontSize: '11px' }} /> {c.name}
              </button>
            ))}
          </>
        )}
      </CollapsibleTagFilter>

      {/* buuur light: stand van de gratis leden (toont niets als er geen grens geldt) */}
      {canDo(role, 'invite_members') && (
        <LightQuotaBanner projectId={project?.id} memberCount={active.length} canRequest={role === 'admin'} />
      )}

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

      {/* Nieuwe uploads banner — spiegelt de geïnteresseerden-banner. Zorgt dat
          admins de sidebar-badge in twee klikken herleiden naar het juiste lid. */}
      {filter !== 'uploads' && unreviewedUploadCount > 0 && canReviewUploads && (
        <div className="members-pending-banner">
          <i className="fa-solid fa-file-arrow-up" />
          <span>{unreviewedUploadCount} {unreviewedUploadCount === 1 ? 'lid heeft' : 'leden hebben'} nieuwe dossier-uploads</span>
          <button className="members-pending-banner__btn" onClick={() => setFilter('uploads')}>
            Bekijk <i className="fa-solid fa-arrow-right" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading-inline"><p>Leden laden...</p></div>
      ) : filter === 'invited' ? (
        /* Openstaande uitnodigingen: wie is uitgenodigd maar heeft nog niet ingelogd */
        <div className="members-list">
          {inviteNotice && (
            <p role="status" className="form-hint" style={{ color: 'var(--tag-green-text, #27A854)', marginBottom: 8 }}>
              <i className="fa-solid fa-circle-check" aria-hidden="true" /> {inviteNotice}
            </p>
          )}
          {pendingInvites.length === 0 ? (
            <div className="empty-inline">
              <i className="fa-solid fa-envelope-open" />
              <p>Geen openstaande uitnodigingen</p>
            </div>
          ) : pendingInvites.map(inv => (
            <div key={inv.id} className="member-row">
              <div className="member-row__left">
                <div className="member-row__avatar member-row__avatar--placeholder">
                  {(inv.name || inv.email)[0].toUpperCase()}
                </div>
                <div>
                  <span className="member-row__name">{inv.name || inv.email}</span>
                  <span className="member-row__meta">
                    {inv.name ? `${inv.email} · ` : ''}uitgenodigd op {new Date(inv.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}
                    {inv.inviter?.full_name ? ` door ${inv.inviter.full_name}` : ''}
                  </span>
                </div>
              </div>
              <div className="member-row__right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="invite-role-badge" style={tagStyle(ROLE_COLORS[inv.assigned_role || 'guest'])}>
                  {inv.assigned_role && inv.assigned_role !== 'guest' ? ROLE_LABELS[inv.assigned_role] : 'Gast'}
                </span>
                <button
                  className="btn-secondary btn-sm"
                  disabled={inviteBusy === inv.id}
                  onClick={async () => {
                    setInviteBusy(inv.id); setInviteNotice(null)
                    try {
                      await inviteApi.resendInvite(inv)
                      setInviteNotice(`Uitnodiging opnieuw verstuurd naar ${inv.email}.`)
                    } catch (err) { alert(err.message || 'Opnieuw versturen mislukt.') }
                    setInviteBusy(null)
                  }}
                >
                  {inviteBusy === inv.id ? 'Versturen…' : 'Opnieuw versturen'}
                </button>
                <button
                  className="btn-icon-sm"
                  title="Uitnodiging intrekken"
                  aria-label={`Uitnodiging voor ${inv.email} intrekken`}
                  onClick={async () => {
                    try { await inviteApi.revokeInvite(inv.id); setInviteNotice(`Uitnodiging voor ${inv.email} ingetrokken.`) }
                    catch (err) { alert(err.message || 'Intrekken mislukt.') }
                  }}
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            </div>
          ))}
        </div>
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
        /* Leden: rijen, in dezelfde stijl als uitgenodigden en geïnteresseerden */
        <div className="members-list">
          {filtered.map(m => {
            const canViewProfile = canDo(role, 'view_member_profiles') || m.role === 'admin' || m.role === 'moderator' || m.profile_id === user?.id
            return (
              <MemberRow
                key={m.id}
                membership={m}
                isMe={m.profile_id === user?.id}
                onClick={canViewProfile ? () => setSelectedMember(m) : undefined}
                showFunnel={canDo(role, 'assign_roles')}
                commissies={workgroupsForProfile(m.profile_id, 'commissie')}
                hasUnreviewedUploads={hasUnreviewedUploads(m.profile_id)}
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
        <InviteModal projectName={project?.name} project={project} inviteApi={inviteApi} onClose={() => setShowInvite(false)} />
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

function InviteModal({ projectName, project, inviteApi, onClose }) {
  const [tab, setTab] = useState('personal')
  const { createInvite } = inviteApi

  return (
    <div className="modal-overlay" onClick={onClose}>
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
          <PersonalInvite projectName={projectName} onInvite={createInvite} />
        ) : (
          <OpenLinkInvite projectName={projectName} project={project} />
        )}
      </div>
    </div>
  )
}

function PersonalInvite({ projectName, onInvite }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [personalMessage, setPersonalMessage] = useState('')
  const [assignedRole, setAssignedRole] = useState('guest')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  // Bevestiging na versturen. Het overzicht van wie is uitgenodigd staat in de
  // ledenlijst (filter Uitgenodigd), niet in dit venster.
  const [notice, setNotice] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setError(null)
    setNotice(null)
    setSaving(true)
    try {
      const sentTo = email.trim()
      await onInvite({ email: sentTo, name: name.trim(), personalMessage: personalMessage.trim(), assignedRole })
      setNotice(`Uitnodiging verstuurd naar ${sentTo}. Je vindt hem terug bij Leden, onder Uitgenodigd.`)
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

        {error && <p role="alert" style={{ color: 'var(--accent-red)', fontSize: '14px' }}>{error}</p>}
        {notice && !error && (
          <p role="status" style={{ color: 'var(--tag-green-text, #27A854)', fontSize: '14px', fontWeight: 500 }}>
            <i className="fa-solid fa-circle-check" aria-hidden="true" /> {notice}
          </p>
        )}

        <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
          <button type="submit" className="btn-primary" disabled={saving || !email.trim()}>
            <i className="fa-solid fa-paper-plane" /> {saving ? 'Versturen...' : 'Uitnodiging versturen'}
          </button>
        </div>
      </form>
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

function MemberRow({ membership, isMe, onClick, showFunnel, commissies = [], hasUnreviewedUploads }) {
  const p = membership.profile
  const roleColor = ROLE_COLORS[membership.role] || '#9ba1b0'
  const proLabel = PROFESSIONAL_LABELS[p?.professional_type]
  const proColor = PROFESSIONAL_COLORS[p?.professional_type]
  const isNew = Date.now() - new Date(membership.joined_at).getTime() < FOURTEEN_DAYS
  const funnelColor = FUNNEL_COLORS[membership.funnel_stage]
  const funnelLabel = FUNNEL_LABELS[membership.funnel_stage]
  // Tweede regel: bedrijf en commissies, gescheiden door een punt.
  const meta = [p?.company, ...commissies.map(c => c.name)].filter(Boolean).join(' · ')

  return (
    <div
      className="member-row"
      onClick={onClick}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={onClick ? undefined : { cursor: 'default' }}
    >
      <div className="member-row__left">
        {p?.avatar_url ? (
          <img src={p.avatar_url} alt="" className="member-row__avatar" />
        ) : (
          <div className="member-row__avatar member-row__avatar--placeholder">
            {(p?.full_name || 'U')[0].toUpperCase()}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <span className="member-row__name">
            {p?.full_name || 'Onbekend'}
            {isMe && <span className="member-row__you">jij</span>}
            {hasUnreviewedUploads && (
              <span className="member-card__upload-dot" title="Nieuwe uploads in dossier" aria-label="Nieuwe uploads in dossier" />
            )}
          </span>
          {meta && <span className="member-row__meta">{meta}</span>}
        </div>
      </div>
      <div className="member-row__right member-row__right--badges">
        <span className="invite-role-badge" style={tagStyle(roleColor)}>{ROLE_LABELS[membership.role]}</span>
        {proLabel && <span className="invite-role-badge" style={tagStyle(proColor)}>{proLabel}</span>}
        {showFunnel && funnelLabel && membership.funnel_stage !== 'nieuw' && (
          <span className="invite-role-badge" style={tagStyle(funnelColor)}>{funnelLabel}</span>
        )}
        {isNew && <span className="invite-role-badge member-card__badge--new">Nieuw</span>}
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
