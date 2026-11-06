import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useProject } from '../contexts/ProjectContext'
import { useProposals } from '../hooks/useProposals'
import { useWorkgroups } from '../hooks/useWorkgroups'
import { canDo } from '../lib/permissions'
import { promptDemoSignup } from '../lib/demo'
import {
  FORM_LABEL, STATUS_LABEL, STATUS_TAG, fractionText, formatDate, submitGroupsFor, timeLeft,
} from '../lib/decisions'
import ProposalModal from '../components/ProposalModal'
import Skeleton from '../components/Skeleton'

const TABS = [
  { key: 'open', label: 'Open' },
  { key: 'lijst', label: 'Besluitenlijst' },
  { key: 'commissie', label: 'Commissie' },
]

/**
 * Besluiten — voor leden: wat loopt er en wat wacht op mij, plus de
 * besluitenlijst. Voor commissie- en bestuursleden: concepten en het
 * inbrengen van nieuwe voorstellen.
 */
export default function Besluiten() {
  const { basePath, role, readOnly } = useProject()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { proposals, pendingIds, eligibleIds, log, rules, loading, refresh } = useProposals()
  const { allWorkgroups, myWorkgroupIds } = useWorkgroups()
  const [modal, setModal] = useState(null) // null | 'new'
  const [query, setQuery] = useState('')
  const [formFilter, setFormFilter] = useState('alles')

  const isModerator = canDo(role, 'moderate_board')
  const submitGroups = useMemo(
    () => submitGroupsFor(allWorkgroups, myWorkgroupIds, isModerator),
    [allWorkgroups, myWorkgroupIds, isModerator],
  )
  const canSubmit = submitGroups.length > 0
  const tabs = TABS.filter(t => t.key !== 'commissie' || canSubmit)
  const tab = tabs.some(t => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'open'
  const setTab = (key) => setSearchParams(key === 'open' ? {} : { tab: key }, { replace: true })

  const running = proposals.filter(p => p.status === 'published')
  const waiting = running.filter(p => pendingIds.has(p.id))
  const otherRunning = running.filter(p => !pendingIds.has(p.id))
  const myGroupIds = new Set(submitGroups.map(g => g.id))
  const drafts = proposals.filter(p => p.status === 'draft')
  const myRunning = running.filter(p => myGroupIds.has(p.workgroup_id))

  const filteredLog = useMemo(() => {
    const q = query.trim().toLowerCase()
    return log.filter(i =>
      (formFilter === 'alles' || i.form === formFilter)
      && (!q || `${i.title} ${i.summary_line || ''} ${i.workgroup_name || ''}`.toLowerCase().includes(q)))
  }, [log, query, formFilter])

  const open = (id) => navigate(`${basePath}/besluiten/${id}`)

  if (loading) return <Skeleton.Page rows={4} />

  return (
    <div className="view-besluiten">
      <div className="view-header">
        <div className="view-header__row">
          <h1>Besluiten</h1>
          {canSubmit && (
            <button className="btn-primary" onClick={() => (readOnly ? promptDemoSignup() : setModal('new'))}>
              <i className="fa-solid fa-plus" /> Nieuw voorstel
            </button>
          )}
        </div>
        {rules && (
          <p className="view-header__subtitle">
            {rules.vote_unit === 'household' ? 'Eén stem per huishouden' : 'Eén stem per persoon'} ·
            {rules.quorum_num > 0 ? ` minstens ${fractionText(rules.quorum_num, rules.quorum_den)} moet reageren` : ' geen quorum'}
            {!rules.formal_online_decisions && ' · stemmingen zijn voorbereidend voor de ALV'}
          </p>
        )}
      </div>

      <div className="seg-tabs besluiten-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`seg-tab ${tab === t.key ? 'seg-tab--active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === 'open' && waiting.length > 0 && <span className="seg-tab__count">{waiting.length}</span>}
            {t.key === 'commissie' && drafts.length > 0 && <span className="seg-tab__count">{drafts.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'open' && (
        running.length === 0 ? (
          <div className="empty-inline">
            <i className="fa-solid fa-check-to-slot" />
            <p>Er lopen op dit moment geen voorstellen.</p>
            {log.length > 0 && <button className="btn-secondary" onClick={() => setTab('lijst')}>Bekijk de besluitenlijst</button>}
          </div>
        ) : (
          <div className="besluiten-feed">
            {waiting.length > 0 && (
              <section>
                <h3 className="besluiten-feed__label">Wacht op jouw reactie</h3>
                {waiting.map(p => <ProposalCard key={p.id} p={p} mine="pending" onClick={() => open(p.id)} />)}
              </section>
            )}
            {otherRunning.length > 0 && (
              <section>
                <h3 className="besluiten-feed__label">{waiting.length > 0 ? 'Ook lopend' : 'Lopend'}</h3>
                {otherRunning.map(p => <ProposalCard key={p.id} p={p} mine={eligibleIds.has(p.id) ? 'done' : readOnly ? null : 'none'} onClick={() => open(p.id)} />)}
              </section>
            )}
          </div>
        )
      )}

      {tab === 'lijst' && (
        <div className="besluiten-log">
          <div className="besluiten-log__filters">
            <div className="besluiten-search">
              <i className="fa-solid fa-magnifying-glass" />
              <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Zoek in besluiten" aria-label="Zoek in besluiten" />
            </div>
            <div className="tag-filter">
              {[['alles', 'Alles'], ['consent', 'Consent'], ['vote', 'Stemming'], ['meeting', 'Vergadering']].map(([k, l]) => (
                <button key={k} className={`tag-filter__pill ${formFilter === k ? 'tag-filter__pill--active' : ''}`} onClick={() => setFormFilter(k)}>{l}</button>
              ))}
            </div>
          </div>
          {filteredLog.length === 0 ? (
            <div className="empty-inline">
              <i className="fa-solid fa-book" />
              <p>{log.length === 0 ? 'Nog geen besluiten. Gesloten voorstellen komen hier automatisch te staan.' : 'Geen besluiten gevonden.'}</p>
            </div>
          ) : (
            <ul className="besluiten-log__list">
              {filteredLog.map(i => (
                <li key={`${i.source}-${i.id}`}>
                  <button
                    className="besluiten-log__row"
                    disabled={i.source !== 'proposal'}
                    onClick={() => i.source === 'proposal' && open(i.id)}
                  >
                    <span className="besluiten-log__date">{formatDate(i.decided_at)}</span>
                    <span className="besluiten-log__main">
                      <span className="besluiten-log__title">
                        {i.title}
                        {i.version > 1 && <span className="besluiten-muted"> · versie {i.version}</span>}
                      </span>
                      <span className="besluiten-log__summary">{i.summary_line}</span>
                    </span>
                    <span className="besluiten-log__meta">
                      {i.source === 'proposal' && <StatusTag status={i.status} />}
                      <span className="besluiten-muted">{FORM_LABEL[i.form] || i.form}{i.workgroup_name ? ` · ${i.workgroup_name}` : ''}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'commissie' && canSubmit && (
        <div className="besluiten-feed">
          <section>
            <h3 className="besluiten-feed__label">Concepten</h3>
            {drafts.length === 0 ? (
              <p className="besluiten-muted besluiten-empty-line">Geen concepten. Een concept is alleen zichtbaar voor je eigen commissie en beheerders.</p>
            ) : drafts.map(p => <ProposalCard key={p.id} p={p} onClick={() => open(p.id)} />)}
          </section>
          <section>
            <h3 className="besluiten-feed__label">Lopend namens jouw groep</h3>
            {myRunning.length === 0
              ? <p className="besluiten-muted besluiten-empty-line">Geen lopende voorstellen.</p>
              : myRunning.map(p => <ProposalCard key={p.id} p={p} onClick={() => open(p.id)} showManage />)}
          </section>
        </div>
      )}

      {modal === 'new' && (
        <ProposalModal
          groups={submitGroups}
          rules={rules}
          onClose={() => setModal(null)}
          onSaved={(id) => { setModal(null); refresh(); open(id) }}
        />
      )}
    </div>
  )
}

export function StatusTag({ status }) {
  const s = STATUS_TAG[status] || STATUS_TAG.closed
  return <span className="besluiten-tag" style={{ background: s.bg, color: s.color }}>{STATUS_LABEL[status] || status}</span>
}

function ProposalCard({ p, mine, onClick, showManage = false }) {
  const total = p.electorate_size || 0
  const pct = total > 0 ? Math.min(100, Math.round((p.response_count / total) * 100)) : 0
  return (
    <button className={`proposal-card ${mine === 'pending' ? 'proposal-card--pending' : ''}`} onClick={onClick}>
      <div className="proposal-card__top">
        <StatusTag status={p.status} />
        <span className="besluiten-muted">{FORM_LABEL[p.form]}{p.is_heavy ? ' · zwaar besluit' : ''}{p.version > 1 ? ` · versie ${p.version}` : ''}</span>
        {p.status === 'published' && <span className="proposal-card__time">{timeLeft(p.deadline)}</span>}
      </div>
      <h3 className="proposal-card__title">{p.title}</h3>
      <p className="proposal-card__summary">{p.summary}</p>
      <div className="proposal-card__bottom">
        <span className="besluiten-muted">Namens {p.workgroup?.name || 'de commissie'}</span>
        {p.status === 'published' && (
          <span className="proposal-card__progress" title={`${p.response_count} van ${total} reageerden`}>
            <span className="proposal-progress"><span style={{ width: `${pct}%` }} /></span>
            <span className="besluiten-muted">{p.response_count}/{total}</span>
          </span>
        )}
        {mine === 'pending' && <span className="proposal-card__mine proposal-card__mine--todo">Nog niet gereageerd</span>}
        {mine === 'done' && <span className="proposal-card__mine proposal-card__mine--done"><i className="fa-solid fa-check" /> Gereageerd</span>}
        {mine === 'none' && <span className="proposal-card__mine">Niet stemgerechtigd</span>}
        {showManage && <span className="proposal-card__mine">Beheren <i className="fa-solid fa-arrow-right" /></span>}
      </div>
    </button>
  )
}
