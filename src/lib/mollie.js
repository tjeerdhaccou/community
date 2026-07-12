// Mollie Connect (Payments for SaaS) helpers.
//
// - MOLLIE_CLIENT_ID + MOLLIE_REDIRECT_URI komen uit .env (public — geen secret).
// - Scopes zijn de standaard set voor een SaaS die namens orgs payments doet.

const CLIENT_ID     = import.meta.env.VITE_MOLLIE_CLIENT_ID || ''
const REDIRECT_URI  = import.meta.env.VITE_MOLLIE_REDIRECT_URI || ''

const SCOPES = [
  'organizations.read',
  'onboarding.read',
  'profiles.read',
  'profiles.write',
  'payments.read',
  'payments.write',
  'refunds.read',
  'refunds.write',
]

export function isMollieConfigured() {
  return Boolean(CLIENT_ID && REDIRECT_URI)
}

export function buildMollieAuthorizeUrl(state) {
  const url = new URL('https://my.mollie.com/oauth2/authorize')
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('state', state)
  url.searchParams.set('scope', SCOPES.join(' '))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('approval_prompt', 'auto')
  url.searchParams.set('redirect_uri', REDIRECT_URI)
  return url.toString()
}
