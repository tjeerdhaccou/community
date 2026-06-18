// Gedeelde renderer voor profielvelden uit de catalogus (src/lib/intakeFields.js).
// Gebruikt door zowel het profiel-intakeformulier (ProfileIntake) als de
// zelf-bewerk profielpagina (Profile), zodat de velden, dropdowns en helptekst
// overal identiek zijn en automatisch met het CMS overeenkomen.

export function CatalogFieldHelp({ field }) {
  if (!field.help) return null
  return <p className="form-hint">{field.help}</p>
}

// Eén catalogusveld. onChange(key, value) — value heeft het juiste type
// (string voor text/select/date, number voor number, boolean voor boolean,
// array voor housing_top3).
export function CatalogFieldInput({ field, value, onChange }) {
  const id = `catalog-${field.key}`

  if (field.type === 'housing_top3') {
    const arr = Array.isArray(value) ? value : ['', '', '']
    return (
      <div className="form-group">
        <label>{field.label}</label>
        <CatalogFieldHelp field={field} />
        <div className="intake-fill__top3">
          {[0, 1, 2].map(i => (
            <div key={i} className="intake-fill__top3-row">
              <span className="intake-fill__top3-rank">{i + 1}</span>
              <input
                type="text"
                value={arr[i] || ''}
                onChange={e => {
                  const next = [...arr]
                  next[i] = e.target.value
                  onChange(field.key, next)
                }}
                placeholder={`Voorkeur ${i + 1}`}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <div className="form-group">
        <label htmlFor={id}>{field.label}</label>
        <CatalogFieldHelp field={field} />
        <textarea id={id} value={value || ''} onChange={e => onChange(field.key, e.target.value)} rows={3} />
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <div className="form-group">
        <label htmlFor={id}>{field.label}</label>
        <CatalogFieldHelp field={field} />
        <select id={id} value={value || ''} onChange={e => onChange(field.key, e.target.value)}>
          <option value="">Kies…</option>
          {field.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>
    )
  }

  if (field.type === 'boolean') {
    return (
      <div className="form-group intake-fill__checkbox">
        <label htmlFor={id}>
          <input id={id} type="checkbox" checked={!!value} onChange={e => onChange(field.key, e.target.checked)} />
          {field.label}
        </label>
        <CatalogFieldHelp field={field} />
      </div>
    )
  }

  return (
    <div className="form-group">
      <label htmlFor={id}>{field.label}</label>
      <CatalogFieldHelp field={field} />
      <input
        id={id}
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        value={value ?? ''}
        onChange={e => onChange(field.key, field.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
      />
    </div>
  )
}
