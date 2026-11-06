import { useState, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useProject } from '../contexts/ProjectContext'
import { useAuth } from '../contexts/AuthContext'
import { uploadFile } from '../lib/storage'
import { logger, friendlyError } from '../lib/logger'
import { FORM_HELP, decisionError } from '../lib/decisions'
import { useToast } from './Toast'

function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function defaultDeadline(days) {
  const d = new Date(Date.now() + days * 86_400_000)
  d.setHours(20, 0, 0, 0)
  return toLocalInput(d)
}

/**
 * Voorstel opstellen of een concept bewerken, namens een commissie of het
 * bestuur. Velden in de leesvolgorde van het voorstel. "Publiceren" slaat op
 * en roept publish_proposal aan; de database controleert alle regels.
 *
 * props: proposal? (concept), groups (waarnamens je mag inbrengen), rules,
 *        attachments?, onClose, onSaved(id, published)
 */
export default function ProposalModal({ proposal, groups, rules, attachments: initialAttachments = [], onClose, onSaved }) {
  const { project } = useProject()
  const { user } = useAuth()
  const toast = useToast()
  const fileRef = useRef(null)
  const mouseDownOnOverlay = useRef(false)

  const [id, setId] = useState(proposal?.id || null)
  const [form, setForm] = useState(proposal?.form || rules?.default_form || 'consent')
  const [workgroupId, setWorkgroupId] = useState(proposal?.workgroup_id || groups[0]?.id || '')
  const [title, setTitle] = useState(proposal?.title || '')
  const [summary, setSummary] = useState(proposal?.summary || '')
  const [impact, setImpact] = useState(proposal?.member_impact || '')
  const [figures, setFigures] = useState(proposal?.key_figures?.length ? proposal.key_figures : [])
  const [body, setBody] = useState(proposal?.body || '')
  const [category, setCategory] = useState(proposal?.category || '')
  const [isHeavy, setIsHeavy] = useState(!!proposal?.is_heavy)
  const [deadline, setDeadline] = useState(
    proposal?.deadline ? toLocalInput(new Date(proposal.deadline)) : defaultDeadline(rules?.default_duration_days || 7),
  )
  const [attachments, setAttachments] = useState(initialAttachments)
  const [busy, setBusy] = useState(null) // 'save' | 'publish' | 'upload'
  const [error, setError] = useState(null)
  const [confirmPublish, setConfirmPublish] = useState(false)

  const heavyCategories = useMemo(() => rules?.heavy_categories || [], [rules])
  const matchedHeavy = useMemo(
    () => heavyCategories.find(c => c.toLowerCase() === category.trim().toLowerCase()) || null,
    [heavyCategories, category],
  )

  function validate(forPublish) {
    if (!workgroupId) return 'Kies namens welke commissie of welk bestuur je dit voorstel inbrengt.'
    if (title.trim().length < 3) return 'Geef het voorstel een titel.'
    if (!summary.trim()) return 'Vul "In het kort" in: twee of drie zinnen die iedereen als eerste leest.'
    if (forPublish) {
      if (!impact.trim()) return 'Vul in wat dit voorstel betekent voor de leden.'
      if (!deadline || new Date(deadline).getTime() < Date.now() + 3_600_000) return 'De deadline moet minstens een uur in de toekomst liggen.'
    }
    return null
  }

  async function save() {
    const row = {
      form,
      workgroup_id: workgroupId,
      title: title.trim(),
      summary: summary.trim(),
      member_impact: impact.trim() || null,
      key_figures: figures.filter(f => f.label.trim() && f.value.trim()),
      body: body.trim() || null,
      category: matchedHeavy || category.trim() || null,
      is_heavy: form === 'vote' && (isHeavy || !!matchedHeavy),
      deadline: deadline ? new Date(deadline).toISOString() : null,
    }
    if (id) {
      const { error: err } = await supabase.from('proposals').update(row).eq('id', id)
      if (err) { logger.error('ProposalModal.update', err); throw new Error(decisionError(err, friendlyError)) }
      return id
    }
    const { data, error: err } = await supabase
      .from('proposals')
      .insert({ ...row, project_id: project.id, created_by: user.id })
      .select('id')
      .single()
    if (err) { logger.error('ProposalModal.insert', err); throw new Error(decisionError(err, friendlyError)) }
    setId(data.id)
    return data.id
  }

  async function handleSave() {
    const v = validate(false)
    if (v) return setError(v)
    setBusy('save'); setError(null)
    try {
      const savedId = await save()
      toast.success('Concept opgeslagen')
      onSaved?.(savedId, false)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  async function handlePublish() {
    setConfirmPublish(false)
    const v = validate(true)
    if (v) return setError(v)
    setBusy('publish'); setError(null)
    try {
      const savedId = await save()
      const { error: err } = await supabase.rpc('publish_proposal', {
        p_proposal_id: savedId, p_deadline: new Date(deadline).toISOString(),
      })
      if (err) { logger.error('ProposalModal.publish', err); throw new Error(decisionError(err, friendlyError)) }
      toast.success('Voorstel gepubliceerd. De leden krijgen een melding.')
      onSaved?.(savedId, true)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setError(null)
    let proposalId = id
    try {
      if (!proposalId) {
        const v = validate(false)
        if (v) throw new Error(`Vul eerst de basis in om bijlagen toe te voegen. ${v}`)
        proposalId = await save()
      }
      setBusy('upload')
      for (const file of files) {
        const { path } = await uploadFile(file, 'project-files', `proposals/${project.id}/${proposalId}`)
        const { data, error: err } = await supabase
          .from('proposal_attachments')
          .insert({ proposal_id: proposalId, file_name: file.name, file_path: path, file_size: file.size, file_type: file.type })
          .select('id, file_name, file_path, file_size, file_type')
          .single()
        if (err) throw new Error(friendlyError(err))
        setAttachments(prev => [...prev, data])
      }
    } catch (err) {
      setError(err.message || friendlyError(err))
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removeAttachment(a) {
    const { error: err } = await supabase.from('proposal_attachments').delete().eq('id', a.id)
    if (err) return setError(friendlyError(err))
    if (a.file_path.includes(`/${id}/`)) await supabase.storage.from('project-files').remove([a.file_path])
    setAttachments(prev => prev.filter(x => x.id !== a.id))
  }

  const deadlineText = deadline
    ? new Date(deadline).toLocaleString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div
      className="modal-overlay"
      onMouseDown={e => { mouseDownOnOverlay.current = e.target === e.currentTarget }}
      onClick={e => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-card proposal-modal">
        <div className="modal-header">
          <h2>{proposal ? (proposal.version > 1 ? `Versie ${proposal.version} bewerken` : 'Concept bewerken') : 'Nieuw voorstel'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Sluiten">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="modal-form">
          <div className="form-row">
            <div className="form-group form-group--half">
              <label>Besluitvorm</label>
              <select value={form} onChange={e => setForm(e.target.value)}>
                <option value="consent">Consent</option>
                <option value="vote">Stemming</option>
              </select>
            </div>
            <div className="form-group form-group--half">
              <label>Namens</label>
              <select value={workgroupId} onChange={e => setWorkgroupId(e.target.value)}>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}{g.is_board ? ' (bestuur)' : ''}</option>)}
              </select>
            </div>
          </div>
          <p className="form-hint">{FORM_HELP[form]} Je naam staat erbij als indiener.</p>

          <div className="form-group">
            <label>Titel</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} placeholder="Bijv. Keuze aannemer voor de ruwbouw" />
          </div>

          <div className="form-group">
            <label>In het kort</label>
            <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3} placeholder="Twee of drie zinnen. Dit leest iedereen als eerste." />
          </div>

          <div className="form-group">
            <label>Wat betekent dit voor de leden</label>
            <textarea value={impact} onChange={e => setImpact(e.target.value)} rows={3} placeholder="Wat verandert er concreet voor een huishouden?" />
          </div>

          <div className="form-group">
            <label>Kerncijfers <span className="form-optional">optioneel</span></label>
            {figures.map((f, i) => (
              <div key={i} className="proposal-figure-row">
                <input type="text" value={f.label} placeholder="Kosten per huishouden"
                  onChange={e => setFigures(figures.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                <input type="text" value={f.value} placeholder="€ 1.250" className="proposal-figure-row__value"
                  onChange={e => setFigures(figures.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
                <button type="button" className="btn-icon" aria-label="Verwijderen" onClick={() => setFigures(figures.filter((_, j) => j !== i))}>
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            ))}
            {figures.length < 6 && (
              <button type="button" className="btn-secondary btn-sm" onClick={() => setFigures([...figures, { label: '', value: '' }])}>
                <i className="fa-solid fa-plus" /> Kerncijfer
              </button>
            )}
          </div>

          <div className="form-group">
            <label>Toelichting <span className="form-optional">optioneel, staat standaard ingeklapt</span></label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} />
          </div>

          <div className="form-group">
            <label>Bijlagen</label>
            {attachments.length > 0 && (
              <ul className="proposal-attachments proposal-attachments--edit">
                {attachments.map(a => (
                  <li key={a.id}>
                    <i className="fa-solid fa-paperclip" />
                    <span>{a.file_name}</span>
                    <button type="button" className="btn-icon" aria-label="Verwijderen" onClick={() => removeAttachment(a)}>
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input ref={fileRef} type="file" multiple hidden onChange={handleFiles} />
            <button type="button" className="btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={busy === 'upload'}>
              <i className={busy === 'upload' ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-paperclip'} /> Bijlage toevoegen
            </button>
          </div>

          <div className="form-row">
            <div className="form-group form-group--half">
              <label>Deadline</label>
              <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
            <div className="form-group form-group--half">
              <label>Categorie <span className="form-optional">optioneel</span></label>
              <input type="text" value={category} onChange={e => setCategory(e.target.value)} list="proposal-heavy-categories" />
              <datalist id="proposal-heavy-categories">
                {heavyCategories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          {form === 'vote' && (
            <label className="proposal-heavy-toggle">
              <input type="checkbox" checked={isHeavy || !!matchedHeavy} disabled={!!matchedHeavy} onChange={e => setIsHeavy(e.target.checked)} />
              <span>
                Zwaar besluit
                <small>
                  {matchedHeavy
                    ? 'Deze categorie is volgens de besluitregels altijd zwaar.'
                    : `Vereist ten minste ${rules?.majority_heavy_num ?? 2}/${rules?.majority_heavy_den ?? 3} voor.`}
                </small>
              </span>
            </label>
          )}

          {error && <p className="proposal-error">{error}</p>}

          <div className="modal-actions">
          <button className="btn-secondary" onClick={handleSave} disabled={!!busy}>
            {busy === 'save' && <i className="fa-solid fa-spinner fa-spin" />} Opslaan als concept
          </button>
          <button className="btn-primary" onClick={() => { const v = validate(true); if (v) setError(v); else setConfirmPublish(true) }} disabled={!!busy}>
            {busy === 'publish' ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-paper-plane" />} Publiceren
          </button>
          </div>
        </div>

        {confirmPublish && (
          <div className="proposal-confirm">
            <p>
              <strong>Publiceren?</strong> Alle stemgerechtigden krijgen een melding en kunnen reageren tot {deadlineText}.
              Daarna kun je het voorstel niet meer bewerken.
            </p>
            <div className="confirm-actions">
              <button className="btn-secondary" onClick={() => setConfirmPublish(false)}>Annuleren</button>
              <button className="btn-primary" onClick={handlePublish}>Publiceren</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
