import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { uploadImage } from '../lib/storage'
import { getProjectSlugFromSubdomain } from '../lib/subdomain'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import { buildMollieAuthorizeUrl, isMollieConfigured } from '../lib/mollie'
import ImageCropper from '../components/ImageCropper'
import ProfileEditModal from '../components/ProfileEditModal'
import ConfirmModal from '../components/ConfirmModal'

const MAIN_DOMAIN = import.meta.env.VITE_MAIN_DOMAIN || 'buuur.nl'

export default function OrgSettings({ orgId: orgIdProp }) {
  const params = useParams()
  const orgSlug = params.orgSlug
  const orgId = orgIdProp
  const navigate = useNavigate()
  const { user, profile, isPlatformAdmin, reload: reloadAuth } = useAuth()
  const toast = useToast()
  const [editingProfile, setEditingProfile] = useState(false)
  const [adminToRemove, setAdminToRemove] = useState(null)
  const [paymentAccount, setPaymentAccount] = useState(null)
  const [connectingMollie, setConnectingMollie] = useState(false)
  const [disconnectingMollie, setDisconnectingMollie] = useState(false)
  const [confirmDisconnectMollie, setConfirmDisconnectMollie] = useState(false)
  const backPath = getProjectSlugFromSubdomain() ? '/admin' : `/org/${orgSlug || orgId}`
  const [org, setOrg] = useState(null)
  const [name, setName] = useState('')
  const [inviteIntro, setInviteIntro] = useState('')
  const [defaultTheme, setDefaultTheme] = useState('warm')
  const [logoUrl, setLogoUrl] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [admins, setAdmins] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState(null)
  const [inviteSuccess, setInviteSuccess] = useState(null)
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
      const invitesRes = await supabase.from('org_admin_invites')
        .select('id, email, status, created_at')
        .eq('organization_id', resolvedId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (orgRes.data) {
        setOrg(orgRes.data)
        setName(orgRes.data.name)
        setLogoUrl(orgRes.data.logo_url)
        setLogoPreview(orgRes.data.logo_url)
        setInviteIntro(orgRes.data.invite_intro_text || '')
        setDefaultTheme(orgRes.data.default_theme || 'warm')
      }
      setAdmins(adminsRes.data || [])
      setPendingInvites(invitesRes.data || [])

      const { data: pa } = await supabase
        .from('org_payment_accounts')
        .select('id, provider, status, mollie_organization_id, mollie_profile_id, connected_at, last_error')
        .eq('organization_id', resolvedId)
        .maybeSingle()
      setPaymentAccount(pa || null)
    }
    load()
  }, [orgId, orgSlug])

  // OAuth-redirect afhandelen: toon toast + verwijder query params uit URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mollie    = params.get('mollie')
    const mollieErr = params.get('mollie_error')
    if (!mollie && !mollieErr) return

    if (mollie === 'connected')  toast.success('Mollie succesvol gekoppeld.')
    else if (mollieErr)          toast.error(`Koppelen mislukt (${mollieErr}).`)

    params.delete('mollie')
    params.delete('mollie_error')
    const q = params.toString()
    window.history.replaceState({}, '', window.location.pathname + (q ? `?${q}` : ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [cropSrc, setCropSrc] = useState(null)

  function handleLogoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
    e.target.value = ''
  }

  async function handleLogoCropComplete(blob) {
    const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' })
    setCropSrc(null)
    setLogoPreview(URL.createObjectURL(blob))
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
    const resolvedOrgId = org?.id || orgId
    if (!resolvedOrgId) return
    setInviting(true)
    setInviteError(null)
    setInviteSuccess(null)

    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .ilike('email', email)
        .maybeSingle()

      if (existingProfile) {
        if (admins.find(a => a.profile_id === existingProfile.id)) {
          setInviteError('Deze gebruiker is al beheerder.')
          setInviting(false)
          return
        }

        const { data, error } = await supabase
          .from('org_members')
          .insert({ organization_id: resolvedOrgId, profile_id: existingProfile.id, role: 'admin' })
          .select('*, profile:profiles(id, full_name, avatar_url)')
          .single()

        if (error) throw error

        setAdmins(prev => [...prev, data])
        setInviteEmail('')
        setInviteSuccess(`${existingProfile.full_name || email} is toegevoegd als beheerder.`)
        return
      }

      if (pendingInvites.find(i => i.email.toLowerCase() === email)) {
        setInviteError('Er staat al een uitnodiging open voor dit e-mailadres.')
        setInviting(false)
        return
      }

      const { data: invite, error: inviteErr } = await supabase
        .from('org_admin_invites')
        .insert({ organization_id: resolvedOrgId, email, invited_by: user?.id })
        .select('id, email, status, created_at')
        .single()

      if (inviteErr) throw inviteErr

      const orgUrl = org?.slug ? `https://${org.slug}.${MAIN_DOMAIN}` : `https://${MAIN_DOMAIN}`
      const { error: mailErr } = await supabase.functions.invoke('send-member-email', {
        body: {
          type: 'org_admin_invite',
          memberEmail: email,
          orgName: org?.name || name,
          orgUrl,
          inviterName: profile?.full_name || null,
        },
      })

      if (mailErr) {
        await supabase.from('org_admin_invites').delete().eq('id', invite.id)
        throw mailErr
      }

      setPendingInvites(prev => [invite, ...prev])
      setInviteEmail('')
      setInviteSuccess(`Uitnodiging verstuurd naar ${email}.`)
    } catch (err) {
      console.error('Error inviting admin:', err)
      setInviteError('Er ging iets mis bij het versturen van de uitnodiging.')
    } finally {
      setInviting(false)
    }
  }

  async function handleRevokeInvite(inviteId) {
    const { error } = await supabase
      .from('org_admin_invites')
      .update({ status: 'revoked' })
      .eq('id', inviteId)
    if (error) {
      console.error('Error revoking invite:', error)
      return
    }
    setPendingInvites(prev => prev.filter(i => i.id !== inviteId))
  }

  async function handleRemoveAdmin(adminRow) {
    const { error } = await supabase
      .from('org_members')
      .delete()
      .eq('id', adminRow.id)
    if (error) {
      console.error('Error removing admin:', error)
      alert('Verwijderen mislukt.')
      return
    }
    setAdmins(prev => prev.filter(a => a.id !== adminRow.id))
    setAdminToRemove(null)
  }

  async function handleConnectMollie() {
    const resolvedOrgId = org?.id || orgId
    if (!resolvedOrgId) return
    if (!isMollieConfigured()) {
      toast.error('Mollie is nog niet geconfigureerd voor deze omgeving.')
      return
    }
    setConnectingMollie(true)
    try {
      const { data: state, error } = await supabase.rpc('create_mollie_oauth_state', {
        p_org_id: resolvedOrgId,
        p_redirect_to: window.location.origin + window.location.pathname,
      })
      if (error || !state) throw error || new Error('geen state')
      window.location.href = buildMollieAuthorizeUrl(state)
    } catch (err) {
      console.error('Mollie connect failed:', err)
      toast.error('Koppelen mislukt.')
      setConnectingMollie(false)
    }
  }

  async function handleDisconnectMollie() {
    const resolvedOrgId = org?.id || orgId
    if (!resolvedOrgId) return
    setDisconnectingMollie(true)
    try {
      const { error } = await supabase.rpc('disconnect_mollie_account', { p_org_id: resolvedOrgId })
      if (error) throw error
      setPaymentAccount(pa => pa ? { ...pa, status: 'disconnected', mollie_organization_id: null, mollie_profile_id: null, connected_at: null } : null)
      toast.success('Mollie ontkoppeld.')
    } catch (err) {
      console.error('Mollie disconnect failed:', err)
      toast.error('Ontkoppelen mislukt.')
    } finally {
      setDisconnectingMollie(false)
      setConfirmDisconnectMollie(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: name.trim(),
          logo_url: logoUrl,
          invite_intro_text: inviteIntro.trim() || null,
        })
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
            <h3 className="profile-section__title">Uitnodigingsmail</h3>
            <p className="form-hint" style={{ marginBottom: 16 }}>
              Standaardtekst voor uitnodigingsmails van alle projecten in deze organisatie.
              Projecten kunnen deze overschrijven met hun eigen tekst.
            </p>
            <div className="form-group">
              <label htmlFor="org-invite-intro">Uitnodigingstekst</label>
              <textarea
                id="org-invite-intro"
                value={inviteIntro}
                onChange={e => setInviteIntro(e.target.value)}
                rows={5}
                placeholder={'Bijvoorbeeld:\n\nWelkom bij {projectnaam}! We helpen woongroepen om samen te bouwen aan een fijne plek.'}
              />
              <p className="form-hint" style={{ marginTop: 8 }}>
                Variabelen: <code>{'{naam}'}</code> = naam van de uitgenodigde, <code>{'{projectnaam}'}</code> = naam van het project.
                Lege regel tussen alinea&apos;s.
              </p>
            </div>
          </div>

          <div className="profile-section">
            <h3 className="profile-section__title">Beheerders</h3>
            <div className="org-admin-list">
              {admins.map(a => {
                const isSelf = a.profile_id === user?.id
                const canRemove = !isSelf && isPlatformAdmin
                return (
                  <div
                    key={a.id}
                    className={`org-admin-row${isSelf ? ' org-admin-row--clickable' : ''}`}
                    onClick={isSelf ? () => setEditingProfile(true) : undefined}
                    role={isSelf ? 'button' : undefined}
                    tabIndex={isSelf ? 0 : undefined}
                  >
                    {a.profile?.avatar_url ? (
                      <img src={a.profile.avatar_url} alt={a.profile.full_name || ''} className="org-admin-row__avatar" />
                    ) : (
                      <div className="org-admin-row__avatar org-admin-row__avatar--placeholder">
                        {(a.profile?.full_name || 'A')[0]}
                      </div>
                    )}
                    <div className="org-admin-row__info">
                      <span className="org-admin-row__name">
                        {a.profile?.full_name || 'Onbekend'}
                        {isSelf && <span className="org-admin-row__you"> (jij)</span>}
                      </span>
                      <span className="org-admin-row__role">{a.role === 'admin' ? 'Admin' : a.role}</span>
                    </div>
                    {isSelf && (
                      <i className="fa-solid fa-pen org-admin-row__edit-icon" />
                    )}
                    {canRemove && (
                      <button
                        type="button"
                        className="btn-icon org-admin-row__remove"
                        title="Beheerder verwijderen"
                        onClick={(e) => { e.stopPropagation(); setAdminToRemove(a) }}
                      >
                        <i className="fa-solid fa-xmark" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {pendingInvites.length > 0 && (
              <div className="org-pending-invites">
                <h4 className="org-pending-invites__title">Openstaande uitnodigingen</h4>
                <div className="org-admin-list">
                  {pendingInvites.map(inv => (
                    <div key={inv.id} className="org-admin-row org-admin-row--pending">
                      <div className="org-admin-row__avatar org-admin-row__avatar--placeholder">
                        <i className="fa-solid fa-envelope" />
                      </div>
                      <div className="org-admin-row__info">
                        <span className="org-admin-row__name">{inv.email}</span>
                        <span className="org-admin-row__role">Uitgenodigd — wacht op aanmelding</span>
                      </div>
                      <button
                        type="button"
                        className="btn-icon"
                        title="Uitnodiging intrekken"
                        onClick={() => handleRevokeInvite(inv.id)}
                      >
                        <i className="fa-solid fa-xmark" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="org-invite-admin">
              <h4 className="org-invite-admin__title">Beheerder toevoegen</h4>
              <div className="org-invite-admin__form">
                <input
                  type="email"
                  placeholder="E-mailadres..."
                  value={inviteEmail}
                  onChange={e => { setInviteEmail(e.target.value); setInviteError(null); setInviteSuccess(null) }}
                />
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={inviting || !inviteEmail.trim()}
                  onClick={handleInviteAdmin}
                >
                  {inviting ? 'Bezig...' : <><i className="fa-solid fa-paper-plane" /> Uitnodigen</>}
                </button>
              </div>
              <p className="org-invite-admin__hint">
                Heeft de persoon al een account, dan wordt hij direct toegevoegd. Zo niet, dan ontvangt hij een uitnodiging per mail.
              </p>
              {inviteError && <p className="org-invite-admin__error">{inviteError}</p>}
              {inviteSuccess && <p className="org-invite-admin__success">{inviteSuccess}</p>}
            </div>
          </div>

          <div className="profile-section">
            <h3 className="profile-section__title">Betalingen</h3>
            <p className="form-hint" style={{ marginBottom: 16 }}>
              Koppel jullie Mollie-account om betaalverzoeken te kunnen versturen aan leden.
              Betalingen komen rechtstreeks binnen op jullie eigen bankrekening — buuur zit nooit in de geldstroom.
            </p>

            {paymentAccount && paymentAccount.status === 'active' ? (
              <div className="payment-account">
                <div className="payment-account__row">
                  <i className="fa-brands fa-cc-visa payment-account__icon" aria-hidden />
                  <div className="payment-account__info">
                    <span className="payment-account__label">Mollie</span>
                    <span className="payment-account__status payment-account__status--active">
                      <i className="fa-solid fa-circle-check" /> Gekoppeld
                    </span>
                    {paymentAccount.mollie_organization_id && (
                      <span className="payment-account__meta">
                        Mollie-organisatie: <code>{paymentAccount.mollie_organization_id}</code>
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => setConfirmDisconnectMollie(true)}
                    disabled={disconnectingMollie}
                  >
                    {disconnectingMollie ? 'Ontkoppelen...' : 'Ontkoppelen'}
                  </button>
                </div>
              </div>
            ) : paymentAccount && paymentAccount.status === 'error' ? (
              <div className="payment-account payment-account--error">
                <div className="payment-account__row">
                  <i className="fa-solid fa-triangle-exclamation payment-account__icon" aria-hidden />
                  <div className="payment-account__info">
                    <span className="payment-account__label">Mollie</span>
                    <span className="payment-account__status payment-account__status--error">Koppeling gaf een fout</span>
                    {paymentAccount.last_error && (
                      <span className="payment-account__meta">{paymentAccount.last_error.slice(0, 200)}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    onClick={handleConnectMollie}
                    disabled={connectingMollie}
                  >
                    {connectingMollie ? 'Bezig...' : 'Opnieuw koppelen'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="payment-account payment-account--empty">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleConnectMollie}
                  disabled={connectingMollie}
                >
                  {connectingMollie
                    ? <>Doorverwijzen naar Mollie...</>
                    : <><i className="fa-solid fa-link" /> Koppel Mollie</>}
                </button>
                <p className="form-hint" style={{ marginTop: 12 }}>
                  Nog geen Mollie-account? Maak er eerst een aan op{' '}
                  <a href="https://www.mollie.com/signup" target="_blank" rel="noreferrer">mollie.com</a>.
                  Verificatie duurt meestal 1-2 dagen.
                </p>
              </div>
            )}
          </div>

          <div className="profile-actions">
            <button type="submit" className="btn-primary" disabled={saving || uploading}>
              {saving ? 'Opslaan...' : saved ? '✓ Opgeslagen' : 'Wijzigingen opslaan'}
            </button>
          </div>
        </form>

        {cropSrc && (
          <ImageCropper
            imageSrc={cropSrc}
            aspect={1}
            round={false}
            onComplete={handleLogoCropComplete}
            onCancel={() => setCropSrc(null)}
          />
        )}

        {editingProfile && profile && (
          <ProfileEditModal
            profile={profile}
            onSave={(updated) => {
              setEditingProfile(false)
              setAdmins(prev => prev.map(a => a.profile_id === updated.id
                ? { ...a, profile: { id: updated.id, full_name: updated.full_name, avatar_url: updated.avatar_url } }
                : a))
              if (reloadAuth) reloadAuth()
            }}
            onClose={() => setEditingProfile(false)}
          />
        )}

        {adminToRemove && (
          <ConfirmModal
            message={`Weet je zeker dat je ${adminToRemove.profile?.full_name || adminToRemove.profile?.email || 'deze beheerder'} wilt verwijderen als beheerder van ${org?.name || 'deze organisatie'}?`}
            confirmLabel="Verwijderen"
            danger
            onConfirm={() => handleRemoveAdmin(adminToRemove)}
            onCancel={() => setAdminToRemove(null)}
          />
        )}

        {confirmDisconnectMollie && (
          <ConfirmModal
            message="Weet je zeker dat je Mollie wilt ontkoppelen? Nieuwe betaalverzoeken werken daarna niet meer totdat je opnieuw koppelt."
            confirmLabel="Ontkoppelen"
            danger
            onConfirm={handleDisconnectMollie}
            onCancel={() => setConfirmDisconnectMollie(false)}
          />
        )}
      </main>
    </div>
  )
}
