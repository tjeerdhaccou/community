import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useProject } from '../contexts/ProjectContext'
import { useSidebarSignals } from '../hooks/useSidebarSignals'
import { NAV_SECTIONS, ACCOUNT_ITEM, MOBILE_PRIMARY_ORDER, isNavItemVisible } from '../lib/navigation'
import { useBodyScrollLock } from '../lib/scrollLock'

const PRIMARY_SLOTS = 4 // + "Meer" = 5 items in de balk

/**
 * Mobiele onderbalk: vier vaste items (op volgorde van MOBILE_PRIMARY_ORDER,
 * alleen wat voor deze gebruiker zichtbaar is) plus "Meer", een sheet met alle
 * overige items gegroepeerd zoals in de sidebar. Badges/dots komen uit
 * useSidebarSignals, net als in de sidebar.
 */
export default function BottomNav() {
  const { role, basePath, featureEnabled, onboardingActive } = useProject()
  const location = useLocation()
  const navigate = useNavigate()
  const { actions, unread } = useSidebarSignals()
  const [moreOpen, setMoreOpen] = useState(false)

  const ctx = useMemo(() => ({ role, featureEnabled, onboardingActive }), [role, featureEnabled, onboardingActive])

  // Zichtbare secties + items, in sidebar-volgorde.
  const sections = useMemo(
    () => NAV_SECTIONS
      .map((s) => ({ ...s, items: s.items.filter((i) => isNavItemVisible(i, ctx)) }))
      .filter((s) => s.items.length > 0),
    [ctx],
  )
  const allItems = useMemo(() => sections.flatMap((s) => s.items), [sections])

  const primary = useMemo(() => {
    const byTo = new Map(allItems.map((i) => [i.to, i]))
    const picked = []
    for (const to of MOBILE_PRIMARY_ORDER) {
      const it = byTo.get(to)
      if (it) picked.push(it)
      if (picked.length === PRIMARY_SLOTS) break
    }
    // Aanvullen met wat er verder nog zichtbaar is (bv. professional zonder prikbord).
    for (const it of allItems) {
      if (picked.length === PRIMARY_SLOTS) break
      if (!picked.includes(it)) picked.push(it)
    }
    return picked
  }, [allItems])

  const primarySet = useMemo(() => new Set(primary.map((i) => i.to)), [primary])
  // Beheer (instellingen, pagina bouwer, aan de slag) is desktopwerk: niet in de mobiele sheet.
  const moreSections = useMemo(
    () => sections
      .filter((s) => s.label !== 'Beheer')
      .map((s) => ({ ...s, items: s.items.filter((i) => !primarySet.has(i.to)) }))
      .filter((s) => s.items.length > 0),
    [sections, primarySet],
  )

  function isActive(to) {
    if (to === '') return location.pathname === (basePath || '/') || location.pathname === basePath + '/'
    return location.pathname.startsWith(`${basePath}/${to}`)
  }
  const moreActive = !primary.some((i) => isActive(i.to)) && (moreSections.some((s) => s.items.some((i) => isActive(i.to))) || isActive(ACCOUNT_ITEM.to))

  function go(item) {
    setMoreOpen(false)
    navigate(item.to === '' ? (basePath || '/') : `${basePath}/${item.to}`)
  }

  // Sheet sluiten bij navigatie (bv. via terugknop) en scroll vastzetten zolang hij open is.
  useEffect(() => { setMoreOpen(false) }, [location.pathname])
  useBodyScrollLock(moreOpen)
  useEffect(() => {
    document.documentElement.classList.toggle('more-open', moreOpen)
    return () => document.documentElement.classList.remove('more-open')
  }, [moreOpen])

  // Signalen per item (zelfde semantiek als de sidebar).
  function badgeFor(to) {
    if (to === 'chat' && actions.chat > 0) return actions.chat > 9 ? '9+' : String(actions.chat)
    if (to === 'mijn-dossier' && actions.dossier > 0) return String(actions.dossier)
    if (to === 'members' && actions.leden > 0) return String(actions.leden)
    return null
  }
  function dotFor(to) {
    return (to === 'community' && unread.board) || (to === 'updates' && unread.updates) || (to === 'events' && unread.events)
  }
  const moreHasSignal = moreSections.some((s) => s.items.some((i) => badgeFor(i.to) || dotFor(i.to)))

  return (
    <>
      <nav className="bottom-nav" role="navigation" aria-label="Mobiele navigatie">
        {primary.map((item) => {
          const badge = badgeFor(item.to)
          return (
            <button
              key={item.to}
              type="button"
              onClick={() => go(item)}
              className={`bottom-nav-item ${isActive(item.to) ? 'bottom-nav-item--active' : ''}`}
              aria-current={isActive(item.to) ? 'page' : undefined}
            >
              <span className="bottom-nav-item__ic">
                <i className={item.icon} aria-hidden="true" />
                {badge && <span className="bottom-nav-badge">{badge}</span>}
                {!badge && dotFor(item.to) && <span className="bottom-nav-dot" aria-label="Nieuw" />}
              </span>
              <span>{item.shortLabel || item.label}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          className={`bottom-nav-item ${moreActive || moreOpen ? 'bottom-nav-item--active' : ''}`}
          aria-expanded={moreOpen}
          aria-controls="bottom-nav-more"
        >
          <span className="bottom-nav-item__ic">
            <i className="fa-solid fa-ellipsis" aria-hidden="true" />
            {moreHasSignal && !moreOpen && <span className="bottom-nav-dot" aria-label="Nieuw" />}
          </span>
          <span>Meer</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="bottom-more" onClick={() => setMoreOpen(false)}>
          <div id="bottom-nav-more" className="bottom-more__sheet" role="dialog" aria-label="Meer" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-more__grip" aria-hidden="true" />
            {moreSections.map((s, si) => (
              <div key={s.label || si} className="bottom-more__group">
                {s.label && <div className="bottom-more__label">{s.label}</div>}
                <div className="bottom-more__list">
                  {s.items.map((item) => {
                    const badge = badgeFor(item.to)
                    return (
                      <button key={item.to} type="button" className={`bottom-more__item ${isActive(item.to) ? 'bottom-more__item--active' : ''}`} onClick={() => go(item)}>
                        <span className="bottom-more__ic" style={{ '--nav-c': item.color, '--nav-bub-bg': `var(--nav-bub-${item.bubble}-bg)`, '--nav-bub-glyph': `var(--nav-bub-${item.bubble}-glyph)` }}>
                          <i className={item.icon} aria-hidden="true" />
                        </span>
                        <span className="bottom-more__txt">{item.label}</span>
                        {badge && <span className="bottom-more__badge">{badge}</span>}
                        {!badge && dotFor(item.to) && <span className="bottom-more__dot" aria-label="Nieuw" />}
                        <i className="fa-solid fa-chevron-right bottom-more__chev" aria-hidden="true" />
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            <div className="bottom-more__group">
              <div className="bottom-more__label">Jij</div>
              <div className="bottom-more__list">
                <button type="button" className={`bottom-more__item ${isActive(ACCOUNT_ITEM.to) ? 'bottom-more__item--active' : ''}`} onClick={() => go(ACCOUNT_ITEM)}>
                  <span className="bottom-more__ic" style={{ '--nav-c': ACCOUNT_ITEM.color, '--nav-bub-bg': 'var(--nav-bub-neutral-bg)', '--nav-bub-glyph': 'var(--nav-bub-neutral-glyph)' }}>
                    <i className={ACCOUNT_ITEM.icon} aria-hidden="true" />
                  </span>
                  <span className="bottom-more__txt">{ACCOUNT_ITEM.label}</span>
                  <i className="fa-solid fa-chevron-right bottom-more__chev" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
