import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { uploadImage } from '../lib/storage'
import { isOrgDomain } from '../lib/subdomain'

export default function OrgSettings({ orgId: orgIdProp }) {
  const params = useParams()
  const orgSlug = params.orgSlug
  const orgId = orgIdProp
  const navigate = useNavigate()
  const backPath = isOrgDomain() ? '/' : `/org/${orgSlug || orgId}`
  const [org, setOrg] = useState(null)
  const [name, setName] = useState('')
  const [logoUrl, setLogoUrl] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [admins, setAdmins] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState(null)
  const logoRef = useRef(null)

  useEffect(() => {
    async function load() {
      // Resolve org by slug or id
      const orgQuery = orgSlug
        ? supabase.from('organizations').select('*').eq('slug', orgSlug).single()
        : supabase.from('organizations').select('*').eq('id', orgId).single()
      const orgRes = await orgQuery
      const resolvedId = orgRes.data?.id
      if (!resolvedId) return
      const adminsRes = await supabase.from('org_members')
        .select('*, profile:profiles(id, full_name, avatar_url)')
        .eq('organization_id', resolvedId)
      if (orgRes.data) {
        setOrg(orgRes.data)
        setName(orgRes.data.name)
        setLogoUrl(orgRes.data.logo_url)
        setLogoPreview(orgRes.data.logo_url)
      }
      setAdmins(adminsRes.data || [])
    }
    load()
  }, [orgId])

  async function handleLogoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      const url = await uploadImage(file)
      setLogoUrl(url)
    } catch (err) {
      console.error('Logo upload failed:', err)
      setLogoPreview(org?.logo_url || null)
    } finally {
      setUploading(false)
    }
  }

  async function handleInviteAdmin() {
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return
    setInviting(true)
    setInviteError(null)

    try {
      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('email', email)
        .single()

      if (profileError || !profile) {
        setInviteError('Geen gebruiker gevonden met dit e-mailadres.')
        setInviting(false)
        return
      }

      // Check if already a member
      const existing = admins.find(a => a.profile_id === profile.id)
      if (existing) {
        setInviteError('Deze gebruiker is al beheerder.')
        setInviting(false)
        return
      }

      // Add as org admin
      const { data, error } = await supabase
        .from('org_members')
        .insert({ organization_id: orgId, profile_id: profile.id, role: 'admin' })
        .select('*, profile:profiles(id, full_name, avatar_url)')
        .single()

      if (error) throw error

      setAdmins(prev => [...prev, data])
      setInviteEmail('')
    } catch (err) {
      console.error('Error adding admin:', err)
      setInviteError('Er ging iets mis bij het toevoegen.')
    } finally {
      setInviting(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ name: name.trim(), logo_url: logoUrl })
        .eq('id', org?.id || orgId)
      if (error) throw error
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Error saving org:', err)
      alert('Opslaan mislukt.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="org-dashboard">
      <header className="org-topbar">
        <div className="org-topbar__left">
          <button className="btn-icon" onClick={() => navigate(backPath)}>
            <i className="fa-solid fa-arrow-left" />
          </button>
          <h1 className="org-topbar__name">Organisatie-instellingen</h1>
        </div>
      </header>

      <main className="org-content org-content--narrow">
        <form onSubmit={handleSave} className="profile-form">
          <div className="profile-section">
            <h3 className="profile-section__title">Organisatie</h3>
            <div className="profile-logo-row">
              {logoPreview ? (
                <img src={logoPreview} alt="Organisatie logo" className="profile-logo" />
              ) : (
                <div className="profile-logo profile-logo--placeholder">
                  <i className="fa-solid fa-building" />
                </div>
              )}
              <button type="button" className="btn-secondary btn-sm" onClick={() => logoRef.current?.click()}>
                {uploading ? 'Uploaden...' : 'Logo wijzigen'}
              </button>
              <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoSelect} style={{ display: 'none' }} />
            </div>
            <div className="form-group">
              <label htmlFor="org-name">Naam</label>
              <input id="org-name" type="text" value={name} onChange={e => setName(e.target.value)} required />
            </div>
          </div>

          <div className="profile-section">
            <h3 className="profile-section__title">Beheerders</h3>
            <div className="org-admin-list">
              {admins.map(a => (
                <div key={a.id} className="org-admin-row">
                  {a.profile?.avatar_url ? (
                    <img src={a.profile.avatar_url} alt={a.profile.full_name || ''} className="org-admin-row__avatar" />
                  ) : (
                    <div className="org-admin-row__avatar org-admin-row__avatar--placeholder">
                      {(a.profile?.full_name || 'A')[0]}
                    </div>
                  )}
                  <div className="org-admin-row__info">
                    <span className="org-admin-row__name">{a.profile?.full_name || 'Onbekend'}</span>
                    <span className="org-admin-row__role">{a.role === 'admin' ? 'Admin' : a.role}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="org-invite-admin">
              <h4 className="org-invite-admin__title">Beheerder toevoegen</h4>
              <div className="org-invite-admin__form">
                <input
                  type="email"
                  placeholder="E-mailadres..."
                  value={inviteEmail}
                  onChange={e => { setInviteEmail(e.target.value); setInviteError(null) }}
                />
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={inviting || !inviteEmail.trim()}
                  onClick={handleInviteAdmin}
                >
                  {inviting ? 'Toevoegen...' : <><i className="fa-solid fa-plus" /> Toevoegen</>}
                </button>
              </div>
              {inviteError && <p className="org-invite-admin__error">{inviteError}</p>}
            </div>
          </div>

          <div className="profile-actions">
            <button type="submit" className="btn-primary" disabled={saving || uploading}>
              {saving ? 'Opslaan...' : saved ? '✓ Opgeslagen' : 'Wijzigingen opslaan'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
