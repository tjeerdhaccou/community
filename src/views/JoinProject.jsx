import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { uploadImage } from '../lib/storage'
import { getIntakeUrl, getPublicSiteUrl } from '../lib/subdomain'

export default function JoinProject() {
  const { user, profile, reload } = useAuth()
  const { project } = useProject()
  const navigate = useNavigate()
  const [hasIntake, setHasIntake] = useState(false)
  const [admins, setAdmins] = useState([])

  useEffect(() => {
    if (!project) return
    // Check if intake is enabled
    supabase.from('projects').select('intake_active').eq('id', project.id).single()
      .then(({ data }) => setHasIntake(data?.intake_active ?? false))
    // Load project admins for contact info
    supabase.from('memberships').select('profile:profiles(full_name, email, avatar_url)')
      .eq('project_id', project.id).eq('role', 'admin')
      .then(({ data }) => setAdmins((data || []).map(m => m.profile).filter(Boolean)))
  }, [project?.id])
  const [step, setStep] = useState('welcome') // welcome | profile | done
  const [joining, setJoining] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [consent, setConsent] = useState(false)

  // Profile fields
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [bio, setBio] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [household, setHousehold] = useState('')
  const [housingDream, setHousingDream] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null)
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || null)
  const [uploading, setUploading] = useState(false)
  const avatarRef = useRef(null)

  async function handleJoin() {
    setJoining(true)
    setError(null)
    try {
      const { error: joinError } = await supabase.from('memberships').insert({
        profile_id: user.id,
        project_id: project.id,
        role: 'guest',
      })

      if (joinError) {
        if (joinError.code === '23505') {
          await reload()
          navigate(0)
          return
        }
        throw joinError
      }

      setStep('profile')
    } catch (err) {
      console.error('Join error:', err)
      setError('Er ging iets mis. Probeer het opnieuw.')
      setJoining(false)
    }
  }

  async function handleAvatarSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      const url = await uploadImage(file)
      setAvatarUrl(url)
    } catch (err) {
      console.error('Avatar upload failed:', err)
      setAvatarPreview(profile?.avatar_url || null)
    } finally {
      setUploading(false)
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const updates = {
        full_name: fullName.trim() || profile?.full_name || null,
        avatar_url: avatarUrl,
        bio: bio.trim() || null,
        birth_year: birthYear ? parseInt(birthYear, 10) : null,
        household: household.trim() || null,
        housing_dream: housingDream.trim() || null,
      }

      const { error: saveError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

      if (saveError) throw saveError
      await reload()
      navigate(0) // Reload to enter project with new membership + profile
    } catch (err) {
      console.error('Profile save error:', err)
      setError('Profiel opslaan mislukt. Probeer het opnieuw.')
      setSaving(false)
    }
  }

  if (!project) {
    return (
      <div className="join-page">
        <div className="join-card">
          <div className="join-card__content">
            <div className="join-card__icon join-card__icon--error">
              <i className="fa-solid fa-circle-exclamation" />
            </div>
            <h2>Project niet gevonden</h2>
            <p className="join-card__tagline">Dit project bestaat niet of is niet toegankelijk.</p>
            <button className="btn-secondary" onClick={() => navigate('/')}>Terug naar home</button>
          </div>
        </div>
      </div>
    )
  }

  const initials = (fullName || profile?.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)

  const hasPublicSite = !!project?.slug
  const publicSiteUrl = getPublicSiteUrl(project)
  const intakeUrl = getIntakeUrl(project)

  // Step 1: Lobby — show available routes
  if (step === 'welcome') {
    return (
      <div className="join-page">
        <div className="join-card">
          {project.cover_image_url ? (
            <div className="join-card__cover">
              <img src={project.cover_image_url} alt={project.name + ' cover'} />
            </div>
          ) : (
            <div className="join-card__header" />
          )}
          <div className="join-card__content">
            {project.logo_url ? (
              <img src={project.logo_url} alt={project.name + ' logo'} className="join-card__logo" />
            ) : (
              <div className="join-card__logo join-card__logo--placeholder">
                {(project.name || 'P')[0]}
              </div>
            )}
            <h1 className="join-card__title">{project.name}</h1>
            {project.tagline && <p className="join-card__tagline">{project.tagline}</p>}

            <div className="join-card__user">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="join-card__user-avatar" />
              ) : (
                <div className="join-card__user-avatar join-card__user-avatar--placeholder">
                  {initials}
                </div>
              )}
              <span>Ingelogd als <strong>{profile?.full_name || 'Gebruiker'}</strong></span>
            </div>

            <div className="join-card__routes">
              {hasIntake && (
                <a href={intakeUrl} className="join-card__route">
                  <div className="join-card__route-icon" style={{ background: 'rgba(59,210,105,0.14)', color: '#27A854' }}>
                    <i className="fa-solid fa-clipboard-list" />
                  </div>
                  <div>
                    <strong>Aanmelden</strong>
                    <p>Vul het aanmeldformulier in om lid te worden</p>
                  </div>
                  <i className="fa-solid fa-arrow-right" />
                </a>
              )}

              {hasPublicSite && (
                <a href={publicSiteUrl} className="join-card__route">
                  <div className="join-card__route-icon" style={{ background: 'rgba(74,144,217,0.14)', color: '#3A7BC8' }}>
                    <i className="fa-solid fa-globe" />
                  </div>
                  <div>
                    <strong>Bekijk project</strong>
                    <p>Lees meer over {project.name}</p>
                  </div>
                  <i className="fa-solid fa-arrow-right" />
                </a>
              )}

              {!hasIntake && (
                <button className="join-card__route" onClick={handleJoin} disabled={joining}>
                  <div className="join-card__route-icon" style={{ background: 'rgba(240,144,32,0.14)', color: '#C47718' }}>
                    <i className="fa-solid fa-user-plus" />
                  </div>
                  <div>
                    <strong>{joining ? 'Aanmelden...' : 'Lid worden'}</strong>
                    <p>Vraag lidmaatschap aan voor deze community</p>
                  </div>
                  <i className="fa-solid fa-arrow-right" />
                </button>
              )}
            </div>

            {admins.length > 0 && (
              <div className="join-card__contact">
                <p className="join-card__contact-label">Vragen? Neem contact op:</p>
                {admins.map((admin, i) => (
                  <div key={i} className="join-card__admin">
                    {admin.avatar_url ? (
                      <img src={admin.avatar_url} alt={admin.full_name} className="join-card__admin-avatar" />
                    ) : (
                      <div className="join-card__admin-avatar join-card__admin-avatar--placeholder">
                        {(admin.full_name || '?')[0]}
                      </div>
                    )}
                    <div>
                      <strong>{admin.full_name}</strong>
                      {admin.email && <a href={`mailto:${admin.email}`}>{admin.email}</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="join-card__error">{error}</p>}
          </div>
        </div>
      </div>
    )
  }

  // Step 2: Profile builder
  return (
    <div className="join-page">
      <div className="join-card join-card--wide">
        <div className="join-card__content">
          <div className="join-card__step-badge">Welkom bij {project.name}!</div>
          <h1 className="join-card__title">Vertel iets over jezelf</h1>
          <p className="join-card__tagline">Zo leren andere leden je alvast een beetje kennen.</p>

          <form onSubmit={handleSaveProfile} className="join-profile-form">
            {/* Avatar */}
            <div className="join-profile__avatar-row">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="join-profile__avatar" />
              ) : (
                <div className="join-profile__avatar join-profile__avatar--placeholder">{initials}</div>
              )}
              <div>
                <button type="button" className="btn-secondary btn-sm" onClick={() => avatarRef.current?.click()} disabled={uploading}>
                  {uploading ? 'Uploaden...' : 'Profielfoto kiezen'}
                </button>
              </div>
              <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarSelect} style={{ display: 'none' }} />
            </div>

            {/* Name */}
            <div className="form-group">
              <label htmlFor="join-name">Naam</label>
              <input id="join-name" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Je volledige naam" />
            </div>

            {/* Bio */}
            <div className="form-group">
              <label htmlFor="join-bio">Over mij</label>
              <textarea id="join-bio" value={bio} onChange={e => setBio(e.target.value)} placeholder="Vertel kort iets over jezelf..." rows={2} />
            </div>

            {/* Personal */}
            <div className="form-row">
              <div className="form-group form-group--half">
                <label htmlFor="join-year">Geboortejaar</label>
                <input id="join-year" type="number" value={birthYear} onChange={e => setBirthYear(e.target.value)} placeholder="bijv. 1985" min="1920" max={new Date().getFullYear()} />
              </div>
              <div className="form-group form-group--half">
                <label htmlFor="join-household">Gezinssamenstelling</label>
                <input id="join-household" type="text" value={household} onChange={e => setHousehold(e.target.value)} placeholder="bijv. Stel met 2 kinderen" />
              </div>
            </div>

            {/* Housing dream */}
            <div className="form-group">
              <label htmlFor="join-dream">Woondroom</label>
              <textarea id="join-dream" value={housingDream} onChange={e => setHousingDream(e.target.value)} placeholder="Beschrijf je ideale woonsituatie..." rows={3} />
            </div>

            {/* Consent */}
            <label className="join-profile__consent">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
              <span>Ik ga akkoord dat mijn profielgegevens zichtbaar zijn voor andere leden van deze community.</span>
            </label>

            <button type="submit" className="btn-primary join-card__btn" disabled={saving || uploading || !consent}>
              {saving ? 'Opslaan...' : 'Opslaan en verder'}
            </button>

            {error && <p className="join-card__error">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  )
}
