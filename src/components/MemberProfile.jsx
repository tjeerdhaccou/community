import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProject } from '../contexts/ProjectContext'
import { ROLES, ROLE_LABELS, ROLE_COLORS, PROFESSIONAL_LABELS, PROFESSIONAL_COLORS } from '../lib/constants'
import ConfirmModal from './ConfirmModal'

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000

export default function MemberProfile({ profileId, membership, onClose, canManage, canRemove, canApprove, onRoleChange, onRemove, onApprove, onReject, isMe }) {
  const [profile, setProfile] = useState(null)
  const [postCount, setPostCount] = useState(0)
  const [intakeData, setIntakeData] = useState(null)
  const [intakeQuestions, setIntakeQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const roleBtnRef = useRef(null)
  const roleMenuRef = useRef(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [expandedPhoto, setExpandedPhoto] = useState(null) // index of expanded photo
  const navigate = useNavigate()
  const { project } = useProject()

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
  const age = profile?.birth_year ? new Date().getFullYear() - profile.birth_year : null

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
                    <span>{profile.household}</span>
                  </div>
                )}
              </div>
            )}

            {/* Contact details */}
            {(profile.company || profile.website || profile.phone) && (
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
                {profile.phone && (
                  <div className="member-profile__detail">
                    <i className="fa-solid fa-phone" />
                    <a href={`tel:${profile.phone}`}>{profile.phone}</a>
                  </div>
                )}
              </div>
            )}

            {/* Contact actions */}
            {profile.phone && (
              <div className="member-profile__actions">
                <a href={`tel:${profile.phone}`} className="btn-secondary member-profile__action-btn">
                  <i className="fa-solid fa-phone" /> Bellen
                </a>
              </div>
            )}

            {/* Intake answers for guests */}
            {intakeData && intakeQuestions.length > 0 && (
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
                      {ROLES.filter(r => r !== 'guest' && r !== role).map(r => (
                        <button key={r} onClick={() => handleRoleChange(r)}>
                          <span className="member-profile__role-dot" style={{ background: ROLE_COLORS[r] }} />
                          {ROLE_LABELS[r]}
                        </button>
                      ))}
                    </div>,
                    document.body
                  )}
                </div>

                {canRemove && (
                  <button className="btn-ghost member-profile__remove-btn" onClick={() => setConfirmRemove(true)}>
                    <i className="fa-solid fa-user-minus" /> Lid verwijderen
                  </button>
                )}
              </div>
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
