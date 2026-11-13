import { useState } from 'react'
import { resolveGenderPhoto } from '../services/productImage'
import styles from './ProductImageToggle.module.css'

// Renders a product photo, with a tap-to-swap pill between the product's men's
// and women's photos when `swapItem` is set (see canSwapGenderPhoto). Each
// side's photo is resolved on its first tap, so cards that are never swapped
// cost no extra photo lookups.
export default function ProductImageToggle({ photo, swapItem = null, alt = '', imgClassName }) {
  const [side, setSide]             = useState(null)   // null = the card's default photo
  const [sidePhotos, setSidePhotos] = useState({})     // 'men' | 'women' → url
  const [loaded, setLoaded]         = useState({})     // url → true once it has loaded
  const [busy, setBusy]             = useState(false)
  const [noMen, setNoMen]           = useState(false)  // no men's photo exists → hide the pill

  if (!photo) return null

  const target = swapItem && side ? sidePhotos[side] : photo
  const shown  = loaded[target] ? target : loaded[photo] ? photo : null
  const markLoaded = (src) => setLoaded((prev) => (prev[src] ? prev : { ...prev, [src]: true }))

  async function swap(e) {
    e.stopPropagation()
    e.preventDefault()
    if (busy) return
    const next = side === 'men' ? 'women' : 'men'
    if (sidePhotos[next]) { setSide(next); return }

    setBusy(true)
    try {
      // No women's photo found → the default photo stands in for that side.
      const url = (await resolveGenderPhoto(swapItem, next)) ?? (next === 'women' ? photo : null)
      if (!url) { setNoMen(true); return }
      setSidePhotos((prev) => ({ ...prev, [next]: url }))
      setSide(next)
    } finally {
      setBusy(false)
    }
  }

  const sources = [...new Set([photo, sidePhotos.men, sidePhotos.women].filter(Boolean))]

  return (
    <>
      {sources.map((src) => (
        <img
          key={src}
          src={src}
          alt={alt}
          className={imgClassName}
          style={{ opacity: src === shown ? 1 : 0 }}
          onLoad={() => markLoaded(src)}
          onError={() => markLoaded(src)}
          draggable={false}
        />
      ))}
      {swapItem && !noMen && (
        <button
          type="button"
          className={styles.toggle}
          onClick={swap}
          aria-busy={busy}
          aria-label={side === 'men' ? "Show women's photo" : "Show men's photo"}
        >
          {side === 'men' ? '♀' : '♂'}
        </button>
      )}
    </>
  )
}
