import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'

/**
 * Reusable image crop modal.
 * @param {string} imageSrc - Data URL or blob URL of the image
 * @param {number} aspect - Aspect ratio (1 for square logo, 16/9 for cover)
 * @param {boolean} round - Show circular crop area (for logos/avatars)
 * @param {function} onComplete - Called with cropped blob
 * @param {function} onCancel - Called when user cancels
 */
export default function ImageCropper({ imageSrc, aspect = 1, round = false, onComplete, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [saving, setSaving] = useState(false)

  const onCropComplete = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels)
  }, [])

  async function handleSave() {
    if (!croppedAreaPixels) return
    setSaving(true)
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels)
      onComplete(blob)
    } catch (err) {
      console.error('Crop failed:', err)
    }
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="image-cropper" onClick={e => e.stopPropagation()}>
        <div className="image-cropper__header">
          <h3>Afbeelding bijsnijden</h3>
          <button className="modal-close" onClick={onCancel} aria-label="Sluiten">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="image-cropper__area">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={round ? 'round' : 'rect'}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="image-cropper__controls">
          <div className="image-cropper__zoom">
            <i className="fa-solid fa-magnifying-glass-minus" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              aria-label="Zoom"
            />
            <i className="fa-solid fa-magnifying-glass-plus" />
          </div>
          <div className="image-cropper__actions">
            <button className="btn-secondary btn-sm" onClick={onCancel}>Annuleren</button>
            <button className="btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Bijsnijden...' : 'Toepassen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Helper: crop image on canvas and return blob ---
function getCroppedBlob(imageSrc, pixelCrop) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = pixelCrop.width
      canvas.height = pixelCrop.height
      const ctx = canvas.getContext('2d')

      ctx.drawImage(
        image,
        pixelCrop.x, pixelCrop.y,
        pixelCrop.width, pixelCrop.height,
        0, 0,
        pixelCrop.width, pixelCrop.height,
      )

      canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas toBlob failed'))
      }, 'image/jpeg', 0.92)
    }
    image.onerror = reject
    image.src = imageSrc
  })
}
