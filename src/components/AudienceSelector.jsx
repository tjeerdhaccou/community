// Gedeelde audience-selector voor posts, updates en events.
// Twee niveaus, consistent met het rolmodel:
//   - public  : iedereen die toegang heeft tot het project (guest+)
//   - members : alleen aspirant-leden en leden
//
// Aspirant en lid hebben in de praktijk dezelfde toegang
// (verschil is offline: interview + betaling).

export default function AudienceSelector({ value, onChange, label = 'Zichtbaar voor' }) {
  return (
    <div className="form-group">
      <label style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block' }}>
        {label}
      </label>
      <div className="post-tag-select">
        <button
          type="button"
          className={`post-tag-option ${value === 'members' ? 'post-tag-option--active' : ''}`}
          onClick={() => onChange('members')}
        >
          <i className="fa-solid fa-user-check" /> Alleen leden
        </button>
        <button
          type="button"
          className={`post-tag-option ${value === 'public' ? 'post-tag-option--active' : ''}`}
          onClick={() => onChange('public')}
        >
          <i className="fa-solid fa-globe" /> Iedereen (ook gasten)
        </button>
      </div>
    </div>
  )
}
