import { useRef } from 'react'

/**
 * Wrapper for legal document pages — adds a print/download-as-PDF button
 * and consistent layout.
 */
export default function LegalDocumentPage({ title, updatedDate, children, backTo = '/legal' }) {
  const contentRef = useRef(null)

  function handlePrint() {
    window.print()
  }

  return (
    <div className="login-page" style={{ alignItems: 'flex-start', overflow: 'auto' }}>
      <div
        ref={contentRef}
        className="cl-card cl-card--elevated legal-document"
        style={{ maxWidth: 720, margin: '40px auto', padding: '32px 28px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <h1 style={{ margin: 0 }}>{title}</h1>
          <button
            className="cl-btn cl-btn--ghost"
            onClick={handlePrint}
            title="Download als PDF"
            style={{ flexShrink: 0, marginLeft: 16 }}
          >
            <i className="fa-solid fa-file-pdf" />{' '}
            <span className="hide-on-print">Download PDF</span>
          </button>
        </div>
        {updatedDate && (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 24 }}>
            Laatst bijgewerkt: {updatedDate}
          </p>
        )}

        {children}

        <div className="hide-on-print" style={{ marginTop: 32, textAlign: 'center' }}>
          <a href={backTo} className="cl-btn cl-btn--primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            <i className="fa-solid fa-arrow-left" /> Terug
          </a>
        </div>
      </div>
    </div>
  )
}
