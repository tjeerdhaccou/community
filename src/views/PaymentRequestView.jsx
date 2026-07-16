import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ============================================================================
// PaymentRequestView — /verzoeken/:id
// ============================================================================
// Voor niet-ingelogde ontvangers (magic-link met ?t=...) haalt de token-RPC
// alle context ineens op — inclusief overeenkomsttekst, project- en org-info —
// zodat RLS-blokkades voor anon-users omzeild worden.
// Voor ingelogde ontvangers vallen we terug op directe select via RLS.
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

  const [ctx, setCtx] = useState(null) // hele context: request + project + org
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
        // Primaire pad: token-RPC — werkt voor anon én authenticated
        if (token) {
          const { data, error: rpcErr } = await supabase.rpc('get_payment_request_by_token', { p_token: token })
          if (!rpcErr && data && data.length > 0) {
            if (!cancelled) setCtx(data[0])
            // Markeer als viewed (fire-and-forget)
            if (data[0].status === 'sent') {
              supabase.rpc('mark_payment_request_viewed', { p_request_id: data[0].id, p_token: token })
            }
            setLoading(false)
            return
          }
        }

        // Fallback: ingelogde ontvanger zonder token — via RLS
        if (user) {
          const { data: pr } = await supabase
            .from('payment_requests')
            .select('id, project_id, recipient_name, recipient_email, title, description, amount_cents, currency, reference, status, agreement_template_id, agreed_at, paid_at, expires_at')
            .eq('id', id)
            .maybeSingle()
          if (pr) {
            const [tplRes, projRes] = await Promise.all([
              pr.agreement_template_id
                ? supabase.from('agreement_templates').select('title, content_markdown, version').eq('id', pr.agreement_template_id).maybeSingle()
                : Promise.resolve({ data: null }),
              supabase.from('projects').select('name, slug, logo_url, brand_primary_color, brand_accent_color, organization:organizations(id, name, logo_url)').eq('id', pr.project_id).maybeSingle(),
            ])
            const proj = projRes.data
            const org = proj?.organization ?? null
            if (!cancelled) {
              setCtx({
                ...pr,
                agreement_text: tplRes.data?.content_markdown ?? null,
                agreement_title: tplRes.data?.title ?? null,
                agreement_version: tplRes.data?.version ?? null,
                project_name: proj?.name ?? null,
                project_slug: proj?.slug ?? null,
                project_logo_url: proj?.logo_url ?? null,
                project_brand_primary: proj?.brand_primary_color ?? null,
                project_brand_accent: proj?.brand_accent_color ?? null,
                organization_name: org?.name ?? null,
                organization_logo_url: org?.logo_url ?? null,
              })
            }
            if (pr.status === 'sent') {
              supabase.rpc('mark_payment_request_viewed', { p_request_id: pr.id, p_token: null })
            }
            setLoading(false)
            return
          }
        }

        if (!cancelled) setError('Verzoek niet gevonden of link ongeldig.')
      } catch (e) {
        console.error('[PaymentRequestView] load failed', e)
        if (!cancelled) setError('Kon verzoek niet laden.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id, token, user, authLoading])

  // Bij ?paid=1 pollen we de status tot 'paid' — Mollie webhook kan een paar
  // seconden nodig hebben. Elke 2s, max 20s. Stopt zodra status paid/refunded is.
  useEffect(() => {
    if (!isPaidReturn || !ctx?.id) return
    if (['paid', 'refunded'].includes(ctx.status)) return
    let cancelled = false
    let attempts = 0
    const maxAttempts = 10
    const tick = async () => {
      if (cancelled) return
      attempts++
      const { data } = token
        ? await supabase.rpc('get_payment_request_by_token', { p_token: token })
        : await supabase.from('payment_requests').select('*').eq('id', ctx.id).limit(1)
      const next = data?.[0]
      if (next && !cancelled) setCtx((prev) => ({ ...prev, ...next }))
      if (next && ['paid', 'refunded'].includes(next.status)) return
      if (attempts < maxAttempts) setTimeout(tick, 2000)
    }
    const t = setTimeout(tick, 1500)
    return () => { cancelled = true; clearTimeout(t) }
  }, [isPaidReturn, ctx?.id, ctx?.status, token])

  const renderedContract = useMemo(() => {
    if (!ctx?.agreement_text) return ''
    const vars = {
      naam:        ctx.recipient_name || '',
      email:       ctx.recipient_email || '',
      bedrag:      formatEuro(ctx.amount_cents).replace('€', '').trim(),
      referentie:  ctx.reference || '',
      datum:       formatDateNL(),
      project:     ctx.project_name || '',
      organisatie: ctx.organization_name || '',
    }
    return renderPlaceholders(ctx.agreement_text, vars)
  }, [ctx])

  async function handlePay() {
    if (!ctx) return
    // Bij een nieuwe akkoord-flow moet de checkbox aangevinkt zijn. Bij een
    // retry (status is al 'agreed') hoeft dat niet — akkoord staat al vast.
    const alreadyAgreed = ['agreed', 'paid'].includes(ctx.status)
    if (!alreadyAgreed && !agreed) return

    setSubmitting(true)
    setError(null)
    try {
      // Sla agree over als 't al gebeurd is (retry na gefaalde initiate).
      if (!alreadyAgreed) {
        const { error: agreeErr } = await supabase.rpc('agree_payment_request', {
          p_request_id: ctx.id,
          p_token: token || null,
          p_ip: null,
          p_user_agent: (typeof navigator !== 'undefined' ? navigator.userAgent : null),
        })
        if (agreeErr) throw agreeErr
      }

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
          payment_request_id: ctx.id,
          access_token: token || undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok || !body.checkout_url) {
        console.error('[PaymentRequestView] initiate failed', res.status, body)
        const mollieDetail = body?.detail?.detail || body?.detail?.title || body?.detail?.error
        const summary =
          body?.error === 'org_not_connected'
            ? 'Mollie is niet gekoppeld aan deze organisatie.'
            : body?.error === 'invalid_state'
              ? 'Verzoek is al betaald of niet meer geldig.'
              : mollieDetail
                ? `Mollie: ${mollieDetail}`
                : 'Betaling starten mislukt. Probeer het opnieuw of neem contact op.'
        setError(summary)
        setSubmitting(false)
        return
      }
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

  if (error && !ctx) {
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

  if (!ctx) return null

  const isPaid    = ctx.status === 'paid'
  const isExpired = ctx.status === 'expired' || (ctx.expires_at && new Date(ctx.expires_at) < new Date() && !isPaid)
  const isAgreed  = ['agreed', 'paid'].includes(ctx.status)
  const orgLogo   = ctx.organization_logo_url || ctx.project_logo_url

  // Theme: project-thema wint over org-thema (project kan overschrijven).
  // Waarden komen uit projects.default_theme / organizations.default_theme:
  // 'crowdbuilding' | 'warm' | 'light' | null
  const theme = ctx.project_default_theme || ctx.organization_default_theme || 'warm'
  const themeAttr = theme === 'crowdbuilding' ? 'crowdbuilding' : theme === 'warm' ? 'warm' : undefined

  return (
    <div className="pr-page" data-theme={themeAttr}>
      <div className="pr-header">
        {orgLogo ? (
          <img src={orgLogo} alt={ctx.organization_name || ''} className="pr-header__logo" />
        ) : (
          <div className="pr-header__logo pr-header__logo--placeholder">
            {(ctx.organization_name || '?').charAt(0)}
          </div>
        )}
        <div className="pr-header__meta">
          <div className="pr-header__org">{ctx.organization_name || ''}</div>
          <div className="pr-header__project">{ctx.project_name || ''}</div>
        </div>
      </div>

      <div className="pr-card">
        <h1 className="pr-title">{ctx.title}</h1>
        {ctx.description && <p className="pr-description">{ctx.description}</p>}

        <div className="pr-amount">
          <div className="pr-amount__label">Te betalen</div>
          <div className="pr-amount__value">{formatEuro(ctx.amount_cents)}</div>
          {ctx.reference && (
            <div className="pr-amount__ref">Referentie: <code>{ctx.reference}</code></div>
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
              <p>Neem contact op met {ctx.organization_name || 'de organisatie'} voor een nieuw verzoek.</p>
            </div>
          </div>
        ) : (
          <>
            {ctx.agreement_text && (
              <div className="pr-agreement">
                <h2 className="pr-agreement__title">Overeenkomst</h2>
                <div className="pr-agreement__body">{renderedContract}</div>
              </div>
            )}

            {isPaidReturn && isAgreed && !isPaid ? (
              <div className="pr-state pr-state--info">
                <i className="fa-solid fa-spinner fa-spin" />
                <div>
                  <strong>Betaling wordt verwerkt…</strong>
                  <p>Een moment geduld terwijl we de bevestiging van Mollie ophalen.</p>
                </div>
              </div>
            ) : isAgreed && !isPaid ? (
              <div className="pr-state pr-state--info">
                <i className="fa-solid fa-hourglass-half" />
                <div>
                  <strong>Je hebt akkoord gegeven</strong>
                  <p>Rond de betaling af via iDEAL om het verzoek te voltooien.</p>
                </div>
              </div>
            ) : (
              <label className="pr-consent">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span>
                  Ik heb de overeenkomst gelezen en ga akkoord met de voorwaarden en betaling van{' '}
                  <strong>{formatEuro(ctx.amount_cents)}</strong>.
                </span>
              </label>
            )}

            {error && <div className="pr-error">{error}</div>}

            <button
              type="button"
              className="pr-pay-btn"
              onClick={handlePay}
              disabled={submitting || (isPaidReturn && !isPaid && isAgreed) || (!isAgreed && !agreed)}
            >
              {submitting
                ? 'Doorverwijzen…'
                : isPaidReturn && !isPaid && isAgreed
                  ? 'Betaling wordt verwerkt…'
                  : isAgreed
                    ? 'Doorgaan met iDEAL'
                    : 'Akkoord en betalen via iDEAL'}
            </button>
          </>
        )}

        <p className="pr-footer">
          Betaling wordt verwerkt door Mollie. buuur zit nooit in de geldstroom — het bedrag gaat rechtstreeks naar {ctx.organization_name || 'de organisatie'}.
        </p>
      </div>
    </div>
  )
}
