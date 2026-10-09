import { useEffect, useRef, useState, useCallback } from 'react'

// Handtekening-veld: tekenen met muis/vinger/pen, of een foto/scan uploaden.
// Geeft via onChange een PNG-Blob terug (transparante achtergrond bij tekenen,
// bijgesneden tot de getekende lijnen) of null als het veld leeg is.
//
// Gebruik: <SignaturePad onChange={blob => setSignature(blob)} />
export default function SignaturePad({ onChange, disabled = false, height = 160 }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const last = useRef(null)
  const [hasInk, setHasInk] = useState(false)
  const [uploadedUrl, setUploadedUrl] = useState(null) // preview van geüploade foto
  const fileInputRef = useRef(null)

  // Canvas op device-pixel-ratio zetten zodat lijnen scherp zijn.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.2
    ctx.strokeStyle = '#1a1a4a'
  }, [])

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const emit = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const blob = await trimmedPng(canvas)
    onChange?.(blob)
  }, [onChange])

  function onPointerDown(e) {
    if (disabled || uploadedUrl) return
    e.preventDefault()
    canvasRef.current.setPointerCapture?.(e.pointerId)
    drawing.current = true
    last.current = pos(e)
    const ctx = canvasRef.current.getContext('2d')
    // Een enkele tik zet ook een puntje — anders "doet" een stip niets.
    ctx.beginPath()
    ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2)
    ctx.fillStyle = ctx.strokeStyle
    ctx.fill()
    setHasInk(true)
  }
  function onPointerMove(e) {
    if (!drawing.current) return
    e.preventDefault()
    const p = pos(e)
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
  }
  function onPointerUp() {
    if (!drawing.current) return
    drawing.current = false
    emit()
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    setHasInk(false)
    if (uploadedUrl) URL.revokeObjectURL(uploadedUrl)
    setUploadedUrl(null)
    onChange?.(null)
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) return
    // Foto/scan naar PNG omzetten (max 1200px breed), zodat de PDF-renderer
    // altijd een PNG krijgt.
    const img = await loadImage(file)
    const maxW = 1200
    const scale = Math.min(1, maxW / img.width)
    const off = document.createElement('canvas')
    off.width = Math.round(img.width * scale)
    off.height = Math.round(img.height * scale)
    off.getContext('2d').drawImage(img, 0, 0, off.width, off.height)
    const blob = await new Promise(res => off.toBlob(res, 'image/png'))
    if (uploadedUrl) URL.revokeObjectURL(uploadedUrl)
    setUploadedUrl(URL.createObjectURL(blob))
    setHasInk(true)
    onChange?.(blob)
  }

  return (
    <div className="signature-pad">
      <div
        style={{
          position: 'relative',
          border: '1px dashed var(--border-default, #d0d0d8)',
          borderRadius: 8,
          background: 'var(--surface-primary, #fff)',
          height,
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            width: '100%',
            height: '100%',
            display: uploadedUrl ? 'none' : 'block',
            touchAction: 'none',
            cursor: disabled ? 'not-allowed' : 'crosshair',
          }}
        />
        {uploadedUrl && (
          <img
            src={uploadedUrl}
            alt="Geüploade handtekening"
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        )}
        {!hasInk && (
          <span
            style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none', color: 'var(--text-tertiary, #9ba1b0)', fontSize: 13,
            }}
          >
            Zet hier je handtekening
          </span>
        )}
        {/* Lijntje waar je "op" tekent */}
        {!uploadedUrl && (
          <span style={{ position: 'absolute', left: 16, right: 16, bottom: 28, borderTop: '1px solid var(--border-default, #e0e0e8)', pointerEvents: 'none' }} />
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 13 }}>
        <button type="button" className="btn-secondary" onClick={clear} disabled={disabled || !hasInk} style={{ fontSize: 13 }}>
          <i className="fa-solid fa-eraser" /> Wissen
        </button>
        <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={disabled} style={{ fontSize: 13 }}>
          <i className="fa-solid fa-camera" /> Foto of scan uploaden
        </button>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} style={{ display: 'none' }} />
      </div>
    </div>
  )
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}

// PNG van alleen het getekende deel (met wat marge), transparante achtergrond.
async function trimmedPng(canvas) {
  const ctx = canvas.getContext('2d')
  const { width, height } = canvas
  const data = ctx.getImageData(0, 0, width, height).data
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  const pad = 8
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad)
  maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad)
  const off = document.createElement('canvas')
  off.width = maxX - minX + 1
  off.height = maxY - minY + 1
  off.getContext('2d').drawImage(canvas, minX, minY, off.width, off.height, 0, 0, off.width, off.height)
  return await new Promise(res => off.toBlob(res, 'image/png'))
}
