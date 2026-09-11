import { supabase } from './supabase'
import { logger } from './logger'

/**
 * Web Push (PWA). Publieke VAPID-sleutel is publiek per definitie; de private
 * sleutel staat als Supabase-secret bij de edge function `chat-push`.
 */
export const VAPID_PUBLIC_KEY = 'BONCLEyAO6fweES4cfyu8u3_Jz4UuNQXpV6S6AZVfgRDXi2rSDEE1fMBwjrrKEqLX5XQCFe9FI1WJnKikyaDpX8'

export function pushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

/** Draait de app als geïnstalleerde PWA (beginscherm)? Op iOS is dat vereist voor push. */
export function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

/** iOS ondersteunt push alleen vanaf 16.4 én alleen als PWA op het beginscherm. */
export function pushBlockedOnIOS() {
  return isIOS() && !isStandalone()
}

export function permissionState() {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch (err) {
    logger.error('push: service worker registreren mislukt', err)
    return null
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

/** Bestaand abonnement van deze browser, of null. */
export async function currentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration('/')
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

/**
 * Vraag toestemming, maak een abonnement en sla het op voor deze gebruiker.
 * Gooit een Error met een Nederlandse melding als het niet kan.
 */
export async function enablePush(userId) {
  if (!pushSupported()) throw new Error('Deze browser ondersteunt geen meldingen.')
  if (pushBlockedOnIOS()) throw new Error('Zet buuur eerst op je beginscherm (Delen → Zet op beginscherm), daarna kun je meldingen aanzetten.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Meldingen zijn geweigerd. Je kunt dit aanpassen in je browserinstellingen.')

  const reg = (await navigator.serviceWorker.getRegistration('/')) || (await registerServiceWorker())
  if (!reg) throw new Error('Meldingen konden niet worden ingesteld.')
  await navigator.serviceWorker.ready

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }
  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({
    profile_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent.slice(0, 200),
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })
  if (error) {
    logger.error('push: abonnement opslaan mislukt', error)
    throw new Error('Meldingen konden niet worden opgeslagen.')
  }
  return sub
}

/** Zet push uit voor deze browser (abonnement weg, ook server-side). */
export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  try { await sub.unsubscribe() } catch { /* toch doorgaan */ }
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

/**
 * Bij het laden: als er een abonnement is, `last_seen_at` bijwerken zodat we
 * weten dat het nog leeft (opruimen gebeurt op 404/410 bij het versturen).
 */
export async function touchSubscription(userId) {
  try {
    const sub = await currentSubscription()
    if (!sub || !userId) return
    await supabase.from('push_subscriptions')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('endpoint', sub.endpoint).eq('profile_id', userId)
  } catch { /* stil */ }
}

/** Appicoon-badge (Android/desktop PWA) met het aantal ongelezen berichten. */
export function setAppBadge(count) {
  try {
    if (!('setAppBadge' in navigator)) return
    if (count > 0) navigator.setAppBadge(count)
    else navigator.clearAppBadge?.()
  } catch { /* stil */ }
}
