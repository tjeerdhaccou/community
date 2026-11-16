/**
 * Production-safe logger.
 * In development: logs everything to console.
 * In production: captures errors for monitoring, suppresses verbose output.
 *
 * To enable Sentry:
 *   1. npm install @sentry/react
 *   2. Set VITE_SENTRY_DSN in .env
 *   3. The logger auto-detects and sends errors
 *
 * Usage: import { logger } from '../lib/logger'
 *        logger.error('Upload failed', err)
 */

const isDev = import.meta.env.DEV
const sentryDsn = import.meta.env.VITE_SENTRY_DSN

// Lazy-load Sentry only when DSN is configured
let Sentry = null
if (sentryDsn && !isDev) {
  import('@sentry/react').then(mod => {
    Sentry = mod
    Sentry.init({
      dsn: sentryDsn,
      environment: isDev ? 'development' : 'production',
      tracesSampleRate: 0.1,
      // Don't send PII
      beforeSend(event) {
        if (event.user) delete event.user.email
        return event
      },
    })
  }).catch(() => { /* Sentry not installed, that's fine */ })
}

function sanitizeError(err) {
  if (!err) return 'Unknown error'
  if (typeof err === 'string') return err
  return err.message || err.code || 'Onbekende fout'
}

export const logger = {
  error(context, err) {
    if (isDev) {
      console.error(`[${context}]`, err)
    }
    if (Sentry) {
      Sentry.withScope(scope => {
        scope.setTag('context', context)
        scope.setExtra('sanitized', sanitizeError(err))
        Sentry.captureException(err instanceof Error ? err : new Error(sanitizeError(err)))
      })
    }
  },

  warn(context, msg) {
    if (isDev) console.warn(`[${context}]`, msg)
    if (Sentry) Sentry.addBreadcrumb({ category: context, message: String(msg), level: 'warning' })
  },

  info(context, msg) {
    if (isDev) console.log(`[${context}]`, msg)
  },
}

/** User-friendly error message from a Supabase/generic error */
export function friendlyError(err) {
  if (!err) return 'Er ging iets mis'
  if (typeof err === 'string') return err

  const msg = err.message || ''

  // Common Supabase errors → Dutch user-friendly messages
  if (msg.includes('duplicate key')) return 'Dit item bestaat al'
  if (msg.includes('violates foreign key')) return 'Gerelateerd item niet gevonden'
  if (msg.includes('permission denied') || msg.includes('row-level security')) return 'Je hebt geen toegang tot deze actie'
  if (msg.includes('JWT expired')) return 'Je sessie is verlopen. Log opnieuw in.'
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return 'Geen internetverbinding'
  if (msg.includes('buuur light')) return msg // Ledengrens: melding uit de database (migratie 125)
  if (msg.includes('te groot')) return msg // Already friendly (file size)
  if (msg.includes('niet toegestaan')) return msg // Already friendly (file type)

  return 'Er ging iets mis. Probeer het opnieuw.'
}
