import { useState, useRef } from 'react'
import { useMyDocuments } from '../hooks/useMyDocuments'
import { useDocumentRequests } from '../hooks/useDocumentRequests'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import { formatFileSize, fileIcon, fileIconColor, timeAgo } from '../lib/constants'

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
  submitted: { label: 'Ingediend', color: 'var(--accent-blue, #4A90D9)', bg: 'rgba(74, 144, 217, 0.12)' },
  approved: { label: 'Goedgekeurd', color: 'var(--accent-green, #3BD269)', bg: 'rgba(59, 210, 105, 0.12)' },
  rejected: { label: 'Afgekeurd', color: 'var(--accent-red, #E53E3E)', bg: 'rgba(229, 62, 62, 0.12)' },
}

export default function MyDocuments() {
  const { user } = useAuth()
  const toast = useToast()
  const { files, loading: filesLoading, download, upload, remove } = useMyDocuments()
  const { requests, loading: requestsLoading, submitResponse } = useDocumentRequests()
  const [uploading, setUploading] = useState(null)
  const fileRef = useRef(null)
  const requestFileRef = useRef(null)
  const [activeRequestId, setActiveRequestId] = useState(null)

  const loading = filesLoading || requestsLoading

  const pendingRequests = requests.filter(r => r.status === 'pending')
  const submittedRequests = requests.filter(r => r.status === 'submitted')
  const completedRequests = requests.filter(r => r.status === 'approved' || r.status === 'rejected')

  const freeFiles = files.filter(f => !f.request_id)
  const teamFiles = freeFiles.filter(f => f.uploaded_by !== user?.id)
  const myUploads = freeFiles.filter(f => f.uploaded_by === user?.id)

  async function handleFreeUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading('free')
    try {
      await upload(file)
      toast.success('Bestand geüpload')
    } catch (err) {
      toast.error(err.message || 'Upload mislukt')
    } finally {
      setUploading(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

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

  if (loading) {
    return (
      <div className="view-container">
        <div className="view-header"><h1 className="view-title">Mijn documenten</h1></div>
        <div className="empty-state"><p className="empty-state__text">Laden...</p></div>
      </div>
    )
  }

  const hasContent = pendingRequests.length > 0 || submittedRequests.length > 0 || completedRequests.length > 0 || files.length > 0

  return (
    <div className="view-container">
      <div className="view-header">
        <div className="view-header__row">
          <div>
            <h1 className="view-title">Mijn documenten</h1>
            <p className="view-subtitle">Documenten en verzoeken van het projectteam</p>
          </div>
          <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <i className={`fa-solid ${uploading === 'free' ? 'fa-spinner fa-spin' : 'fa-upload'}`} />
            {uploading === 'free' ? 'Uploaden...' : 'Bestand uploaden'}
          </button>
          <input ref={fileRef} type="file" onChange={handleFreeUpload} style={{ display: 'none' }} />
          <input ref={requestFileRef} type="file" onChange={handleRequestUpload} style={{ display: 'none' }} />
        </div>
      </div>

      {!hasContent ? (
        <div className="empty-state">
          <i className="fa-solid fa-folder-open empty-state__icon" />
          <h3 className="empty-state__title">Geen documenten</h3>
          <p className="empty-state__text">
            Er zijn nog geen documenten of verzoeken. Upload zelf een bestand of wacht tot het projectteam iets klaarzet.
          </p>
        </div>
      ) : (
        <div className="my-docs">

          {/* ── Acties vereist ── */}
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
                    onUpload={() => triggerRequestUpload(req.id)}
                    onDownload={download}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── In behandeling ── */}
          {submittedRequests.length > 0 && (
            <section className="my-docs__section">
              <h2 className="my-docs__section-title">
                <i className="fa-solid fa-clock" style={{ color: 'var(--accent-blue, #4A90D9)' }} />
                In behandeling
              </h2>
              <div className="my-docs__cards">
                {submittedRequests.map(req => (
                  <RequestCard key={req.id} request={req} onDownload={download} />
                ))}
              </div>
            </section>
          )}

          {/* ── Afgeronde verzoeken ── */}
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
                    <div key={req.id} className="doc-row">
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
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Documenten van het team ── */}
          {teamFiles.length > 0 && (
            <section className="my-docs__section">
              <h2 className="my-docs__section-title">
                <i className="fa-solid fa-building" style={{ color: 'var(--accent-primary, #4A90D9)' }} />
                Van het projectteam
              </h2>
              <div className="doc-list">
                {teamFiles.map(file => (
                  <FileRow key={file.id} file={file} userId={user?.id} onDownload={download} onRemove={remove} />
                ))}
              </div>
            </section>
          )}

          {/* ── Eigen uploads ── */}
          {myUploads.length > 0 && (
            <section className="my-docs__section">
              <h2 className="my-docs__section-title">
                <i className="fa-solid fa-user" style={{ color: 'var(--text-secondary)' }} />
                Mijn uploads
              </h2>
              <div className="doc-list">
                {myUploads.map(file => (
                  <FileRow key={file.id} file={file} userId={user?.id} onDownload={download} onRemove={remove} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function RequestCard({ request, uploading, onUpload, onDownload }) {
  const sc = STATUS_CONFIG[request.status]
  const isOverdue = request.deadline && new Date(request.deadline) < new Date() && request.status === 'pending'

  return (
    <div className={`request-card ${isOverdue ? 'request-card--overdue' : ''}`}>
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
        <div className="request-card__response">
          <i className="fa-solid fa-check" style={{ color: 'var(--accent-green, #3BD269)' }} />
          <span>Ingediend: {request.response_file.file_name}</span>
        </div>
      )}

      <div className="request-card__actions">
        {request.status === 'pending' && (request.type === 'upload_request' || request.type === 'sign_request') && (
          <button className="btn-primary btn-sm" onClick={onUpload} disabled={uploading}>
            <i className={`fa-solid ${uploading ? 'fa-spinner fa-spin' : 'fa-upload'}`} />
            {uploading ? 'Uploaden...' : request.type === 'sign_request' ? 'Getekend uploaden' : 'Document uploaden'}
          </button>
        )}
        {request.status === 'submitted' && (
          <span className="request-card__status-badge" style={{ background: sc.bg, color: sc.color }}>
            <i className="fa-solid fa-clock" /> Wacht op beoordeling
          </span>
        )}
      </div>

      <div className="request-card__meta">
        <span>{CATEGORY_LABELS[request.category] || request.category}</span>
        <span>{timeAgo(request.created_at)}</span>
      </div>
    </div>
  )
}

function FileRow({ file, userId, onDownload, onRemove }) {
  const icon = fileIcon(file.file_type || file.file_name)
  const iconColor = fileIconColor(file.file_type || file.file_name)
  const isMine = file.uploaded_by === userId

  return (
    <div
      className="doc-row"
      style={{ cursor: 'pointer' }}
      onClick={() => onDownload(file.id, file.file_path, file.file_name)}
    >
      <div className="doc-row__icon" style={{ color: iconColor }}>
        <i className={icon} />
      </div>
      <div className="doc-row__info">
        <span className="doc-row__title">{file.title}</span>
        <div className="doc-row__meta">
          <span
            className="doc-row__source"
            style={{
              background: isMine ? 'rgba(59, 210, 105, 0.12)' : 'var(--accent-primary-light, rgba(74, 144, 217, 0.12))',
              color: isMine ? '#3BD269' : 'var(--accent-primary, #4A90D9)',
            }}
          >
            {isMine ? 'Eigen upload' : (CATEGORY_LABELS[file.category] || file.category)}
          </span>
          {file.file_size > 0 && <span>{formatFileSize(file.file_size)}</span>}
          <span>{timeAgo(file.created_at)}</span>
        </div>
        {file.description && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {file.description}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        {isMine && (
          <button
            className="btn-icon-sm"
            onClick={e => { e.stopPropagation(); onRemove(file.id) }}
            title="Verwijderen"
            style={{ color: 'var(--accent-red)' }}
          >
            <i className="fa-solid fa-trash" />
          </button>
        )}
        <div style={{ color: 'var(--text-tertiary)', fontSize: 16 }}>
          <i className="fa-solid fa-download" />
        </div>
      </div>
    </div>
  )
}
