import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { useWishlist } from '../context/WishlistContext'
import { fetchPhotosWithFallback } from '../services/stockPhotos'
import { getItemLabels } from '../data/labels'
import styles from './ClothingCard.module.css'

const SWIPE_THRESHOLD = 90
const MAX_ROTATION    = 12

export default function ClothingCard({ item }) {
  const { state, dispatch } = useApp()
  const gender = state.gender
  const { addToWishlist, removeFromWishlist, isWishlisted, addToLiked } = useWishlist()
  const wishlisted = isWishlisted(item.id)

  const [photo, setPhoto]           = useState(null)
  const [imgLoaded, setImgLoaded]   = useState(false)
  const [loadingPhoto, setLoading]  = useState(true)
  const [dragX, setDragX]           = useState(0)
  const [dragging, setDragging]     = useState(false)
  const [flyDir, setFlyDir]         = useState(null)
  const [heartPop, setHeartPop]     = useState(false)

  const startXRef = useRef(null)
  const cardRef   = useRef(null)
  const labels    = getItemLabels(item)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setPhoto(null)
    setImgLoaded(false)
    const itemGender = item.gender && item.gender !== 'unisex' ? item.gender : gender
    const hint = itemGender === 'women' ? 'women' : itemGender === 'men' ? 'men' : ''
    const queries = [
      `${item.name} ${hint} fashion outfit`.trim(),
      `${item.name} ${hint} outfit`.trim(),
      `${item.name} fashion`,
    ]
    fetchPhotosWithFallback(queries, 1).then(([url] = []) => {
      if (!cancelled) { setPhoto(url ?? null); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [item.id, gender])

  // ── Wishlist helpers ──────────────────────────────────────────────────────

  function addItemToLiked() {
    addToLiked({
      id: item.id, type: 'item',
      name: item.name, emoji: item.emoji, gradient: item.gradient,
      categoryId: item.categoryId, seasons: item.seasons, description: item.description,
      styleWeights: item.styleWeights ?? {},
    })
  }

  function toggleWishlist(e) {
    e.stopPropagation()
    if (wishlisted) {
      removeFromWishlist(item.id)
    } else {
      addItemToLiked()
      setHeartPop(true)
    }
  }

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const onDragStart = useCallback((clientX) => {
    startXRef.current = clientX
    setDragging(true)
    setFlyDir(null)
  }, [])

  const onDragMove = useCallback((clientX) => {
    if (startXRef.current === null) return
    setDragX(clientX - startXRef.current)
  }, [])

  const onDragEnd = useCallback(() => {
    if (startXRef.current === null) return
    startXRef.current = null
    setDragging(false)

    if (Math.abs(dragX) >= SWIPE_THRESHOLD) {
      const dir = dragX > 0 ? 'right' : 'left'
      setFlyDir(dir)
      setTimeout(() => {
        if (dir === 'right') {
          addItemToLiked()
          dispatch({ type: 'LIKE_ITEM', item })
        } else {
          dispatch({ type: 'SKIP_ITEM' })
        }
      }, 300)
    } else {
      setDragX(0)
    }
  }, [dragX, dispatch, item])

  const onTouchStart = (e) => onDragStart(e.touches[0].clientX)
  const onTouchMove  = (e) => onDragMove(e.touches[0].clientX)
  const onTouchEnd   = () => onDragEnd()

  const onMouseDown  = (e) => { if (e.target.closest('button')) return; e.preventDefault(); onDragStart(e.clientX) }
  const onMouseMove  = (e) => { if (dragging) onDragMove(e.clientX) }
  const onMouseUp    = () => { if (dragging) onDragEnd() }
  const onMouseLeave = () => { if (dragging) onDragEnd() }

  // ── Visual transform ──────────────────────────────────────────────────────

  const activeDrag = flyDir ? (flyDir === 'right' ? 600 : -600) : dragX
  const rotation   = (activeDrag / 300) * MAX_ROTATION
  const likeOp     = Math.min(Math.max(activeDrag / SWIPE_THRESHOLD, 0), 1)
  const skipOp     = Math.min(Math.max(-activeDrag / SWIPE_THRESHOLD, 0), 1)

  const glowAlpha = Math.min(likeOp * 0.65, 0.65)
  const cardStyle = {
    transform:  `translateX(${activeDrag}px) rotate(${rotation}deg)`,
    transition: flyDir
      ? 'transform 0.3s ease, opacity 0.3s ease'
      : dragging ? 'none' : 'transform 0.4s cubic-bezier(0.3, 1.5, 0.7, 1)',
    opacity: flyDir ? 0 : 1,
    cursor:  dragging ? 'grabbing' : 'grab',
    boxShadow: likeOp > 0.1
      ? `0 20px 60px rgba(0,0,0,0.45), 0 0 28px rgba(34,197,94,${glowAlpha.toFixed(2)})`
      : '0 20px 60px rgba(0,0,0,0.45)',
  }

  return (
    <div className={styles.scene}>
      <div
        ref={cardRef}
        className={styles.card}
        style={cardStyle}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        {/* Photo background */}
        <div
          className={`${styles.carousel} ${loadingPhoto ? styles.carouselSkeleton : ''}`}
          style={{ background: item.gradient }}>
          {photo && (
            <img
              src={photo}
              alt=""
              className={styles.photo}
              style={{ opacity: imgLoaded ? 1 : 0 }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(true)}
              draggable={false}
            />
          )}
          <div className={styles.photoOverlay} />
        </div>

        {/* Like overlay */}
        <div className={styles.likeOverlay} style={{ opacity: likeOp }}>
          <div className={styles.swipeStamp}>♥ LIKE</div>
        </div>

        {/* Skip overlay */}
        <div className={styles.skipOverlay} style={{ opacity: skipOp }}>
          <div className={styles.swipeStamp}>✕ SKIP</div>
        </div>

        {/* Wishlist button */}
        <button
          className={`${styles.wishlistBtn} ${wishlisted ? styles.wishlistBtnActive : ''}`}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={toggleWishlist}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <svg
            className={heartPop ? styles.heartPopping : ''}
            onAnimationEnd={() => setHeartPop(false)}
            width="16" height="16" viewBox="0 0 24 24"
            fill={wishlisted ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="2.2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </button>

        {/* Item info + labels */}
        <div className={styles.frontInfo}>
          <div className={styles.seasonTags}>
            {item.seasons.map((s) => (
              <span key={s} className={styles.seasonTag}>{s}</span>
            ))}
          </div>
          <h2 className={styles.itemName}>{item.name}</h2>
          <p className={styles.itemDesc}>{item.description}</p>
          <div className={styles.labelChips}>
            {labels.map((label) => (
              <span key={label} className={styles.labelChip}>{label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className={styles.actionRow}>
        <button
          className={`${styles.actionBtn} ${styles.skipBtn}`}
          onClick={() => {
            setFlyDir('left')
            setTimeout(() => dispatch({ type: 'SKIP_ITEM' }), 300)
          }}
          aria-label="Skip"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <button
          className={`${styles.actionBtn} ${styles.likeBtn}`}
          onClick={() => {
            setFlyDir('right')
            addItemToLiked()
            setTimeout(() => dispatch({ type: 'LIKE_ITEM', item }), 300)
          }}
          aria-label="Like"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
