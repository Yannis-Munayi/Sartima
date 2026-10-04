// Camera photos straight from a phone break every downstream consumer:
// Storage rules reject ≥10 MB or a non-image/* content type (HEIC picked on
// Windows/Chrome often arrives with an empty type), and the vision models
// reject oversized images and HEIC. Decoding through the browser and
// re-encoding gives a small, correctly-typed, upright image every time.

const STORAGE_MAX_EDGE = 2048
// Vision models downscale anything larger than this anyway
const VISION_MAX_EDGE  = 1568
const JPEG_QUALITY     = 0.85
// Already-small, already-web-safe images are uploaded untouched
const PASSTHROUGH_BYTES = 3 * 1024 * 1024
const WEB_SAFE_TYPES    = ['image/jpeg', 'image/png', 'image/webp']

export const UNSUPPORTED_IMAGE_MESSAGE =
  "This photo format isn't supported. Try a JPEG or PNG — on iPhone, set Settings → Camera → Formats → Most Compatible."

export class UnsupportedImageError extends Error {
  constructor() {
    super(UNSUPPORTED_IMAGE_MESSAGE)
    this.name = 'UnsupportedImageError'
  }
}

function decodeImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new UnsupportedImageError()) }
    img.src = url
  })
}

function encodeCanvas(img, maxEdge, type) {
  const scale  = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width  = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  if (type === 'image/jpeg') {
    // JPEG has no alpha — paint transparent areas white instead of black
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (out) => (out ? resolve(out) : reject(new Error('Image encode failed'))),
      type,
      type === 'image/jpeg' ? JPEG_QUALITY : undefined,
    )
  })
}

/**
 * Prepare a user-picked photo for Firebase Storage (closet pieces, avatar).
 * PNGs stay PNG so cut-out transparency survives; everything else becomes JPEG.
 * Throws UnsupportedImageError when the browser can't decode the file.
 * @param {File|Blob} file
 * @returns {Promise<Blob>}
 */
export async function normalizeForUpload(file) {
  const img = await decodeImage(file)
  const fitsAlready = WEB_SAFE_TYPES.includes(file.type)
    && file.size <= PASSTHROUGH_BYTES
    && Math.max(img.naturalWidth, img.naturalHeight) <= STORAGE_MAX_EDGE
  if (fitsAlready) return file
  return encodeCanvas(img, STORAGE_MAX_EDGE, file.type === 'image/png' ? 'image/png' : 'image/jpeg')
}

/**
 * Prepare a photo for outfit analysis: a JPEG well within the vision models' size limits.
 * @param {File|Blob} file
 * @returns {Promise<{ base64: string, mimeType: string }>}
 */
export async function normalizeForVision(file) {
  const img  = await decodeImage(file)
  const blob = await encodeCanvas(img, VISION_MAX_EDGE, 'image/jpeg')
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
  return { base64, mimeType: 'image/jpeg' }
}

/** File extension matching a blob's MIME type, for Storage paths. */
export function extensionFor(blob) {
  return { 'image/png': 'png', 'image/webp': 'webp' }[blob.type] ?? 'jpg'
}
