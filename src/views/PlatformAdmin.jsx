import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { openSubdomainInNewTab } from '../lib/subdomain'
import { signOut } from '../lib/auth'

const STATUS_COLORS = {
  active: { bg: 'rgba(59,210,105,0.14)', color: '#27A854' },
  trial: { bg: 'rgba(244,180,0,0.14)', color: '#B8870A' },
  paused: { bg: 'rgba(231,76,60,0.14)', color: '#C0392B' },
}

const TIER_LABELS = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise' }

export default function PlatformAdmin() {
  const { isPlatformAdmin, profile } = useAuth()
  const { mode, setMode } = useTheme()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    window.location.href = '/login'
  }
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  // Create form
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  useEffect(() => { loadOrgs() }, [])

  async function loadOrgs() {
    setLoading(true)
    const { data: orgData } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false })

    // For each org, get project count and member count
    const enriched = await Promise.all((orgData || []).map(async org => {
      const [projectsRes, membersRes, orgMembersRes] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
        supabase.from('memberships').select('id', { count: 'exact', head: true })
          .in('project_id', (await supabase.from('projects').select('id').eq('organization_id', org.id)).data?.map(p => p.id) || []),
        supabase.from('org_members').select('id, role, profile:profiles(full_name, email)').eq('organization_id', org.id),
      ])
      return {
        ...org,
        project_count: projectsRes.count || 0,
        member_count: membersRes.count || 0,
        admins: (orgMembersRes.data || []).filter(m => m.role === 'admin').map(m => m.profile),
      }
    }))

    setOrgs(enriched)
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)

    try {
      const slug = newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')

      // 1. Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: newName.trim(), slug })
        .select()
        .single()
      if (orgError) throw orgError

      // 2. Find admin profile by email
      if (newAdminEmail.trim()) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', newAdminEmail.trim().toLowerCase())
          .single()

        if (profile) {
          // 3. Add as org admin
          await supabase.from('org_members').insert({
            organization_id: org.id,
            profile_id: profile.id,
            role: 'admin',
          })
        }
      }

      // 4. Setup subdomain
      supabase.functions.invoke('setup-project-domain', {
        body: { slug, project_id: org.id },
      }).catch(() => {}) // non-blocking

      // Reset form
      setNewName('')
      setNewSlug('')
      setNewAdminEmail('')
      setShowCreate(false)
      loadOrgs()
    } catch (err) {
      setCreateError(err.message)
    }
    setCreating(false)
  }

  async function toggleStatus(orgId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    await supabase.from('organizations').update({ status: newStatus }).eq('id', orgId)
    setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, status: newStatus } : o))
  }

  async function setOrgTheme(orgId, theme) {
    const value = theme || null
    await supabase.from('organizations').update({ default_theme: value }).eq('id', orgId)
    setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, default_theme: value } : o))
  }

  if (!isPlatformAdmin) {
    return (
      <div className="error-boundary">
        <div className="error-boundary__card">
          <i className="fa-solid fa-lock error-boundary__icon" style={{ color: 'var(--accent-red)' }} />
          <h2>Geen toegang</h2>
          <p>Je hebt geen platform admin rechten.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="platform-admin">
      <div className="platform-admin__header">
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>
            <i className="fa-solid fa-shield-halved" style={{ marginRight: 12, color: 'var(--accent-primary)' }} />
            BUUUR.NL Platform
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Beheer alle organisaties en projecten</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
            <i className="fa-solid fa-plus" /> Nieuwe organisatie
          </button>
          <button className="btn-secondary" onClick={handleSignOut} title={profile?.email ? `Uitloggen (${profile.email})` : 'Uitloggen'}>
            <i className="fa-solid fa-right-from-bracket" /> Uitloggen
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="platform-admin__stats">
        <div className="platform-admin__stat">
          <span className="platform-admin__stat-value">{orgs.length}</span>
          <span className="platform-admin__stat-label">Organisaties</span>
        </div>
        <div className="platform-admin__stat">
          <span className="platform-admin__stat-value">{orgs.reduce((sum, o) => sum + o.project_count, 0)}</span>
          <span className="platform-admin__stat-label">Projecten</span>
        </div>
        <div className="platform-admin__stat">
          <span className="platform-admin__stat-value">{orgs.reduce((sum, o) => sum + o.member_count, 0)}</span>
          <span className="platform-admin__stat-label">Leden totaal</span>
        </div>
        <div className="platform-admin__stat">
          <span className="platform-admin__stat-value">{orgs.filter(o => o.status === 'active').length}</span>
          <span className="platform-admin__stat-label">Actief</span>
        </div>
      </div>

      {/* Create org form */}
      {showCreate && (
        <form className="platform-admin__create" onSubmit={handleCreate}>
          <h3>Nieuwe organisatie aanmaken</h3>
          <div className="platform-admin__create-grid">
            <div className="form-group">
              <label>Naam *</label>
              <input type="text" value={newName} onChange={e => { setNewName(e.target.value); if (!newSlug) setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')) }} placeholder="CommonCity" required />
            </div>
            <div className="form-group">
              <label>Slug *</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="text" value={newSlug} onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="commoncity" required />
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>.buuur.nl</span>
              </div>
            </div>
            <div className="form-group">
              <label>Admin e-mail</label>
              <input type="email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="admin@organisatie.nl" />
              <span className="form-hint">Moet een bestaand account zijn. Laat leeg om later toe te voegen.</span>
            </div>
          </div>
          {createError && <p style={{ color: 'var(--accent-red)', fontSize: 13, marginTop: 8 }}>{createError}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Annuleren</button>
            <button type="submit" className="btn-primary" disabled={creating || !newName.trim() || !newSlug.trim()}>
              {creating ? 'Aanmaken...' : 'Organisatie aanmaken'}
            </button>
          </div>
        </form>
      )}

      {/* Org list */}
      {loading ? (
        <div className="loading-inline"><p>Laden...</p></div>
      ) : (
        <div className="platform-admin__orgs">
          {orgs.map(org => {
            const statusStyle = STATUS_COLORS[org.status] || STATUS_COLORS.active
            return (
              <div key={org.id} className="platform-admin__org-card">
                <div className="platform-admin__org-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {org.logo_url ? (
                      <img src={org.logo_url} alt={org.name} style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--accent-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>
                        {(org.name || 'O')[0]}
                      </div>
                    )}
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{org.name}</h3>
                      <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{org.slug}.buuur.nl</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 'var(--radius-xs)', background: statusStyle.bg, color: statusStyle.color }}>
                      {org.status || 'active'}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 'var(--radius-xs)', background: 'rgba(74,144,217,0.14)', color: '#3A7BC8' }}>
                      {TIER_LABELS[org.tier] || 'Free'}
                    </span>
                  </div>
                </div>

                <div className="platform-admin__org-stats">
                  <div><i className="fa-solid fa-diagram-project" style={{ color: 'var(--accent-primary)', marginRight: 6 }} /><strong>{org.project_count}</strong> projecten</div>
                  <div><i className="fa-solid fa-users" style={{ color: 'var(--accent-green)', marginRight: 6 }} /><strong>{org.member_count}</strong> leden</div>
                  {org.admins?.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <i className="fa-solid fa-user-shield" style={{ color: 'var(--accent-purple)', marginRight: 4 }} />
                      {org.admins.map((a, i) => (
                        <span key={i} style={{ fontSize: 13 }}>{a?.full_name}{i < org.admins.length - 1 ? ', ' : ''}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="platform-admin__org-actions">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <i className="fa-solid fa-palette" style={{ color: 'var(--text-tertiary)' }} />
                    <select
                      value={org.default_theme || ''}
                      onChange={e => setOrgTheme(org.id, e.target.value)}
                      style={{ fontSize: 13, padding: '4px 8px', borderRadius: 'var(--radius-sm)' }}
                    >
                      <option value="">Standaard (warm)</option>
                      <option value="warm">Warm</option>
                      <option value="dark">Donker</option>
                      <option value="crowdbuilding">CrowdBuilding</option>
                    </select>
                  </label>
                  <button className="btn-secondary btn-sm" onClick={() => openSubdomainInNewTab(`https://${org.slug}.buuur.nl/admin`)}>
                    <i className="fa-solid fa-arrow-up-right-from-square" /> Dashboard
                  </button>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => toggleStatus(org.id, org.status)}
                    style={{ color: org.status === 'active' ? 'var(--accent-red)' : 'var(--accent-green)' }}
                  >
                    <i className={`fa-solid ${org.status === 'active' ? 'fa-pause' : 'fa-play'}`} />
                    {org.status === 'active' ? 'Pauzeren' : 'Activeren'}
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
