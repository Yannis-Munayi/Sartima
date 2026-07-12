import { useEffect, useMemo, useState } from 'react'
import { STYLES } from '../../data/styles'
import { AESTHETIC_ITEMS, TYPE_EMOJI, inferCat, inferSeasons, inferGender } from '../../data/aestheticItems'
import { fetchPhotosWithFallback } from '../../services/pexels'
import { resolveProductImage, getAltProductImage } from '../../services/productImage'
import ProductImageToggle from '../../components/ProductImageToggle'
import { PRODUCTS } from '../../data/products'
import { useWishlist } from '../../context/WishlistContext'
import { useApp } from '../../context/AppContext'
import { useNavigation } from '../../context/NavigationContext'
import ItemActionSheet from '../../components/ItemActionSheet'
import { HeartButton } from './shared'
import styles from '../AestheticScreen.module.css'

// Maps a product type string or item name to a Shop Scout PIECE_OPTIONS id
function inferShopScoutPieceId(str) {
  if (!str) return null
  const n = str.toLowerCase()
  // Exact type matches (from PRODUCTS.type)
  const exactMap = {
    'plain-tee': 'plain-tee', 'graphic-tee': 'graphic-tee',
    'oxford-shirt': 'oxford', 'linen-shirt': 'oxford', 'camp-shirt': 'oxford',
    'polo': 'polo',
    'hoodie': 'hoodie',
    'crewneck': 'crewneck', 'turtleneck': 'crewneck',
    'slim-jeans': 'slim-jeans',
    'baggy-jeans': 'baggy-jeans', 'wide-leg-trousers': 'baggy-jeans',
    'chinos': 'chinos',
    'cargo-pants': 'cargo',
    'cycling-shorts': 'shorts',
    'sneaker': 'clean-sneakers', 'runner': 'clean-sneakers',
    'high-top': 'high-tops',
    'chelsea-boot': 'boots', 'combat-boot': 'boots', 'work-boot': 'boots',
    'loafer': 'loafers',
    'bomber': 'bomber',
    'puffer': 'puffer', 'insulated-jacket': 'puffer',
    'denim-jacket': 'denim-jacket',
    'trench': 'trench', 'trench-coat': 'trench', 'overcoat': 'trench',
  }
  if (exactMap[n]) return exactMap[n]
  // Keyword fallbacks for item names
  if (n.includes('graphic') || n.includes('printed tee')) return 'graphic-tee'
  if (n.includes('polo')) return 'polo'
  if (n.includes('oxford') || n.includes('button-down') || n.includes('button down') || n.includes('linen shirt') || n.includes('camp shirt')) return 'oxford'
  if (n.includes('hoodie') || n.includes('zip-up')) return 'hoodie'
  if (n.includes('crewneck') || n.includes('crew neck') || n.includes('sweater') || n.includes('pullover') || n.includes('knitwear') || n.includes('turtleneck')) return 'crewneck'
  if (n.includes('cargo')) return 'cargo'
  if (n.includes('baggy') || n.includes('wide-leg') || n.includes('wide leg') || n.includes('relaxed jean')) return 'baggy-jeans'
  if (n.includes('chino') || n.includes('trouser') || n.includes('slacks')) return 'chinos'
  if (n.includes('short')) return 'shorts'
  if (n.includes('loafer')) return 'loafers'
  if (n.includes('high-top') || n.includes('high top')) return 'high-tops'
  if (n.includes('boot')) return 'boots'
  if (n.includes('sneaker') || n.includes('trainer') || n.includes('runner')) return 'clean-sneakers'
  if (n.includes('bomber')) return 'bomber'
  if (n.includes('puffer') || n.includes('quilted jacket') || n.includes('down jacket')) return 'puffer'
  if ((n.includes('denim') || n.includes('jean')) && n.includes('jacket')) return 'denim-jacket'
  if (n.includes('trench') || n.includes('overcoat') || n.includes('peacoat') || n.includes('wool coat')) return 'trench'
  if (n.includes('tee') || n.includes('t-shirt') || n.includes('plain')) return 'plain-tee'
  if (n.includes('jean') || n.includes('denim')) return 'slim-jeans'
  return null
}

function ProductGridCard({ product }) {
  const [photo, setPhoto]   = useState(null)
  const { addToLiked, removeFromLiked, isLiked } = useWishlist()
  const navigate = useNavigation()
  const { state } = useApp()
  const gender = state.gender
  const liked = isLiked(product.id)
  const altPhoto = getAltProductImage(product, gender)

  useEffect(() => {
    let cancelled = false
    resolveProductImage(product, gender).then((url) => {
      if (!cancelled) setPhoto(url ?? null)
    })
    return () => { cancelled = true }
  }, [product.id, gender])

  function toggleLike(e) {
    e.stopPropagation()
    if (liked) {
      removeFromLiked(product.id)
    } else {
      addToLiked({
        id: product.id, type: 'product',
        name: product.name, brand: product.brand,
        itemType: product.type, parentType: product.parentType,
        color: product.color, colorHex: product.colorHex,
        priceRange: product.priceRange, emoji: product.emoji,
        gradient: product.gradient, description: product.description,
        styleWeights: product.styleWeights ?? {},
        shopUrl: product.shopUrl, shopFallbackUrl: product.shopFallbackUrl,
        seasons: product.seasons,
        image: product.image, imageMen: product.imageMen, googleQuery: product.googleQuery,
      })
    }
  }

  return (
    <div className={styles.productGridCard}>
      <div className={styles.productGridPhoto} style={{ background: product.gradient }}>
        <ProductImageToggle photo={photo} altPhoto={altPhoto} alt={product.name} imgClassName={styles.itemImg} />
        {product.brand && <span className={styles.brandBadge}>{product.brand}</span>}
        <button
          className={`${styles.heartBtnSmall} ${liked ? styles.heartBtnSmallActive : ''}`}
          onClick={toggleLike}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="2.2">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </button>
      </div>
      <p className={styles.itemName}>{product.name}</p>
      {(() => {
        const pieceId = inferShopScoutPieceId(product.type) ?? inferShopScoutPieceId(product.name)
        return pieceId ? (
          <button
            className={styles.shopLink}
            onClick={() => navigate(`wardrobe-builder:${pieceId}|${product.name}`)}
          >
            Shop Scout →
          </button>
        ) : product.shopUrl ? (
          <a href={product.shopUrl} target="_blank" rel="noopener noreferrer" className={styles.shopLink}>
            Shop ↗
          </a>
        ) : null
      })()}
    </div>
  )
}

function ItemCard({ item, genderFilter, onSelect }) {
  const [photo, setPhoto]   = useState(null)
  const [loaded, setLoaded] = useState(false)
  const { addToWishlist, removeFromWishlist, isWishlisted } = useWishlist()
  const wishlisted = isWishlisted(item.id)

  useEffect(() => {
    let cancelled = false
    const genderHint = genderFilter === 'women' ? 'women' : genderFilter === 'men' ? 'men' : ''
    const queries = [
      `${item.name} ${genderHint} fashion outfit`.trim(),
      `${item.name} ${genderHint} outfit`.trim(),
      `${item.name} fashion`,
    ]
    fetchPhotosWithFallback(queries, 1).then(([url] = []) => {
      if (!cancelled) setPhoto(url ?? null)
    })
    return () => { cancelled = true }
  }, [item.id, genderFilter])

  function toggleWishlist() {
    if (wishlisted) {
      removeFromWishlist(item.id)
    } else {
      addToWishlist({
        id: item.id, type: 'item',
        name: item.name, emoji: item.emoji, gradient: item.gradient,
        categoryId: item.categoryId, seasons: item.seasons, description: item.description,
      })
    }
  }

  return (
    <div className={styles.itemCard}>
      <button className={styles.itemPhotoBtn} onClick={() => onSelect(item)}>
        <div className={styles.itemPhoto} style={{ background: item.gradient }}>
          {photo && (
            <img
              src={photo}
              alt={item.name}
              className={styles.itemImg}
              style={{ opacity: loaded ? 1 : 0 }}
              onLoad={() => setLoaded(true)}
              onError={() => setLoaded(true)}
            />
          )}
          <span className={styles.itemEmoji}>{item.emoji}</span>
          <div className={styles.itemOverlay}>
            <span className={styles.itemOverlayDots}>⋯</span>
          </div>
        </div>
      </button>
      <HeartButton wishlisted={wishlisted} onToggle={toggleWishlist} />
      <p className={styles.itemName}>{item.name}</p>
    </div>
  )
}

const GENDER_OPTIONS = [
  { id: 'both', label: 'Both' },
  { id: 'men',  label: 'Men' },
  { id: 'women', label: 'Women' },
]

function matchesGenderFilter(item, preference) {
  if (preference === 'both') return true
  const g = item.gender || inferGender(item.name)
  return g === 'unisex' || g === preference
}

export default function ItemsTab({ aestheticId }) {
  const { state } = useApp()
  const navigate = useNavigation()
  const genderFilter = state.gender
  const styleData = STYLES[aestheticId]
  const gradient  = styleData?.gradient ?? 'linear-gradient(135deg, #1a1a1a 0%, #333 100%)'

  const [activeItem, setActiveItem] = useState(null)

  const aestheticProducts = useMemo(() =>
    PRODUCTS
      .filter((p) => (p.styleWeights?.[aestheticId] ?? 0) >= 1)
      .sort((a, b) => (b.styleWeights?.[aestheticId] ?? 0) - (a.styleWeights?.[aestheticId] ?? 0)),
    [aestheticId]
  )

  const { core, statement, accessory } = useMemo(() => {
    const raw = AESTHETIC_ITEMS[aestheticId] ?? []
    const enrich = (item) => ({
      ...item,
      description: item.desc,
      gradient,
      emoji:      TYPE_EMOJI[item.type],
      categoryId: inferCat(item.name),
      seasons:    inferSeasons(item.name),
    })
    const filtered = raw.filter((i) => matchesGenderFilter(i, genderFilter))
    return {
      core:      filtered.filter((i) => i.type === 'core').map(enrich),
      statement: filtered.filter((i) => i.type === 'statement').map(enrich),
      accessory: filtered.filter((i) => i.type === 'accessory').map(enrich),
    }
  }, [aestheticId, gradient, genderFilter])

  function handleOpenShop() {
    const pieceId  = activeItem ? inferShopScoutPieceId(activeItem.name) : null
    const itemName = activeItem?.name ?? null
    setActiveItem(null)
    if (pieceId && itemName) {
      navigate(`wardrobe-builder:${pieceId}|${itemName}`)
    } else if (pieceId) {
      navigate(`wardrobe-builder:${pieceId}`)
    }
  }

  return (
    <>
      {aestheticProducts.length > 0 && (
        <div className={styles.itemSection}>
          <p className={styles.itemSectionLabel}>Products</p>
          <div className={styles.itemsGrid}>
            {aestheticProducts.map((p) => (
              <ProductGridCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

      {core.length + statement.length + accessory.length === 0 && aestheticProducts.length === 0 ? (
        <p className={styles.emptyText}>No items for this filter.</p>
      ) : (
        <>
          {core.length > 0 && (
            <div className={styles.itemSection}>
              <p className={styles.itemSectionLabel}>Core Pieces</p>
              <div className={styles.itemsGrid}>
                {core.map((item) => <ItemCard key={item.id} item={item} genderFilter={genderFilter} onSelect={setActiveItem} />)}
              </div>
            </div>
          )}
          {statement.length > 0 && (
            <div className={styles.itemSection}>
              <p className={styles.itemSectionLabel}>Statement Pieces</p>
              <div className={styles.itemsGrid}>
                {statement.map((item) => <ItemCard key={item.id} item={item} genderFilter={genderFilter} onSelect={setActiveItem} />)}
              </div>
            </div>
          )}
          {accessory.length > 0 && (
            <div className={styles.itemSection}>
              <p className={styles.itemSectionLabel}>Accessories</p>
              <div className={styles.itemsGrid}>
                {accessory.map((item) => <ItemCard key={item.id} item={item} genderFilter={genderFilter} onSelect={setActiveItem} />)}
              </div>
            </div>
          )}
        </>
      )}

      {activeItem && (
        <ItemActionSheet
          item={activeItem}
          onShop={handleOpenShop}
          onClose={() => setActiveItem(null)}
        />
      )}
    </>
  )
}
