import { useEffect, useRef, useState } from 'react'
import { GROUP_ICONS, GROUP_COLORS, parseGroupIcon, encodeGroupIcon, groupColorCss } from '../../lib/groupIcons'

/** Kiezer voor het groepsicoon: icoon uit de set + kleur uit het palet. */
export default function GroupIconPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const current = parseGroupIcon(value) || { icon: 'comments', color: 'blue' }

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="grp-emoji" ref={wrapRef}>
      <button
        type="button"
        className="grp-emoji__btn grp-icon__btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Kies een icoon en kleur"
        aria-expanded={open}
      >
        <i className={`fa-solid fa-${current.icon}`} style={{ color: groupColorCss(current.color) }} aria-hidden="true" />
      </button>
      {open && (
        <div className="grp-emoji__menu grp-icon__menu" role="dialog" aria-label="Icoon en kleur">
          <div className="grp-icon__grid">
            {GROUP_ICONS.map((it) => (
              <button
                type="button"
                key={it.key}
                className={it.key === current.icon ? 'on' : ''}
                onClick={() => onChange(encodeGroupIcon(it.key, current.color))}
                aria-label={it.label}
                aria-pressed={it.key === current.icon}
                title={it.label}
              >
                <i className={`fa-solid fa-${it.key}`} style={{ color: groupColorCss(current.color) }} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="grp-icon__colors" role="radiogroup" aria-label="Kleur">
            {GROUP_COLORS.map((c) => (
              <button
                type="button"
                key={c.key}
                role="radio"
                aria-checked={c.key === current.color}
                aria-label={c.label}
                title={c.label}
                className={`grp-icon__swatch ${c.key === current.color ? 'on' : ''}`}
                style={{ '--swatch': c.css }}
                onClick={() => onChange(encodeGroupIcon(current.icon, c.key))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
