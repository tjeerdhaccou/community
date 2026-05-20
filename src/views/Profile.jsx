import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { uploadImage } from '../lib/storage'
import { logAudit } from '../lib/audit'
import { PROFESSIONAL_LABELS, PROFESSIONAL_COLORS } from '../lib/constants'
import ImageCropper from '../components/ImageCropper'
import {
  isSupported as browserNotifSupported,
  getPermission as getBrowserNotifPermission,
  requestPermission as requestBrowserNotif,
  getUserPreference as getBrowserNotifPref,
  setUserPreference as setBrowserNotifPref,
} from '../lib/browserNotifications'

export default function Profile() {
  const { profile: authProfile, reload } = useAuth()
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [companyLogoUrl, setCompanyLogoUrl] = useState(null)
  const [companyLogoPreview, setCompanyLogoPreview] = useState(null)
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [bio, setBio] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [household, setHousehold] = useState('')
  const [housingDream, setHousingDream] = useState('')
  const [photoUrls, setPhotoUrls] = useState([])
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const avatarRef = useRef(null)
  const logoRef = useRef(null)
  const photoRef = useRef(null)

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState({
    pref_updates: 'all', pref_prikbord: 'all', pref_events: 'all', pref_documents: 'all', mute_until: null,
  })
  const [prefsLoaded, setPrefsLoaded] = useState(false)

  // Desktop notifications: gecombineerde state (user-pref AAN + browser-permission GRANTED)
  const [desktopNotif, setDesktopNotif] = useState(false)
  useEffect(() => {
    if (!browserNotifSupported()) return
    setDesktopNotif(getBrowserNotifPref() && getBrowserNotifPermission() === 'granted')
  }, [])

  async function toggleDesktopNotif(enabled) {
    if (!enabled) {
      setBrowserNotifPref(false)
      setDesktopNotif(false)
      return
    }
    const result = await requestBrowserNotif()
    if (result === 'granted') {
      setBrowserNotifPref(true)
      setDesktopNotif(true)
    } else {
      setBrowserNotifPref(false)
      setDesktopNotif(false)
    }
  }

  const isProfessional = !!authProfile?.professional_type

  // Load notification preferences
  useEffect(() => {
    if (!authProfile?.id) return
    supabase.from('notification_preferences').select('*').eq('profile_id', authProfile.id).maybeSingle()
      .then(({ data }) => {
        if (data) setNotifPrefs(data)
        setPrefsLoaded(true)
      })
  }, [authProfile?.id])

  async function saveNotifPrefs(updates) {
    const newPrefs = { ...notifPrefs, ...updates }
    setNotifPrefs(newPrefs)
    const { error } = await supabase.from('notification_preferences').upsert({
      profile_id: authProfile.id,
      pref_updates: newPrefs.pref_updates,
      pref_prikbord: newPrefs.pref_prikbord,
      pref_events: newPrefs.pref_events,
      pref_documents: newPrefs.pref_documents,
      mute_until: newPrefs.mute_until,
    }, { onConflict: 'profile_id' })
    if (error) console.error('Error saving notification preferences:', error)
  }

  useEffect(() => {
    if (authProfile) {
      setFullName(authProfile.full_name || '')
      setCompany(authProfile.company || '')
      setCompanyLogoUrl(authProfile.company_logo_url || null)
      setCompanyLogoPreview(authProfile.company_logo_url || null)
      setPhone(authProfile.phone || '')
      setWebsite(authProfile.website || '')
      setBio(authProfile.bio || '')
      setBirthYear(authProfile.birth_year || '')
      setHousehold(authProfile.household || '')
      setHousingDream(authProfile.housing_dream || '')
      setPhotoUrls(authProfile.photo_urls || [])
      setAvatarUrl(authProfile.avatar_url || null)
      setAvatarPreview(authProfile.avatar_url || null)
    }
  }, [authProfile])

  const [cropSrc, setCropSrc] = useState(null)

  function handleAvatarSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
    e.target.value = ''
  }

  async function handleAvatarCropComplete(blob) {
    const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' })
    setCropSrc(null)
    setAvatarPreview(URL.createObjectURL(blob))
    setUploading(true)
    try {
      const url = await uploadImage(file)
      setAvatarUrl(url)
    } catch (err) {
      console.error('Avatar upload failed:', err)
      setAvatarPreview(authProfile?.avatar_url || null)
    } finally {
      setUploading(false)
    }
  }

  async function handleLogoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCompanyLogoPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      const url = await uploadImage(file)
      setCompanyLogoUrl(url)
    } catch (err) {
      console.error('Logo upload failed:', err)
      setCompanyLogoPreview(authProfile?.company_logo_url || null)
    } finally {
      setUploading(false)
    }
  }

  async function handleGalleryPhoto(e) {
    const file = e.target.files?.[0]
    if (!file || photoUrls.length >= 6) return
    setUploadingPhoto(true)
    try {
      const url = await uploadImage(file)
      setPhotoUrls(prev => [...prev, url])
    } catch (err) {
      console.error('Gallery photo upload failed:', err)
    } finally {
      setUploadingPhoto(false)
      if (photoRef.current) photoRef.current.value = ''
    }
  }

  function removeGalleryPhoto(index) {
    setPhotoUrls(prev => prev.filter((_, i) => i !== index))
  }

  async function handleExportData() {
    setExporting(true)
    try {
      const userId = authProfile.id
      const [profileRes, membershipsRes, postsRes, commentsRes, updatesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, bio, company, phone, website, birth_year, household, housing_dream, created_at').eq('id', userId).single(),
        supabase.from('memberships').select('role, joined_at, projects(name)').eq('profile_id', userId),
        supabase.from('posts').select('text, tag, post_type, created_at').eq('author_id', userId).order('created_at', { ascending: false }),
        supabase.from('comments').select('text, created_at').eq('author_id', userId).order('created_at', { ascending: false }),
        supabase.from('updates').select('title, body, tag, is_public, created_at').eq('author_id', userId).order('created_at', { ascending: false }),
      ])

      const exportData = {
        exported_at: new Date().toISOString(),
        profile: profileRes.data,
        memberships: (membershipsRes.data || []).map(m => ({
          project: m.projects?.name,
          role: m.role,
          joined_at: m.joined_at,
        })),
        posts: postsRes.data || [],
        comments: commentsRes.data || [],
        updates: updatesRes.data || [],
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mijn-gegevens-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)

      logAudit('user.data_exported', 'profile', { resourceId: userId })
    } catch (err) {
      console.error('Export failed:', err)
      alert('Data exporteren mislukt. Probeer het opnieuw.')
    } finally {
      setExporting(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    try {
      const userId = authProfile.id
      logAudit('user.account_deleted', 'profile', { resourceId: userId })

      // Delete all user content
      await Promise.all([
        supabase.from('comments').delete().eq('author_id', userId),
        supabase.from('posts').delete().eq('author_id', userId),
        supabase.from('updates').delete().eq('author_id', userId),
        supabase.from('memberships').delete().eq('profile_id', userId),
      ])

      // Delete profile
      await supabase.from('profiles').delete().eq('id', userId)

      // Sign out
      await supabase.auth.signOut()
      window.location.href = '/login'
    } catch (err) {
      console.error('Account deletion failed:', err)
      alert('Account verwijderen mislukt. Neem contact op met privacy@crowdbuilding.com.')
      setDeleting(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      const updates = {
        full_name: fullName.trim() || null,
        avatar_url: avatarUrl,
        company: company.trim() || null,
        company_logo_url: companyLogoUrl,
        phone: phone.trim() || null,
        website: website.trim() || null,
        bio: bio.trim() || null,
        birth_year: birthYear ? parseInt(birthYear, 10) : null,
        household: household.trim() || null,
        housing_dream: housingDream.trim() || null,
        photo_urls: photoUrls.length > 0 ? photoUrls : null,
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', authProfile.id)

      if (error) throw error
      setSaved(true)
      reload() // Refresh auth context
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Error saving profile:', err)
      alert('Profiel opslaan mislukt.')
    } finally {
      setSaving(false)
    }
  }

  const initials = (fullName || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)
  const proColor = PROFESSIONAL_COLORS[authProfile?.professional_type] || '#9ba1b0'
  const proLabel = authProfile?.professional_label || PROFESSIONAL_LABELS[authProfile?.professional_type]

  return (
    <div className="view-profile">
      <div className="view-header">
        <h1>Mijn profiel</h1>
        <p className="view-header__subtitle">Beheer je persoonlijke gegevens</p>
      </div>

      <form onSubmit={handleSubmit} className="profile-form">
        {/* Avatar section */}
        <div className="profile-section">
          <div className="profile-avatar-row">
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="profile-avatar" />
            ) : (
              <div className="profile-avatar profile-avatar--placeholder">{initials}</div>
            )}
            <div className="profile-avatar-info">
              <h3>{fullName || 'Naam instellen'}</h3>
              {isProfessional && proLabel && (
                <span className="pro-badge" style={{ background: `${proColor}14`, color: proColor }}>{proLabel}</span>
              )}
              <button type="button" className="btn-secondary btn-sm" onClick={() => avatarRef.current?.click()}>
                <i className="fa-solid fa-camera" /> Foto wijzigen
              </button>
            </div>
            <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarSelect} style={{ display: 'none' }} />
          </div>
        </div>

        {/* Basic info */}
        <div className="profile-section">
          <h3 className="profile-section__title">Persoonlijk</h3>
          <div className="form-group">
            <label htmlFor="prof-name">Naam</label>
            <input id="prof-name" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Je volledige naam" />
          </div>
          <div className="form-group">
            <label htmlFor="prof-bio">Bio</label>
            <textarea id="prof-bio" value={bio} onChange={e => setBio(e.target.value)} placeholder="Vertel iets over jezelf..." rows={3} />
          </div>
          <div className="form-row">
            <div className="form-group form-group--half">
              <label htmlFor="prof-birth-year">Geboortejaar</label>
              <input id="prof-birth-year" type="number" value={birthYear} onChange={e => setBirthYear(e.target.value)} placeholder="bijv. 1985" min="1920" max={new Date().getFullYear()} />
            </div>
            <div className="form-group form-group--half">
              <label htmlFor="prof-household">Gezinssamenstelling</label>
              <input id="prof-household" type="text" value={household} onChange={e => setHousehold(e.target.value)} placeholder="bijv. Stel met 2 kinderen" />
            </div>
          </div>
        </div>

        {/* Woondroom */}
        <div className="profile-section">
          <h3 className="profile-section__title"><i className="fa-solid fa-house-chimney" /> Woondroom</h3>
          <div className="form-group">
            <textarea id="prof-dream" value={housingDream} onChange={e => setHousingDream(e.target.value)} placeholder="Beschrijf je ideale woonsituatie..." rows={4} />
          </div>
          <div className="form-group">
            <label>Foto's <span className="form-hint">({photoUrls.length}/6)</span></label>
            <div className="profile-edit__gallery">
              {photoUrls.map((url, i) => (
                <div key={i} className="profile-edit__gallery-item">
                  <img src={url} alt="" />
                  <button type="button" className="profile-edit__gallery-remove" onClick={() => removeGalleryPhoto(i)} aria-label="Verwijderen">
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              ))}
              {photoUrls.length < 6 && (
                <button type="button" className="profile-edit__gallery-add" onClick={() => photoRef.current?.click()}>
                  {uploadingPhoto ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-plus" />}
                </button>
              )}
            </div>
            <input ref={photoRef} type="file" accept="image/*" onChange={handleGalleryPhoto} style={{ display: 'none' }} />
          </div>
        </div>

        {/* Contact */}
        <div className="profile-section">
          <h3 className="profile-section__title">Contact</h3>
          <div className="form-row">
            <div className="form-group form-group--half">
              <label htmlFor="prof-phone">Telefoon</label>
              <input id="prof-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+31 6..." />
            </div>
            <div className="form-group form-group--half">
              <label htmlFor="prof-website">Website</label>
              <input id="prof-website" type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
            </div>
          </div>
        </div>

        {/* Professional section — only for adviseurs */}
        {isProfessional && (
          <div className="profile-section">
            <h3 className="profile-section__title">Bedrijf</h3>
            <div className="form-group">
              <label htmlFor="prof-company">Bedrijfsnaam</label>
              <input id="prof-company" type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Bedrijfsnaam" />
            </div>
            <div className="form-group">
              <label>Bedrijfslogo</label>
              <div className="profile-logo-row">
                {companyLogoPreview ? (
                  <img src={companyLogoPreview} alt="" className="profile-logo" />
                ) : (
                  <div className="profile-logo profile-logo--placeholder">
                    <i className="fa-solid fa-building" />
                  </div>
                )}
                <button type="button" className="btn-secondary btn-sm" onClick={() => logoRef.current?.click()}>
                  <i className="fa-solid fa-upload" /> Logo uploaden
                </button>
                {companyLogoUrl && (
                  <button type="button" className="btn-icon-sm" onClick={() => { setCompanyLogoUrl(null); setCompanyLogoPreview(null) }} aria-label="Verwijderen">
                    <i className="fa-solid fa-xmark" />
                  </button>
                )}
              </div>
              <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoSelect} style={{ display: 'none' }} />
            </div>
          </div>
        )}

        {/* Notification preferences */}
        <div className="profile-section" id="notif-section">
          <h3 className="profile-section__title">
            <i className="fa-solid fa-bell" /> Notificaties
          </h3>

          {[
            { key: 'pref_updates', label: 'Projectnieuws', icon: 'fa-solid fa-bullhorn', desc: 'Nieuwe aankondigingen vanuit het projectteam' },
            { key: 'pref_prikbord', label: 'Prikbord', icon: 'fa-solid fa-comments', desc: 'Reacties en likes op je berichten' },
            { key: 'pref_events', label: 'Events', icon: 'fa-solid fa-calendar-check', desc: 'Nieuwe events en herinneringen' },
            { key: 'pref_documents', label: 'Documenten', icon: 'fa-solid fa-folder-open', desc: 'Nieuwe documenten' },
          ].map(cat => (
            <div key={cat.key} className="notif-pref-row">
              <div className="notif-pref-row__info">
                <i className={cat.icon} />
                <div>
                  <span className="notif-pref-row__label">{cat.label}</span>
                  <span className="notif-pref-row__desc">{cat.desc}</span>
                </div>
              </div>
              <select
                value={notifPrefs[cat.key]}
                onChange={e => saveNotifPrefs({ [cat.key]: e.target.value })}
              >
                <option value="all">Alles</option>
                <option value="mentions">Vermeldingen</option>
                <option value="mute">Uit</option>
              </select>
            </div>
          ))}

          {browserNotifSupported() && (
            <div className="notif-pref-row">
              <div className="notif-pref-row__info">
                <i className="fa-solid fa-desktop" />
                <div>
                  <span className="notif-pref-row__label">Desktop-meldingen</span>
                  <span className="notif-pref-row__desc">
                    {getBrowserNotifPermission() === 'denied'
                      ? 'Geblokkeerd in browser — pas dit aan via je browser-instellingen'
                      : 'Pop-up in je browser bij nieuwe activiteit (tab moet open zijn)'}
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={desktopNotif}
                disabled={getBrowserNotifPermission() === 'denied'}
                onChange={e => toggleDesktopNotif(e.target.checked)}
                style={{ width: 20, height: 20, cursor: 'pointer' }}
              />
            </div>
          )}

          <div className="notif-pref-row notif-pref-row--mute">
            <div className="notif-pref-row__info">
              <i className="fa-solid fa-moon" />
              <div>
                <span className="notif-pref-row__label">Vakantie-modus</span>
                <span className="notif-pref-row__desc">Pauzeer alle notificaties tot een datum</span>
              </div>
            </div>
            <input
              type="date"
              value={notifPrefs.mute_until ? new Date(notifPrefs.mute_until).toISOString().split('T')[0] : ''}
              onChange={e => saveNotifPrefs({ mute_until: e.target.value ? new Date(e.target.value).toISOString() : null })}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {notifPrefs.mute_until && new Date(notifPrefs.mute_until) > new Date() && (
            <div className="notif-mute-active">
              <i className="fa-solid fa-moon" />
              <span>Notificaties gepauzeerd tot {new Date(notifPrefs.mute_until).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}</span>
              <button className="btn-secondary btn-sm" onClick={() => saveNotifPrefs({ mute_until: null })}>
                Hervatten
              </button>
            </div>
          )}
        </div>

        {/* Privacy & Data */}
        <div className="profile-section">
          <h3 className="profile-section__title">
            <i className="fa-solid fa-shield-halved" /> Privacy & gegevens
          </h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Op grond van de AVG heb je recht op inzage en verwijdering van je gegevens.
            Lees ons <a href="/privacy">privacybeleid</a>.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleExportData}
              disabled={exporting}
            >
              <i className="fa-solid fa-download" />
              {exporting ? 'Exporteren...' : 'Mijn gegevens downloaden'}
            </button>

            <button
              type="button"
              className="btn-secondary"
              style={{ color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
              onClick={() => setShowDeleteConfirm(true)}
            >
              <i className="fa-solid fa-trash" /> Account verwijderen
            </button>
          </div>

          {showDeleteConfirm && (
            <div className="cl-card" style={{ marginTop: 16, padding: 16, border: '1px solid var(--accent-red)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ fontWeight: 600, color: 'var(--accent-red)', marginBottom: 8 }}>
                Weet je het zeker?
              </p>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Al je berichten, reacties, updates en lidmaatschappen worden permanent verwijderd.
                Dit kan niet ongedaan worden gemaakt.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ background: 'var(--accent-red)' }}
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? 'Verwijderen...' : 'Definitief verwijderen'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Annuleren
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Save */}
        <div className="profile-actions">
          <button type="submit" className="btn-primary" disabled={saving || uploading || uploadingPhoto}>
            {saving ? 'Opslaan...' : saved ? '✓ Opgeslagen' : 'Wijzigingen opslaan'}
          </button>
        </div>
      </form>

      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          aspect={1}
          round={true}
          onComplete={handleAvatarCropComplete}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  )
}
