let bgRemoval = null

async function loadBgRemoval() {
  if (!bgRemoval) {
    const mod = await import('@imgly/background-removal')
    bgRemoval = mod
  }
  return bgRemoval
}

/**
 * Remove the background from an image URL or File and return a Blob.
 * Lazy-loads the WASM module on first call.
 *
 * @param {string|File} source  - Firebase Storage URL or File object
 * @param {function}    onProgress - (key, current, total) callback
 * @returns {Promise<Blob>}
 */
export async function prettifyImage(source, onProgress) {
  const { removeBackground } = await loadBgRemoval()

  let blob
  if (source instanceof File || source instanceof Blob) {
    blob = source
  } else {
    const res = await fetch(source)
    if (!res.ok) throw new Error('Failed to fetch image for prettify')
    blob = await res.blob()
  }

  const result = await removeBackground(blob, {
    progress: onProgress ?? (() => {}),
  })

  return result
}
