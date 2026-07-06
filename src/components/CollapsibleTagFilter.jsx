import { useState, useRef, useEffect } from 'react'

// Filterrij die op één regel begint en bij overflow een Meer/Minder-knop toont
// in plaats van een horizontale scrollbar. Gedeeld door Documenten en Leden.
export default function CollapsibleTagFilter({ children }) {
  const ref = useRef(null)
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [children])

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
