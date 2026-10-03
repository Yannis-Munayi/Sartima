import { useCallback, useEffect, useRef, useState } from 'react'
import { useWishlist } from '../context/WishlistContext'
import { useNavigation } from '../context/NavigationContext'
import { useApp } from '../context/AppContext'
import { useInterests } from '../context/InterestContext'
import { BRAND_NAME_TO_ID } from '../data/brands'
import { resolveProductImage, getAltProductImage } from '../services/productImage'
import ProductImageToggle from './ProductImageToggle'
import styles from './ProductCard.module.css'
import Icon from './Icon'

const SWIPE_THRESHOLD = 90
const MAX_ROTATION    = 12

const PRICE_LABEL = { budget: '$', mid: '$$', premium: '$$$', luxury: '$$$$' }

export default function ProductCard({ product, onLike, onSkip }) {
  const { addToLiked, removeFromLiked, isLiked } = useWishlist()
  const { recordInterest } = useInterests() ?? {}
  const navigate   = useNavigation()
  const { state }  = useApp()
  const gender     = state.gender
  const wishlisted = isLiked(product.id)
  const brandId    = BRAND_NAME_TO_ID[product.brand]

  const [photo,       setPhoto]     = useState(null)
  const [loadingPhoto, setLoading]  = useState(true)
  const [dragX,       setDragX]     = useState(0)
  const [dragging,    setDragging]  = useState(false)
  const [flyDir,      setFlyDir]    = useState(null)

  const altPhoto  = getAltProductImage(product, gender)

  const startXRef = useRef(null)
  const cardRef   = useRef(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setPhoto(null)
    resolveProductImage(product, gender).then((url) => {
      if (!cancelled) { setPhoto(url); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [product.id, gender])

  function addProductToLiked() {
    addToLiked({
      id:           product.id,
      type:         'product',
      name:         product.name,
      brand:        product.brand,
      itemType:     product.type,
      parentType:   product.parentType,
      color:        product.color,
      colorHex:     product.colorHex,
      priceRange:   product.priceRange,
      emoji:        product.emoji,
      gradient:     product.gradient,
      description:  product.description,
      styleWeights: product.styleWeights ?? {},
      shopUrl:      product.shopUrl,
      shopFallbackUrl: product.shopFallbackUrl,
      seasons:      product.seasons,
      image:        product.image,
      imageMen:     product.imageMen,
      googleQuery:  product.googleQuery,
    })
  }

  function toggleWishlist(e) {
    e.stopPropagation()
    if (wishlisted) removeFromLiked(product.id)
    else            addProductToLiked()
  }

  // ── Drag handlers (identical mechanics to ClothingCard) ───────────────────

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
          addProductToLiked()
          onLike(product)
        } else {
          onSkip(product)
        }
      }, 300)
    } else {
      setDragX(0)
    }
  }, [dragX, product, onLike, onSkip])

  const onTouchStart = (e) => onDragStart(e.touches[0].clientX)
  const onTouchMove  = (e) => onDragMove(e.touches[0].clientX)
  const onTouchEnd   = () => onDragEnd()

  const onMouseDown  = (e) => { if (e.target.closest('button, a')) return; e.preventDefault(); onDragStart(e.clientX) }
  const onMouseMove  = (e) => { if (dragging) onDragMove(e.clientX) }
  const onMouseUp    = () => { if (dragging) onDragEnd() }
  const onMouseLeave = () => { if (dragging) onDragEnd() }

  // ── Visual transform ──────────────────────────────────────────────────────

  const activeDrag = flyDir ? (flyDir === 'right' ? 600 : -600) : dragX
  const rotation   = (activeDrag / 300) * MAX_ROTATION
  const likeOp     = Math.min(Math.max(activeDrag / SWIPE_THRESHOLD, 0), 1)
  const skipOp     = Math.min(Math.max(-activeDrag / SWIPE_THRESHOLD, 0), 1)

  const cardStyle = {
    transform:  `translateX(${activeDrag}px) rotate(${rotation}deg)`,
    transition: flyDir
      ? 'transform 0.3s ease, opacity 0.3s ease'
      : dragging ? 'none' : 'transform 0.4s cubic-bezier(0.3, 1.5, 0.7, 1)',
    opacity: flyDir ? 0 : 1,
    cursor:  dragging ? 'grabbing' : 'grab',
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
          className={`${styles.carousel} ${loadingPhoto ? styles.pulsing : ''}`}
          style={{ background: product.gradient }}
        >
          <ProductImageToggle photo={photo} altPhoto={altPhoto} imgClassName={styles.photo} />
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

        {/* Top-right action buttons */}
        <div className={styles.topActions}>
          <a
            href={product.shopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.shopBtn}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={() => recordInterest?.('shop', { product })}
            aria-label="Shop this item"
          >
            <Icon name="bag" size={16} />
          </a>
          <button
            className={`${styles.wishlistBtn} ${wishlisted ? styles.wishlistBtnActive : ''}`}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={toggleWishlist}
            aria-label={wishlisted ? 'Remove from saved' : 'Save item'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={wishlisted ? 'currentColor' : 'none'}
              stroke="currentColor" strokeWidth="2.2">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>
        </div>

        {/* Product info overlay */}
        <div className={styles.frontInfo}>
          {brandId ? (
            <button
              className={`${styles.brandPill} ${styles.brandPillLink}`}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); navigate(`brand:${brandId}`) }}
            >
              {product.brand} ↗
            </button>
          ) : (
            <span className={styles.brandPill}>{product.brand}</span>
          )}
          <h2 className={styles.itemName}>{product.name}</h2>
          <div className={styles.metaRow}>
            <span className={styles.colorDot} style={{ background: product.colorHex }} />
            <span className={styles.colorLabel}>{product.color}</span>
            <span className={styles.pricePill}>{PRICE_LABEL[product.priceRange] ?? ''}</span>
          </div>
          <p className={styles.itemDesc}>{product.description}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className={styles.actionRow}>
        <button
          className={`${styles.actionBtn} ${styles.skipBtn}`}
          onClick={() => {
            setFlyDir('left')
            setTimeout(() => onSkip(product), 300)
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
            addProductToLiked()
            setTimeout(() => onLike(product), 300)
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
