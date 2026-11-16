import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { logger } from '../lib/logger'

function toSlug(value) {
  return value
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

// Zelfde regel als create_initiative_group in de database.
const SLUG_OK = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/

/**
 * Eerste scherm voor wie inlogt zonder groep: start zelf een initiatief
 * (buuur light). De database maakt in één keer de onzichtbare org, het project
 * en het beheerderschap aan. Organisaties die meerdere groepen begeleiden
 * (buuur pro) lopen via het contactformulier.
 */
export default function OrgOnboarding() {
  const { reload } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

  const slugValid = SLUG_OK.test(slug)
  const canSubmit = name.trim().length >= 2 && slugValid && !creating

  async function handleCreate(e) {
    e.preventDefault()
    if (!canSubmit) return
    setCreating(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('create_initiative_group', {
      p_group_name: name.trim(),
      p_slug: slug,
    })

    if (rpcError) {
      logger.error('create_initiative_group failed', rpcError)
      // De functie geeft zelf een Nederlandse melding (naam bezet, limiet, ...).
      setError(rpcError.code === 'P0001' || rpcError.code === '42501'
        ? rpcError.message
        : 'Het aanmaken is niet gelukt. Probeer het opnieuw.')
      setCreating(false)
      return
    }

    // Welkomstmail (hooguit één keer per groep); mag het starten niet ophouden.
    supabase.functions.invoke('light-welcome-email', { body: { project_id: data.project_id } }).catch(() => {})

    // Nieuwe membership ophalen, daarna door naar het project.
    await reload()
    navigate(`/p/${data.slug}`, { replace: true })
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <div className="onboarding-card__header">
          <h1>Start je groep</h1>
          <p>Een eigen plek om elkaar op de hoogte te houden: nieuws, prikbord, agenda en chat.</p>
        </div>

        <form className="onboarding-card__content" onSubmit={handleCreate}>
          <div className="form-group">
            <label htmlFor="onb-name">Naam van je initiatief</label>
            <input
              id="onb-name"
              type="text"
              value={name}
              maxLength={80}
              onChange={e => {
                setName(e.target.value)
                if (!slugTouched) setSlug(toSlug(e.target.value))
              }}
              placeholder="bijv. Vlinderhaven"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="onb-slug">Webadres</label>
            <div className="onboarding-slug-row">
              <input
                id="onb-slug"
                type="text"
                value={slug}
                maxLength={40}
                onChange={e => {
                  setSlugTouched(true)
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
                }}
              />
              <span className="onboarding-slug-suffix">.buuur.nl</span>
            </div>
            {slug && !slugValid && (
              <span className="form-hint">Gebruik 3 tot 40 tekens: kleine letters, cijfers en koppeltekens.</span>
            )}
          </div>

          {error && <p role="alert" style={{ color: 'var(--accent-red)', fontSize: 13 }}>{error}</p>}

          <button type="submit" className="btn-primary onboarding-card__next" disabled={!canSubmit}>
            {creating ? (
              <><i className="fa-solid fa-spinner fa-spin" /> Aanmaken...</>
            ) : (
              <>Groep starten <i className="fa-solid fa-arrow-right" /></>
            )}
          </button>

          <p className="form-hint" style={{ textAlign: 'center', marginTop: 16 }}>
            Begeleid je als organisatie meerdere groepen?{' '}
            <Link to="/start?segment=professional">Neem contact op</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
