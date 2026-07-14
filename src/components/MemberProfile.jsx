import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProject } from '../contexts/ProjectContext'
import { ROLES, ROLE_LABELS, ROLE_COLORS, PROFESSIONAL_LABELS, PROFESSIONAL_COLORS, FUNNEL_STAGES, FUNNEL_LABELS, FUNNEL_COLORS, FUNNEL_ICONS, formatFileSize, fileIcon, fileIconColor } from '../lib/constants'
import { uploadFile } from '../lib/storage'
import { labelForValue } from '../lib/intakeFields'
import { useAuth } from '../contexts/AuthContext'
import { useAdminDocumentRequests } from '../hooks/useDocumentRequests'
import { useUnreviewedMemberUploads } from '../hooks/useUnreviewedMemberUploads'
import { useFileRemovalRequests } from '../hooks/useFileRemovalRequests'
import ConfirmModal from './ConfirmModal'

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000

export default function MemberProfile({ profileId, membership, onClose, canManage, canRemove, canApprove, canAssignAdminRole = false, onRoleChange, onFunnelChange, onRemove, onApprove, onReject, isMe }) {
  const [profile, setProfile] = useState(null)
  const [postCount, setPostCount] = useState(0)
  const [intakeData, setIntakeData] = useState(null)
  const [intakeQuestions, setIntakeQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const roleBtnRef = useRef(null)
  const roleMenuRef = useRef(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [expandedPhoto, setExpandedPhoto] = useState(null)
  const [activeTab, setActiveTab] = useState('profile')
  const navigate = useNavigate()
  const { project } = useProject()
  const { user } = useAuth()
  const { hasUnreviewed: hasUnreviewedUploads, markReviewed: markUploadsReviewed } = useUnreviewedMemberUploads()
  const showDossierDot = canManage && !isMe && hasUnreviewedUploads(profileId)

  // Zodra de admin het Dossier-tab opent, alle ongelezen zelf-uploads van dit
  // lid markeren als gezien. Dot verdwijnt daarna in sidebar + ledenlijst.
  useEffect(() => {
    if (activeTab === 'dossier' && canManage && !isMe && hasUnreviewedUploads(profileId)) {
      markUploadsReviewed(profileId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, profileId])

  useEffect(() => {
    if (!profileId) return
    const queries = [
      supabase.from('profiles').select('*').eq('id', profileId).single(),
      supabase.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', profileId),
    ]

    Promise.all(queries).then(async ([profileRes, postRes]) => {
      setProfile(profileRes.data)
      setPostCount(postRes.count || 0)

      // Load intake data if this is a guest (pending approval)
      if (profileRes.data?.email && membership?.role === 'guest' && project?.id) {
        const [intakeRes, questionsRes] = await Promise.all([
          supabase.from('intake_responses').select('*').eq('email', profileRes.data.email).eq('project_id', project.id).limit(1).single(),
          supabase.from('intake_questions').select('*').eq('project_id', project.id).eq('active', true).order('sort_order'),
        ])
        if (intakeRes.data) setIntakeData(intakeRes.data)
        if (questionsRes.data) setIntakeQuestions(questionsRes.data)
      }

      setLoading(false)
    })
  }, [profileId, membership?.role, project?.id])

  if (!profileId) return null

  const role = membership?.role
  const roleLabel = ROLE_LABELS[role] || role
  const roleColor = ROLE_COLORS[role] || '#9ba1b0'
  const proType = profile?.professional_type
  const proLabel = PROFESSIONAL_LABELS[proType]
  const proColor = PROFESSIONAL_COLORS[proType]
  const isProfessional = !!proType && !!profile?.company_logo_url
  const isNew = membership?.joined_at && (Date.now() - new Date(membership.joined_at).getTime() < FOURTEEN_DAYS)
  const joinDate = membership?.joined_at
    ? new Date(membership.joined_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const birthYearVal = profile?.date_of_birth
    ? new Date(profile.date_of_birth).getFullYear()
    : profile?.birth_year || null
  const age = birthYearVal ? new Date().getFullYear() - birthYearVal : null

  // Close role menu on outside click
  useEffect(() => {
    if (!showRoleMenu) return
    const close = (e) => {
      if (roleBtnRef.current?.contains(e.target)) return
      if (roleMenuRef.current?.contains(e.target)) return
      setShowRoleMenu(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showRoleMenu])

  function handleRoleChange(newRole) {
    onRoleChange?.(membership.id, newRole)
    setShowRoleMenu(false)
  }

  function handleRemove() {
    onRemove?.(membership.id)
    setConfirmRemove(false)
    onClose()
  }

  function handleApprove() {
    onApprove?.(membership.id)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card--profile" onClick={e => e.stopPropagation()}>
        {/* Close button — always top-right */}
        <button className="modal-close modal-close--profile" onClick={onClose} aria-label="Sluiten">
          <i className="fa-solid fa-xmark" />
        </button>

        {loading ? (
          <div className="loading-inline" style={{ padding: '48px 0' }}><p>Laden...</p></div>
        ) : profile ? (
          <div className="member-profile">
            {/* Avatar with optional company logo overlay */}
            <div className="member-profile__avatar-section">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name || ''} className="member-profile__avatar" />
              ) : (
                <div className="member-profile__avatar member-profile__avatar--placeholder">
                  {(profile.full_name || '?')[0]}
                </div>
              )}
              {isProfessional && (
                <img src={profile.company_logo_url} alt={profile.company ? profile.company + ' logo' : ''} className="member-profile__logo-overlay" />
              )}
            </div>

            {/* Name */}
            <h2 className="member-profile__name">{profile.full_name || 'Onbekend'}</h2>

            {/* Badges */}
            <div className="member-profile__badges">
              {role && (
                <span className="member-profile__badge" style={{ background: `${roleColor}18`, color: roleColor }}>
                  {roleLabel}
                </span>
              )}
              {proLabel && (
                <span className="member-profile__badge" style={{ background: `${proColor}18`, color: proColor }}>
                  {proLabel}
                </span>
              )}
              {isNew && (
                <span className="member-profile__badge member-profile__badge--new">
                  Nieuw lid
                </span>
              )}
            </div>

            {/* Edit own profile — navigate to profile page */}
            {isMe && (
              <button className="btn-secondary member-profile__edit-btn" onClick={() => { onClose(); navigate(`/p/${project?.slug}/profile`) }}>
                <i className="fa-solid fa-pen" /> Profiel bewerken
              </button>
            )}

            {/* Tabs for admin: Profiel | Dossier */}
            {canManage && !isMe && (
              <div className="tag-filter" style={{ marginTop: 12, marginBottom: 0 }}>
                <button
                  className={`tag-filter__pill ${activeTab === 'profile' ? 'tag-filter__pill--active' : ''}`}
                  onClick={() => setActiveTab('profile')}
                >
                  Profiel
                </button>
                <button
                  className={`tag-filter__pill ${activeTab === 'dossier' ? 'tag-filter__pill--active' : ''}`}
                  onClick={() => setActiveTab('dossier')}
                >
                  <i className="fa-solid fa-folder-open" /> Dossier
                  {showDossierDot && (
                    <span
                      className="member-profile__dossier-dot"
                      aria-label="Nieuwe uploads"
                      title="Nieuwe uploads"
                    />
                  )}
                </button>
              </div>
            )}

            {activeTab === 'profile' ? (
              <>
                {/* Bio */}
                {profile.bio && (
                  <p className="member-profile__bio">{profile.bio}</p>
                )}

                {/* Woondroom */}
                {profile.housing_dream && (
                  <div className="member-profile__section">
                    <h4 className="member-profile__section-title">
                      <i className="fa-solid fa-house-chimney" /> Woondroom
                    </h4>
                    <p className="member-profile__section-text">{profile.housing_dream}</p>
                  </div>
                )}

                {/* Photo gallery */}
                {profile.photo_urls?.length > 0 && (
                  <div className="member-profile__gallery">
                    {profile.photo_urls.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className={`member-profile__gallery-img ${expandedPhoto === i ? 'member-profile__gallery-img--expanded' : ''}`}
                        onClick={() => setExpandedPhoto(expandedPhoto === i ? null : i)}
                      />
                    ))}
                  </div>
                )}

                {/* Stats */}
                <div className="member-profile__stats">
                  {joinDate && (
                    <div className="member-profile__stat">
                      <i className="fa-solid fa-calendar" />
                      <span>Lid sinds {joinDate}</span>
                    </div>
                  )}
                  <div className="member-profile__stat">
                    <i className="fa-solid fa-pen-to-square" />
                    <span>{postCount} {postCount === 1 ? 'bericht' : 'berichten'} op het prikbord</span>
                  </div>
                </div>

                {/* Personal details */}
                {(age || profile.household) && (
                  <div className="member-profile__details">
                    {age && (
                      <div className="member-profile__detail">
                        <i className="fa-solid fa-cake-candles" />
                        <span>{age} jaar</span>
                      </div>
                    )}
                    {profile.household && (
                      <div className="member-profile__detail">
                        <i className="fa-solid fa-people-roof" />
                        <span>{labelForValue('household', profile.household)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Contact details — telefoon is privé en alleen voor beheerders */}
                {(profile.company || profile.website || (profile.phone && canManage)) && (
                  <div className="member-profile__details">
                    {profile.company && (
                      <div className="member-profile__detail">
                        <i className="fa-solid fa-building" />
                        <span>{profile.company}</span>
                        {profile.company_logo_url && !isProfessional && (
                          <img src={profile.company_logo_url} alt={profile.company ? profile.company + ' logo' : ''} className="member-profile__company-logo" />
                        )}
                      </div>
                    )}
                    {profile.website && (
                      <div className="member-profile__detail">
                        <i className="fa-solid fa-globe" />
                        <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer">
                          {profile.website.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}
                    {profile.phone && canManage && (
                      <div className="member-profile__detail">
                        <i className="fa-solid fa-phone" />
                        <a href={`tel:${profile.phone}`}>{profile.phone}</a>
                      </div>
                    )}
                  </div>
                )}

                {/* Contact actions — bellen alleen voor beheerders */}
                {profile.phone && canManage && (
                  <div className="member-profile__actions">
                    <a href={`tel:${profile.phone}`} className="btn-secondary member-profile__action-btn">
                      <i className="fa-solid fa-phone" /> Bellen
                    </a>
                  </div>
                )}

                {/* Intake answers — privé, alleen voor beheerders */}
                {canManage && intakeData && intakeQuestions.length > 0 && (
                  <div className="member-profile__intake">
                    <h4>Intake antwoorden</h4>
                    {intakeQuestions.map(q => {
                      const answer = intakeData.answers?.[q.id]
                      if (!answer) return null
                      return (
                        <div key={q.id} className="member-profile__intake-answer">
                          <span className="member-profile__intake-label">{q.question_text}</span>
                          <span className="member-profile__intake-value">{answer}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Approve/reject banner for guests */}
                {canApprove && (
                  <div className="member-profile__approve-banner">
                    <p>Dit lid wacht op goedkeuring</p>
                    <div className="member-profile__approve-actions">
                      <button className="btn-secondary" onClick={onReject}>
                        <i className="fa-solid fa-xmark" /> Afwijzen
                      </button>
                      <button className="btn-primary" onClick={handleApprove}>
                        <i className="fa-solid fa-check" /> Goedkeuren
                      </button>
                    </div>
                  </div>
                )}

                {/* Admin actions */}
                {canManage && role !== 'guest' && (
                  <div className="member-profile__admin">
                    <div className="member-profile__admin-row">
                      <span className="member-profile__admin-label">Rol</span>
                      <button ref={roleBtnRef} className="member-profile__role-btn" onClick={() => setShowRoleMenu(!showRoleMenu)}>
                        {roleLabel} <i className="fa-solid fa-chevron-down" />
                      </button>
                      {showRoleMenu && createPortal(
                        <div ref={roleMenuRef} className="member-profile__role-menu member-profile__role-menu--portal" style={(() => {
                          const r = roleBtnRef.current?.getBoundingClientRect()
                          return r ? { top: r.bottom + 4, left: r.left } : {}
                        })()}>
                          {ROLES.filter(r => r !== 'guest' && r !== role && (r !== 'admin' || canAssignAdminRole)).map(r => (
                            <button key={r} onClick={() => handleRoleChange(r)}>
                              <span className="member-profile__role-dot" style={{ background: ROLE_COLORS[r] }} />
                              {ROLE_LABELS[r]}
                            </button>
                          ))}
                        </div>,
                        document.body
                      )}
                    </div>

                    <div className="member-profile__admin-row">
                      <span className="member-profile__admin-label">Status</span>
                      <select
                        className="member-profile__funnel-select"
                        value={membership.funnel_stage || 'nieuw'}
                        onChange={e => onFunnelChange?.(membership.id, e.target.value)}
                      >
                        {FUNNEL_STAGES.map(s => (
                          <option key={s} value={s}>{FUNNEL_LABELS[s]}</option>
                        ))}
                      </select>
                    </div>

                    {canRemove && (
                      <button className="btn-ghost member-profile__remove-btn" onClick={() => setConfirmRemove(true)}>
                        <i className="fa-solid fa-user-minus" /> Lid verwijderen
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <MemberDossier profileId={profileId} projectId={project?.id} />
            )}
          </div>
        ) : (
          <p style={{ padding: '32px', textAlign: 'center' }}>Profiel niet gevonden</p>
        )}
      </div>

      {confirmRemove && (
        <ConfirmModal
          message={`Weet je zeker dat je ${profile?.full_name || 'dit lid'} wilt verwijderen uit het project?`}
          confirmLabel="Verwijderen"
          danger
          onConfirm={handleRemove}
          onCancel={() => setConfirmRemove(false)}
        />
      )}

    </div>
  )
}

function MemberDossier({ profileId, projectId }) {
  const { user } = useAuth()
  const [files, setFiles] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [noteType, setNoteType] = useState('note')
  const [savingNote, setSavingNote] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!profileId || !projectId) return
    fetchDossier()
  }, [profileId, projectId])

  async function fetchDossier() {
    setLoading(true)
    const [filesRes, notesRes] = await Promise.all([
      supabase
        .from('member_files')
        .select('*')
        .eq('profile_id', profileId)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
      supabase
        .from('member_notes')
        .select('*, author:profiles!author_id(full_name)')
        .eq('profile_id', profileId)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
    ])
    setFiles(filesRes.data || [])
    setNotes(notesRes.data || [])
    setLoading(false)
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      // Owner-scoped path: last folder segment (member profile id) = file owner,
      // so the member can read their own document via the storage RLS policy.
      const { path } = await uploadFile(file, 'member-files', `${projectId}/${profileId}`)
      const { error } = await supabase.from('member_files').insert({
        profile_id: profileId,
        project_id: projectId,
        title: file.name,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: user.id,
        is_visible_to_member: true,
      })
      if (error) throw error
      await fetchDossier()
    } catch (err) {
      console.error('Upload failed:', err)
      alert('Upload mislukt: ' + (err.message || err))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDownload(filePath) {
    const { data, error } = await supabase.storage
      .from('member-files')
      .createSignedUrl(filePath, 120)
    if (error) { console.error(error); return }
    window.open(data.signedUrl, '_blank')
  }

  async function handleToggleVisibility(fileId, currentVisibility) {
    await supabase.from('member_files').update({ is_visible_to_member: !currentVisibility }).eq('id', fileId)
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, is_visible_to_member: !currentVisibility } : f))
  }

  async function handleDeleteFile(fileId) {
    await supabase.from('member_files').delete().eq('id', fileId)
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  async function handleAddNote(e) {
    e.preventDefault()
    if (!newNote.trim()) return
    setSavingNote(true)
    try {
      const { error } = await supabase.from('member_notes').insert({
        profile_id: profileId,
        project_id: projectId,
        author_id: user.id,
        type: noteType,
        body: newNote.trim(),
      })
      if (error) throw error
      setNewNote('')
      await fetchDossier()
    } catch (err) {
      console.error('Note save failed:', err)
    } finally {
      setSavingNote(false)
    }
  }

  const NOTE_TYPES = [
    { value: 'note', label: 'Notitie', icon: 'fa-solid fa-note-sticky' },
    { value: 'call', label: 'Telefoongesprek', icon: 'fa-solid fa-phone' },
    { value: 'email_sent', label: 'E-mail verstuurd', icon: 'fa-solid fa-envelope' },
    { value: 'meeting', label: 'Afspraak', icon: 'fa-solid fa-handshake' },
  ]

  const NOTE_ICONS = {
    note: 'fa-solid fa-note-sticky',
    call: 'fa-solid fa-phone',
    email_sent: 'fa-solid fa-envelope',
    email_received: 'fa-solid fa-envelope-open',
    meeting: 'fa-solid fa-handshake',
    status_change: 'fa-solid fa-arrow-right',
    system: 'fa-solid fa-gear',
  }

  if (loading) return <div className="loading-inline" style={{ padding: '24px 0' }}><p>Dossier laden...</p></div>

  return (
    <div className="member-dossier">
      {/* AVG verwijderingsverzoeken van deze member — hoogste prio, dus bovenaan. */}
      <DossierRemovalRequests profileId={profileId} onFileRemoved={fetchDossier} />

      {/* Document requests section */}
      <DossierRequests profileId={profileId} projectId={projectId} />

      {/* Files section */}
      <div className="member-dossier__section">
        <div className="member-dossier__section-header">
          <h4><i className="fa-solid fa-file" /> Documenten</h4>
          <button className="btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <i className={`fa-solid ${uploading ? 'fa-spinner fa-spin' : 'fa-upload'}`} />
            {uploading ? 'Uploaden...' : 'Upload'}
          </button>
          <input ref={fileInputRef} type="file" onChange={handleFileUpload} style={{ display: 'none' }} />
        </div>

        {files.length === 0 ? (
          <p className="member-dossier__empty">Nog geen documenten in dit dossier.</p>
        ) : (
          <div className="member-dossier__files">
            {files.map(f => (
              <div key={f.id} className="member-dossier__file">
                <div className="member-dossier__file-icon" style={{ color: fileIconColor(f.file_type) }}>
                  <i className={fileIcon(f.file_type)} />
                </div>
                <div className="member-dossier__file-info">
                  <span className="member-dossier__file-name">{f.title || f.file_name}</span>
                  <span className="member-dossier__file-meta">
                    {formatFileSize(f.file_size)} · {new Date(f.created_at).toLocaleDateString('nl-NL')}
                    {f.is_visible_to_member && <span className="member-dossier__visible-badge"> · Zichtbaar voor lid</span>}
                  </span>
                </div>
                <div className="member-dossier__file-actions">
                  <button
                    className="btn-icon-sm"
                    onClick={() => handleToggleVisibility(f.id, f.is_visible_to_member)}
                    title={f.is_visible_to_member ? 'Verberg voor lid' : 'Toon aan lid'}
                  >
                    <i className={`fa-solid ${f.is_visible_to_member ? 'fa-eye' : 'fa-eye-slash'}`} />
                  </button>
                  <button className="btn-icon-sm" onClick={() => handleDownload(f.file_path)} title="Downloaden">
                    <i className="fa-solid fa-download" />
                  </button>
                  <button className="btn-icon-sm" onClick={() => handleDeleteFile(f.id)} title="Verwijderen">
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes timeline */}
      <div className="member-dossier__section">
        <h4><i className="fa-solid fa-clock-rotate-left" /> Tijdlijn</h4>

        <form onSubmit={handleAddNote} className="member-dossier__note-form">
          <div className="member-dossier__note-type-row">
            {NOTE_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                className={`member-dossier__note-type ${noteType === t.value ? 'member-dossier__note-type--active' : ''}`}
                onClick={() => setNoteType(t.value)}
                title={t.label}
              >
                <i className={t.icon} />
              </button>
            ))}
          </div>
          <textarea
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            placeholder="Schrijf een notitie..."
            rows={2}
          />
          <button type="submit" className="btn-primary btn-sm" disabled={savingNote || !newNote.trim()}>
            {savingNote ? 'Opslaan...' : 'Opslaan'}
          </button>
        </form>

        {notes.length === 0 ? (
          <p className="member-dossier__empty">Nog geen notities.</p>
        ) : (
          <div className="member-dossier__timeline">
            {notes.map(n => (
              <div key={n.id} className="member-dossier__note">
                <div className="member-dossier__note-dot">
                  <i className={NOTE_ICONS[n.type] || 'fa-solid fa-circle'} />
                </div>
                <div className="member-dossier__note-content">
                  <div className="member-dossier__note-header">
                    <span className="member-dossier__note-author">{n.author?.full_name || 'Systeem'}</span>
                    <span className="member-dossier__note-date">
                      {new Date(n.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {n.subject && <span className="member-dossier__note-subject">{n.subject}</span>}
                  <p className="member-dossier__note-body">{n.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const REQUEST_STATUS_CONFIG = {
  pending: { label: 'Wacht op lid', color: 'var(--accent-orange, #F5A623)', bg: 'rgba(245, 166, 35, 0.12)' },
  submitted: { label: 'Ingediend', color: 'var(--accent-blue, #4A90D9)', bg: 'rgba(var(--accent-blue-rgb), 0.12)' },
  approved: { label: 'Goedgekeurd', color: 'var(--accent-green, #3BD269)', bg: 'rgba(59, 210, 105, 0.12)' },
  rejected: { label: 'Afgekeurd', color: 'var(--accent-red, #E53E3E)', bg: 'rgba(229, 62, 62, 0.12)' },
}

const REQUEST_TYPE_OPTIONS = [
  { value: 'upload_request', label: 'Upload gevraagd' },
  { value: 'sign_request', label: 'Ter ondertekening' },
  { value: 'review_document', label: 'Ter inzage' },
]

const CATEGORY_OPTIONS = [
  { value: 'identiteit', label: 'Identiteitsbewijs' },
  { value: 'financieel', label: 'Financieel' },
  { value: 'contract', label: 'Contract' },
  { value: 'formulier', label: 'Formulier' },
  { value: 'correspondentie', label: 'Correspondentie' },
  { value: 'overig', label: 'Overig' },
]

function DossierRequests({ profileId, projectId }) {
  const { requests, loading, createRequest, reviewRequest, deleteRequest } = useAdminDocumentRequests(profileId)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'upload_request', category: 'overig', title: '', description: '', deadline: '' })
  const [saving, setSaving] = useState(false)
  const [reviewingId, setReviewingId] = useState(null)
  const [reviewNote, setReviewNote] = useState('')

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await createRequest({
        type: form.type,
        category: form.category,
        title: form.title.trim(),
        description: form.description.trim() || null,
        deadline: form.deadline || null,
      })
      setForm({ type: 'upload_request', category: 'overig', title: '', description: '', deadline: '' })
      setShowForm(false)
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleReview(requestId, approved) {
    try {
      await reviewRequest(requestId, approved, reviewNote.trim() || null)
      setReviewingId(null)
      setReviewNote('')
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleDownloadResponse(filePath) {
    const { data, error } = await supabase.storage.from('member-files').createSignedUrl(filePath, 60)
    if (error) { console.error(error); return }
    window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="member-dossier__section">
      <div className="member-dossier__section-header">
        <h4><i className="fa-solid fa-file-circle-question" /> Documentverzoeken</h4>
        <button className="btn-secondary btn-sm" onClick={() => setShowForm(s => !s)}>
          <i className={`fa-solid ${showForm ? 'fa-times' : 'fa-plus'}`} />
          {showForm ? 'Annuleer' : 'Nieuw verzoek'}
        </button>
      </div>

      {showForm && (
        <form className="doc-request-form" onSubmit={handleCreate}>
          <div className="doc-request-form__row">
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {REQUEST_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <input
            type="text"
            placeholder="Titel, bijv. 'Upload identiteitsbewijs'"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
          />
          <textarea
            placeholder="Toelichting (optioneel)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2}
          />
          <div className="doc-request-form__row">
            <input
              type="date"
              value={form.deadline}
              onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              placeholder="Deadline (optioneel)"
            />
            <button type="submit" className="btn-primary btn-sm" disabled={saving || !form.title.trim()}>
              {saving ? 'Aanmaken...' : 'Verzoek aanmaken'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="member-dossier__empty">Laden...</p>
      ) : requests.length === 0 ? (
        <p className="member-dossier__empty">Geen documentverzoeken.</p>
      ) : (
        <div>
          {requests.map(req => {
            const sc = REQUEST_STATUS_CONFIG[req.status]
            const isReviewing = reviewingId === req.id
            return (
              <div key={req.id} className="admin-request-row">
                <div className="admin-request-row__info">
                  <div className="admin-request-row__title">{req.title}</div>
                  <div className="admin-request-row__meta">
                    <span>{CATEGORY_OPTIONS.find(c => c.value === req.category)?.label || req.category}</span>
                    <span>{new Date(req.created_at).toLocaleDateString('nl-NL')}</span>
                    {req.deadline && (
                      <span style={{ color: new Date(req.deadline) < new Date() && req.status === 'pending' ? 'var(--accent-red)' : undefined }}>
                        Deadline: {new Date(req.deadline).toLocaleDateString('nl-NL')}
                      </span>
                    )}
                  </div>
                  {req.review_note && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Notitie: {req.review_note}
                    </div>
                  )}

                  {/* Review controls for submitted requests */}
                  {req.status === 'submitted' && (
                    <div style={{ marginTop: 8 }}>
                      {req.response_file && (
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => handleDownloadResponse(req.response_file.file_path)}
                          style={{ marginRight: 8 }}
                        >
                          <i className="fa-solid fa-download" /> {req.response_file.file_name}
                        </button>
                      )}
                      {isReviewing ? (
                        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                          <input
                            type="text"
                            placeholder="Notitie (optioneel)"
                            value={reviewNote}
                            onChange={e => setReviewNote(e.target.value)}
                            style={{ flex: 1, fontSize: 13 }}
                          />
                          <button className="btn-primary btn-sm" onClick={() => handleReview(req.id, true)}>
                            <i className="fa-solid fa-check" /> Goedkeuren
                          </button>
                          <button className="btn-secondary btn-sm" onClick={() => handleReview(req.id, false)} style={{ color: 'var(--accent-red)' }}>
                            <i className="fa-solid fa-times" /> Afkeuren
                          </button>
                          <button className="btn-icon-sm" onClick={() => { setReviewingId(null); setReviewNote('') }}>
                            <i className="fa-solid fa-times" />
                          </button>
                        </div>
                      ) : (
                        <button className="btn-primary btn-sm" onClick={() => setReviewingId(req.id)} style={{ marginTop: 4 }}>
                          <i className="fa-solid fa-magnifying-glass" /> Beoordelen
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <span className="admin-request-row__status" style={{ background: sc.bg, color: sc.color }}>
                  {sc.label}
                </span>

                <div className="admin-request-row__actions">
                  <button className="btn-icon-sm" onClick={() => deleteRequest(req.id)} title="Verwijderen" style={{ color: 'var(--accent-red)' }}>
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Sectie in het admin-dossier: pending AVG-verwijderingsverzoeken van deze
// member. Approve = file wordt echt weg (storage + DB); reject vereist een
// notitie zodat de member weet waarom (audit trail bewaard).
function DossierRemovalRequests({ profileId, onFileRemoved }) {
  const { requests, approve, reject } = useFileRemovalRequests({ scope: 'project' })
  const [rejectTarget, setRejectTarget] = useState(null) // request row
  const [rejectNote, setRejectNote] = useState('')
  const [busy, setBusy] = useState(null) // request.id

  const pending = requests.filter(r => r.requested_by === profileId && r.status === 'pending')
  if (pending.length === 0) return null

  async function handleApprove(req) {
    setBusy(req.id)
    try {
      await approve(req, null)
      onFileRemoved?.()
    } catch (err) {
      alert('Goedkeuren mislukt: ' + (err.message || err))
    } finally {
      setBusy(null)
    }
  }

  async function handleReject() {
    if (!rejectTarget || !rejectNote.trim()) return
    setBusy(rejectTarget.id)
    try {
      await reject(rejectTarget, rejectNote)
      setRejectTarget(null)
      setRejectNote('')
    } catch (err) {
      alert('Afwijzen mislukt: ' + (err.message || err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="member-dossier__section">
      <div className="member-dossier__section-header">
        <h4><i className="fa-solid fa-trash-can" style={{ color: 'var(--accent-orange)' }} /> Verwijderingsverzoeken ({pending.length})</h4>
      </div>
      <div className="member-dossier__removal-list">
        {pending.map(req => (
          <div key={req.id} className="member-dossier__removal-row">
            <div className="member-dossier__removal-info">
              <div className="member-dossier__removal-file">
                <i className="fa-solid fa-file" />
                <span>{req.member_file?.title || req.member_file?.file_name || 'Bestand niet meer beschikbaar'}</span>
              </div>
              {req.reason && (
                <div className="member-dossier__removal-reason">
                  <strong>Reden:</strong> {req.reason}
                </div>
              )}
              <div className="member-dossier__removal-meta">
                Aangevraagd door {req.requester?.full_name || 'onbekend'} · {new Date(req.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <div className="member-dossier__removal-actions">
              <button
                type="button"
                className="btn-sm btn-sm--danger"
                onClick={() => handleApprove(req)}
                disabled={busy === req.id || !req.member_file_id}
                title={!req.member_file_id ? 'Bestand is al verwijderd' : 'Goedkeuren en bestand verwijderen'}
              >
                <i className={`fa-solid ${busy === req.id ? 'fa-spinner fa-spin' : 'fa-check'}`} />
                Goedkeuren
              </button>
              <button
                type="button"
                className="btn-sm"
                onClick={() => setRejectTarget(req)}
                disabled={busy === req.id}
              >
                <i className="fa-solid fa-xmark" /> Afwijzen
              </button>
            </div>
          </div>
        ))}
      </div>

      {rejectTarget && (
        <div className="modal-overlay" onClick={() => setRejectTarget(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2>Verzoek afwijzen</h2>
              <button className="modal-close" onClick={() => setRejectTarget(null)} aria-label="Sluiten">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>
                Leg uit waarom je dit verwijderingsverzoek afwijst. De member ziet deze uitleg.
              </p>
              <div className="form-group">
                <label htmlFor="reject-note">Toelichting <span style={{ color: 'var(--accent-red)' }}>*</span></label>
                <textarea
                  id="reject-note"
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                  autoFocus
                  placeholder="Bijv. 'Dit document is nodig voor onze administratie en mag conform de bewaartermijn niet worden verwijderd.'"
                />
              </div>
              <div className="modal-actions" style={{ justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={() => setRejectTarget(null)}>Annuleren</button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleReject}
                  disabled={!rejectNote.trim() || busy === rejectTarget.id}
                >
                  Verzoek afwijzen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
