import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getSignedUrl } from '../lib/storage'

/**
 * Resolves a document share link (buuur.nl/d/<code>) to the actual file.
 *
 * Sits behind AuthGuard, so the visitor is always logged in. The lookup and the
 * signed-URL request both run as the user, so RLS decides whether they may see
 * the document — exactly the same visibility rules as the in-app document list.
 * No access → friendly "geen toegang" message instead of the file.
 */
export default function DocumentShare() {
  const { code } = useParams()
  const [status, setStatus] = useState('loading') // loading | notfound

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      const { data: doc, error } = await supabase
        .from('documents')
        .select('doc_type, url, file_path')
        .eq('share_code', code)
        .maybeSingle()

      if (cancelled) return
      if (error || !doc) { setStatus('notfound'); return }

      // External-link documents go straight to their URL.
      if (doc.doc_type === 'link' && doc.url) {
        window.location.replace(doc.url)
        return
      }

      const signed = await getSignedUrl(doc.file_path)
      if (cancelled) return
      if (!signed) { setStatus('notfound'); return }
      window.location.replace(signed)
    }

    resolve()
    return () => { cancelled = true }
  }, [code])

  if (status === 'notfound') {
    return (
      <div className="error-boundary">
        <div className="error-boundary__card">
          <i className="fa-solid fa-file-circle-question error-boundary__icon" style={{ color: 'var(--text-tertiary)' }} />
          <h2>Document niet gevonden</h2>
          <p>Deze deellink bestaat niet meer, of je hebt geen toegang tot dit document.</p>
          <button className="btn-primary" onClick={() => window.location.href = '/'}>
            <i className="fa-solid fa-house" /> Naar home
          </button>
        </div>
      </div>
    )
  }

  return <div className="loading-page"><p>Document openen…</p></div>
}
