import { useEffect, useMemo, useState } from 'react'
import { useWishlist } from '../context/WishlistContext'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { resolveProductImage, getAltProductImage } from '../services/productImage'
import ItemActionSheet from '../components/ItemActionSheet'
import ShopPanel from '../components/ShopPanel'
import TryOnSheet from '../components/TryOnSheet'
import ProductImageToggle from '../components/ProductImageToggle'
import { TRYON_CATEGORIES } from '../services/tryOn'
import styles from './WardrobeScreen.module.css'

// Ordered category buckets for grouping liked items
const BUCKET_META = {
  footwear:    { label: 'Footwear',    emoji: '👟' },
  tops:        { label: 'Tops',        emoji: '👕' },
  knitwear:    { label: 'Knitwear',    emoji: '🧶' },
  bottoms:     { label: 'Bottoms',     emoji: '👖' },
  outerwear:   { label: 'Outerwear',   emoji: '🧥' },
  accessories: { label: 'Accessories', emoji: '👜' },
  activewear:  { label: 'Activewear',  emoji: '🏃' },
  // legacy categoryIds from old quiz items
  tops_legacy:       { label: 'Tops',      emoji: '👕' },
  outerwear_legacy:  { label: 'Outerwear', emoji: '🧥' },
  bottoms_legacy:    { label: 'Bottoms',   emoji: '👖' },
  footwear_legacy:   { label: 'Footwear',  emoji: '👟' },
  other:       { label: 'Other',       emoji: '✨' },
}

const BUCKET_ORDER = ['footwear', 'tops', 'knitwear', 'bottoms', 'outerwear', 'accessories', 'activewear']

function bucketFor(item) {
  // New products use parentType
  if (item.parentType) return item.parentType
  // Old quiz items use categoryId — map to parentType equivalents
  if (item.categoryId) return item.categoryId
  return 'other'
}

// Single card for any liked item (product or old quiz item)
function LikedItemCard({ item, onSelect, onTryOn }) {
  const [photo, setPhoto] = useState(null)
  const { state } = useApp()
  const gender = state.gender
  const isProduct = item.type === 'product'
  const altPhoto = getAltProductImage(item, gender)

  useEffect(() => {
    let cancelled = false
    resolveProductImage(item, gender).then((url) => {
      if (!cancelled) setPhoto(url ?? null)
    })
    return () => { cancelled = true }
  }, [item.id, gender])

  return (
    <div className={styles.item} onClick={() => onSelect(item)} role="button" tabIndex={0}>
      <div className={styles.itemPhoto} style={{ background: item.gradient }}>
        <ProductImageToggle photo={photo} altPhoto={altPhoto} alt={item.name} imgClassName={styles.itemImg} />
        {isProduct
          ? <span className={styles.brandBadge}>{item.brand}</span>
          : <span className={styles.itemEmoji}>{item.emoji}</span>
        }
        <div className={styles.itemOverlay}>
          <span className={styles.itemOverlayIcon}>⋯</span>
        </div>
      </div>

      <p className={styles.itemName}>{item.name}</p>

      {isProduct && (
        <div className={styles.itemMeta}>
          {item.colorHex && (
            <span className={styles.colorDot} style={{ background: item.colorHex }} />
          )}
          <span className={styles.colorLabel}>{item.color}</span>
        </div>
      )}

      {isProduct && item.shopUrl && (
        <a
          href={item.shopUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.shopLink}
          onClick={(e) => e.stopPropagation()}
        >
          Shop at {item.brand} ↗
        </a>
      )}

      {TRYON_CATEGORIES.includes(bucketFor(item)) && (
        <button
          className={styles.tryOnBtn}
          onClick={(e) => { e.stopPropagation(); onTryOn?.(item) }}
        >
          Try On
        </button>
      )}
    </div>
  )
}

const GHOST_ITEMS = [
  { id: 'g1', name: 'Slim Fit Chinos',      gradient: 'linear-gradient(135deg,#3d2b1f,#2c3e50)', emoji: '👖' },
  { id: 'g2', name: 'Oxford Button-Down',   gradient: 'linear-gradient(135deg,#1a2634,#2d3a4a)', emoji: '👕' },
  { id: 'g3', name: 'White Leather Sneakers', gradient: 'linear-gradient(135deg,#2a2a3a,#1a1a2a)', emoji: '👟' },
  { id: 'g4', name: 'Wool Overcoat',        gradient: 'linear-gradient(135deg,#1a0a2e,#2d1b3d)', emoji: '🧥' },
  { id: 'g5', name: 'Satin Midi Skirt',     gradient: 'linear-gradient(135deg,#2e1a3d,#1a2e3d)', emoji: '👗' },
  { id: 'g6', name: 'Crossbody Bag',        gradient: 'linear-gradient(135deg,#3d1a1a,#2d2a1a)', emoji: '👜' },
]

export default function WardrobeScreen() {
  const { user } = useAuth()
  const { liked, removeFromLiked }      = useWishlist()

  const [activeItem, setActiveItem] = useState(null)
  const [shopItem,   setShopItem]   = useState(null)
  const [tryOnItem,  setTryOnItem]  = useState(null)

  if (!user) {
    return (
      <div className={styles.screen}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <h1 className={styles.title}>Liked</h1>
          </div>
        </div>
        <div className={styles.lockedWrap}>
          <div className={styles.lockedContent}>
            <div className={styles.grid} style={{ filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none', padding: '16px 0' }}>
              {GHOST_ITEMS.map((item) => (
                <div key={item.id} className={styles.item}>
                  <div className={styles.itemPhoto} style={{ background: item.gradient }}>
                    <span className={styles.itemEmoji}>{item.emoji}</span>
                  </div>
                  <p className={styles.itemName}>{item.name}</p>
                </div>
              ))}
            </div>
            <div className={styles.lockedOverlay}>
              <span className={styles.lockIcon}>🔒</span>
              <p className={styles.lockLabel}>Sign in to save your liked items</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Group liked items by bucket (parentType for products, categoryId for old items)
  const grouped = useMemo(() => {
    const map = {}
    for (const item of liked) {
      const bucket = bucketFor(item)
      if (!map[bucket]) map[bucket] = []
      map[bucket].push(item)
    }
    const ordered = BUCKET_ORDER
      .filter((id) => map[id])
      .map((id) => ({ meta: BUCKET_META[id] ?? { label: id, emoji: '✨' }, items: map[id] }))
    // Append any buckets not in the defined order (legacy categoryIds, etc.)
    const seen = new Set(BUCKET_ORDER)
    const extra = Object.keys(map)
      .filter((id) => !seen.has(id))
      .map((id) => ({
        meta: BUCKET_META[id] ?? { label: id.charAt(0).toUpperCase() + id.slice(1), emoji: '👔' },
        items: map[id],
      }))
    return [...ordered, ...extra]
  }, [liked])

  function handleOpenShop() {
    setShopItem(activeItem)
    setActiveItem(null)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.title}>Liked</h1>
            {liked.length > 0 && (
              <p className={styles.sub}>
                {liked.length} piece{liked.length !== 1 ? 's' : ''} liked
              </p>
            )}
          </div>
        </div>
      </div>

      {liked.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🤍</span>
          <p className={styles.emptyTitle}>Nothing liked yet</p>
          <p className={styles.emptySub}>
            Swipe right on items in Discover, or tap the heart on any card.
          </p>
        </div>
      )}

      <div className={styles.sections}>
        {grouped.map(({ meta, items }) => (
          <section key={meta.label} className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionEmoji}>{meta.emoji}</span>
              <h2 className={styles.sectionTitle}>{meta.label}</h2>
              <span className={styles.sectionCount}>{items.length}</span>
            </div>
            <div className={styles.grid}>
              {items.map((item) => (
                <LikedItemCard key={item.id} item={item} onSelect={setActiveItem} onTryOn={setTryOnItem} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Item action sheet */}
      {activeItem && (
        <ItemActionSheet
          item={activeItem}
          onShop={handleOpenShop}
          onRemove={() => { removeFromLiked(activeItem.id); setActiveItem(null) }}
          onClose={() => setActiveItem(null)}
        />
      )}

      {/* Shop panel for old quiz items */}
      {shopItem && (
        <ShopPanel item={shopItem} onClose={() => setShopItem(null)} />
      )}

      {/* Try On sheet */}
      {tryOnItem && (
        <TryOnSheet
          item={tryOnItem}
          onClose={() => setTryOnItem(null)}
          onSaved={() => setTryOnItem(null)}
        />
      )}

    </div>
  )
}
