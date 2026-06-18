import { supabase } from './supabase'

const MAX_IMAGE_SIZE = 1024 * 1024 // 1 MB
const MAX_IMAGE_WIDTH = 1920
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const ALLOWED_FILE_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'csv', 'rtf', 'odt', 'ods',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
  'mp4', 'mov', 'mp3', 'wav',
  'zip', 'rar',
])

function validateFile(file) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Bestand is te groot (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`)
  }
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !ALLOWED_FILE_EXTENSIONS.has(ext)) {
    throw new Error(`Bestandstype .${ext} is niet toegestaan`)
  }
}

/**
 * Compress an image file to max 1MB / 1920px wide.
 * Returns the original file if it's not an image or already small enough.
 */
async function compressImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  if (file.size <= MAX_IMAGE_SIZE) return file

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img

      // Scale down if wider than max
      if (width > MAX_IMAGE_WIDTH) {
        height = Math.round(height * (MAX_IMAGE_WIDTH / width))
        width = MAX_IMAGE_WIDTH
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      // Try progressively lower quality until under 1MB
      let quality = 0.85
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (blob.size > MAX_IMAGE_SIZE && quality > 0.3) {
              quality -= 0.1
              tryCompress()
            } else {
              resolve(new File([blob], file.name, { type: 'image/jpeg' }))
            }
          },
          'image/jpeg',
          quality
        )
      }
      tryCompress()
    }
    img.onerror = () => resolve(file) // fallback to original
    img.src = URL.createObjectURL(file)
  })
}

export async function uploadImage(file, bucket = 'post-images') {
  const compressed = await compressImage(file)
  const ext = compressed.type === 'image/jpeg' ? 'jpg' : file.name.split('.').pop()
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage.from(bucket).upload(filename, compressed)
  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(filename)
  return data.publicUrl
}

/**
 * Upload a file to a (private) bucket. Returns only the storage `path`.
 *
 * `pathPrefix` scopes the object into a folder, e.g. `${projectId}/${profileId}`
 * for member-files — the storage RLS policy treats the LAST folder segment as
 * the owner, so member self-uploads must end in the owner's profile id.
 *
 * We intentionally do NOT return a public URL: project-files and member-files
 * are private buckets, so callers must store the `path` and resolve a
 * short-lived signed URL on demand via `getSignedUrl()`.
 */
export async function uploadFile(file, bucket = 'project-files', pathPrefix = '') {
  validateFile(file)
  const ext = file.name.split('.').pop().toLowerCase()
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const path = pathPrefix ? `${pathPrefix.replace(/\/+$/, '')}/${filename}` : filename

  const { error } = await supabase.storage.from(bucket).upload(path, file)
  if (error) throw error

  return { path }
}

/**
 * Normalise a stored file reference to a bare storage object path.
 *
 * Accepts either a bare path (`documents/<projectId>/<file>`) or a legacy full
 * public URL (rows created before the private-bucket migration stored
 * `getPublicUrl(...)`). Used both for signing and for deletion.
 */
export function toStoragePath(pathOrUrl, bucket = 'project-files') {
  if (!pathOrUrl) return null
  const marker = `/${bucket}/`
  let path = pathOrUrl.includes(marker)
    ? pathOrUrl.split(marker)[1].split('?')[0]
    : pathOrUrl
  // Legacy public URLs are percent-encoded; storage object names are not.
  try { path = decodeURIComponent(path) } catch { /* keep as-is */ }
  return path
}

/**
 * Resolve a stored file reference to a short-lived signed URL.
 *
 * Returns null on failure so callers can degrade gracefully. The signed URL is
 * enforced by RLS, so it only succeeds when the current user may actually read
 * the underlying document.
 */
export async function getSignedUrl(pathOrUrl, { bucket = 'project-files', expiresIn = 120 } = {}) {
  const path = toStoragePath(pathOrUrl, bucket)
  if (!path) return null

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
  if (error) {
    console.error('getSignedUrl failed', error)
    return null
  }
  return data.signedUrl
}

/** Resolve a signed URL and open it in a new tab. */
export async function openProjectFile(pathOrUrl, bucket = 'project-files') {
  const url = await getSignedUrl(pathOrUrl, { bucket })
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}
