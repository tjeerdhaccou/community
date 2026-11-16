import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import { LIGHT_PLAN } from '../lib/constants'

/**
 * Ledenstand van een buuur light-groep, voor moderators en beheerders.
 * Light is gratis tot LIGHT_PLAN.freeMembers leden; daarna is een abonnement
 * nodig. De database bewaakt de grens (migratie 125) en levert de stand via
 * get_project_member_quota: NULL als er geen grens geldt, dan toont dit niets.
 *
 * `memberCount` is alleen een signaal om opnieuw op te halen als de ledenlijst
 * verandert; de telling zelf komt uit de database.
 */
export default function LightQuotaBanner({ projectId, memberCount, canRequest }) {
  const [quota, setQuota] = useState(null)
  const [interval, setInterval] = useState('month')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!projectId) return
    const { data, error: rpcError } = await supabase.rpc('get_project_member_quota', { p_project_id: projectId })
    if (rpcError) { logger.error('get_project_member_quota', rpcError); return }
    setQuota(data)
  }, [projectId])

  useEffect(() => { load() }, [load, memberCount])

  if (!quota) return null

  const { limit, used, requested_at: requestedAt } = quota
  const full = used >= limit
  const near = !full && used >= limit - 2
  const price = `€ ${LIGHT_PLAN.monthly} per maand of € ${LIGHT_PLAN.yearly} per jaar (incl. btw)`

  async function handleRequest() {
    setBusy(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('request_light_upgrade', {
      p_project_id: projectId,
      p_interval: interval,
    })
    setBusy(false)
    if (rpcError) {
      logger.error('request_light_upgrade', rpcError)
      setError('Aanvragen is niet gelukt. Probeer het opnieuw.')
      return
    }
    setQuota(q => ({ ...q, requested_at: data.requested_at }))
  }

  return (
    <div className={`light-quota ${full ? 'light-quota--full' : ''}`} role={full ? 'alert' : undefined}>
      <div className="light-quota__head">
        <i className={`fa-solid ${full ? 'fa-circle-exclamation' : 'fa-seedling'}`} aria-hidden="true" />
        <strong>{used} van {limit} gratis leden</strong>
        <div className="light-quota__bar" aria-hidden="true">
          <span style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
        </div>
      </div>

      {full ? (
        <p>
          Je groep zit vol. Nieuwe aanmeldingen blijven als geïnteresseerde wachten tot er plek is.
          Met een abonnement groeit je groep verder: {price}.
        </p>
      ) : near ? (
        <p>Bijna vol. buuur light is gratis tot {limit} leden; daarna kost het {price}.</p>
      ) : (
        <p>buuur light is gratis tot {limit} leden. Daarna kost het {price}.</p>
      )}

      {requestedAt ? (
        <p className="light-quota__done">
          <i className="fa-solid fa-check" aria-hidden="true" /> Abonnement aangevraagd op{' '}
          {new Date(requestedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}.
          We nemen contact met je op en zetten je groep open.
        </p>
      ) : (full || near) && canRequest ? (
        <div className="light-quota__actions">
          <label>
            <input type="radio" name="light-interval" checked={interval === 'month'} onChange={() => setInterval('month')} />
            € {LIGHT_PLAN.monthly} per maand
          </label>
          <label>
            <input type="radio" name="light-interval" checked={interval === 'year'} onChange={() => setInterval('year')} />
            € {LIGHT_PLAN.yearly} per jaar
          </label>
          <button type="button" className="btn-primary" onClick={handleRequest} disabled={busy}>
            {busy ? 'Aanvragen…' : 'Abonnement aanvragen'}
          </button>
        </div>
      ) : (full || near) ? (
        <p className="light-quota__done">Een beheerder van de groep kan het abonnement aanvragen.</p>
      ) : null}

      {error && <p className="light-quota__error" role="alert">{error}</p>}
    </div>
  )
}
