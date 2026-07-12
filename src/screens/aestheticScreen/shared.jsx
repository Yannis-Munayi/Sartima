import { useState } from 'react'
import { useWishlist } from '../../context/WishlistContext'
import styles from '../AestheticScreen.module.css'

// Used by ItemsTab's ItemCard and by OutfitPhoto below (Looks + Guide tabs).
export function HeartButton({ wishlisted, onToggle }) {
  return (
    <button
      className={`${styles.heartBtn} ${wishlisted ? styles.heartBtnActive : ''}`}
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill={wishlisted ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="2.2">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    </button>
  )
}

// Reused by LooksTab's LookCard and GuideTab's GuideItem for outfit photo grids.
export function OutfitPhoto({ url, alt, wishlistEntry }) {
  const [loaded, setLoaded] = useState(false)
  const { addToWishlist, removeFromWishlist, isWishlisted } = useWishlist()
  const wishlisted = wishlistEntry ? isWishlisted(wishlistEntry.id) : false

  function toggleWishlist() {
    if (!wishlistEntry) return
    if (wishlisted) removeFromWishlist(wishlistEntry.id)
    else addToWishlist({ ...wishlistEntry, type: 'photo', photoUrl: url })
  }

  return (
    <div className={styles.outfitPhotoWrap}>
      <img
        src={url}
        alt={alt}
        className={styles.outfitPhoto}
        style={{ opacity: loaded ? 1 : 0 }}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
      {wishlistEntry && (
        <HeartButton wishlisted={wishlisted} onToggle={toggleWishlist} />
      )}
    </div>
  )
}
