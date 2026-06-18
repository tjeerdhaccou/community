import { useState } from 'react'
import { INTAKE_FIELDS, INTAKE_FIELD_GROUPS, getIntakeField } from '../lib/intakeFields'

const QUESTION_TYPES = [
  { value: 'text', label: 'Kort antwoord' },
  { value: 'textarea', label: 'Lang antwoord' },
  { value: 'select', label: 'Dropdown' },
  { value: 'radio', label: 'Keuzerondje' },
]

// Profielvelden die in het publieke formulier al apart gevraagd worden of niet
// als losse vraag passen.
const EXCLUDED_PROFILE_KEYS = new Set(['first_name', 'last_name', 'phone'])

// Catalogustype → opgeslagen question_type (moet binnen de CHECK-constraint van
// intake_questions vallen). De daadwerkelijke render gebeurt op basis van het
// catalogusveld zelf (via profile_field_key).
function catalogQuestionType(field) {
  if (field.type === 'select') return 'select'
  if (field.type === 'textarea') return 'textarea'
  return 'text'
}

export default function IntakeQuestionEditor({ questions, onAdd, onUpdate, onDelete, onReorder }) {
  // adding: null | 'custom' | 'profile'
  const [adding, setAdding] = useState(null)
  const [newText, setNewText] = useState('')
  const [newType, setNewType] = useState('text')
  const [newOptions, setNewOptions] = useState('')
  const [newRequired, setNewRequired] = useState(true)
  const [fieldKey, setFieldKey] = useState('')

  const usedProfileKeys = new Set(questions.map(q => q.profile_field_key).filter(Boolean))
  const availableProfileGroups = INTAKE_FIELD_GROUPS
    .map(group => ({
      group,
      fields: INTAKE_FIELDS.filter(f =>
        f.group === group &&
        f.target !== 'memberships' &&
        !EXCLUDED_PROFILE_KEYS.has(f.key) &&
        !usedProfileKeys.has(f.key)
      ),
    }))
    .filter(g => g.fields.length > 0)

  function resetForm() {
    setNewText('')
    setNewType('text')
    setNewOptions('')
    setNewRequired(true)
    setFieldKey('')
    setAdding(null)
  }

  function handleAddCustom() {
    if (!newText.trim()) return
    const options = (newType === 'select' || newType === 'radio')
      ? newOptions.split('\n').map(o => o.trim()).filter(Boolean)
      : null

    onAdd({
      question_text: newText.trim(),
      question_type: newType,
      options,
      required: newRequired,
    })
    resetForm()
  }

  function handleAddProfile() {
    const field = getIntakeField(fieldKey)
    if (!field) return
    onAdd({
      question_text: newText.trim() || field.label,
      question_type: catalogQuestionType(field),
      options: null,
      required: newRequired,
      profile_field_key: field.key,
    })
    resetForm()
  }

  function handleMoveUp(index) {
    if (index === 0) return
    const reordered = [...questions]
    ;[reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]]
    onReorder(reordered)
  }

  function handleMoveDown(index) {
    if (index === questions.length - 1) return
    const reordered = [...questions]
    ;[reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]]
    onReorder(reordered)
  }

  const selectedField = getIntakeField(fieldKey)

  return (
    <div className="intake-editor">
      {questions.length === 0 && !adding && (
        <p className="intake-editor__empty">
          Nog geen vragen toegevoegd. Voeg vragen toe die geïnteresseerden moeten beantwoorden.
        </p>
      )}

      <div className="intake-editor__list">
        {questions.map((q, i) => (
          <QuestionRow
            key={q.id}
            question={q}
            index={i}
            total={questions.length}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onMoveUp={() => handleMoveUp(i)}
            onMoveDown={() => handleMoveDown(i)}
          />
        ))}
      </div>

      {adding === 'custom' && (
        <div className="intake-editor__add-form">
          <div className="form-group">
            <label>Vraag</label>
            <input
              type="text"
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder="bijv. Wat is je woondroom?"
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group form-group--half">
              <label>Type</label>
              <select value={newType} onChange={e => setNewType(e.target.value)}>
                {QUESTION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group form-group--half">
              <label className="intake-editor__checkbox-label">
                <input
                  type="checkbox"
                  checked={newRequired}
                  onChange={e => setNewRequired(e.target.checked)}
                />
                Verplicht
              </label>
            </div>
          </div>

          {(newType === 'select' || newType === 'radio') && (
            <div className="form-group">
              <label>Opties (één per regel)</label>
              <textarea
                value={newOptions}
                onChange={e => setNewOptions(e.target.value)}
                placeholder={'Optie 1\nOptie 2\nOptie 3'}
                rows={3}
              />
            </div>
          )}

          <div className="intake-editor__add-actions">
            <button className="btn-secondary btn-sm" onClick={resetForm}>Annuleren</button>
            <button className="btn-primary btn-sm" onClick={handleAddCustom} disabled={!newText.trim()}>Toevoegen</button>
          </div>
        </div>
      )}

      {adding === 'profile' && (
        <div className="intake-editor__add-form">
          <div className="form-group">
            <label>Profielveld</label>
            <select value={fieldKey} onChange={e => { setFieldKey(e.target.value); setNewText('') }} autoFocus>
              <option value="">Kies een profielveld…</option>
              {availableProfileGroups.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </optgroup>
              ))}
            </select>
            {selectedField?.help && <p className="form-hint">{selectedField.help}</p>}
          </div>

          {selectedField && (
            <div className="form-row">
              <div className="form-group form-group--half">
                <label>Vraagtekst (optioneel)</label>
                <input
                  type="text"
                  value={newText}
                  onChange={e => setNewText(e.target.value)}
                  placeholder={selectedField.label}
                />
              </div>
              <div className="form-group form-group--half">
                <label className="intake-editor__checkbox-label">
                  <input
                    type="checkbox"
                    checked={newRequired}
                    onChange={e => setNewRequired(e.target.checked)}
                  />
                  Verplicht
                </label>
              </div>
            </div>
          )}

          <div className="intake-editor__add-actions">
            <button className="btn-secondary btn-sm" onClick={resetForm}>Annuleren</button>
            <button className="btn-primary btn-sm" onClick={handleAddProfile} disabled={!fieldKey}>Toevoegen</button>
          </div>
        </div>
      )}

      {!adding && (
        <div className="intake-editor__add-actions">
          <button className="btn-secondary intake-editor__add-btn" onClick={() => setAdding('profile')}>
            <i className="fa-solid fa-id-card" /> Profielveld toevoegen
          </button>
          <button className="btn-secondary intake-editor__add-btn" onClick={() => setAdding('custom')}>
            <i className="fa-solid fa-plus" /> Eigen vraag toevoegen
          </button>
        </div>
      )}
    </div>
  )
}

function QuestionRow({ question, index, total, onUpdate, onDelete, onMoveUp, onMoveDown }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(question.question_text)

  function handleSave() {
    onUpdate(question.id, { question_text: text.trim() })
    setEditing(false)
  }

  const isProfileField = !!question.profile_field_key
  const typeLabel = QUESTION_TYPES.find(t => t.value === question.question_type)?.label || question.question_type

  return (
    <div className="intake-editor__row">
      <div className="intake-editor__row-order">
        <button
          className="intake-editor__order-btn"
          onClick={onMoveUp}
          disabled={index === 0}
          title="Omhoog"
        >
          <i className="fa-solid fa-chevron-up" />
        </button>
        <button
          className="intake-editor__order-btn"
          onClick={onMoveDown}
          disabled={index === total - 1}
          title="Omlaag"
        >
          <i className="fa-solid fa-chevron-down" />
        </button>
      </div>

      <div className="intake-editor__row-content">
        {editing ? (
          <div className="intake-editor__row-edit">
            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <div className="intake-editor__row-edit-actions">
              <button className="btn-secondary btn-sm" onClick={() => { setText(question.question_text); setEditing(false) }}>Annuleren</button>
              <button className="btn-primary btn-sm" onClick={handleSave}>Opslaan</button>
            </div>
          </div>
        ) : (
          <>
            <span className="intake-editor__row-text">{question.question_text}</span>
            <span className="intake-editor__row-meta">
              {isProfileField ? <><i className="fa-solid fa-id-card" /> Profielveld</> : typeLabel}
              {question.required && ' · Verplicht'}
              {!question.active && ' · Inactief'}
            </span>
          </>
        )}
      </div>

      <div className="intake-editor__row-actions">
        <button className="intake-editor__action-btn" onClick={() => setEditing(!editing)} title="Bewerken" aria-label="Bewerken">
          <i className="fa-solid fa-pen" />
        </button>
        <button
          className="intake-editor__action-btn"
          onClick={() => onUpdate(question.id, { active: !question.active })}
          title={question.active ? 'Deactiveren' : 'Activeren'}
        >
          <i className={`fa-solid ${question.active ? 'fa-eye' : 'fa-eye-slash'}`} />
        </button>
        <button className="intake-editor__action-btn intake-editor__action-btn--danger" onClick={() => onDelete(question.id)} title="Verwijderen" aria-label="Verwijderen">
          <i className="fa-solid fa-trash" />
        </button>
      </div>
    </div>
  )
}
