// Cloudflare Turnstile voor de inlog- en aanmeldverzoeken naar Supabase Auth.
//
// Staat pas aan als VITE_TURNSTILE_SITE_KEY is gezet; zonder sleutel geeft
// getCaptchaToken() niets terug en verandert er niets. Volgorde van aanzetten:
//   1. Turnstile-widget aanmaken bij Cloudflare (domeinen: buuur.nl + admin);
//   2. site key als VITE_TURNSTILE_SITE_KEY in Vercel, opnieuw deployen;
//   3. pas dan in Supabase (Authentication > Attack Protection) de captcha
//      aanzetten met de secret key. Supabase weigert daarna elk inlogverzoek
//      zonder token, dus ook buuur-admin moet de sleutel hebben.
//
// De widget is onzichtbaar tenzij Cloudflare een controle wil tonen
// (appearance 'interaction-only'); dan verschijnt hij onderin beeld.

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const TIMEOUT_MS = 60_000

let scriptPromise = null

function loadScript() {
  if (window.turnstile) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const el = document.createElement('script')
      el.src = SCRIPT_SRC
      el.async = true
      el.onload = () => resolve()
      el.onerror = () => { scriptPromise = null; reject(new Error('Captcha kon niet worden geladen')) }
      document.head.appendChild(el)
    })
  }
  return scriptPromise
}

export const captchaEnabled = !!SITE_KEY

/** Eén vers token per aanroep (tokens zijn eenmalig). Undefined als captcha uit staat. */
export async function getCaptchaToken() {
  if (!SITE_KEY) return undefined
  await loadScript()

  return new Promise((resolve, reject) => {
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:10000'
    document.body.appendChild(host)

    let widgetId = null
    let timer = null
    const finish = (fn, value) => {
      clearTimeout(timer)
      try { if (widgetId !== null) window.turnstile.remove(widgetId) } catch { /* al weg */ }
      host.remove()
      fn(value)
    }
    const fail = () => finish(reject, new Error('De controle is niet gelukt. Probeer het opnieuw.'))

    timer = setTimeout(fail, TIMEOUT_MS)
    widgetId = window.turnstile.render(host, {
      sitekey: SITE_KEY,
      appearance: 'interaction-only',
      callback: token => finish(resolve, token),
      'error-callback': fail,
      'timeout-callback': fail,
    })
  })
}
