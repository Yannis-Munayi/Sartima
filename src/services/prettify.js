import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

let bgRemoval = null

async function loadBgRemoval() {
  if (!bgRemoval) {
    const mod = await import('@imgly/background-removal')
    bgRemoval = mod
  }
  return bgRemoval
}

const proxyImageFn = httpsCallable(functions, 'proxyImage')

/**
 * Fetch an image URL as a Blob.
 * Tries a direct fetch first (works for Firebase Storage and same-origin URLs).
 * Falls back to the proxyImage Firebase Function for cross-origin CDN URLs (Pexels, Google, etc.)
 */
export async function fetchImageAsBlob(url) {
  try {
    const res = await fetch(url)
    if (res.ok) return res.blob()
  } catch (_) {
    // CORS or network error — fall through to proxy
  }
  const { data } = await proxyImageFn({ url })
  const res = await fetch(data.dataUrl)
  return res.blob()
}

/**
 * Remove the background from an image and return a transparent PNG Blob.
 * Lazy-loads the WASM module on first call.
 *
 * @param {string|File|Blob} source  - URL, File, or Blob
 * @param {function}         onProgress - (key, current, total) callback
 * @returns {Promise<Blob>}
 */
export async function prettifyImage(source, onProgress) {
  const { removeBackground } = await loadBgRemoval()

  let blob
  if (source instanceof File || source instanceof Blob) {
    blob = source
  } else {
    // Use fetchImageAsBlob to handle CORS for external URLs
    blob = await fetchImageAsBlob(source)
  }

  return removeBackground(blob, { progress: onProgress ?? (() => {}) })
}
