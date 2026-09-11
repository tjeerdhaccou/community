import { useState, useRef, useEffect } from 'react'
import { isNarrowScreen } from '../lib/scrollLock'

// Filterrij, gedeeld door Prikbord, Nieuws, Events, Documenten en Leden.
//   Desktop: begint op één regel en toont bij overflow een Meer/Minder-knop.
//   Mobiel:  één horizontaal scrollende rij chips (zoals Instagram/YouTube),
//            zonder Meer-knop; de actieve chip scrolt vanzelf in beeld.
export default function CollapsibleTagFilter({ children }) {
  const ref = useRef(null)
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const [scrollMode, setScrollMode] = useState(() => isNarrowScreen())

  // Schakelen tussen de twee modi bij draaien/resizen.
  useEffect(() => {
    const mq = window.matchMedia?.('(max-width: 768px)')
    if (!mq) return
    const onChange = (e) => setScrollMode(e.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || scrollMode) { setOverflowing(false); return }
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [children, scrollMode])

  // Mobiel: actieve chip in beeld houden (bv. na kiezen aan de rechterrand).
  useEffect(() => {
    if (!scrollMode || !ref.current) return
    const active = ref.current.querySelector('.tag-filter__pill--active')
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [children, scrollMode])

  if (scrollMode) {
    return (
      <div className="tag-filter-wrap tag-filter-wrap--scroll">
        <div ref={ref} className="tag-filter tag-filter--scroll" role="tablist">
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className="tag-filter-wrap">
      <div
        ref={ref}
        className={`tag-filter ${expanded ? 'tag-filter--expanded' : 'tag-filter--collapsed'}`}
      >
        {children}
      </div>
      {(overflowing || expanded) && (
        <button
          type="button"
          className="tag-filter__toggle"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? 'Minder' : 'Meer'}
          <i className={`fa-solid ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'}`} />
        </button>
      )}
    </div>
  )
}
