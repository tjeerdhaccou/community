import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { useToast } from '../components/Toast'
import { logger, friendlyError } from '../lib/logger'
import { renderSignedPdf } from '../lib/signature/render-signed-pdf'

export default function Tekenen() {
  const { id } = useParams() // signer_id
  const { user, profile } = useAuth()
  const { basePath } = useProject()
  const navigate = useNavigate()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [signer, setSigner] = useState(null) // joined met request
  const [pdfBytes, setPdfBytes] = useState(null)
  const [error, setError] = useState(null)

  // Tekenform-state
  const [place, setPlace] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Weigeren-modal
  const [declining, setDeclining] = useState(false)
  const [declineReason, setDeclineReason] = useState('')

  // PDF preview
  const canvasContainerRef = useRef(null)
  const placementMarkerRef = useRef(null)

  // 1. Verzoek + signer-rij laden + viewed_at zetten als eerste keer.
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user?.id || !id) return
      setLoading(true)

      const { data, error: fetchErr } = await supabase
        .from('signature_request_signers')
        .select(`
          id, status, viewed_at, signed_at, signed_place, signed_file_path, decline_reason,
          placement_page, placement_x_norm, placement_y_norm, placement_width_norm, placement_height_norm,
          request:signature_requests!request_id(
            id, title, description, file_path, file_name, file_size, file_sha256,
            status, due_at, created_at, project_id, org_id,
            creator:profiles!created_by(full_name)
          )
        `)
        .eq('id', id)
        .eq('profile_id', user.id)
        .maybeSingle()

      if (cancelled) return

      if (fetchErr || !data) {
        logger.error('Signer-rij laden mislukt', fetchErr)
        setError('Dit tekenverzoek bestaat niet of je hebt er geen toegang toe.')
        setLoading(false)
        return
      }

      const mapped = {
        signer_id: data.id,
        status: data.status,
        viewed_at: data.viewed_at,
        signed_at: data.signed_at,
        signed_place: data.signed_place,
        signed_file_path: data.signed_file_path,
        decline_reason: data.decline_reason,
        placement: data.placement_page ? {
          page: data.placement_page,
          x: Number(data.placement_x_norm),
          y: Number(data.placement_y_norm),
          width: Number(data.placement_width_norm),
          height: Number(data.placement_height_norm),
        } : null,
        title: data.request.title,
        description: data.request.description,
        file_path: data.request.file_path,
        file_name: data.request.file_name,
        file_size: data.request.file_size,
        file_sha256: data.request.file_sha256,
        request_id: data.request.id,
        request_status: data.request.status,
        due_at: data.request.due_at,
        org_id: data.request.org_id,
        creator_name: data.request.creator?.full_name ?? null,
      }
      setSigner(mapped)

      // viewed-flag bij eerste opening (best-effort, niet kritisch)
      if (data.status === 'pending') {
        await supabase
          .from('signature_request_signers')
          .update({ status: 'viewed', viewed_at: new Date().toISOString() })
          .eq('id', data.id)
      }

      // Plaats voor-invullen vanuit profiel als beschikbaar
      if (profile?.city) setPlace(profile.city)

      // Origineel PDF downloaden (signed URL want bucket is private)
      const { data: urlData, error: urlErr } = await supabase.storage
        .from('signatures')
        .createSignedUrl(data.request.file_path, 300)
      if (urlErr || !urlData?.signedUrl) {
        logger.error('Signed URL voor PDF mislukt', urlErr)
        setError('Het document kon niet geladen worden.')
        setLoading(false)
        return
      }
      try {
        const res = await fetch(urlData.signedUrl)
        const buf = new Uint8Array(await res.arrayBuffer())
        if (cancelled) return
        setPdfBytes(buf)
      } catch (e) {
        logger.error('PDF download mislukt', e)
        setError('Het document kon niet geladen worden.')
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [id, user?.id, profile?.city])

  // 2. PDF renderen naar canvases zodra bytes binnen zijn.
  useEffect(() => {
    if (!pdfBytes || !canvasContainerRef.current) return
    let cancelled = false
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        // pdfjs draagt de buffer over naar zijn worker thread (transferable) —
        // dat detacht het origineel. We sturen een kopie zodat onze bytes
        // intact blijven voor de signing-flow én voor de hash-verify.
        const doc = await pdfjs.getDocument({ data: pdfBytes.slice() }).promise
        if (cancelled) return

        const container = canvasContainerRef.current
        container.innerHTML = ''

        for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
          const page = await doc.getPage(pageNum)
          const viewport = page.getViewport({ scale: 1.3 })

          const wrap = document.createElement('div')
          wrap.style.position = 'relative'
          wrap.style.margin = '0 auto 12px'
          wrap.style.width = `${viewport.width}px`
          wrap.style.maxWidth = '100%'
          wrap.dataset.page = String(pageNum)

          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.style.width = '100%'
          canvas.style.height = 'auto'
          canvas.style.display = 'block'
          canvas.style.borderRadius = '4px'
          canvas.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
          wrap.appendChild(canvas)

          // Marker overlay voor signer's placement (alleen op juiste pagina)
          if (signer?.placement && signer.placement.page === pageNum) {
            const p = signer.placement
            const marker = document.createElement('div')
            marker.style.position = 'absolute'
            marker.style.left = `${p.x * 100}%`
            marker.style.top = `${p.y * 100}%`
            marker.style.width = `${p.width * 100}%`
            marker.style.height = `${p.height * 100}%`
            marker.style.transform = 'translate(-50%, -50%)'
            marker.style.border = '2px dashed var(--accent-primary, #4A90D9)'
            marker.style.background = 'rgba(74, 144, 217, 0.10)'
            marker.style.borderRadius = '4px'
            marker.style.pointerEvents = 'none'
            const label = document.createElement('span')
            label.textContent = 'Hier komt jouw handtekening'
            label.style.position = 'absolute'
            label.style.top = '-22px'
            label.style.left = '0'
            label.style.fontSize = '11px'
            label.style.padding = '2px 6px'
            label.style.borderRadius = '4px'
            label.style.background = 'var(--accent-primary, #4A90D9)'
            label.style.color = '#fff'
            label.style.whiteSpace = 'nowrap'
            marker.appendChild(label)
            wrap.appendChild(marker)
            placementMarkerRef.current = marker
          }

          container.appendChild(wrap)
          const ctx = canvas.getContext('2d')
          await page.render({ canvasContext: ctx, viewport }).promise
        }

        // Auto-scroll naar de placement-marker als die er is
        if (placementMarkerRef.current) {
          setTimeout(() => {
            placementMarkerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 300)
        }
      } catch (e) {
        if (!cancelled) {
          logger.error('PDF render mislukt', e)
          setError('De PDF kon niet weergegeven worden.')
        }
      }
    })()
    return () => { cancelled = true }
  }, [pdfBytes, signer?.placement?.page])

  // 3. Tekenen-action
  const onSign = useCallback(async () => {
    if (!signer || !pdfBytes) return
    if (!place.trim()) { toast.error('Vul je plaats in.'); return }
    if (!agreed) { toast.error('Vink eerst het akkoord aan.'); return }
    if (signer.request_status !== 'open') { toast.error('Dit verzoek is niet meer actief.'); return }

    setSubmitting(true)
    try {
      // Server-side IP-lookup via edge function (CSP staat externe IP-services
      // niet toe; edge functions zitten wél op de whitelist). Faalt stil naar
      // null — niet kritisch voor SES-geldigheid.
      let signedIp = null
      try {
        const { data: ipData } = await supabase.functions.invoke('get-client-ip')
        signedIp = ipData?.ip ?? null
      } catch (e) {
        logger.error('get-client-ip mislukt', e)
      }

      // Defensief: kopie maken zodat eventuele toekomstige transfers door
      // pdf-lib of crypto.subtle de bron-bytes niet kunnen detachen.
      const { signedBytes } = await renderSignedPdf({
        originalPdf: pdfBytes.slice(),
        signature: signer,
        signer: { full_name: profile?.full_name ?? user?.email ?? 'Onbekend', email: user?.email ?? null },
        place: place.trim(),
        signedIp,
      })

      // Upload signed PDF
      const signedPath = `${signer.org_id}/${signer.request_id}/signed-${signer.signer_id}.pdf`
      const { error: upErr } = await supabase.storage
        .from('signatures')
        .upload(signedPath, signedBytes, { contentType: 'application/pdf', upsert: true })
      if (upErr) throw new Error(`Upload mislukt: ${upErr.message}`)

      // Signer-rij updaten
      const { error: updateErr } = await supabase
        .from('signature_request_signers')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
          signed_ip: signedIp,
          signed_user_agent: navigator.userAgent.slice(0, 500),
          signed_full_name: profile?.full_name ?? null,
          signed_email: user?.email ?? null,
          signed_place: place.trim(),
          signed_file_path: signedPath,
        })
        .eq('id', signer.signer_id)
      if (updateErr) throw new Error(friendlyError(updateErr))

      // Check of alle signers van dit request klaar zijn → request status completed
      const { data: remaining } = await supabase
        .from('signature_request_signers')
        .select('id')
        .eq('request_id', signer.request_id)
        .neq('status', 'signed')
      if ((remaining ?? []).length === 0) {
        await supabase
          .from('signature_requests')
          .update({ status: 'completed' })
          .eq('id', signer.request_id)
      }

      toast.success('Document getekend')
      navigate(`${basePath}/mijn-documenten`)
    } catch (err) {
      logger.error('Tekenen mislukt', err)
      toast.error(err.message || 'Tekenen mislukt. Probeer opnieuw.')
      setSubmitting(false)
    }
  }, [signer, pdfBytes, place, agreed, profile, user, basePath, navigate, toast])

  // Download van het originele document (vóór tekenen) — lid wil het rustig
  // kunnen lezen / offline doornemen voordat ze tekenen.
  const onDownloadOriginal = useCallback(async () => {
    if (!signer) return
    try {
      const { data, error: urlErr } = await supabase.storage
        .from('signatures')
        .createSignedUrl(signer.file_path, 120)
      if (urlErr || !data?.signedUrl) throw new Error(urlErr?.message || 'Geen URL')
      const res = await fetch(data.signedUrl)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = signer.file_name || 'document.pdf'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) {
      logger.error('Download mislukt', err)
      toast.error('Download mislukt — probeer opnieuw.')
    }
  }, [signer, toast])

  // 4. Weigeren-action
  const onDecline = useCallback(async () => {
    if (!signer) return
    setSubmitting(true)
    try {
      const { error: declineErr } = await supabase
        .from('signature_request_signers')
        .update({
          status: 'declined',
          decline_reason: declineReason.trim() || null,
        })
        .eq('id', signer.signer_id)
      if (declineErr) throw new Error(friendlyError(declineErr))
      toast.success('Verzoek geweigerd')
      navigate(`${basePath}/mijn-documenten`)
    } catch (err) {
      logger.error('Weigeren mislukt', err)
      toast.error(err.message || 'Weigeren mislukt.')
      setSubmitting(false)
    }
  }, [signer, declineReason, basePath, navigate, toast])

  // ===== Renderen =====

  if (loading) {
    return (
      <div className="view-tekenen">
        <div className="loading-inline"><p>Laden...</p></div>
      </div>
    )
  }

  if (error || !signer) {
    return (
      <div className="view-tekenen">
        <div className="empty-inline">
          <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--accent-orange, #F5A623)' }} />
          <h3 className="empty-inline__title">Niet beschikbaar</h3>
          <p>{error || 'Dit verzoek bestaat niet.'}</p>
          <button className="btn-primary" onClick={() => navigate(`${basePath}/mijn-documenten`)}>
            Terug naar Mijn documenten
          </button>
        </div>
      </div>
    )
  }

  // Reeds getekend
  if (signer.status === 'signed') {
    return (
      <div className="view-tekenen">
        <div className="empty-inline">
          <i className="fa-solid fa-circle-check" style={{ color: 'var(--accent-green, #3BD269)' }} />
          <h3 className="empty-inline__title">Al getekend</h3>
          <p>Je hebt dit document getekend op {new Date(signer.signed_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
          <SignedDownloadButton signedPath={signer.signed_file_path} title={signer.title} />
        </div>
      </div>
    )
  }

  // Geweigerd
  if (signer.status === 'declined') {
    return (
      <div className="view-tekenen">
        <div className="empty-inline">
          <i className="fa-solid fa-circle-xmark" style={{ color: 'var(--accent-red, #E53E3E)' }} />
          <h3 className="empty-inline__title">Geweigerd</h3>
          <p>Je hebt dit verzoek geweigerd{signer.decline_reason ? `: "${signer.decline_reason}"` : ''}.</p>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Neem contact op met de organisatie als je dit ongedaan wilt maken.</p>
        </div>
      </div>
    )
  }

  // Verzoek niet meer open
  if (signer.request_status !== 'open') {
    return (
      <div className="view-tekenen">
        <div className="empty-inline">
          <i className="fa-solid fa-ban" style={{ color: 'var(--accent-orange, #F5A623)' }} />
          <h3 className="empty-inline__title">Verzoek ingetrokken</h3>
          <p>De aanvrager heeft dit tekenverzoek ingetrokken.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="view-tekenen" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24, alignItems: 'start' }}>
      {/* Links: PDF preview */}
      <div>
        <div className="view-header" style={{ marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0 }}>{signer.title}</h1>
            {signer.creator_name && (
              <p className="view-header__subtitle">Aangevraagd door {signer.creator_name}</p>
            )}
          </div>
        </div>
        {signer.description && (
          <div style={{
            padding: 12,
            background: 'var(--surface-secondary, #f5f5f7)',
            borderRadius: 8,
            fontSize: 14,
            color: 'var(--text-secondary)',
            marginBottom: 16,
            whiteSpace: 'pre-wrap',
          }}>
            {signer.description}
          </div>
        )}
        <div ref={canvasContainerRef} style={{ overflowX: 'auto' }} />
      </div>

      {/* Rechts: tekenform (sticky) */}
      <aside style={{
        position: 'sticky',
        top: 80,
        background: 'var(--surface-primary, #fff)',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      }}>
        <h3 style={{ marginTop: 0, fontSize: 16 }}>Ondertekenen</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Je krabbel, naam, plaats en de datum komen op de gemarkeerde plek in het document. Een audit-pagina met hash en tijdstip wordt achteraan toegevoegd.
        </p>

        <button
          type="button"
          className="btn-secondary"
          onClick={onDownloadOriginal}
          disabled={submitting}
          style={{ width: '100%', marginBottom: 16, fontSize: 13 }}
        >
          <i className="fa-solid fa-download" />
          Download origineel om te lezen
        </button>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Naam</label>
          <input
            type="text"
            value={profile?.full_name ?? user?.email ?? ''}
            readOnly
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--surface-secondary, #f5f5f7)', fontSize: 14 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
            Plaats <span style={{ color: 'var(--accent-red)' }}>*</span>
          </label>
          <input
            type="text"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="Bv. Amsterdam"
            disabled={submitting}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-default)', fontSize: 14 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Datum</label>
          <input
            type="text"
            value={new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
            readOnly
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--surface-secondary, #f5f5f7)', fontSize: 14 }}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, margin: '16px 0', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            disabled={submitting}
            style={{ marginTop: 2 }}
          />
          <span>Ik heb het document gelezen en ga akkoord met de inhoud.</span>
        </label>

        <button
          type="button"
          className="btn-primary"
          onClick={onSign}
          disabled={submitting || !agreed || !place.trim()}
          style={{ width: '100%', marginBottom: 8 }}
        >
          <i className="fa-solid fa-signature" />
          {submitting ? 'Tekenen…' : 'Teken document'}
        </button>

        {!declining ? (
          <button
            type="button"
            onClick={() => setDeclining(true)}
            disabled={submitting}
            style={{ width: '100%', padding: 8, background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Verzoek weigeren
          </button>
        ) : (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-default)' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Reden (optioneel)</label>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              disabled={submitting}
              rows={2}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-default)', fontSize: 14, marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={onDecline}
                disabled={submitting}
                className="btn-secondary"
                style={{ flex: 1, color: 'var(--accent-red)' }}
              >
                Bevestig weigeren
              </button>
              <button
                type="button"
                onClick={() => { setDeclining(false); setDeclineReason('') }}
                disabled={submitting}
                style={{ padding: '8px 12px', background: 'transparent', border: 'none', fontSize: 13, cursor: 'pointer' }}
              >
                Annuleren
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

// Knop om de getekende PDF te downloaden (signed URL ophalen, openen in nieuwe tab).
function SignedDownloadButton({ signedPath, title }) {
  const [busy, setBusy] = useState(false)
  async function onDownload() {
    if (!signedPath) return
    setBusy(true)
    const { data, error } = await supabase.storage
      .from('signatures')
      .createSignedUrl(signedPath, 120)
    setBusy(false)
    if (error || !data) return
    window.open(data.signedUrl, '_blank')
  }
  return (
    <button className="btn-primary" onClick={onDownload} disabled={busy || !signedPath}>
      <i className="fa-solid fa-download" />
      {busy ? 'Laden…' : `Download getekende versie`}
    </button>
  )
}
