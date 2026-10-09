import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { useToast } from '../components/Toast'
import { logger, friendlyError } from '../lib/logger'
import { renderSignedPdf } from '../lib/signature/render-signed-pdf'
import { downloadProjectFile } from '../lib/storage'
import SignaturePad from '../components/SignaturePad'

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
  // Echte krabbel (PNG-blob uit SignaturePad): getekend of geüpload.
  const [signatureBlob, setSignatureBlob] = useState(null)
  // Invulregels die het lid zelf op de PDF zet (bv. NAW op de stippellijnen).
  // x/y genormaliseerd (0..1) = linksboven van de tekst; size in PDF-punten.
  const [annotations, setAnnotations] = useState([])
  const [annotateMode, setAnnotateMode] = useState(false)
  const [activeAnnotation, setActiveAnnotation] = useState(null)
  // De pagina-wrappers uit de pdfjs-render, zodat we er met portals een
  // React-laag (invulregels) overheen kunnen leggen.
  const [pageEls, setPageEls] = useState([])

  // NAW-velden — worden zowel op het handtekening-blok gerenderd, op de
  // audit-pagina, opgeslagen als snapshot op de signer-rij, én bij submit
  // teruggeschreven naar het profiel zodat het lid het maar één keer hoeft
  // in te vullen (volgende tekenverzoeken zijn direct compleet).
  const [naw, setNaw] = useState({
    street_address: '',
    postal_code: '',
    city: '',
    date_of_birth: '',
    phone: '',
  })

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
            countersigned_at, countersigned_file_path,
            creator:profiles!created_by(full_name),
            org:organizations!org_id(name)
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
        countersigned_at: data.request.countersigned_at ?? null,
        countersigned_file_path: data.request.countersigned_file_path ?? null,
        org_name: data.request.org?.name ?? null,
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

      // Plaats + NAW voor-invullen vanuit profiel — lid ziet meteen wat we
      // hebben en hoeft alleen aan te vullen wat ontbreekt.
      if (profile?.city) setPlace(profile.city)
      setNaw({
        street_address: profile?.street_address ?? '',
        postal_code: profile?.postal_code ?? '',
        city: profile?.city ?? '',
        date_of_birth: profile?.date_of_birth ?? '',
        phone: profile?.phone ?? '',
      })

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
        const wraps = []

        for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
          const page = await doc.getPage(pageNum)
          const viewport = page.getViewport({ scale: 1.3 })
          const base = page.getViewport({ scale: 1 }) // afmetingen in PDF-punten

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
          wraps.push({ page: pageNum, el: wrap, widthPt: base.width, heightPt: base.height })
          const ctx = canvas.getContext('2d')
          await page.render({ canvasContext: ctx, viewport }).promise
        }
        if (!cancelled) setPageEls(wraps)

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
    if (!naw.street_address.trim()) { toast.error('Vul je adres in.'); return }
    if (!naw.postal_code.trim()) { toast.error('Vul je postcode in.'); return }
    if (!naw.city.trim()) { toast.error('Vul je woonplaats in.'); return }
    if (!signatureBlob) { toast.error('Zet eerst je handtekening (tekenen of foto uploaden).'); return }
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

      // NAW-snapshot voor rendering + audit + DB
      const nawSnapshot = {
        street_address: naw.street_address.trim(),
        postal_code: naw.postal_code.trim(),
        city: naw.city.trim(),
        date_of_birth: naw.date_of_birth || null,
        phone: naw.phone.trim() || null,
      }

      // Lege invulregels weglaten; alleen wat het lid echt getypt heeft.
      const cleanAnnotations = annotations
        .filter(a => a.text.trim())
        .map(a => ({ page: a.page, x: a.x, y: a.y, text: a.text.trim(), size: a.size }))

      // Krabbel-PNG: eerst uploaden (naast de getekende PDF), zodat de
      // tegentekening door de organisatie hem later opnieuw kan plaatsen.
      const signaturePng = new Uint8Array(await signatureBlob.arrayBuffer())
      const signaturePath = `${signer.org_id}/${signer.request_id}/signed-${signer.signer_id}.png`
      const { error: sigUpErr } = await supabase.storage
        .from('signatures')
        .upload(signaturePath, signatureBlob, { contentType: 'image/png', upsert: true })
      if (sigUpErr) throw new Error(`Handtekening uploaden mislukt: ${sigUpErr.message}`)

      // Defensief: kopie maken zodat eventuele toekomstige transfers door
      // pdf-lib of crypto.subtle de bron-bytes niet kunnen detachen.
      const { signedBytes } = await renderSignedPdf({
        originalPdf: pdfBytes.slice(),
        signature: signer,
        signer: { full_name: profile?.full_name ?? user?.email ?? 'Onbekend', email: user?.email ?? null },
        naw: nawSnapshot,
        place: place.trim(),
        signedIp,
        signaturePng,
        annotations: cleanAnnotations,
      })

      // Profiel bijwerken met de NAW die het lid nu heeft ingevuld — zo hoeft
      // het bij volgende tekenverzoeken niet opnieuw. Alleen velden die
      // afwijken van de profielwaarde overschrijven we niet nodeloos; supabase
      // update overschrijft alleen wat we meesturen.
      const profileUpdates = {}
      if (nawSnapshot.street_address !== (profile?.street_address ?? '')) profileUpdates.street_address = nawSnapshot.street_address
      if (nawSnapshot.postal_code   !== (profile?.postal_code   ?? '')) profileUpdates.postal_code   = nawSnapshot.postal_code
      if (nawSnapshot.city          !== (profile?.city          ?? '')) profileUpdates.city          = nawSnapshot.city
      if (nawSnapshot.date_of_birth && nawSnapshot.date_of_birth !== profile?.date_of_birth) profileUpdates.date_of_birth = nawSnapshot.date_of_birth
      if (nawSnapshot.phone && nawSnapshot.phone !== profile?.phone) profileUpdates.phone = nawSnapshot.phone
      if (Object.keys(profileUpdates).length > 0) {
        const { error: profErr } = await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', user.id)
        if (profErr) logger.error('Profiel-update mislukt', profErr)
        // Faalt stil: teken-flow gaat door zelfs als profile-write faalt.
      }

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
          signed_naw_snapshot: nawSnapshot,
          signed_file_path: signedPath,
          signed_signature_path: signaturePath,
          signed_annotations: cleanAnnotations.length ? cleanAnnotations : null,
        })
        .eq('id', signer.signer_id)
      if (updateErr) throw new Error(friendlyError(updateErr))

      // signature_requests → 'completed' wordt server-side door een trigger
      // (sig_maybe_complete_request) afgehandeld. Als signer hebben we geen
      // schrijfrechten op signature_requests, dus een client-side update
      // zou hier stil falen.

      toast.success('Document getekend')
      navigate(`${basePath}/mijn-documenten`)
    } catch (err) {
      logger.error('Tekenen mislukt', err)
      toast.error(err.message || 'Tekenen mislukt. Probeer opnieuw.')
      setSubmitting(false)
    }
  }, [signer, pdfBytes, place, naw, agreed, signatureBlob, annotations, profile, user, basePath, navigate, toast])

  // Invulregels beheren
  const addAnnotation = useCallback((page, x, y) => {
    const id = crypto.randomUUID()
    setAnnotations(prev => [...prev, { id, page, x, y, text: '', size: 10 }])
    setActiveAnnotation(id)
  }, [])
  const updateAnnotation = useCallback((id, patch) => {
    setAnnotations(prev => prev.map(a => (a.id === id ? { ...a, ...patch } : a)))
  }, [])
  const removeAnnotation = useCallback((id) => {
    setAnnotations(prev => prev.filter(a => a.id !== id))
  }, [])

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
          {signer.countersigned_file_path ? (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                {signer.org_name || 'De organisatie'} heeft het op {new Date(signer.countersigned_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })} bevestigd; daarmee is het rond.
              </p>
              <SignedDownloadButton signedPath={signer.countersigned_file_path} title={signer.title} label="Download volledig getekende versie" />
            </>
          ) : (
            <SignedDownloadButton signedPath={signer.signed_file_path} title={signer.title} />
          )}
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
        {annotateMode && (
          <div style={{
            position: 'sticky', top: 72, zIndex: 2, marginBottom: 8, padding: '8px 12px',
            background: 'var(--accent-primary, #4A90D9)', color: '#fff', borderRadius: 8, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <span><i className="fa-solid fa-i-cursor" /> Klik op het document waar je tekst wilt zetten. Typ, en klik ergens anders voor de volgende regel.</span>
            <button type="button" onClick={() => { setAnnotateMode(false); setActiveAnnotation(null) }} style={{ background: '#fff', color: 'var(--accent-primary, #4A90D9)', border: 'none', borderRadius: 6, padding: '4px 10px', fontWeight: 600, cursor: 'pointer' }}>
              Klaar
            </button>
          </div>
        )}
        <div ref={canvasContainerRef} style={{ overflowX: 'auto' }} />
        {pageEls.map(({ page, el, widthPt }) => createPortal(
          <AnnotationLayer
            key={page}
            page={page}
            pageWidthPt={widthPt}
            annotations={annotations.filter(a => a.page === page)}
            active={annotateMode && !submitting}
            activeId={activeAnnotation}
            onAdd={(x, y) => addAnnotation(page, x, y)}
            onChange={updateAnnotation}
            onRemove={removeAnnotation}
            onFocus={setActiveAnnotation}
          />,
          el,
        ))}
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
          Je handtekening, naam, plaats en de datum komen op de gemarkeerde plek in het document. Een certificaat-pagina met hash en tijdstip wordt achteraan toegevoegd.
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

        {/* --- Persoonsgegevens (worden ook naar profiel geschreven) --- */}
        <SignFormField label="Naam" readOnly value={profile?.full_name ?? user?.email ?? ''} />

        <SignFormField
          label="Adres"
          required
          value={naw.street_address}
          onChange={v => setNaw(p => ({ ...p, street_address: v }))}
          placeholder="Voorbeeldstraat 12"
          disabled={submitting}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 8, marginBottom: 12 }}>
          <SignFormField
            label="Postcode"
            required
            noMargin
            value={naw.postal_code}
            onChange={v => setNaw(p => ({ ...p, postal_code: v }))}
            placeholder="1234 AB"
            disabled={submitting}
          />
          <SignFormField
            label="Woonplaats"
            required
            noMargin
            value={naw.city}
            onChange={v => setNaw(p => ({ ...p, city: v }))}
            placeholder="Amsterdam"
            disabled={submitting}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <SignFormField
            label="Geboortedatum"
            optional
            noMargin
            type="date"
            value={naw.date_of_birth ?? ''}
            onChange={v => setNaw(p => ({ ...p, date_of_birth: v }))}
            disabled={submitting}
          />
          <SignFormField
            label="Telefoon"
            optional
            noMargin
            value={naw.phone}
            onChange={v => setNaw(p => ({ ...p, phone: v }))}
            placeholder="+31 6 …"
            disabled={submitting}
          />
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: -6, marginBottom: 14 }}>
          Deze gegevens komen op het contract én worden op je profiel opgeslagen zodat je ze niet opnieuw hoeft in te vullen.
        </p>

        {/* --- Invullen op het document --- */}
        <div style={{ marginBottom: 14, paddingTop: 12, borderTop: '1px solid var(--border-default)' }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
            Invullen op het document
            <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> (optioneel)</span>
          </label>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 8px' }}>
            Staan er stippellijnen of vragen in het document? Zet je antwoord er direct op, zoals in Acrobat.
          </p>
          <button
            type="button"
            className={annotateMode ? 'btn-primary' : 'btn-secondary'}
            onClick={() => { setAnnotateMode(m => !m); setActiveAnnotation(null) }}
            disabled={submitting}
            style={{ width: '100%', fontSize: 13 }}
          >
            <i className="fa-solid fa-i-cursor" />
            {annotateMode ? 'Klaar met invullen' : annotations.length ? `Tekst toevoegen (${annotations.filter(a => a.text.trim()).length} regel${annotations.filter(a => a.text.trim()).length === 1 ? '' : 's'})` : 'Tekst toevoegen'}
          </button>
        </div>

        {/* --- Ondertekening --- */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
            Handtekening<span style={{ color: 'var(--accent-red)' }}> *</span>
          </label>
          <SignaturePad onChange={setSignatureBlob} disabled={submitting} height={150} />
        </div>

        <SignFormField
          label="Plaats van ondertekening"
          required
          value={place}
          onChange={setPlace}
          placeholder="Bv. Amsterdam"
          disabled={submitting}
        />

        <SignFormField
          label="Datum"
          readOnly
          value={new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
        />

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
          disabled={submitting || !agreed || !place.trim() || !signatureBlob}
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

// Laag over één PDF-pagina met de invulregels van het lid. In "active"-modus
// voegt een klik op lege ruimte een nieuwe regel toe; bestaande regels zijn
// altijd te bewerken/verwijderen. Lettergrootte schaalt mee met de
// pagina-breedte zodat wat je ziet overeenkomt met de PDF.
function AnnotationLayer({ page, pageWidthPt, annotations, active, activeId, onAdd, onChange, onRemove, onFocus }) {
  const ref = useRef(null)
  const [scale, setScale] = useState(1) // css-px per PDF-punt

  useLayoutEffect(() => {
    function measure() {
      if (ref.current && pageWidthPt) setScale(ref.current.clientWidth / pageWidthPt)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [pageWidthPt])

  function onClick(e) {
    if (!active || e.target !== e.currentTarget) return
    const r = e.currentTarget.getBoundingClientRect()
    onAdd((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
  }

  return (
    <div
      ref={ref}
      data-page={page}
      onClick={onClick}
      style={{ position: 'absolute', inset: 0, pointerEvents: active ? 'auto' : 'none', cursor: active ? 'text' : 'default', zIndex: 1 }}
    >
      {annotations.map(a => {
        const px = Math.max(8, a.size * scale)
        const isActive = a.id === activeId
        return (
          <div
            key={a.id}
            style={{ position: 'absolute', left: `${a.x * 100}%`, top: `${a.y * 100}%`, display: 'flex', alignItems: 'flex-start', gap: 2, pointerEvents: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <input
              autoFocus={isActive}
              value={a.text}
              placeholder="Typ hier…"
              onChange={e => onChange(a.id, { text: e.target.value })}
              onFocus={() => onFocus(a.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }}
              size={Math.max(4, a.text.length + 1)}
              style={{
                fontSize: px, lineHeight: 1, padding: '0 1px', margin: 0,
                fontFamily: 'Helvetica, Arial, sans-serif', color: '#1a1a1a',
                background: isActive ? 'rgba(74,144,217,0.10)' : 'transparent',
                border: `1px ${a.text ? 'dotted' : 'dashed'} rgba(74,144,217,0.7)`, borderRadius: 2, outline: 'none',
              }}
            />
            <button
              type="button"
              title="Regel verwijderen"
              onClick={() => onRemove(a.id)}
              style={{ fontSize: Math.max(10, px * 0.9), lineHeight: 1, padding: '0 3px', border: 'none', background: 'rgba(255,255,255,0.85)', color: 'var(--accent-red, #E53E3E)', borderRadius: 3, cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}

// Uniform input-veld voor het teken-form. Houdt de JSX beknopt en de styling
// consistent (Clean DS via var()'s uit index.css).
function SignFormField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  optional = false,
  readOnly = false,
  disabled = false,
  noMargin = false,
}) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : 12 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
        {label}
        {required && <span style={{ color: 'var(--accent-red)' }}> *</span>}
        {optional && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> (optioneel)</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '8px 10px',
          borderRadius: 6,
          border: '1px solid var(--border-default)',
          background: readOnly ? 'var(--surface-secondary, #f5f5f7)' : 'transparent',
          fontSize: 14,
        }}
      />
    </div>
  )
}

function SignedDownloadButton({ signedPath, title, label = 'Download getekende versie' }) {
  const [busy, setBusy] = useState(false)
  async function onDownload() {
    if (!signedPath) return
    setBusy(true)
    const fileName = title ? `${title.replace(/[\\/:*?"<>|]/g, '-')}.pdf` : undefined
    await downloadProjectFile(signedPath, { bucket: 'signatures', fileName })
    setBusy(false)
  }
  return (
    <button className="btn-primary" onClick={onDownload} disabled={busy || !signedPath}>
      <i className="fa-solid fa-download" />
      {busy ? 'Laden…' : label}
    </button>
  )
}
