import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useProject } from '../contexts/ProjectContext'
import { useAuth } from '../contexts/AuthContext'
import { useProposal } from '../hooks/useProposal'
import { useProposals } from '../hooks/useProposals'
import { useWorkgroups } from '../hooks/useWorkgroups'
import { canDo } from '../lib/permissions'
import { promptDemoSignup } from '../lib/demo'
import { openProjectFile } from '../lib/storage'
import { formatFileSize, fileIcon, fileIconColor } from '../lib/constants'
import {
  CHOICES, CHOICE_LABEL, FORM_HELP, FORM_LABEL, formatDateTime, formatDeadline, submitGroupsFor, timeLeft,
} from '../lib/decisions'
import { StatusTag } from './Besluiten'
import ProposalModal from '../components/ProposalModal'
import ConfirmModal from '../components/ConfirmModal'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'

/**
 * Eén voorstel, in leesvolgorde: titel → in het kort → wat betekent dit voor
 * de leden → toelichting (ingeklapt) → bijlagen → reageren → tussenstand →
 * vragenronde. Beheeracties (indienende groep + moderators) rechtsboven.
 */
export default function BesluitDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { basePath, role, readOnly } = useProject()
  const { user } = useAuth()
  const toast = useToast()
  const d = useProposal(id)
  const { rules } = useProposals()
  const { allWorkgroups, myWorkgroupIds } = useWorkgroups()
  const [editing, setEditing] = useState(false)
  const [dialog, setDialog] = useState(null) // { kind: 'extend' | 'withdraw' | 'overrule', unitId? }
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pendingUnits, setPendingUnits] = useState(null)

  const { proposal: p, tally } = d
  const back = () => navigate(`${basePath}/besluiten`)

  if (d.loading) return <Skeleton.Page rows={5} />
  if (d.notFound || !p) {
    return (
      <div className="view-besluiten">
        <button className="besluit-back" onClick={back}><i className="fa-solid fa-arrow-left" /> Besluiten</button>
        <div className="empty-inline"><i className="fa-solid fa-circle-question" /><p>Dit voorstel bestaat niet of je hebt er geen toegang toe.</p></div>
      </div>
    )
  }

  const isModerator = canDo(role, 'moderate_board')
  const isManager = tally?.is_manager ?? (isModerator || myWorkgroupIds.has(p.workgroup_id) || p.created_by === user?.id)
  const groupName = p.workgroup?.name || 'de commissie'
  const isOpen = !!tally?.is_open
  const submitGroups = submitGroupsFor(allWorkgroups, myWorkgroupIds, isModerator)
  const canAsk = p.status === 'published' && canDo(role, 'view_internal_updates') && !readOnly
  const topQuestions = d.questions.filter(q => !q.parent_id)
  const answersFor = (qid) => d.questions.filter(q => q.parent_id === qid)
  const allowOverrule = !!p.rules_snapshot?.allow_overrule_objection && (p.status === 'published' || p.status === 'amended')
  const canNewVersion = isManager && ['amended', 'no_quorum', 'withdrawn'].includes(p.status) && !d.nextVersion

  async function guarded(fn, success) {
    if (readOnly) return promptDemoSignup()
    try {
      await fn()
      if (success) toast.success(success)
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function deleteDraft() {
    setConfirmDelete(false)
    const { error } = await supabase.from('proposals').delete().eq('id', p.id)
    if (error) return toast.error('Verwijderen mislukt')
    toast.success('Concept verwijderd')
    back()
  }

  return (
    <div className="view-besluiten besluit-detail">
      <button className="besluit-back" onClick={back}><i className="fa-solid fa-arrow-left" /> Besluiten</button>

      {/* Beheeracties: rechtsboven, 32×32 iconknoppen */}
      {isManager && (
        <div className="besluit-actions">
          {p.status === 'draft' && (
            <>
              <button onClick={() => setEditing(true)} title="Bewerken en publiceren" aria-label="Bewerken"><i className="fa-solid fa-pen" /></button>
              <button onClick={() => setConfirmDelete(true)} title="Concept verwijderen" aria-label="Concept verwijderen" className="besluit-actions__danger"><i className="fa-solid fa-trash" /></button>
            </>
          )}
          {isOpen && !p.deadline_extended_at && (
            <button onClick={() => setDialog({ kind: 'extend' })} title="Deadline verlengen" aria-label="Deadline verlengen"><i className="fa-solid fa-calendar-plus" /></button>
          )}
          {isOpen && (
            <button onClick={() => setDialog({ kind: 'withdraw' })} title="Intrekken" aria-label="Intrekken" className="besluit-actions__danger"><i className="fa-solid fa-rotate-left" /></button>
          )}
          {canNewVersion && (
            <button
              onClick={() => guarded(async () => { const n = await d.newVersion(); navigate(`${basePath}/besluiten/${n.id}`) }, 'Nieuwe versie aangemaakt als concept')}
              title="Nieuwe versie maken" aria-label="Nieuwe versie maken"
            ><i className="fa-solid fa-code-branch" /></button>
          )}
        </div>
      )}

      <header className="besluit-head">
        <div className="besluit-head__tags">
          <StatusTag status={p.status} />
          <span className="besluiten-muted">
            {FORM_LABEL[p.form]}
            {p.is_heavy && ' · zwaar besluit'}
            {p.version > 1 && ` · versie ${p.version}`}
            {p.form === 'vote' && p.rules_snapshot?.formal_online_decisions === false && ' · voorbereidend'}
          </span>
        </div>
        <h1>{p.title}</h1>
        <p className="besluiten-muted">
          Namens {groupName}{p.author?.full_name ? `, ingediend door ${p.author.full_name}` : ''}
        </p>
        {p.status === 'draft' && (
          <p className="besluit-note">
            <i className="fa-solid fa-eye-slash" /> Concept: alleen zichtbaar voor {groupName} en beheerders.
            {isManager && <button className="btn-primary btn-sm" onClick={() => setEditing(true)}>Bewerken en publiceren</button>}
          </p>
        )}
      </header>

      {/* Uitkomst of looptijd */}
      {p.outcome && (
        <div className={`besluit-outcome besluit-outcome--${p.status}`}>
          <strong>{p.outcome.summary}</strong>
          {p.outcome.preparatory && <span>De ALV neemt het formele besluit.</span>}
        </div>
      )}
      {p.status === 'withdrawn' && (
        <div className="besluit-outcome besluit-outcome--withdrawn">
          <strong>Ingetrokken door {groupName}</strong>
          <span>{p.withdrawn_reason}</span>
        </div>
      )}
      {(d.nextVersion || p.previous_version_id) && (
        <p className="besluit-versions">
          {p.previous_version_id && <button className="link-btn" onClick={() => navigate(`${basePath}/besluiten/${p.previous_version_id}`)}>Vorige versie</button>}
          {d.nextVersion && d.nextVersion.status !== 'draft' && (
            <button className="link-btn" onClick={() => navigate(`${basePath}/besluiten/${d.nextVersion.id}`)}>
              Er is een nieuwe versie (versie {d.nextVersion.version}) <i className="fa-solid fa-arrow-right" />
            </button>
          )}
        </p>
      )}

      <section className="besluit-section">
        <h2>In het kort</h2>
        <p className="besluit-lead">{p.summary}</p>
      </section>

      {p.member_impact && (
        <section className="besluit-section">
          <h2>Wat betekent dit voor de leden</h2>
          <p className="besluit-text">{p.member_impact}</p>
          {p.key_figures?.length > 0 && (
            <div className="besluit-figures">
              {p.key_figures.map((k, i) => (
                <div key={i} className="besluit-figure">
                  <span className="besluit-figure__value">{k.value}</span>
                  <span className="besluit-figure__label">{k.label}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {p.body && (
        <details className="besluit-section besluit-more">
          <summary>Toelichting</summary>
          <p className="besluit-text">{p.body}</p>
        </details>
      )}

      {d.attachments.length > 0 && (
        <section className="besluit-section">
          <h2>Bijlagen</h2>
          <ul className="proposal-attachments">
            {d.attachments.map(a => (
              <li key={a.id}>
                <button className="proposal-attachment" onClick={() => openProjectFile(a.file_path)}>
                  <i className={fileIcon(a.file_type)} style={{ color: fileIconColor(a.file_type) }} />
                  <span>{a.file_name}</span>
                  {a.file_size ? <span className="besluiten-muted">{formatFileSize(a.file_size)}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Reageren */}
      {p.status === 'published' && (
        <ResponsePanel
          proposal={p}
          tally={tally}
          readOnly={readOnly}
          onRespond={(choice, motivation) => guarded(() => d.respond(choice, motivation), 'Je reactie is opgeslagen')}
        />
      )}

      {/* Tussenstand / uitslag */}
      {p.status !== 'draft' && tally && <TallyPanel tally={tally} proposal={p} />}

      {/* Bezwaren (consent) */}
      {p.form === 'consent' && d.objections.length > 0 && (
        <section className="besluit-section">
          <h2>Bezwaren ({d.objections.length})</h2>
          <ul className="besluit-objections">
            {d.objections.map(o => (
              <li key={o.unit_id} className={o.overruled ? 'is-overruled' : ''}>
                <div className="besluit-objections__head">
                  <strong>{o.label || 'Een lid'}</strong>
                  {o.overruled && <span className="besluiten-tag" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>gepasseerd</span>}
                  {!o.overruled && isManager && allowOverrule && (
                    <button className="btn-secondary btn-sm" onClick={() => setDialog({ kind: 'overrule', unitId: o.unit_id, label: o.label })}>Passeren</button>
                  )}
                </div>
                <p>{o.motivation}</p>
                {o.overruled && o.overrule_reason && <p className="besluit-objections__reason">Niet overwegend: {o.overrule_reason}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Wie nog niet reageerde — alleen voor de indienende groep en moderators */}
      {isManager && p.status === 'published' && (
        <section className="besluit-section">
          <h2>Nog niet gereageerd</h2>
          {pendingUnits === null ? (
            <button className="btn-secondary btn-sm" onClick={async () => setPendingUnits(await d.loadPendingUnits())}>
              <i className="fa-solid fa-phone" /> Toon wie nog niet reageerde
            </button>
          ) : pendingUnits.length === 0 ? (
            <p className="besluiten-muted">Iedereen heeft gereageerd.</p>
          ) : (
            <ul className="besluit-pending">
              {pendingUnits.map(u => (
                <li key={u.unit_id}>
                  <strong>{u.unit_label}</strong>
                  {(u.members || []).map(m => (
                    <span key={m.id} className="besluiten-muted">
                      {u.unit_type === 'household' && `${m.full_name} `}
                      {m.phone && <a href={`tel:${m.phone}`}><i className="fa-solid fa-phone" /> {m.phone}</a>}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Vragenronde */}
      {p.status !== 'draft' && (
        <QuestionRound
          questions={topQuestions}
          answersFor={answersFor}
          groupName={groupName}
          canAsk={canAsk}
          canAnswer={isManager && p.status === 'published'}
          userId={user?.id}
          onAsk={(body) => guarded(() => d.askQuestion(body), 'Je vraag is gesteld. De commissie krijgt een melding.')}
          onAnswer={(qid, body) => guarded(() => d.answerQuestion(qid, body), 'Antwoord geplaatst')}
          onDelete={(qid) => guarded(() => d.deleteQuestion(qid))}
        />
      )}

      {editing && (
        <ProposalModal
          proposal={p}
          groups={submitGroups.length ? submitGroups : (p.workgroup ? [p.workgroup] : [])}
          rules={rules}
          attachments={d.attachments}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); d.refresh() }}
        />
      )}

      {dialog && (
        <ReasonDialog
          dialog={dialog}
          deadline={p.deadline}
          onCancel={() => setDialog(null)}
          onSubmit={async (text, newDeadline) => {
            const kind = dialog.kind
            setDialog(null)
            if (kind === 'extend') await guarded(() => d.extend(new Date(newDeadline).toISOString(), text), 'Deadline verlengd')
            if (kind === 'withdraw') await guarded(() => d.withdraw(text), 'Voorstel ingetrokken')
            if (kind === 'overrule') await guarded(() => d.overrule(dialog.unitId, text), 'Bezwaar gepasseerd')
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          message="Dit concept en de bijlagen worden verwijderd. Dit kan niet ongedaan worden gemaakt."
          confirmLabel="Verwijderen"
          danger
          onConfirm={deleteDraft}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}

function ResponsePanel({ proposal: p, tally, readOnly, onRespond }) {
  const my = tally?.my_unit
  const [choice, setChoice] = useState(null)
  const [motivation, setMotivation] = useState(() => my?.motivation || '')
  const [saving, setSaving] = useState(false)
  const options = CHOICES[p.form] || []
  const selected = choice ?? my?.choice ?? null
  const needsMotivation = selected === 'objection'
  const changed = selected && (selected !== my?.choice || (needsMotivation && motivation.trim() !== (my?.motivation || '')))

  // In de demo laten we de knoppen zien (klik → "maak een account").
  if (!tally?.can_respond && !my && !readOnly) {
    return (
      <section className="besluit-respond besluit-respond--muted">
        <p><i className="fa-solid fa-circle-info" /> Je bent niet stemgerechtigd voor dit voorstel. Je kunt wel meelezen en vragen stellen.</p>
      </section>
    )
  }

  async function submit() {
    if (readOnly) return promptDemoSignup()
    if (needsMotivation && motivation.trim().length < 10) return
    setSaving(true)
    await onRespond(selected, needsMotivation ? motivation : null)
    setSaving(false)
    setChoice(null)
  }

  const isHousehold = my?.unit_type === 'household'

  return (
    <section className="besluit-respond">
      <div className="besluit-respond__head">
        <h2>{my?.choice ? 'Jouw reactie' : 'Reageer'}</h2>
        <span className="besluiten-muted">Tot {formatDeadline(p.deadline)} · {timeLeft(p.deadline)}</span>
      </div>
      {isHousehold && (
        <p className="besluiten-muted besluit-respond__unit">
          Je reageert namens {my.label}. {my.member_count > 1 && 'Iedereen in je huishouden kan de reactie wijzigen; de laatste telt.'}
        </p>
      )}
      {my?.choice && (
        <p className="besluit-respond__current">
          <i className="fa-solid fa-circle-check" />
          {isHousehold ? `${my.label} reageerde` : 'Je reageerde'}: <strong>{CHOICE_LABEL[my.choice]}</strong>
          {isHousehold && my.responded_by_name && <> · door {my.responded_by_name}</>}
          <span className="besluiten-muted"> · {formatDateTime(my.responded_at)}</span>
        </p>
      )}
      <p className="besluiten-muted besluit-respond__help">{FORM_HELP[p.form]}</p>
      <div className={`besluit-choices besluit-choices--${p.form}`} role="radiogroup">
        {options.map(o => (
          <button
            key={o.key}
            role="radio"
            aria-checked={selected === o.key}
            className={`besluit-choice besluit-choice--${o.key} ${selected === o.key ? 'is-selected' : ''}`}
            onClick={() => setChoice(o.key)}
            disabled={saving}
          >
            <i className={o.icon} /> {o.label}
          </button>
        ))}
      </div>
      {needsMotivation && (
        <div className="form-group besluit-respond__motivation">
          <label>Waarom maak je bezwaar? <span className="besluiten-muted">verplicht, zichtbaar voor iedereen</span></label>
          <textarea
            value={motivation}
            onChange={e => setMotivation(e.target.value)}
            rows={3}
            placeholder="Wat is je bezwaar, en wat zou het voorstel voor jou acceptabel maken?"
          />
          {motivation.trim().length > 0 && motivation.trim().length < 10 && <span className="form-hint">Minimaal 10 tekens.</span>}
        </div>
      )}
      {changed && (
        <button className="btn-primary" onClick={submit} disabled={saving || (needsMotivation && motivation.trim().length < 10)}>
          {saving && <i className="fa-solid fa-spinner fa-spin" />} {my?.choice ? 'Reactie wijzigen' : 'Reactie versturen'}
        </button>
      )}
    </section>
  )
}

function TallyPanel({ tally, proposal: p }) {
  const total = tally.electorate || 0
  const pct = total > 0 ? Math.min(100, Math.round((tally.responded / total) * 100)) : 0
  const quorumPct = total > 0 && tally.quorum_required ? Math.min(100, (tally.quorum_required / total) * 100) : null
  const unitWord = p.rules_snapshot?.vote_unit === 'person' ? 'leden' : 'huishoudens'
  const options = CHOICES[p.form] || []
  return (
    <section className="besluit-section besluit-tally">
      <h2>{p.status === 'published' ? 'Tussenstand' : 'Uitslag'}</h2>
      <div className="besluit-tally__participation">
        <span><strong>{tally.responded}</strong> van {total} {unitWord} reageerden</span>
        <span className={tally.quorum_met ? 'besluit-tally__ok' : 'besluiten-muted'}>
          {tally.quorum_required > 0
            ? (tally.quorum_met ? <><i className="fa-solid fa-check" /> Quorum gehaald</> : `Quorum: ${tally.quorum_required} nodig`)
            : 'Geen quorum vereist'}
        </span>
      </div>
      <div className="proposal-progress proposal-progress--lg">
        <span style={{ width: `${pct}%` }} />
        {quorumPct !== null && <i className="proposal-progress__marker" style={{ left: `${quorumPct}%` }} title="Quorum" />}
      </div>
      {tally.tally_visible && tally.counts ? (
        <div className="besluit-counts">
          {options.map(o => (
            <div key={o.key} className={`besluit-count besluit-count--${o.key}`}>
              <span className="besluit-count__value">{tally.counts[o.key] ?? 0}</span>
              <span className="besluit-count__label">{o.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="besluiten-muted">De tussenstand zie je nadat je zelf gereageerd hebt.</p>
      )}
      {p.status === 'published' && tally.projection && tally.tally_visible && (
        <p className="besluiten-muted">Als het nu zou sluiten: {tally.projection.summary}</p>
      )}
      {p.deadline_extension_note && (
        <p className="besluiten-muted"><i className="fa-solid fa-calendar-plus" /> Deadline verlengd: {p.deadline_extension_note}</p>
      )}
    </section>
  )
}

function QuestionRound({ questions, answersFor, groupName, canAsk, canAnswer, userId, onAsk, onAnswer, onDelete }) {
  const [draft, setDraft] = useState('')
  const [answerFor, setAnswerFor] = useState(null)
  const [answer, setAnswer] = useState('')
  return (
    <section className="besluit-section besluit-questions">
      <h2>Vragenronde {questions.length > 0 && <span className="besluiten-muted">({questions.length})</span>}</h2>
      {questions.length === 0 && <p className="besluiten-muted">Nog geen vragen. {groupName} beantwoordt vragen namens de groep.</p>}
      <ul>
        {questions.map(q => {
          const answers = answersFor(q.id)
          return (
            <li key={q.id} className="besluit-question">
              <div className="besluit-question__meta">
                <strong>{q.author?.full_name || 'Lid'}</strong>
                <span className="besluiten-muted">{formatDateTime(q.created_at)}</span>
                {q.author_id === userId && answers.length === 0 && (
                  <button className="link-btn besluiten-muted" onClick={() => onDelete(q.id)}>verwijderen</button>
                )}
              </div>
              <p>{q.body}</p>
              {answers.map(a => (
                <div key={a.id} className="besluit-answer">
                  <div className="besluit-question__meta">
                    <strong>{groupName}</strong>
                    <span className="besluiten-muted">{a.author?.full_name ? `${a.author.full_name} · ` : ''}{formatDateTime(a.created_at)}</span>
                  </div>
                  <p>{a.body}</p>
                </div>
              ))}
              {canAnswer && answers.length === 0 && (
                answerFor === q.id ? (
                  <div className="besluit-answer besluit-answer--form">
                    <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={3} placeholder={`Antwoord namens ${groupName}`} autoFocus />
                    <div className="besluit-answer__actions">
                      <button className="btn-secondary btn-sm" onClick={() => setAnswerFor(null)}>Annuleren</button>
                      <button className="btn-primary btn-sm" disabled={!answer.trim()} onClick={async () => { await onAnswer(q.id, answer); setAnswer(''); setAnswerFor(null) }}>Antwoord plaatsen</button>
                    </div>
                  </div>
                ) : (
                  <button className="link-btn besluit-answer__open" onClick={() => setAnswerFor(q.id)}>Beantwoorden namens {groupName}</button>
                )
              )}
            </li>
          )
        })}
      </ul>
      {canAsk && (
        <div className="besluit-ask">
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2} placeholder="Stel een vraag over dit voorstel. Iedereen in de groep kan meelezen." />
          <button className="btn-secondary btn-sm" disabled={!draft.trim()} onClick={async () => { await onAsk(draft); setDraft('') }}>
            <i className="fa-solid fa-paper-plane" /> Vraag stellen
          </button>
        </div>
      )}
    </section>
  )
}

function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function ReasonDialog({ dialog, deadline, onCancel, onSubmit }) {
  const [text, setText] = useState('')
  const [newDeadline, setNewDeadline] = useState(() =>
    toLocalInput(new Date((deadline ? new Date(deadline).getTime() : Date.now()) + 3 * 86_400_000)))
  const copy = {
    extend: { title: 'Deadline verlengen', hint: 'Dit kan één keer. De reden is zichtbaar voor alle leden.', label: 'Verlengen', min: 1 },
    withdraw: { title: 'Voorstel intrekken', hint: 'Reageren is daarna niet meer mogelijk. De reden is zichtbaar voor alle leden.', label: 'Intrekken', min: 1 },
    overrule: { title: `Bezwaar${dialog.label ? ` van ${dialog.label}` : ''} passeren`, hint: 'Leg uit waarom dit bezwaar niet overwegend is. Dit blijft zichtbaar bij het besluit.', label: 'Passeren', min: 10 },
  }[dialog.kind]
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card besluit-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{copy.title}</h2>
          <button className="modal-close" onClick={onCancel} aria-label="Sluiten"><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="modal-form">
          <p className="besluiten-muted">{copy.hint}</p>
          {dialog.kind === 'extend' && (
            <div className="form-group">
              <label>Nieuwe deadline</label>
              <input type="datetime-local" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} />
            </div>
          )}
          <div className="form-group">
            <label>{dialog.kind === 'overrule' ? 'Motivatie' : 'Reden'}</label>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={3} autoFocus />
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onCancel}>Annuleren</button>
            <button
              className={dialog.kind === 'withdraw' ? 'btn-danger' : 'btn-primary'}
              disabled={text.trim().length < copy.min}
              onClick={() => onSubmit(text.trim(), newDeadline)}
            >{copy.label}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
