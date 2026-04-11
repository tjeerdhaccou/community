import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function OrgOnboarding() {
  const { user, reload } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState('type') // type | details | creating
  const [orgType, setOrgType] = useState(null) // 'professional' | 'group'
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [projectName, setProjectName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

  async function handleCreate() {
    if (!name.trim() || !slug.trim()) return
    setCreating(true)
    setError(null)

    try {
      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')

      // 1. Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: name.trim(),
          slug: cleanSlug,
          created_by: user.id,
        })
        .select()
        .single()
      if (orgError) throw orgError

      // 2. Add user as org admin
      const { error: memberError } = await supabase
        .from('org_members')
        .insert({ organization_id: org.id, profile_id: user.id, role: 'admin' })
      if (memberError) throw memberError

      // 3. For standalone groups: also create first project
      if (orgType === 'group' && projectName.trim()) {
        const projectSlug = projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const { data: project, error: projError } = await supabase
          .from('projects')
          .insert({
            organization_id: org.id,
            name: projectName.trim(),
            slug: projectSlug,
          })
          .select()
          .single()
        if (projError) throw projError

        // Add user as project admin
        await supabase.from('memberships').insert({
          profile_id: user.id,
          project_id: project.id,
          role: 'admin',
        })

        // Setup subdomain (non-blocking)
        supabase.functions.invoke('setup-project-domain', {
          body: { slug: projectSlug, project_id: project.id },
        }).catch(() => {})
      }

      // Setup org subdomain (non-blocking)
      supabase.functions.invoke('setup-project-domain', {
        body: { slug: cleanSlug, project_id: org.id },
      }).catch(() => {})

      // Refresh auth context to pick up new memberships
      await reload()

      // Redirect
      if (orgType === 'group') {
        navigate('/', { replace: true })
      } else {
        navigate(`/org/${cleanSlug}`, { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Er ging iets mis')
      setCreating(false)
    }
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <div className="onboarding-card__header">
          <h1>Welkom bij BUUUR</h1>
          <p>Stel je organisatie in om te beginnen</p>
        </div>

        {step === 'type' && (
          <div className="onboarding-card__content">
            <p className="onboarding-card__question">Hoe ga je het platform gebruiken?</p>
            <div className="onboarding-types">
              <button
                className={`onboarding-type ${orgType === 'professional' ? 'onboarding-type--active' : ''}`}
                onClick={() => setOrgType('professional')}
              >
                <div className="onboarding-type__icon" style={{ background: 'rgba(74,144,217,0.14)', color: '#3A7BC8' }}>
                  <i className="fa-solid fa-briefcase" />
                </div>
                <strong>Ik begeleid meerdere groepen</strong>
                <p>Als procesbegeleider, ontwikkelaar of adviseur beheer je meerdere woonprojecten</p>
              </button>
              <button
                className={`onboarding-type ${orgType === 'group' ? 'onboarding-type--active' : ''}`}
                onClick={() => setOrgType('group')}
              >
                <div className="onboarding-type__icon" style={{ background: 'rgba(59,210,105,0.14)', color: '#27A854' }}>
                  <i className="fa-solid fa-house-chimney-user" />
                </div>
                <strong>Ik heb een woongroep</strong>
                <p>Je hebt één woonproject en wilt een eigen community platform</p>
              </button>
            </div>
            <button
              className="btn-primary onboarding-card__next"
              disabled={!orgType}
              onClick={() => setStep('details')}
            >
              Verder <i className="fa-solid fa-arrow-right" />
            </button>
          </div>
        )}

        {step === 'details' && (
          <div className="onboarding-card__content">
            <button className="onboarding-card__back" onClick={() => setStep('type')}>
              <i className="fa-solid fa-arrow-left" /> Terug
            </button>

            <div className="form-group">
              <label>{orgType === 'group' ? 'Naam van je woongroep' : 'Naam van je organisatie'}</label>
              <input
                type="text"
                value={name}
                onChange={e => {
                  setName(e.target.value)
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
                  if (orgType === 'group') setProjectName(e.target.value)
                }}
                placeholder={orgType === 'group' ? 'bijv. Vlinderhaven' : 'bijv. CommonCity'}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Webadres</label>
              <div className="onboarding-slug-row">
                <input
                  type="text"
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                />
                <span className="onboarding-slug-suffix">.buuur.nl</span>
              </div>
            </div>

            {orgType === 'group' && (
              <div className="form-group">
                <label>Projectnaam</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="Naam van je eerste project"
                />
                <span className="form-hint">Je kunt dit later wijzigen</span>
              </div>
            )}

            {error && <p style={{ color: 'var(--accent-red)', fontSize: 13 }}>{error}</p>}

            <button
              className="btn-primary onboarding-card__next"
              disabled={creating || !name.trim() || !slug.trim() || (orgType === 'group' && !projectName.trim())}
              onClick={handleCreate}
            >
              {creating ? (
                <><i className="fa-solid fa-spinner fa-spin" /> Aanmaken...</>
              ) : (
                <>{orgType === 'group' ? 'Community starten' : 'Organisatie aanmaken'} <i className="fa-solid fa-arrow-right" /></>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
