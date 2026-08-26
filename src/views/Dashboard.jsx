import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProject } from '../contexts/ProjectContext'
import { useAuth } from '../contexts/AuthContext'
import { useRoadmap } from '../hooks/useRoadmap'
import { ROLE_LABELS, timeAgo, POST_TAG_COLORS } from '../lib/constants'
import { canDo } from '../lib/permissions'
import { safeStorage } from '../lib/safeStorage'
import Skeleton from '../components/Skeleton'
import MemberWelcome from '../components/MemberWelcome'
import { useSignatureRequestCount } from '../hooks/useSignatureRequestCount'
import { useToast } from '../components/Toast'
import { friendlyError } from '../lib/logger'

export default function Dashboard() {
  const { project, role, loading, basePath, onboardingActive } = useProject()
  const { profile, isPlatformAdmin } = useAuth()
  const navigate = useNavigate()

  // Verse group-admins naar "Aan de slag" tot de checklist klaar/weggeklikt is.
  // Alleen als onboarding voor dit project actief is (light-groepen; pro/MO-
  // projecten worden door de org begeleid en krijgen geen checklist).
  // Platform admins die rondkijken slaan we over; de session-guard voorkomt
  // een redirect-loop nadat de admin in dezelfde sessie heeft weggeklikt.
  useEffect(() => {
    if (loading || !project || role !== 'admin' || isPlatformAdmin) return
    if (!onboardingActive) return
    if (project.onboarding_dismissed) return
    if (safeStorage.getItem(`buuur-onboarding-skip-${project.id}`)) return
    navigate(`${basePath}/aan-de-slag`, { replace: true })
  }, [loading, project, role, isPlatformAdmin, onboardingActive, basePath, navigate])
  const { activePhase } = useRoadmap(project?.id)
  const signatureCount = useSignatureRequestCount()
  const toast = useToast()
  const [feed, setFeed] = useState({ nextEvent: null, latestUpdate: null, latestPosts: [], newMembers: [], intakePending: 0, docRequests: 0, intakeRequest: null, paymentRequests: [], stats: { members: 0, updates: 0 } })
  const [infoOpen, setInfoOpen] = useState(false)
  const [showAllActions, setShowAllActions] = useState(false)

  async function dismissPaymentRequest(id) {
    setFeed(prev => ({ ...prev, paymentRequests: prev.paymentRequests.filter(p => p.id !== id) }))
    const { error } = await supabase.rpc('dismiss_payment_request', { request_id: id })
    if (error) {
      // Rollback: RPC afgeslagen (bv. RLS / netwerk). Nieuwe fetch trekt de rij weer terug.
      toast.error(friendlyError(error))
    }
  }

  useEffect(() => {
    if (!project?.id) return
    let stale = false

    async function loadFeed() {
      const queries = [
        supabase.from('meetings').select('*').eq('project_id', project.id).gte('date', new Date().toISOString()).order('date', { ascending: true }).limit(1),
        supabase.from('updates').select('*, author:profiles(id, full_name, avatar_url)').eq('project_id', project.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('posts').select('*, author:profiles(id, full_name, avatar_url)').eq('project_id', project.id).eq('is_hidden', false).order('created_at', { ascending: false }).limit(3),
        supabase.from('memberships').select('*, profile:profiles(id, full_name, avatar_url)').eq('project_id', project.id).order('joined_at', { ascending: false }).limit(5),
        supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('project_id', project.id).neq('role', 'guest'),
        supabase.from('updates').select('id', { count: 'exact', head: true }).eq('project_id', project.id),
        supabase.from('intake_responses').select('id', { count: 'exact', head: true }).eq('project_id', project.id).eq('status', 'pending'),
        profile?.id ? supabase.from('document_requests').select('id', { count: 'exact', head: true }).eq('project_id', project.id).eq('profile_id', profile.id).eq('status', 'pending') : Promise.resolve({ count: 0 }),
        profile?.id ? supabase.from('profile_intake_requests').select('token').eq('project_id', project.id).eq('profile_id', profile.id).eq('status', 'open').order('sent_at', { ascending: false }).limit(1) : Promise.resolve({ data: [] }),
        profile?.id ? supabase.from('payment_requests')
          .select('id, title, amount_cents, currency, reference, status, expires_at, access_token, dismissed_by_recipient_at')
          .eq('project_id', project.id)
          .eq('recipient_profile_id', profile.id)
          .in('status', ['sent', 'viewed', 'agreed'])
          .is('dismissed_by_recipient_at', null)
          .order('sent_at', { ascending: false }) : Promise.resolve({ data: [] }),
      ]

      const [eventRes, updateRes, postsRes, membersRes, memberCount, updateCount, intakeRes, docReqRes, intakeReqRes, payReqRes] = await Promise.all(queries)
      if (stale) return

      setFeed({
        nextEvent: eventRes.data?.[0] || null,
        latestUpdate: updateRes.data?.[0] || null,
        latestPosts: postsRes.data || [],
        newMembers: membersRes.data || [],
        intakePending: intakeRes.count || 0,
        docRequests: docReqRes.count || 0,
        intakeRequest: intakeReqRes.data?.[0] || null,
        paymentRequests: payReqRes.data || [],
        stats: { members: memberCount.count || 0, updates: updateCount.count || 0 },
      })
    }

    loadFeed()
    return () => { stale = true }
  }, [project?.id])

  // Realtime: verwijder een betaalverzoek-banner zodra 'ie paid/refunded/cancelled/expired
  // wordt (bv. Mollie webhook update de status). Zonder deze subscription bleef
  // de banner staan tot page-refresh.
  useEffect(() => {
    if (!project?.id || !profile?.id) return
    const channel = supabase
      .channel(`dash-payments:${profile.id}:${project.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'payment_requests',
        filter: `recipient_profile_id=eq.${profile.id}`,
      }, (payload) => {
        const next = payload.new
        setFeed(prev => {
          const open = ['sent', 'viewed', 'agreed'].includes(next.status) && !next.dismissed_by_recipient_at
          if (open) {
            // Insert of update-in-place
            const idx = prev.paymentRequests.findIndex(p => p.id === next.id)
            const updated = { ...next }
            const list = idx >= 0
              ? prev.paymentRequests.map(p => p.id === next.id ? { ...p, ...updated } : p)
              : [updated, ...prev.paymentRequests]
            return { ...prev, paymentRequests: list }
          }
          // Niet meer open (of weggeklikt door lid) → drop uit lijst
          return { ...prev, paymentRequests: prev.paymentRequests.filter(p => p.id !== next.id) }
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [project?.id, profile?.id])

  if (loading) return <Skeleton.Page rows={5} />
  if (!project) return <div className="empty-state"><p>Project niet gevonden</p></div>

  const MONTHS_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

  // Alle "actie vereist" items in één geordende lijst zodat ze samen bovenaan
  // renderen. Volgorde = urgentie: geld eerst, dan profiel/documenten, dan
  // admin-taken.
  const actionItems = []
  feed.paymentRequests.forEach((pr) => {
    const isAgreed = pr.status === 'agreed'
    const href = `/verzoeken/${pr.id}${pr.access_token ? `?t=${pr.access_token}` : ''}`
    actionItems.push({
      id: `pay-${pr.id}`,
      iconClass: 'fa-euro-sign',
      iconStyle: { background: 'rgba(240,144,32,0.14)', color: '#F09020' },
      title: `${isAgreed ? 'Rond je betaling af' : 'Openstaand betaalverzoek'}: ${(pr.amount_cents / 100).toLocaleString('nl-NL', { style: 'currency', currency: pr.currency || 'EUR' })}`,
      subtitle: `${pr.title}${pr.reference ? ` · ref ${pr.reference}` : ''}`,
      onClick: () => { window.location.href = href },
      onDismiss: () => dismissPaymentRequest(pr.id),
    })
  })
  if (feed.intakeRequest) {
    actionItems.push({
      id: 'intake-req',
      iconClass: 'fa-clipboard-user',
      iconStyle: { background: 'var(--tag-blue-bg)', color: 'var(--accent-primary)' },
      title: 'Vul je gegevens aan',
      subtitle: 'De initiatiefnemers vragen je een paar profielvelden in te vullen',
      onClick: () => navigate(`${basePath}/profiel-intake/${feed.intakeRequest.token}`),
    })
  }
  if (feed.docRequests > 0) {
    actionItems.push({
      id: 'doc-req',
      iconClass: 'fa-file-circle-question',
      iconStyle: { background: 'var(--tag-blue-bg)', color: 'var(--accent-primary)' },
      title: `${feed.docRequests} ${feed.docRequests === 1 ? 'documentverzoek' : 'documentverzoeken'}`,
      subtitle: 'wacht op jouw actie',
      onClick: () => navigate(`${basePath}/documenten?tab=mijn`),
    })
  }
  if (signatureCount > 0) {
    actionItems.push({
      id: 'sig-req',
      iconClass: 'fa-signature',
      iconStyle: { background: 'rgba(245, 166, 35, 0.12)', color: 'var(--accent-orange, #F5A623)' },
      title: `${signatureCount} ${signatureCount === 1 ? 'tekenverzoek' : 'tekenverzoeken'}`,
      subtitle: 'wacht op jouw handtekening',
      onClick: () => navigate(`${basePath}/documenten?tab=mijn`),
    })
  }
  if (feed.intakePending > 0 && canDo(role, 'manage_intake')) {
    actionItems.push({
      id: 'admin-intake',
      iconClass: 'fa-clipboard-list',
      iconStyle: null,
      title: `${feed.intakePending} nieuwe ${feed.intakePending === 1 ? 'aanmelding' : 'aanmeldingen'}`,
      subtitle: 'via het intake formulier',
      onClick: () => navigate(`${basePath}/members?tab=werving`),
    })
  }
  const COLLAPSE_THRESHOLD = 3
  const visibleActions = showAllActions ? actionItems : actionItems.slice(0, COLLAPSE_THRESHOLD)
  const hiddenCount = actionItems.length - COLLAPSE_THRESHOLD

  return (
    <div className="view-dashboard">
      {/* Header with project info */}
      <div className="dash-header">
        <div className="dash-header__info">
          {project.logo_url && <img src={project.logo_url} alt={project.name + ' logo'} className="dash-header__logo" />}
          <div>
            <h1>{project.name}</h1>
            {project.tagline && <p className="dash-header__tagline">{project.tagline}</p>}
          </div>
        </div>
        {project.description && (
          <button className="btn-secondary btn-sm" onClick={() => setInfoOpen(true)}>
            <i className="fa-solid fa-circle-info" /> Over dit project
          </button>
        )}
      </div>

      {/* Stats row — meteen onder de header voor projectcontext in één oogopslag */}
      <div className="dash-stats">
        <div className="dash-stat" onClick={() => navigate(`${basePath}/members`)} role="button" tabIndex={0}>
          <i className="fa-solid fa-user-tag dash-stat__icon" style={{ color: '#4A90D9' }} />
          <span className="dash-stat__value">{ROLE_LABELS[role] || role}</span>
          <span className="dash-stat__label">Jouw rol</span>
        </div>
        <div className="dash-stat" onClick={() => navigate(`${basePath}/members`)} role="button" tabIndex={0}>
          <i className="fa-solid fa-users dash-stat__icon" style={{ color: '#F09020' }} />
          <span className="dash-stat__value">{feed.stats.members}</span>
          <span className="dash-stat__label">Leden</span>
        </div>
        <div className="dash-stat" onClick={() => navigate(`${basePath}/updates`)} role="button" tabIndex={0}>
          <i className="fa-solid fa-bullhorn dash-stat__icon" style={{ color: '#F23578' }} />
          <span className="dash-stat__value">{feed.stats.updates}</span>
          <span className="dash-stat__label">Nieuws</span>
        </div>
        <div className="dash-stat" onClick={() => navigate(`${basePath}/roadmap`)} role="button" tabIndex={0}>
          <i className="fa-solid fa-road dash-stat__icon" style={{ color: '#7B5EA7' }} />
          <span className="dash-stat__value">{activePhase?.subtitle || activePhase?.name || '—'}</span>
          <span className="dash-stat__label">Fase</span>
        </div>
      </div>

      {/* Guest banner */}
      {role === 'guest' && (
        <div className="dash-guest-banner">
          <div className="dash-guest-banner__icon">
            <i className="fa-solid fa-clock" />
          </div>
          <div className="dash-guest-banner__text">
            <h3>Je aanvraag wordt beoordeeld</h3>
            <p>Een beheerder beoordeelt je aanvraag. In de tussentijd kun je publieke updates en documenten bekijken.</p>
          </div>
        </div>
      )}

      {/* Aspirant banner */}
      {role === 'aspirant' && (
        <div className="dash-guest-banner">
          <div className="dash-guest-banner__icon" style={{ background: 'rgba(59,210,105,0.1)', color: '#3BD269' }}>
            <i className="fa-solid fa-seedling" />
          </div>
          <div className="dash-guest-banner__text">
            <h3>Welkom als aspirant-lid!</h3>
            <p>Je bent goedgekeurd om de community te leren kennen. Je hebt toegang tot vrijwel alles. Na de kennismakingsperiode kun je volledig lid worden.</p>
          </div>
        </div>
      )}

      {/* Alle "actie vereist" items in één sectie zodat het dashboard rustiger
          leest. Volgorde staat in actionItems hierboven; > COLLAPSE_THRESHOLD
          items wordt de rest ingeklapt achter "Toon alle". */}
      {actionItems.length > 0 && (
        <div className="dash-actions">
          <div className="dash-actions__header">
            <h3 className="dash-actions__title">Wat wacht op jou</h3>
            <span className="dash-actions__count">{actionItems.length}</span>
          </div>
          {visibleActions.map((item) => (
            <div key={item.id} className="dash-intake-alert" onClick={item.onClick} role="button" tabIndex={0}>
              <div className="dash-intake-alert__icon" style={item.iconStyle || undefined}>
                <i className={`fa-solid ${item.iconClass}`} />
              </div>
              <div className="dash-intake-alert__text">
                <strong>{item.title}</strong>
                <span>{item.subtitle}</span>
              </div>
              {item.onDismiss && (
                <button
                  type="button"
                  className="dash-intake-alert__dismiss"
                  onClick={(e) => { e.stopPropagation(); item.onDismiss() }}
                  aria-label="Verzoek verbergen"
                  title="Verbergen"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
              <i className="fa-solid fa-arrow-right dash-intake-alert__arrow" />
            </div>
          ))}
          {!showAllActions && hiddenCount > 0 && (
            <button className="dash-actions__more" onClick={() => setShowAllActions(true)}>
              <i className="fa-solid fa-chevron-down" /> Toon alle {actionItems.length}
            </button>
          )}
          {showAllActions && actionItems.length > COLLAPSE_THRESHOLD && (
            <button className="dash-actions__more" onClick={() => setShowAllActions(false)}>
              <i className="fa-solid fa-chevron-up" /> Toon minder
            </button>
          )}
        </div>
      )}

      {/* Welkomststappen voor nieuwe leden (profiel afmaken, prikbord, roadmap) */}
      <MemberWelcome />

      {/* Activity feed grid */}
      <div className="dash-feed">
        {/* Next event */}
        {feed.nextEvent && (
          <div className="dash-card dash-card--event" onClick={() => navigate(`${basePath}/events?open=${feed.nextEvent.id}`)} role="button" tabIndex={0}>
            <div className="dash-card__content">
              <span className="dash-card__label"><i className="fa-solid fa-calendar-check" style={{ color: '#F09020' }} /> Eerstvolgende event</span>
              <h3 className="dash-card__title">{feed.nextEvent.title}</h3>
              <span className="dash-card__meta">
                {(() => {
                  const d = new Date(feed.nextEvent.date)
                  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} · ${d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
                })()}
                {feed.nextEvent.location && ` · ${feed.nextEvent.location}`}
              </span>
            </div>
            <i className="fa-solid fa-arrow-right dash-card__arrow" />
          </div>
        )}

        {/* Latest update */}
        {feed.latestUpdate && (
          <div className="dash-card dash-card--update" onClick={() => navigate(`${basePath}/updates`)} role="button" tabIndex={0}>
            <div className="dash-card__content">
              <span className="dash-card__label"><i className="fa-solid fa-bullhorn" style={{ color: '#F4B400' }} /> Laatste update</span>
              <h3 className="dash-card__title">{feed.latestUpdate.title}</h3>
              <span className="dash-card__meta">
                {feed.latestUpdate.author?.full_name} · {timeAgo(feed.latestUpdate.created_at)}
              </span>
            </div>
            <i className="fa-solid fa-arrow-right dash-card__arrow" />
          </div>
        )}

        {/* Latest prikbord posts */}
        {feed.latestPosts.length > 0 && (
          <div className="dash-card dash-card--posts" onClick={() => navigate(`${basePath}/community`)} role="button" tabIndex={0}>
            <div className="dash-card__content">
              <span className="dash-card__label"><i className="fa-solid fa-thumbtack" style={{ color: '#3BD269' }} /> Prikbord</span>
              <div className="dash-posts-list">
                {feed.latestPosts.map(p => (
                  <div key={p.id} className="dash-post-item">
                    {p.author?.avatar_url
                      ? <img src={p.author.avatar_url} alt="" className="dash-post-item__avatar" />
                      : <div className="dash-post-item__avatar dash-post-item__avatar--placeholder">{(p.author?.full_name || 'U')[0]}</div>
                    }
                    <span className="dash-post-item__text">{p.text}</span>
                    {p.tag && <span className="dash-post-item__tag" style={{ color: POST_TAG_COLORS[p.tag]?.color }}>{p.tag}</span>}
                  </div>
                ))}
              </div>
            </div>
            <i className="fa-solid fa-arrow-right dash-card__arrow" />
          </div>
        )}

        {/* New members */}
        {feed.newMembers.length > 0 && (
          <div className="dash-card dash-card--members" onClick={() => navigate(`${basePath}/members`)} role="button" tabIndex={0}>
            <div className="dash-card__content">
              <span className="dash-card__label"><i className="fa-solid fa-users" style={{ color: '#F23578' }} /> Nieuwste leden</span>
              <div className="dash-members-avatars">
                {feed.newMembers.slice(0, 8).map(m => (
                  m.profile?.avatar_url
                    ? <img key={m.id} src={m.profile.avatar_url} alt={m.profile.full_name} className="dash-member-avatar" title={m.profile.full_name} />
                    : <div key={m.id} className="dash-member-avatar dash-member-avatar--placeholder" title={m.profile?.full_name}>{(m.profile?.full_name || '?')[0]}</div>
                ))}
                {feed.newMembers.length > 8 && (
                  <div className="dash-member-avatar dash-member-avatar--more">+{feed.newMembers.length - 8}</div>
                )}
              </div>
            </div>
            <i className="fa-solid fa-arrow-right dash-card__arrow" />
          </div>
        )}
      </div>

      {/* Project info modal */}
      {infoOpen && (
        <div className="modal-overlay" onClick={() => setInfoOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Over {project.name}</h2>
              <button className="modal-close" onClick={() => setInfoOpen(false)} aria-label="Sluiten"><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="dash-info-modal">
              {project.cover_image_url && (
                <img src={project.cover_image_url} alt={project.name + ' cover'} className="dash-info-modal__cover" />
              )}
              {project.location && (
                <p className="dash-info-modal__location">
                  <i className="fa-solid fa-location-dot" /> {project.location}
                </p>
              )}
              <p className="dash-info-modal__desc">{project.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
