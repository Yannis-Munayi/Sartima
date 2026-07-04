import { useState } from 'react'
import styles from './ProductImageToggle.module.css'

// Renders a product photo, with an optional tap-to-swap pill when an
// alternate (men's/women's) curated photo is available for the same product.
export default function ProductImageToggle({ photo, altPhoto, alt = '', imgClassName }) {
  const [loaded, setLoaded]   = useState(false)
  const [showAlt, setShowAlt] = useState(false)

  if (!photo && !altPhoto) return null

  return (
    <>
      {photo && (
        <img
          src={photo}
          alt={alt}
          className={imgClassName}
          style={{ opacity: loaded && !showAlt ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          draggable={false}
        />
      )}
      {altPhoto && (
        <img
          src={altPhoto}
          alt={alt}
          className={imgClassName}
          style={{ opacity: showAlt ? 1 : 0 }}
          draggable={false}
        />
      )}
      {photo && altPhoto && (
        <button
          type="button"
          className={styles.toggle}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowAlt((v) => !v) }}
          aria-label={showAlt ? "Show women's photo" : "Show men's photo"}
        >
          {showAlt ? '♀' : '♂'}
        </button>
      )}
    </>
  )
}
