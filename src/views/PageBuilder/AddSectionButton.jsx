import { useState } from 'react'
import { SECTION_TYPES } from './constants'

/* --- Add Section Button --- */
export default function AddSectionButton({ onAdd }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="pb-add-section">
      {open ? (
        <div className="pb-add-section__menu">
          {SECTION_TYPES.map(t => (
            <button key={t.value} type="button" className="pb-add-section__option" onClick={() => { onAdd(t.value); setOpen(false) }}>
              <i className={t.icon} />
              <span>{t.label}</span>
            </button>
          ))}
          <button type="button" className="pb-add-section__cancel" onClick={() => setOpen(false)}>Annuleren</button>
        </div>
      ) : (
        <button type="button" className="page-builder__add-btn" onClick={() => setOpen(true)}>
          <i className="fa-solid fa-plus" /> Sectie toevoegen
        </button>
      )}
    </div>
  )
}
