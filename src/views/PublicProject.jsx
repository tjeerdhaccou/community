import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { timeAgo, MONTHS_SHORT, MONTHS_LONG, DAYS_LONG } from '../lib/constants'
import { COLOR_THEMES } from './PageBuilder'

const FONT_MAP = {
  clean: { heading: 'Inter, sans-serif', body: 'Inter, sans-serif' },
  editorial: { heading: '"Playfair Display", serif', body: '"Source Sans 3", sans-serif' },
  modern: { heading: '"Space Grotesk", sans-serif', body: '"DM Sans", sans-serif' },
  warm: { heading: 'Lora, serif', body: 'Nunito, sans-serif' },
  bold: { heading: 'Ubuntu, sans-serif', body: 'Kreon, serif' },
}

/* ==================== Sub-components ==================== */

function EventCard({ event, onClick }) {
  const d = new Date(event.date)
  return (
    <div className="pub-event" onClick={onClick} role={onClick ? 'button' : undefined} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="pub-event__date">
        <span className="pub-event__day">{d.getDate()}</span>
        <span className="pub-event__month">{MONTHS_SHORT[d.getMonth()]}</span>
      </div>
      <div className="pub-event__info">
        <h4>{event.title}</h4>
        {event.location && <p><i className="fa-solid fa-location-dot" /> {event.location}</p>}
        {event.description && <p className="pub-event__desc">{event.description}</p>}
      </div>
      {onClick && <i className="fa-solid fa-chevron-right pub-event__arrow" />}
    </div>
  )
}

function PublicEventModal({ event, project, onClose }) {
  if (!event) return null
  const d = new Date(event.date)
  const timeStr = d.toTimeString().slice(0, 5)
  const endDate = event.duration_hours ? new Date(d.getTime() + event.duration_hours * 3600000) : null
  const endTimeStr = endDate ? endDate.toTimeString().slice(0, 5) : null

  return (
    <div className="pub-modal-overlay" onClick={onClose}>
      <div className="pub-modal pub-modal--event" onClick={e => e.stopPropagation()}>
        <button type="button" className="pub-modal__close" onClick={onClose}>
          <i className="fa-solid fa-xmark" />
        </button>
        <div className="pub-modal__body">
          <p className="pub-event-modal__day">{DAYS_LONG[d.getDay()]} {d.getDate()} {MONTHS_LONG[d.getMonth()]} {d.getFullYear()}</p>
          <h2>{event.title}</h2>
          <div className="pub-event-modal__meta">
            <span><i className="fa-solid fa-clock" /> {timeStr}{endTimeStr ? ` – ${endTimeStr}` : ''}</span>
            {event.location && event.location !== 'Online' && (
              <span><i className="fa-solid fa-location-dot" /> {event.location}</span>
            )}
            {event.online_url && (
              <span><i className="fa-solid fa-video" /> Online bijeenkomst</span>
            )}
            {event.max_attendees && (
              <span><i className="fa-solid fa-users" /> Max. {event.max_attendees} deelnemers</span>
            )}
          </div>
          {event.description && <p className="pub-event-modal__desc">{event.description}</p>}
          <div className="pub-event-modal__actions">
            {event.online_url && (
              <a href={event.online_url} target="_blank" rel="noopener noreferrer" className="cl-btn cl-btn--secondary">
                <i className="fa-solid fa-video" /> Deelnamelink
              </a>
            )}
            {project.intake_enabled && (
              <Link
                to={`/intake/${project.id}`}
                className="cl-btn cl-btn--primary"
                style={project.cta_btn_color ? { background: project.cta_btn_color, borderColor: project.cta_btn_color } : undefined}
              >
                <i className="fa-solid fa-pen" /> Aanmelden voor dit project
              </Link>
            )}
            {!project.intake_enabled && project.public_contact_email && (
              <a
                href={`mailto:${project.public_contact_email}`}
                className="cl-btn cl-btn--primary"
                style={project.cta_btn_color ? { background: project.cta_btn_color, borderColor: project.cta_btn_color } : undefined}
              >
                <i className="fa-solid fa-envelope" /> Neem contact op
              </a>
            )}
          </div>
          <p className="pub-event-modal__hint">Al lid? Meld je aan via het ledenportaal.</p>
        </div>
      </div>
    </div>
  )
}

function UpdateCard({ update, onClick }) {
  return (
    <div className="pub-update-card" onClick={onClick} role="button" tabIndex={0}>
      {update.image_url && <img src={update.image_url} alt="" className="pub-update-card__img" />}
      <div className="pub-update-card__body">
        <h4>{update.title}</h4>
        <p>{update.body?.length > 120 ? update.body.slice(0, 120) + '...' : update.body}</p>
        <div className="pub-update-card__meta">
          {update.author?.avatar_url ? (
            <img src={update.author.avatar_url} alt="" className="pub-avatar pub-avatar--sm" />
          ) : (
            <div className="pub-avatar pub-avatar--sm pub-avatar--placeholder">{(update.author?.full_name || 'A')[0]}</div>
          )}
          <span>{update.author?.full_name}</span>
          <span className="pub-update-card__time">{timeAgo(update.created_at)}</span>
        </div>
      </div>
    </div>
  )
}

function UpdateModal({ update, onClose }) {
  if (!update) return null
  return (
    <div className="pub-modal-overlay" onClick={onClose}>
      <div className="pub-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="pub-modal__close" onClick={onClose}>
          <i className="fa-solid fa-xmark" />
        </button>
        {update.image_url && <img src={update.image_url} alt="" className="pub-modal__img" />}
        <div className="pub-modal__body">
          <h2>{update.title}</h2>
          <div className="pub-modal__meta">
            {update.author?.avatar_url ? (
              <img src={update.author.avatar_url} alt="" className="pub-avatar" />
            ) : (
              <div className="pub-avatar pub-avatar--placeholder">{(update.author?.full_name || 'A')[0]}</div>
            )}
            <span>{update.author?.full_name}</span>
            <span>{timeAgo(update.created_at)}</span>
          </div>
          <div className="pub-modal__content">{update.body}</div>
        </div>
      </div>
    </div>
  )
}

function TeamMember({ member }) {
  const p = member.profile
  return (
    <div className="pub-team-member">
      {p?.avatar_url ? (
        <img src={p.avatar_url} alt="" className="pub-avatar pub-avatar--lg" />
      ) : (
        <div className="pub-avatar pub-avatar--lg pub-avatar--placeholder">
          {(p?.full_name || '?')[0]}
        </div>
      )}
      <span className="pub-team-member__name">{p?.full_name}</span>
      <span className="pub-team-member__role">{member.role === 'admin' ? 'Beheerder' : 'Moderator'}</span>
    </div>
  )
}

function Carousel({ images }) {
  const [current, setCurrent] = useState(0)
  const total = images.length
  if (total === 0) return null

  return (
    <div className="pub-carousel">
      <div className="pub-carousel__track" style={{ transform: `translateX(-${current * 100}%)` }}>
        {images.map((url, i) => (
          <img key={i} src={url} alt="" className="pub-carousel__slide" />
        ))}
      </div>
      {total > 1 && (
        <>
          <button className="pub-carousel__btn pub-carousel__btn--prev" onClick={() => setCurrent(c => (c - 1 + total) % total)}>
            <i className="fa-solid fa-chevron-left" />
          </button>
          <button className="pub-carousel__btn pub-carousel__btn--next" onClick={() => setCurrent(c => (c + 1) % total)}>
            <i className="fa-solid fa-chevron-right" />
          </button>
          <div className="pub-carousel__dots">
            {images.map((_, i) => (
              <button key={i} className={`pub-carousel__dot ${i === current ? 'pub-carousel__dot--active' : ''}`} onClick={() => setCurrent(i)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ==================== Block Renderer ==================== */

function ContentBlock({ section, updates, events, onUpdateClick, onEventClick }) {
  const style = {}
  if (section.bg_color) style.backgroundColor = section.bg_color
  const textClass = section.text_color === 'light' ? 'pub-block--text-light' : ''

  switch (section.section_type) {
    case 'text-image-left':
    case 'text-image-right': {
      const reverse = section.section_type === 'text-image-right'
      return (
        <section className={`pub-block ${textClass}`} style={style}>
          <div className={`pub-block__inner pub-block__inner--split ${reverse ? 'pub-block__inner--reverse' : ''}`}>
            <div className="pub-block__text">
              {section.title && <h2 className="pub-block__title">{section.title}</h2>}
              {section.body && <p className="pub-block__body">{section.body}</p>}
            </div>
            {section.image_url && (
              <div className="pub-block__media">
                <img src={section.image_url} alt={section.title || ''} className="pub-block__img" />
              </div>
            )}
          </div>
        </section>
      )
    }

    case 'text-only':
      return (
        <section className={`pub-block ${textClass}`} style={style}>
          <div className="pub-block__inner pub-block__inner--text-only" style={{ textAlign: section.text_align || 'left' }}>
            {section.title && <h2 className="pub-block__title">{section.title}</h2>}
            {section.body && <p className={`pub-block__body ${section.text_size === 'large' ? 'pub-block__body--large' : ''}`}>{section.body}</p>}
          </div>
        </section>
      )

    case 'image-full':
      return (
        <section className={`pub-block pub-block--image-full ${textClass}`} style={style}>
          {section.image_url && <img src={section.image_url} alt={section.title || ''} className="pub-block__full-img" />}
        </section>
      )

    case 'image-carousel':
      return (
        <section className={`pub-block ${textClass}`} style={style}>
          <div className="pub-block__inner">
            <Carousel images={section.images || []} />
          </div>
        </section>
      )

    case 'updates':
      return (
        <section className={`pub-block ${textClass}`} style={style}>
          <div className="pub-block__inner">
            <h2 className="pub-block__title" style={{ marginBottom: 20 }}>{section.title || 'Laatste updates'}</h2>
            <div className="pub-updates-grid">
              {updates.map(u => (
                <UpdateCard key={u.id} update={u} onClick={() => onUpdateClick(u)} />
              ))}
              {updates.length === 0 && <p style={{ color: 'var(--text-tertiary)' }}>Nog geen updates.</p>}
            </div>
          </div>
        </section>
      )

    case 'cards': {
      const cols = section.card_columns || 3
      const cards = (section.images || []).filter(c => c && typeof c === 'object')
      if (cards.length === 0) return null
      return (
        <section className={`pub-block ${textClass}`} style={style}>
          <div className="pub-block__inner">
            {section.title && <h2 className="pub-block__title" style={{ marginBottom: 28 }}>{section.title}</h2>}
            <div className={`pub-cards-grid pub-cards-grid--${cols}`}>
              {cards.map((card, i) => (
                <div key={i} className="pub-card" style={card.bg_color ? { backgroundColor: card.bg_color } : {}}>
                  {card.image_url && <img src={card.image_url} alt={card.title || ''} className="pub-card__img" />}
                  <div className="pub-card__content">
                    {card.title && <h3 className="pub-card__title">{card.title}</h3>}
                    {card.body && <p className="pub-card__body">{card.body}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    }

    case 'footer': {
      const hasBtn = !!(section.cta_label && section.cta_url)
      return (
        <section className={`pub-block pub-block--footer ${textClass}`} style={style}>
          <div className={`pub-block__inner pub-block__inner--text-only pub-footer-inner${hasBtn ? ' pub-footer-inner--with-btn' : ''}`}>
            <div className="pub-footer__text">
              {section.title && <h2 className="pub-block__title pub-block__title--footer">{section.title}</h2>}
              {section.body && <p className="pub-block__body">{section.body}</p>}
            </div>
            {hasBtn && (
              <a href={section.cta_url} className="cl-btn cl-btn--primary cl-btn--lg pub-footer__btn" target="_blank" rel="noopener noreferrer"
                style={{ background: section.cta_btn_color || 'var(--pub-primary)', color: '#fff', whiteSpace: 'nowrap' }}>
                {section.cta_label}
              </a>
            )}
          </div>
        </section>
      )
    }

    case 'members': {
      const featured = (section.images || []).filter(m => m && typeof m === 'object' && m.profile_id)
      if (featured.length === 0) return null
      return (
        <section className={`pub-block ${textClass}`} style={style}>
          <div className="pub-block__inner" style={{ textAlign: 'center' }}>
            {section.title && <h2 className="pub-block__title">{section.title}</h2>}
            {section.body && <p className="pub-members__intro">{section.body}</p>}
            <div className="pub-members-grid">
              {featured.map(m => (
                <div key={m.profile_id} className="pub-member-card">
                  <div className="pub-member-card__avatar">
                    {m.avatar_url
                      ? <img src={m.avatar_url} alt={m.name} />
                      : <span className="pub-member-card__initials">{(m.name || '?').charAt(0)}</span>
                    }
                  </div>
                  <div className="pub-member-card__info">
                    <span className="pub-member-card__name">{m.name}</span>
                    {m.label && <span className="pub-member-card__label">{m.label}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    }

    case 'agenda': {
      const upcomingEvents = events || []
      if (upcomingEvents.length === 0) return null
      const nextEvent = upcomingEvents[0]
      const d = new Date(nextEvent.date)
      return (
        <section className={`pub-block ${textClass}`} style={style}>
          <div className="pub-block__inner">
            <p className="pub-agenda-eyebrow">{section.title || 'Op de agenda'}</p>
            <div
              className="pub-agenda-next pub-agenda-next--clickable"
              onClick={() => onEventClick?.(nextEvent)}
              role="button"
              tabIndex={0}
            >
              <div className="pub-agenda-next__date">
                <span className="pub-agenda-next__day">{d.getDate()}</span>
                <span className="pub-agenda-next__month">{MONTHS_LONG[d.getMonth()]}</span>
                <span className="pub-agenda-next__year">{d.getFullYear()}</span>
              </div>
              <div className="pub-agenda-next__info">
                <h3>{nextEvent.title}</h3>
                {nextEvent.location && nextEvent.location !== 'Online' && (
                  <p><i className="fa-solid fa-location-dot" style={{ marginRight: 6, opacity: 0.6 }} />{nextEvent.location}</p>
                )}
                {nextEvent.online_url && <p><i className="fa-solid fa-video" style={{ marginRight: 6, opacity: 0.6 }} />Online bijeenkomst</p>}
                {nextEvent.description && <p className="pub-agenda-next__desc">{nextEvent.description}</p>}
              </div>
              <i className="fa-solid fa-chevron-right pub-agenda-next__arrow" />
            </div>
            {upcomingEvents.length > 1 && (
              <div className="pub-agenda-more">
                {upcomingEvents.slice(1).map(e => (
                  <EventCard key={e.id} event={e} onClick={() => onEventClick?.(e)} />
                ))}
              </div>
            )}
          </div>
        </section>
      )
    }

    default:
      return null
  }
}

/* ==================== Main Component ==================== */

export default function PublicProject({ slugOverride }) {
  const params = useParams()
  const slug = slugOverride || params.slug
  const isPreview = new URLSearchParams(window.location.search).get('preview') === '1'
  const [project, setProject] = useState(null)
  const [sections, setSections] = useState([])
  const [events, setEvents] = useState([])
  const [updates, setUpdates] = useState([])
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [selectedUpdate, setSelectedUpdate] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [previewTheme, setPreviewTheme] = useState(null)

  useEffect(() => {
    async function load() {
      // In preview mode, don't filter by is_public so admins can preview unpublished pages
      const query = supabase.from('projects').select('*').eq('slug', slug)
      if (!isPreview) query.eq('is_public', true)
      const { data: proj, error } = await query.single()

      if (error || !proj) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setProject(proj)

      // In preview mode: read concept from localStorage (saved by PageBuilder)
      if (isPreview) {
        const previewKey = `pb-preview-${proj.id}`
        let previewData = null
        try { previewData = JSON.parse(localStorage.getItem(previewKey) || 'null') } catch {}
        if (previewData) {
          setSections(previewData.sections || [])
          setPreviewTheme({
            fontTheme: previewData.fontTheme || 'clean',
            colorTheme: previewData.colorTheme || 'clean',
            ctaText: previewData.ctaText || '',
            ctaBtnColor: previewData.ctaBtnColor || null,
          })
          const [eventsRes, updatesRes] = await Promise.all([
            supabase.from('meetings').select('*').eq('project_id', proj.id).eq('visibility', 'public').gte('date', new Date().toISOString()).order('date').limit(5),
            supabase.from('updates').select('*, author:profiles(full_name, avatar_url)').eq('project_id', proj.id).eq('is_public', true).order('created_at', { ascending: false }).limit(8),
          ])
          setEvents(eventsRes.data || [])
          setUpdates(updatesRes.data || [])
          setLoading(false)
          return
        }
        // No preview data in localStorage — fall through to live version
      }

      const [sectionsRes, eventsRes, updatesRes, teamRes] = await Promise.all([
        supabase.from('public_sections').select('*').eq('project_id', proj.id).order('sort_order'),
        supabase.from('meetings').select('*').eq('project_id', proj.id).eq('visibility', 'public').gte('date', new Date().toISOString()).order('date').limit(5),
        supabase.from('updates').select('*, author:profiles(full_name, avatar_url)').eq('project_id', proj.id).eq('is_public', true).order('created_at', { ascending: false }).limit(8),
        supabase.from('memberships').select('role, profile:profiles(full_name, avatar_url)').eq('project_id', proj.id).in('role', ['admin', 'moderator']),
      ])

      if (sectionsRes.error) console.error('PublicProject: sections load failed', sectionsRes.error)
      if (eventsRes.error)   console.error('PublicProject: events load failed', eventsRes.error)
      if (updatesRes.error)  console.error('PublicProject: updates load failed', updatesRes.error)

      setSections(sectionsRes.data || [])
      setEvents(eventsRes.data || [])
      setUpdates(updatesRes.data || [])
      setTeam(teamRes.data || [])
      setLoading(false)
    }
    load()
  }, [slug, isPreview])

  // Project-merkkleuren worden niet meer toegepast (zie ThemeContext): alle
  // surfaces gebruiken het vaste functionele palet, ook de publieke pagina.

  if (loading) return <div className="loading-page"><p>Laden...</p></div>

  if (notFound) {
    return (
      <div className="error-boundary">
        <div className="error-boundary__card">
          <i className="fa-solid fa-compass error-boundary__icon" style={{ color: 'var(--text-tertiary)' }} />
          <h2>Project niet gevonden</h2>
          <p>Dit project bestaat niet of is niet publiek.</p>
        </div>
      </div>
    )
  }

  // In preview mode, override theme with draft values
  const activeFontTheme = previewTheme?.fontTheme || project.font_theme
  const activeColorTheme = previewTheme?.colorTheme || project.color_theme
  const activeCtaText = previewTheme?.ctaText ?? project.cta_text
  const activeCtaBtnColor = previewTheme?.ctaBtnColor ?? project.cta_btn_color

  const fonts = FONT_MAP[activeFontTheme] || FONT_MAP.clean
  const palette = COLOR_THEMES[activeColorTheme] || COLOR_THEMES.clean
  const heroSection = sections.find(s => s.section_type === 'hero')
  const ctaSection = sections.find(s => s.section_type === 'cta')
  const contentSections = sections.filter(s => s.section_type !== 'hero' && s.section_type !== 'cta')

  const heroImage = heroSection?.image_url || project.cover_image_url
  const heroTitle = heroSection?.title || project.name
  const heroSub = heroSection?.body || project.tagline

  const ctaBg = ctaSection?.bg_color || palette.primary
  const ctaTextOnBg = ctaSection?.text_color === 'light' ? '#ffffff' : palette.text

  const themeVars = {
    '--pub-primary': palette.primary,
    '--pub-secondary': palette.secondary,
    '--pub-accent': palette.accent,
    '--pub-muted': palette.muted,
    '--pub-background': palette.background,
    '--pub-text': palette.text,
    '--font-heading': fonts.heading,
    '--font-body': fonts.body,
  }

  return (
    <div className={`pub-page pub-page--font-${activeFontTheme || 'clean'}`} style={themeVars}>
      {/* Concept banner */}
      {isPreview && (
        <div className="pub-concept-banner">
          <i className="fa-solid fa-eye" />
          <span>Dit is een <strong>voorbeeld</strong> — nog niet gepubliceerd voor bezoekers</span>
        </div>
      )}
      {/* Hero */}
      <header
        className="pub-hero"
        style={heroImage
          ? { backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.6)), url(${heroImage})` }
          : { background: palette.primary }
        }
      >
        <div className="pub-hero__content">
          {project.logo_url && <img src={project.logo_url} alt="" className="pub-hero__logo" />}
          <h1>{heroTitle}</h1>
          {heroSub && <p className="pub-hero__tagline">{heroSub}</p>}
          {project.location && (
            <p className="pub-hero__location"><i className="fa-solid fa-location-dot" /> {project.location}</p>
          )}
        </div>
      </header>

      {/* CTA Banner */}
      {ctaSection && project.intake_enabled && (
        <section className="pub-cta-banner" style={{ background: ctaBg, color: ctaTextOnBg }}>
          <div className="pub-cta-banner__inner">
            {ctaSection.title && <p className="pub-cta-banner__text">{ctaSection.title}</p>}
            <Link
              to={`/intake/${project.id}`}
              className="cl-btn cl-btn--primary cl-btn--lg"
              style={{ background: activeCtaBtnColor || '#ffffff', color: activeCtaBtnColor ? '#fff' : ctaBg }}
            >
              {activeCtaText || 'Schrijf je in'}
            </Link>
          </div>
        </section>
      )}

      {/* Content blocks */}
      {contentSections.map(s => (
        <ContentBlock
          key={s.id}
          section={s}
          updates={updates}
          events={events}
          onUpdateClick={setSelectedUpdate}
          onEventClick={setSelectedEvent}
        />
      ))}

      {/* Contact CTA */}
      {(project.public_contact_email || (project.intake_enabled && !ctaSection)) && (
        <section className="pub-block">
          <div className="pub-block__inner pub-cta-footer">
            {project.intake_enabled && !ctaSection && (
              <Link to={`/intake/${project.id}`} className="cl-btn cl-btn--primary">
                {project.cta_text || 'Schrijf je in'}
              </Link>
            )}
            {project.public_contact_email && (
              <a href={`mailto:${project.public_contact_email}`} className="cl-btn cl-btn--secondary">
                <i className="fa-solid fa-envelope" /> Neem contact op
              </a>
            )}
          </div>
        </section>
      )}

      <footer className="pub-footer">
        <p>Powered by <strong>CrowdBuilding</strong></p>
        <Link to="/privacy">Privacybeleid</Link>
      </footer>

      {/* Update modal */}
      <UpdateModal update={selectedUpdate} onClose={() => setSelectedUpdate(null)} />

      {/* Event modal */}
      <PublicEventModal event={selectedEvent} project={project} onClose={() => setSelectedEvent(null)} />
    </div>
  )
}
