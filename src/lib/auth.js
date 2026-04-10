import { supabase } from './supabase'

// Cookie helpers scoped to root domain (shared across subdomains)
function setReturnCookie(url) {
  const mainDomain = import.meta.env.VITE_MAIN_DOMAIN
  const domain = mainDomain ? `.${mainDomain}` : ''
  document.cookie = `returnAfterLogin=${encodeURIComponent(url)};domain=${domain};path=/;max-age=600;SameSite=Lax;Secure`
}

export function getReturnCookie() {
  const match = document.cookie.match(/returnAfterLogin=([^;]+)/)
  if (!match) return null
  // Clear it
  const mainDomain = import.meta.env.VITE_MAIN_DOMAIN
  const domain = mainDomain ? `.${mainDomain}` : ''
  document.cookie = `returnAfterLogin=;domain=${domain};path=/;max-age=0`
  return decodeURIComponent(match[1])
}

export async function signInWithGoogle() {
  // Always redirect to main domain for OAuth callback, then bounce back to subdomain
  const mainDomain = import.meta.env.VITE_MAIN_DOMAIN
  const isSubdomain = mainDomain && window.location.hostname !== mainDomain && window.location.hostname !== `www.${mainDomain}`
  const callbackOrigin = isSubdomain ? `https://${mainDomain}` : window.location.origin

  // Save full return URL in cookie shared across subdomains
  if (isSubdomain) {
    setReturnCookie(window.location.href)
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${callbackOrigin}/auth/callback`,
    },
  })
  if (error) throw error
  return data
}

export async function checkInvitedEmail(email) {
  const { data, error } = await supabase.rpc('check_invited_email', {
    p_email: email.toLowerCase().trim(),
  })
  if (error) throw error
  return data ? { invited: true } : null
}

export async function sendOtpCode(email) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email: email.toLowerCase().trim(),
    options: {
      shouldCreateUser: true,
    },
  })
  if (error) throw error
  return data
}

export async function verifyOtpCode(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.toLowerCase().trim(),
    token,
    type: 'email',
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
}
