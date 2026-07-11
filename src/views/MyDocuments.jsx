import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMyDocuments } from '../hooks/useMyDocuments'
import { useDocumentRequests } from '../hooks/useDocumentRequests'
import { useSignatureRequests } from '../hooks/useSignatureRequests'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import { formatFileSize, fileIcon, fileIconColor, timeAgo } from '../lib/constants'

const SIGNER_STATUS_CONFIG = {
  pending:  { label: 'Wacht op tekenen', color: 'var(--accent-orange, #F5A623)', bg: 'rgba(245, 166, 35, 0.12)' },
  viewed:   { label: 'Bekeken',          color: 'var(--accent-blue, #4A90D9)',   bg: 'rgba(var(--accent-blue-rgb), 0.12)' },
  signed:   { label: 'Getekend',         color: 'var(--accent-green, #3BD269)',  bg: 'rgba(59, 210, 105, 0.12)' },
  declined: { label: 'Geweigerd',        color: 'var(--accent-red, #E53E3E)',    bg: 'rgba(229, 62, 62, 0.12)' },
}

const CATEGORY_LABELS = {
  contract: 'Contract',
  formulier: 'Formulier',
  correspondentie: 'Correspondentie',
  identiteit: 'Identiteitsbewijs',
  financieel: 'Financieel',
  overig: 'Overig',
}

const TYPE_LABELS = {
  upload_request: 'Upload gevraagd',
  sign_request: 'Ter ondertekening',
  review_document: 'Ter inzage',
}

const STATUS_CONFIG = {
  pending: { label: 'Actie vereist', color: 'var(--accent-orange, #F5A623)', bg: 'rgba(245, 166, 35, 0.12)' },
  submitted: { label: 'Ingediend', color: 'var(--accent-blue, #4A90D9)', bg: 'rgba(var(--accent-blue-rgb), 0.12)' },
  approved: { label: 'Goedgekeurd', color: 'var(--accent-green, #3BD269)', bg: 'rgba(59, 210, 105, 0.12)' },
  rejected: { label: 'Afgekeurd', color: 'var(--accent-red, #E53E3E)', bg: 'rgba(229, 62, 62, 0.12)' },
}

export default function MyDocuments() {
  const { user } = useAuth()
  const { basePath } = useProject()
  const navigate = useNavigate()
  const toast = useToast()
  const { files, loading: filesLoading, download, upload } = useMyDocuments()
  const { requests, loading: requestsLoading, submitResponse, markReviewed } = useDocumentRequests()
  const { requests: signatures, loading: signaturesLoading } = useSignatureRequests()
  const [uploading, setUploading] = useState(null)
  const requestFileRef = useRef(null)
  const [activeRequestId, setActiveRequestId] = useState(null)
  const [detailRequest, setDetailRequest] = useState(null)
  const [detailFile, setDetailFile] = useState(null)
  const [tab, setTab] = useState('verzoeken')

  const loading = filesLoading || requestsLoading || signaturesLoading

  // Tekenverzoeken: cancelled verzoeken (admin trok in) niet tonen — voor lid
  // niet meer relevant. De rest groeperen op signer-status.
  const activeSignatures = signatures.filter(s => s.request_status !== 'cancelled')
  const pendingSignatures = activeSignatures.filter(s => s.status === 'pending' || s.status === 'viewed')
  const signedSignatures  = activeSignatures.filter(s => s.status === 'signed')
  const declinedSignatures = activeSignatures.filter(s => s.status === 'declined')

  const pendingRequests = requests.filter(r => r.status === 'pending')
  const submittedRequests = requests.filter(r => r.status === 'submitted')
  const completedRequests = requests.filter(r => r.status === 'approved' || r.status === 'rejected')

  const teamFiles = files.filter(f => !f.request_id && f.uploaded_by !== user?.id)

  async function handleRequestUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !activeRequestId) return
    setUploading(activeRequestId)
    try {
      const fileId = await upload(file, activeRequestId)
      await submitResponse(activeRequestId, fileId)
      toast.success('Document ingediend')
    } catch (err) {
      toast.error(err.message || 'Upload mislukt')
    } finally {
      setUploading(null)
      setActiveRequestId(null)
      if (requestFileRef.current) requestFileRef.current.value = ''
    }
  }

  function triggerRequestUpload(requestId) {
    setActiveRequestId(requestId)
    setTimeout(() => requestFileRef.current?.click(), 0)
  }

  async function handleMarkReviewed(requestId) {
    setUploading(requestId)
    try {
      await markReviewed(requestId)
      toast.success('Document als gelezen gemarkeerd')
      if (detailRequest?.id === requestId) setDetailRequest(null)
    } catch (err) {
      toast.error(err.message || 'Markeren mislukt')
    } finally {
      setUploading(null)
    }
  }

  if (loading) {
    return (
      <div className="view-mydocuments">
        <div className="view-header"><h1>Mijn documenten</h1></div>
        <div className="loading-inline"><p>Laden...</p></div>
      </div>
    )
  }

  const requestCount = requests.length
  const docCount = teamFiles.length
  const signatureCount = activeSignatures.length
  const pendingSignatureCount = pendingSignatures.length

  return (
    <div className="view-mydocuments">
      <div className="view-header">
        <div>
          <h1>Mijn dossier</h1>
          <p className="view-header__subtitle">Documenten en verzoeken van het projectteam</p>
        </div>
      </div>

      <div className="seg-tabs">
        <button className={`seg-tab ${tab === 'verzoeken' ? 'seg-tab--active' : ''}`} onClick={() => setTab('verzoeken')}>
          <i className="fa-solid fa-file-circle-question" />
          Verzoeken
          {requestCount > 0 && <span className="seg-tab__count">{requestCount}</span>}
        </button>
        <button className={`seg-tab ${tab === 'tekenen' ? 'seg-tab--active' : ''}`} onClick={() => setTab('tekenen')}>
          <i className="fa-solid fa-signature" />
          Tekenen
          {pendingSignatureCount > 0 && <span className="seg-tab__count">{pendingSignatureCount}</span>}
        </button>
        <button className={`seg-tab ${tab === 'documenten' ? 'seg-tab--active' : ''}`} onClick={() => setTab('documenten')}>
          <i className="fa-solid fa-folder-open" />
          Documenten
          {docCount > 0 && <span className="seg-tab__count">{docCount}</span>}
        </button>
      </div>

      <input ref={requestFileRef} type="file" onChange={handleRequestUpload} style={{ display: 'none' }} />

      {tab === 'verzoeken' && (
        <RequestsTab
          pendingRequests={pendingRequests}
          submittedRequests={submittedRequests}
          completedRequests={completedRequests}
          uploading={uploading}
          onUpload={triggerRequestUpload}
          onMarkReviewed={handleMarkReviewed}
          onDownload={download}
          onOpenDetail={setDetailRequest}
        />
      )}

      {tab === 'tekenen' && (
        <SignaturesTab
          pending={pendingSignatures}
          signed={signedSignatures}
          declined={declinedSignatures}
          onOpen={(signerId) => navigate(`${basePath}/tekenen/${signerId}`)}
        />
      )}

      {tab === 'documenten' && (
        <DocumentsTab
          files={teamFiles}
          onOpenDetail={setDetailFile}
        />
      )}

      {detailRequest && (
        <RequestDetailModal
          request={detailRequest}
          uploading={uploading}
          onClose={() => setDetailRequest(null)}
          onDownload={download}
          onUpload={(id) => { setDetailRequest(null); triggerRequestUpload(id) }}
          onMarkReviewed={handleMarkReviewed}
        />
      )}

      {detailFile && (
        <FileDetailModal
          file={detailFile}
          onClose={() => setDetailFile(null)}
          onDownload={download}
        />
      )}
    </div>
  )
}

function RequestsTab({ pendingRequests, submittedRequests, completedRequests, uploading, onUpload, onMarkReviewed, onDownload, onOpenDetail }) {
  const hasRequests = pendingRequests.length > 0 || submittedRequests.length > 0 || completedRequests.length > 0

  if (!hasRequests) {
    return (
      <div className="empty-inline">
        <i className="fa-solid fa-file-circle-question" />
        <h3 className="empty-inline__title">Geen verzoeken</h3>
        <p>Er zijn nog geen documentverzoeken van het projectteam.</p>
      </div>
    )
  }

  return (
    <div className="my-docs">
      {pendingRequests.length > 0 && (
        <section className="my-docs__section">
          <h2 className="my-docs__section-title">
            <i className="fa-solid fa-circle-exclamation" style={{ color: 'var(--accent-orange, #F5A623)' }} />
            Actie vereist
            <span className="my-docs__count">{pendingRequests.length}</span>
          </h2>
          <div className="my-docs__cards">
            {pendingRequests.map(req => (
              <RequestCard
                key={req.id}
                request={req}
                uploading={uploading === req.id}
                onUpload={() => onUpload(req.id)}
                onMarkReviewed={() => onMarkReviewed(req.id)}
                onDownload={onDownload}
                onOpen={() => onOpenDetail(req)}
              />
            ))}
          </div>
        </section>
      )}

      {submittedRequests.length > 0 && (
        <section className="my-docs__section">
          <h2 className="my-docs__section-title">
            <i className="fa-solid fa-clock" style={{ color: 'var(--accent-blue, #4A90D9)' }} />
            In behandeling
          </h2>
          <div className="my-docs__cards">
            {submittedRequests.map(req => (
              <RequestCard key={req.id} request={req} onDownload={onDownload} onOpen={() => onOpenDetail(req)} />
            ))}
          </div>
        </section>
      )}

      {completedRequests.length > 0 && (
        <section className="my-docs__section">
          <h2 className="my-docs__section-title">
            <i className="fa-solid fa-circle-check" style={{ color: 'var(--accent-green, #3BD269)' }} />
            Afgerond
          </h2>
          <div className="doc-list">
            {completedRequests.map(req => {
              const sc = STATUS_CONFIG[req.status]
              return (
                <div key={req.id} className="doc-row" onClick={() => onOpenDetail(req)} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
                  <div className="doc-row__icon" style={{ color: sc.color }}>
                    <i className={`fa-solid ${req.status === 'approved' ? 'fa-circle-check' : 'fa-circle-xmark'}`} />
                  </div>
                  <div className="doc-row__info">
                    <span className="doc-row__title">{req.title}</span>
                    <div className="doc-row__meta">
                      <span className="doc-row__source" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                      <span>{CATEGORY_LABELS[req.category] || req.category}</span>
                      <span>{timeAgo(req.reviewed_at || req.updated_at)}</span>
                    </div>
                    {req.review_note && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {req.review_note}
                      </div>
                    )}
                  </div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 14, flexShrink: 0 }}>
                    <i className="fa-solid fa-chevron-right" />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function SignaturesTab({ pending, signed, declined, onOpen }) {
  const hasAny = pending.length > 0 || signed.length > 0 || declined.length > 0
  if (!hasAny) {
    return (
      <div className="empty-inline">
        <i className="fa-solid fa-signature" />
        <h3 className="empty-inline__title">Geen tekenverzoeken</h3>
        <p>Er staan geen documenten klaar om te ondertekenen.</p>
      </div>
    )
  }

  return (
    <div className="my-docs">
      {pending.length > 0 && (
        <section className="my-docs__section">
          <h2 className="my-docs__section-title">
            <i className="fa-solid fa-circle-exclamation" style={{ color: 'var(--accent-orange, #F5A623)' }} />
            Actie vereist
            <span className="my-docs__count">{pending.length}</span>
          </h2>
          <div className="my-docs__cards">
            {pending.map(sig => <SignatureCard key={sig.signer_id} signature={sig} onOpen={() => onOpen(sig.signer_id)} />)}
          </div>
        </section>
      )}

      {signed.length > 0 && (
        <section className="my-docs__section">
          <h2 className="my-docs__section-title">
            <i className="fa-solid fa-circle-check" style={{ color: 'var(--accent-green, #3BD269)' }} />
            Getekend
          </h2>
          <div className="my-docs__cards">
            {signed.map(sig => <SignatureCard key={sig.signer_id} signature={sig} onOpen={() => onOpen(sig.signer_id)} />)}
          </div>
        </section>
      )}

      {declined.length > 0 && (
        <section className="my-docs__section">
          <h2 className="my-docs__section-title">
            <i className="fa-solid fa-circle-xmark" style={{ color: 'var(--accent-red, #E53E3E)' }} />
            Geweigerd
          </h2>
          <div className="my-docs__cards">
            {declined.map(sig => <SignatureCard key={sig.signer_id} signature={sig} onOpen={() => onOpen(sig.signer_id)} />)}
          </div>
        </section>
      )}
    </div>
  )
}

function SignatureCard({ signature, onOpen }) {
  const sc = SIGNER_STATUS_CONFIG[signature.status]
  const isOverdue = signature.due_at && new Date(signature.due_at) < new Date() && signature.status !== 'signed' && signature.status !== 'declined'
  const canSign = signature.status === 'pending' || signature.status === 'viewed'

  return (
    <div className={`request-card ${isOverdue ? 'request-card--overdue' : ''}`} onClick={onOpen} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
      <div className="request-card__header">
        <span className="request-card__type" style={{ background: sc.bg, color: sc.color }}>
          {sc.label}
        </span>
        {signature.due_at && (
          <span className={`request-card__deadline ${isOverdue ? 'request-card__deadline--overdue' : ''}`}>
            <i className="fa-solid fa-calendar" />
            {new Date(signature.due_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>

      <h3 className="request-card__title">{signature.title}</h3>
      {signature.description && <p className="request-card__desc">{signature.description}</p>}

      <div className="request-card__attachment-preview">
        <i className="fa-solid fa-file-pdf" style={{ color: 'var(--accent-red, #E53E3E)' }} />
        <span>{signature.file_name}</span>
      </div>

      <div className="request-card__footer">
        <div className="request-card__meta">
          {signature.creator_name && (
            <span><i className="fa-solid fa-user" /> {signature.creator_name}</span>
          )}
          <span>{timeAgo(signature.created_at)}</span>
        </div>
        {canSign && (
          <button
            type="button"
            className="btn-primary"
            onClick={(e) => { e.stopPropagation(); onOpen() }}
          >
            <i className="fa-solid fa-signature" />
            Bekijken &amp; tekenen
          </button>
        )}
        {signature.status === 'declined' && (
          <button
            type="button"
            className="btn-secondary"
            onClick={(e) => { e.stopPropagation(); onOpen() }}
          >
            Details
          </button>
        )}
        {signature.status === 'signed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Getekend op {new Date(signature.signed_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <SignedDownloadButton signedPath={signature.signed_file_path} fileName={signature.file_name} />
          </div>
        )}
      </div>
    </div>
  )
}

// Knop om de getekende versie van een tekenverzoek te downloaden. Werkt op
// de privé signatures-bucket via een tijdelijke signed URL (RLS laat signers
// hun eigen signed-<id>.pdf lezen).
function SignedDownloadButton({ signedPath, fileName }) {
  const [busy, setBusy] = useState(false)
  async function onClick(e) {
    e.stopPropagation()
    if (!signedPath) return
    setBusy(true)
    try {
      const { data, error } = await supabase.storage
        .from('signatures')
        .createSignedUrl(signedPath, 120)
      if (error || !data?.signedUrl) throw new Error(error?.message || 'Geen URL')
      const res = await fetch(data.signedUrl)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `Getekend - ${fileName || 'document.pdf'}`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) {
      logger.error('Download getekende PDF mislukt', err)
    } finally {
      setBusy(false)
    }
  }
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={onClick}
      disabled={busy || !signedPath}
      style={{ fontSize: 13 }}
    >
      <i className="fa-solid fa-download" />
      {busy ? 'Laden…' : 'Download getekende versie'}
    </button>
  )
}

function DocumentsTab({ files, onOpenDetail }) {
  if (files.length === 0) {
    return (
      <div className="empty-inline">
        <i className="fa-solid fa-folder-open" />
        <h3 className="empty-inline__title">Geen documenten</h3>
        <p>Het projectteam heeft nog geen documenten voor je klaargezet.</p>
      </div>
    )
  }

  return (
    <div className="my-docs__cards">
      {files.map(file => (
        <TeamFileCard key={file.id} file={file} onOpen={() => onOpenDetail(file)} />
      ))}
    </div>
  )
}

function TeamFileCard({ file, onOpen }) {
  const icon = fileIcon(file.file_type || file.file_name)
  const iconColor = fileIconColor(file.file_type || file.file_name)

  return (
    <div className="request-card" onClick={onOpen} role="button" tabIndex={0}>
      <div className="request-card__header">
        <span className="request-card__type" style={{ background: 'var(--accent-primary-light, rgba(var(--accent-blue-rgb), 0.12))', color: 'var(--accent-primary, #4A90D9)' }}>
          {CATEGORY_LABELS[file.category] || file.category || 'Document'}
        </span>
        {file.file_size > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{formatFileSize(file.file_size)}</span>
        )}
      </div>

      <h3 className="request-card__title">{file.title}</h3>
      {file.description && <p className="request-card__desc">{file.description}</p>}

      <div className="request-card__attachment-preview">
        <i className={icon} style={{ color: iconColor }} />
        <span>{file.file_name}</span>
      </div>

      <div className="request-card__footer">
        <div className="request-card__meta">
          <span>{timeAgo(file.created_at)}</span>
        </div>
      </div>
    </div>
  )
}

function RequestCard({ request, uploading, onUpload, onMarkReviewed, onDownload, onOpen }) {
  const sc = STATUS_CONFIG[request.status]
  const isOverdue = request.deadline && new Date(request.deadline) < new Date() && request.status === 'pending'

  return (
    <div className={`request-card ${isOverdue ? 'request-card--overdue' : ''}`} onClick={onOpen} role="button" tabIndex={0}>
      <div className="request-card__header">
        <span className="request-card__type" style={{ background: sc.bg, color: sc.color }}>
          {TYPE_LABELS[request.type] || request.type}
        </span>
        {request.deadline && (
          <span className={`request-card__deadline ${isOverdue ? 'request-card__deadline--overdue' : ''}`}>
            <i className="fa-solid fa-calendar" />
            {new Date(request.deadline).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>

      <h3 className="request-card__title">{request.title}</h3>
      {request.description && (
        <p className="request-card__desc">{request.description}</p>
      )}

      {request.attached_file && (
        <div className="request-card__attachment-preview">
          <i className={fileIcon(request.attached_file.file_type || request.attached_file.file_name)} style={{ color: fileIconColor(request.attached_file.file_type || request.attached_file.file_name) }} />
          <span>{request.attached_file.file_name}</span>
        </div>
      )}

      {request.response_file && (
        <div className="request-card__response">
          <i className="fa-solid fa-check" style={{ color: 'var(--accent-green, #3BD269)' }} />
          <span>Ingediend: {request.response_file.file_name}</span>
        </div>
      )}

      <div className="request-card__footer">
        {request.status === 'pending' && (request.type === 'upload_request' || request.type === 'sign_request') && (
          <button className="btn-primary btn-sm" onClick={e => { e.stopPropagation(); onUpload?.() }} disabled={uploading}>
            <i className={`fa-solid ${uploading ? 'fa-spinner fa-spin' : 'fa-upload'}`} />
            {uploading ? 'Uploaden...' : request.type === 'sign_request' ? 'Getekend uploaden' : 'Uploaden'}
          </button>
        )}
        {request.status === 'pending' && request.type === 'review_document' && (
          <button className="btn-primary btn-sm" onClick={e => { e.stopPropagation(); onMarkReviewed?.() }} disabled={uploading}>
            <i className={`fa-solid ${uploading ? 'fa-spinner fa-spin' : 'fa-check'}`} />
            {uploading ? 'Bezig...' : 'Gelezen'}
          </button>
        )}
        {request.status === 'submitted' && (
          <span className="request-card__status-badge" style={{ background: sc.bg, color: sc.color }}>
            <i className="fa-solid fa-clock" /> Wacht op beoordeling
          </span>
        )}
        <div className="request-card__meta">
          <span>{CATEGORY_LABELS[request.category] || request.category}</span>
          <span>{timeAgo(request.created_at)}</span>
        </div>
      </div>
    </div>
  )
}

function RequestDetailModal({ request, uploading, onClose, onDownload, onUpload, onMarkReviewed }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h2>{request.title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Sluiten">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="request-card__type" style={{ background: STATUS_CONFIG[request.status]?.bg, color: STATUS_CONFIG[request.status]?.color }}>
              {TYPE_LABELS[request.type] || request.type}
            </span>
            <span className="request-card__type" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
              {CATEGORY_LABELS[request.category] || request.category}
            </span>
            {request.status !== 'pending' && (
              <span className="request-card__type" style={{ background: STATUS_CONFIG[request.status]?.bg, color: STATUS_CONFIG[request.status]?.color }}>
                {STATUS_CONFIG[request.status]?.label}
              </span>
            )}
            {request.deadline && (
              <span style={{ fontSize: 13, color: new Date(request.deadline) < new Date() && request.status === 'pending' ? 'var(--accent-red)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className="fa-solid fa-calendar" />
                {new Date(request.deadline).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            )}
          </div>

          {request.description && (
            <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>
              {request.description}
            </p>
          )}

          {request.attached_file && (
            <button
              className="request-card__attachment"
              onClick={() => onDownload(request.attached_file.id, request.attached_file.file_path, request.attached_file.file_name)}
            >
              <i className={fileIcon(request.attached_file.file_type || request.attached_file.file_name)} style={{ color: fileIconColor(request.attached_file.file_type || request.attached_file.file_name) }} />
              <span>{request.attached_file.file_name}</span>
              <span className="request-card__attachment-size">{formatFileSize(request.attached_file.file_size)}</span>
              <i className="fa-solid fa-download" />
            </button>
          )}

          {request.response_file && (
            <button
              className="request-card__attachment"
              style={{ background: 'rgba(59, 210, 105, 0.08)' }}
              onClick={() => onDownload(request.response_file.id, request.response_file.file_path, request.response_file.file_name)}
            >
              <i className="fa-solid fa-check" style={{ color: 'var(--accent-green, #3BD269)' }} />
              <span>Jouw inzending: {request.response_file.file_name}</span>
              <span className="request-card__attachment-size">{formatFileSize(request.response_file.file_size)}</span>
              <i className="fa-solid fa-download" />
            </button>
          )}

          {request.status === 'submitted' && !request.response_file && request.type === 'review_document' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--accent-blue, #4A90D9)', padding: '10px 14px', background: 'rgba(var(--accent-blue-rgb), 0.08)', borderRadius: 8 }}>
              <i className="fa-solid fa-eye" />
              <span>Je hebt dit document als gelezen gemarkeerd</span>
            </div>
          )}

          {request.review_note && (
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', padding: '12px 16px', background: 'var(--bg-hover)', borderRadius: 8 }}>
              <strong>Opmerking:</strong> {request.review_note}
            </div>
          )}

          {request.status === 'pending' && (request.type === 'upload_request' || request.type === 'sign_request') && (
            <button
              className="btn-primary"
              onClick={() => onUpload(request.id)}
              disabled={uploading}
            >
              <i className={`fa-solid ${uploading ? 'fa-spinner fa-spin' : 'fa-upload'}`} />
              {request.type === 'sign_request' ? 'Getekend uploaden' : 'Document uploaden'}
            </button>
          )}
          {request.status === 'pending' && request.type === 'review_document' && (
            <button
              className="btn-primary"
              onClick={() => onMarkReviewed(request.id)}
              disabled={uploading}
            >
              <i className={`fa-solid ${uploading ? 'fa-spinner fa-spin' : 'fa-check'}`} />
              {uploading ? 'Bezig...' : 'Markeer als gelezen'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function FileDetailModal({ file, onClose, onDownload }) {
  const icon = fileIcon(file.file_type || file.file_name)
  const iconColor = fileIconColor(file.file_type || file.file_name)
  const isImage = file.file_type?.startsWith('image/')
  const isPdf = file.file_type === 'application/pdf' || file.file_name?.endsWith('.pdf')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h2>{file.title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Sluiten">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="request-card__type" style={{ background: 'var(--accent-primary-light, rgba(var(--accent-blue-rgb), 0.12))', color: 'var(--accent-primary, #4A90D9)' }}>
              {CATEGORY_LABELS[file.category] || file.category || 'Document'}
            </span>
            {file.file_size > 0 && (
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{formatFileSize(file.file_size)}</span>
            )}
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{timeAgo(file.created_at)}</span>
          </div>

          {file.description && (
            <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>
              {file.description}
            </p>
          )}

          {(isImage || isPdf) && (
            <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 16, textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
              <i className={icon} style={{ fontSize: 32, color: iconColor, display: 'block', marginBottom: 8 }} />
              {isImage ? 'Afbeelding' : 'PDF-document'} — klik hieronder om te openen
            </div>
          )}

          <button
            className="request-card__attachment"
            onClick={() => onDownload(file.id, file.file_path, file.file_name)}
          >
            <i className={icon} style={{ color: iconColor }} />
            <span>{file.file_name}</span>
            {file.file_size > 0 && <span className="request-card__attachment-size">{formatFileSize(file.file_size)}</span>}
            <i className="fa-solid fa-download" />
          </button>
        </div>
      </div>
    </div>
  )
}
