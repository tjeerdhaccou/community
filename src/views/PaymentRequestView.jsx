import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ============================================================================
// PaymentRequestView — /verzoeken/:id
// ============================================================================
// Ontvangt óf een ingelogde user (RLS pakt via recipient_profile_id) óf een
// niet-ingelogde bezoeker met magic-link token (?t=…). We resolven dat via
// RPC get_payment_request_by_token voor de anon flow, of via directe select
// voor de authenticated flow. Template halen we altijd via RPC (agreement
// templates zijn RLS-open voor leden — voor niet-leden lezen we ook via het
// token-pad).
//
// Flow:
//   1. Fetch payment_request (+ project + template) → toon overeenkomst
//   2. Als status='sent' → markeer 'viewed' via RPC mark_payment_request_viewed
//   3. Checkbox akkoord → RPC agree_payment_request
//   4. Op klik "Betalen via iDEAL" → invoke edge fn initiate-payment →
//      redirect naar checkout URL
//   5. Bij ?paid=1 → toon success state + refresh status
// ============================================================================

const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

function formatEuro(cents) {
  return (cents / 100).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })
}

function formatDateNL() {
  return new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function renderPlaceholders(tpl, vars) {
  if (!tpl) return ''
  return tpl.replace(PLACEHOLDER_REGEX, (_, key) => vars[key] ?? `{{${key}}}`)
}

export default function PaymentRequestView() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('t') || ''
  const isPaidReturn = searchParams.get('paid') === '1'

  const { user, loading: authLoading } = useAuth()

  const [request, setRequest] = useState(null)
  const [template, setTemplate] = useState(null)
  const [project, setProject] = useState(null)
  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (authLoading) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        let req = null
        // 1. Probeer token-based lookup (werkt ook zonder login)
        if (token) {
          const { data, error: tokenErr } = await supabase.rpc('get_payment_request_by_token', { p_token: token })
          if (!tokenErr && data && data.length > 0) {
            req = data[0]
          }
        }
        // 2. Fallback: direct lookup via RLS (alleen als ingelogd)
        if (!req && user) {
          const { data } = await supabase
            .from('payment_requests')
            .select('id, project_id, recipient_name, recipient_email, title, description, amount_cents, currency, reference, status, agreement_template_id, agreed_at, paid_at, expires_at')
            .eq('id', id)
            .maybeSingle()
          req = data
        }

        if (!req) {
          setError('Verzoek niet gevonden of link ongeldig.')
          setLoading(false)
          return
        }

        // Fetch template (kan RLS-blokkeren voor niet-leden — dus alleen als recipient/ingelogd, of pak via RPC later).
        let tpl = null
        if (req.agreement_template_id) {
          const { data: tData } = await supabase
            .from('agreement_templates')
            .select('id, title, content_markdown, version')
            .eq('id', req.agreement_template_id)
            .maybeSingle()
          tpl = tData
        }

        // Fetch project + org for naam-render
        const { data: proj } = await supabase
          .from('projects')
          .select('id, name, slug, logo_url, brand_primary_color, brand_accent_color, organization:organizations(id, name, slug, logo_url)')
          .eq('id', req.project_id)
          .maybeSingle()

        if (cancelled) return
        setRequest(req)
        setTemplate(tpl)
        setProject(proj)
        setOrg(proj?.organization ?? null)

        // Markeer als viewed (fire-and-forget)
        if (req.status === 'sent') {
          supabase.rpc('mark_payment_request_viewed', { p_request_id: req.id, p_token: token || null })
        }

        // Als terugkomst na paid: refresh status (webhook kan al gepushed hebben)
        if (isPaidReturn) {
          setTimeout(async () => {
            const { data: refreshed } = await supabase.rpc('get_payment_request_by_token', { p_token: token })
            if (!cancelled && refreshed?.[0]) setRequest(refreshed[0])
          }, 1500)
        }
      } catch (e) {
        console.error('[PaymentRequestView] load failed', e)
        setError('Kon verzoek niet laden.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id, token, user, authLoading, isPaidReturn])

  const renderedContract = useMemo(() => {
    if (!template || !request) return ''
    const vars = {
      naam:        request.recipient_name || '',
      email:       request.recipient_email || '',
      bedrag:      formatEuro(request.amount_cents).replace('€', '').trim(),
      referentie:  request.reference || '',
      datum:       formatDateNL(),
      project:     project?.name || '',
      organisatie: org?.name || '',
    }
    return renderPlaceholders(template.content_markdown, vars)
  }, [template, request, project, org])

  async function handlePay() {
    if (!agreed) return
    setSubmitting(true)
    setError(null)
    try {
      // 1. Markeer akkoord in DB
      const { error: agreeErr } = await supabase.rpc('agree_payment_request', {
        p_request_id: request.id,
        p_token: token || null,
        p_ip: null, // IP wordt niet client-side vastgelegd; webhook logt Mollie payment id
        p_user_agent: (typeof navigator !== 'undefined' ? navigator.userAgent : null),
      })
      if (agreeErr) throw agreeErr

      // 2. Vraag Mollie checkout URL via edge fn
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess?.session?.access_token
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY

      const res = await fetch(`${supabaseUrl}/functions/v1/initiate-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        body: JSON.stringify({
          payment_request_id: request.id,
          access_token: token || undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok || !body.checkout_url) {
        console.error('[PaymentRequestView] initiate failed', res.status, body)
        setError('Betaling starten mislukt. Probeer het opnieuw of neem contact op.')
        setSubmitting(false)
        return
      }

      // 3. Redirect naar Mollie
      window.location.href = body.checkout_url
    } catch (e) {
      console.error('[PaymentRequestView] pay flow failed', e)
      setError('Er ging iets mis bij het starten van de betaling.')
      setSubmitting(false)
    }
  }

  if (authLoading || loading) {
    return <div className="pr-page pr-page--loading"><p>Laden…</p></div>
  }

  if (error && !request) {
    return (
      <div className="pr-page">
        <div className="pr-card pr-card--error">
          <i className="fa-solid fa-circle-exclamation" />
          <h1>Verzoek niet beschikbaar</h1>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!request) return null

  const isPaid    = request.status === 'paid'
  const isExpired = request.status === 'expired' || (request.expires_at && new Date(request.expires_at) < new Date() && !isPaid)
  const isAgreed  = ['agreed', 'paid'].includes(request.status)

  return (
    <div className="pr-page">
      <div className="pr-header">
        {org?.logo_url ? (
          <img src={org.logo_url} alt={org.name || ''} className="pr-header__logo" />
        ) : null}
        <div>
          <div className="pr-header__org">{org?.name || ''}</div>
          <div className="pr-header__project">{project?.name || ''}</div>
        </div>
      </div>

      <div className="pr-card">
        <h1 className="pr-title">{request.title}</h1>
        {request.description && <p className="pr-description">{request.description}</p>}

        <div className="pr-amount">
          <div className="pr-amount__label">Te betalen</div>
          <div className="pr-amount__value">{formatEuro(request.amount_cents)}</div>
          {request.reference && (
            <div className="pr-amount__ref">Referentie: <code>{request.reference}</code></div>
          )}
        </div>

        {isPaid ? (
          <div className="pr-state pr-state--success">
            <i className="fa-solid fa-circle-check" />
            <div>
              <strong>Betaling ontvangen</strong>
              <p>Bedankt. Je krijgt binnenkort een bevestigingsmail met de definitieve overeenkomst.</p>
            </div>
          </div>
        ) : isExpired ? (
          <div className="pr-state pr-state--warn">
            <i className="fa-solid fa-clock" />
            <div>
              <strong>Dit verzoek is verlopen</strong>
              <p>Neem contact op met {org?.name || 'de organisatie'} voor een nieuw verzoek.</p>
            </div>
          </div>
        ) : (
          <>
            {template && (
              <div className="pr-agreement">
                <h2 className="pr-agreement__title">Overeenkomst</h2>
                <div className="pr-agreement__body">{renderedContract}</div>
              </div>
            )}

            {isAgreed && !isPaid ? (
              <div className="pr-state pr-state--info">
                <i className="fa-solid fa-hourglass-half" />
                <div>
                  <strong>Wachten op betaling</strong>
                  <p>Je hebt akkoord gegeven. Rond de betaling af om het verzoek te voltooien.</p>
                </div>
              </div>
            ) : (
              <label className="pr-consent">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span>
                  Ik heb de overeenkomst gelezen en ga akkoord met de bovenstaande voorwaarden en betaling van{' '}
                  <strong>{formatEuro(request.amount_cents)}</strong>.
                </span>
              </label>
            )}

            {error && <div className="pr-error">{error}</div>}

            <button
              type="button"
              className="pr-pay-btn"
              onClick={handlePay}
              disabled={!agreed || submitting || isAgreed}
            >
              {submitting ? 'Doorverwijzen…' : isAgreed ? 'Wachten op betaling…' : 'Akkoord en betalen via iDEAL'}
            </button>
          </>
        )}

        <p className="pr-footer">
          Betaling wordt verwerkt door Mollie. buuur zit nooit in de geldstroom — het bedrag gaat rechtstreeks naar {org?.name || 'de organisatie'}.
        </p>
      </div>
    </div>
  )
}
