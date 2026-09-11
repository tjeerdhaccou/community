import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../Toast'
import { safeStorage } from '../../lib/safeStorage'
import {
  pushSupported, pushBlockedOnIOS, permissionState, currentSubscription, enablePush, touchSubscription,
} from '../../lib/push'

const DISMISS_KEY = 'buuur.push-banner.dismissed'

/**
 * Bovenin de gesprekkenlijst: nodigt uit om meldingen op de telefoon aan te
 * zetten. Verdwijnt zodra er een abonnement is, toestemming is geweigerd, of
 * de gebruiker hem wegklikt (30 dagen).
 */
export default function PushBanner() {
  const { user } = useAuth()
  const toast = useToast()
  const [state, setState] = useState('checking') // checking | hidden | offer | ios | busy

  useEffect(() => {
    let active = true
    async function check() {
      if (!user?.id || !pushSupported()) { if (active) setState('hidden'); return }
      const dismissed = Number(safeStorage.getItem(DISMISS_KEY) || 0)
      if (dismissed && Date.now() - dismissed < 30 * 86400000) { if (active) setState('hidden'); return }
      if (permissionState() === 'denied') { if (active) setState('hidden'); return }
      const sub = await currentSubscription()
      if (sub) { touchSubscription(user.id); if (active) setState('hidden'); return }
      if (active) setState(pushBlockedOnIOS() ? 'ios' : 'offer')
    }
    check()
    return () => { active = false }
  }, [user?.id])

  function dismiss() {
    safeStorage.setItem(DISMISS_KEY, String(Date.now()))
    setState('hidden')
  }

  async function enable() {
    setState('busy')
    try {
      await enablePush(user.id)
      toast.success('Meldingen staan aan. Je krijgt een melding bij nieuwe berichten.')
      setState('hidden')
    } catch (err) {
      toast.error(err.message)
      setState(pushBlockedOnIOS() ? 'ios' : 'offer')
    }
  }

  if (state === 'checking' || state === 'hidden') return null

  return (
    <div className="push-banner" role="status">
      <span className="push-banner__ic"><i className="fa-solid fa-bell" aria-hidden="true" /></span>
      <div className="push-banner__txt">
        {state === 'ios' ? (
          <>
            <b>Meldingen op je iPhone?</b>
            <span>Tik in Safari op <i className="fa-solid fa-arrow-up-from-bracket" aria-hidden="true" /> Delen en kies <em>Zet op beginscherm</em>. Open buuur daarna vanaf je beginscherm en zet meldingen aan.</span>
          </>
        ) : (
          <>
            <b>Meldingen op je telefoon</b>
            <span>Krijg een melding zodra iemand je een bericht stuurt.</span>
          </>
        )}
      </div>
      <div className="push-banner__actions">
        {state !== 'ios' && (
          <button type="button" className="push-banner__btn" onClick={enable} disabled={state === 'busy'}>
            {state === 'busy' ? 'Even…' : 'Aanzetten'}
          </button>
        )}
        <button type="button" className="push-banner__x" onClick={dismiss} aria-label="Sluiten">
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
