// Gedeelde audience-selector voor posts, updates en events.
// Twee niveaus, consistent met het rolmodel:
//   - public    : iedereen die toegang heeft tot het project (guest+)
//   - members   : alleen aspirant-leden en leden
//   - workgroup  : alleen leden van een specifieke werkgroep
//
// Aspirant en lid hebben in de praktijk dezelfde toegang
// (verschil is offline: interview + betaling).
//
// De 'workgroup'-optie verschijnt alleen wanneer `workgroups` wordt
// meegegeven (alleen voor prikbord-posts). Updates en events blijven
// project-breed en krijgen die optie niet.

export default function AudienceSelector({
  value,
  onChange,
  workgroups = [],
  workgroupId = null,
  onWorkgroupChange,
  label = 'Zichtbaar voor',
}) {
  const hasWorkgroups = workgroups.length > 0

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
          <i className="fa-solid fa-globe" /> Iedereen
        </button>
        {hasWorkgroups && (
          <button
            type="button"
            className={`post-tag-option ${value === 'workgroup' ? 'post-tag-option--active' : ''}`}
            onClick={() => onChange('workgroup')}
          >
            <i className="fa-solid fa-users" /> Groep
          </button>
        )}
      </div>

      {/* Groepkeuze — alleen tonen als 'Groep' actief is */}
      {hasWorkgroups && value === 'workgroup' && (
        <div className="post-tag-select" style={{ marginTop: '8px' }}>
          {workgroups.map(wg => (
            <button
              key={wg.id}
              type="button"
              className={`post-tag-option ${workgroupId === wg.id ? 'post-tag-option--active' : ''}`}
              onClick={() => onWorkgroupChange?.(wg.id)}
            >
              {wg.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
