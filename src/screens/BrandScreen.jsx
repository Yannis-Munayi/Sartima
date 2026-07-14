import { useEffect, useRef, useState } from 'react'
import { getBrandById, BRAND_NAME_TO_ID } from '../data/brands'
import { PRODUCTS } from '../data/products'
import { fetchPhotosWithFallback } from '../services/pexels'
import { resolveProductImage, getAltProductImage } from '../services/productImage'
import { useExplore } from '../context/ExploreContext'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { useNavigation } from '../context/NavigationContext'
import { useWishlist } from '../context/WishlistContext'
import { useInterests } from '../context/InterestContext'
import { recordSignal } from '../services/interestTracker'
import ProductImageToggle from '../components/ProductImageToggle'
import styles from './BrandScreen.module.css'

// ── Helpers ──────────────────────────────────────────────────────────────────

const TIER_LABELS = {
  luxury:      'Luxury',
  premium:     'Premium',
  contemporary:'Contemporary',
  value:       'Value',
  streetwear:  'Streetwear',
}

const TIER_COLORS = {
  luxury:      '#b8956a',
  premium:     '#7a8c6e',
  contemporary:'#5a7fa0',
  value:       '#888',
  streetwear:  '#e8735a',
}

const POSITIONING_LABELS = {
  luxury:      '✦ Luxury',
  premium:     '◆ Premium',
  contemporary:'● Contemporary',
  value:       '○ Value',
  streetwear:  '▲ Streetwear',
}

// ── Collection image loader ───────────────────────────────────────────────────

function CollectionCard({ collection, isCurrent }) {
  const [photo, setPhoto]   = useState(null)
  const [loaded, setLoaded] = useState(false)
  const cardRef = useRef(null)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    let cancelled = false
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      fetchPhotosWithFallback([collection.imageQuery ?? collection.name], 1)
        .then(([url] = []) => { if (!cancelled) setPhoto(url ?? null) })
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => { cancelled = true; observer.disconnect() }
  }, [collection.imageQuery, collection.name])

  return (
    <div className={styles.collectionCard} ref={cardRef}>
      <div className={styles.collectionPhoto} style={{ background: 'var(--bg-elevated)' }}>
        {photo && (
          <img
            src={photo}
            alt={collection.name}
            className={styles.collectionImg}
            style={{ opacity: loaded ? 1 : 0 }}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        )}
        {!photo && <div className={styles.collectionPlaceholder} />}
        {isCurrent && <span className={styles.currentBadge}>Current</span>}
        {!isCurrent && collection.year && (
          <span className={styles.yearBadge}>{collection.year}</span>
        )}
      </div>
      <div className={styles.collectionInfo}>
        <p className={styles.collectionName}>{collection.name}</p>
        {collection.season && <p className={styles.collectionSeason}>{collection.season}</p>}
        {collection.desc && <p className={styles.collectionDesc}>{collection.desc}</p>}
      </div>
    </div>
  )
}

// ── Shop tab ─────────────────────────────────────────────────────────────────

function ShopTab({ brand }) {
  const { addToLiked, removeFromLiked, isLiked } = useWishlist()

  const brandProducts = PRODUCTS.filter((p) => BRAND_NAME_TO_ID[p.brand] === brand.id)

  if (brandProducts.length === 0) {
    return (
      <div className={styles.emptySection}>
        <p className={styles.emptyText}>No products in catalog yet.</p>
        <p className={styles.emptySubtext}>We're adding new pieces regularly.</p>
      </div>
    )
  }

  return (
    <div className={styles.shopGrid}>
      {brandProducts.map((product) => (
        <BrandProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}

function BrandProductCard({ product }) {
  const [photo, setPhoto]   = useState(null)
  const { addToLiked, removeFromLiked, isLiked } = useWishlist()
  const { state } = useApp()
  const gender = state.gender
  const liked = isLiked(product.id)
  const altPhoto = getAltProductImage(product, gender)
  const cardRef = useRef(null)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    let cancelled = false
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      resolveProductImage(product, gender)
        .then((url) => { if (!cancelled) setPhoto(url ?? null) })
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => { cancelled = true; observer.disconnect() }
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

  const { recordInterest } = useInterests() ?? {}

  return (
    <div className={styles.shopCard} ref={cardRef}>
      <div className={styles.shopCardPhoto} style={{ background: product.gradient ?? 'var(--bg-elevated)' }}>
        <ProductImageToggle photo={photo} altPhoto={altPhoto} alt={product.name} imgClassName={styles.shopCardImg} />
        <button
          className={`${styles.heartBtn} ${liked ? styles.heartBtnActive : ''}`}
          onClick={toggleLike}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="2.2">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </button>
      </div>
      <p className={styles.shopCardName}>{product.name}</p>
      {product.priceRange && <p className={styles.shopCardPrice}>{product.priceRange}</p>}
      {product.shopUrl && (
        <a
          href={product.shopUrl} target="_blank" rel="noopener noreferrer" className={styles.shopLink}
          onClick={() => recordInterest?.('shop', { product })}
        >
          Shop ↗
        </a>
      )}
    </div>
  )
}

// ── Lines tab ─────────────────────────────────────────────────────────────────

function LinesTab({ brand }) {
  if (!brand.lines?.length) {
    return (
      <div className={styles.emptySection}>
        <p className={styles.emptyText}>Line information coming soon.</p>
      </div>
    )
  }

  return (
    <div className={styles.linesGrid}>
      {brand.lines.map((line) => (
        <div key={line.id} className={styles.lineCard}>
          <div className={styles.lineCardHeader}>
            <p className={styles.lineName}>{line.name}</p>
            <span
              className={styles.lineTier}
              style={{ color: TIER_COLORS[line.tier] ?? '#888', borderColor: TIER_COLORS[line.tier] ?? '#888' }}
            >
              {TIER_LABELS[line.tier] ?? line.tier}
            </span>
          </div>
          <p className={styles.lineDesc}>{line.desc}</p>
        </div>
      ))}
    </div>
  )
}

// ── Collections tab ───────────────────────────────────────────────────────────

function CollectionsTab({ brand }) {
  return (
    <div className={styles.collectionsTab}>
      {brand.currentCollections?.length > 0 && (
        <div className={styles.collectionSection}>
          <h3 className={styles.collectionSectionTitle}>Current Season</h3>
          <div className={styles.collectionGrid}>
            {brand.currentCollections.map((c, i) => (
              <CollectionCard key={i} collection={c} isCurrent />
            ))}
          </div>
        </div>
      )}
      {brand.pastCollections?.length > 0 && (
        <div className={styles.collectionSection}>
          <h3 className={styles.collectionSectionTitle}>Notable Collections</h3>
          <div className={styles.collectionGrid}>
            {brand.pastCollections.map((c, i) => (
              <CollectionCard key={i} collection={c} isCurrent={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Story tab ─────────────────────────────────────────────────────────────────

function StoryTab({ brand, navigate }) {
  return (
    <div className={styles.storyTab}>
      <div className={styles.storyMeta}>
        <span className={styles.storyPill}>Est. {brand.founded}</span>
        <span className={styles.storyPill}>{brand.origin}</span>
        <span className={styles.storyPill}>{POSITIONING_LABELS[brand.positioning] ?? brand.positioning}</span>
      </div>

      <section className={styles.storySection}>
        <p className={styles.storyBody}>{brand.story}</p>
      </section>

      {brand.keyPieces?.length > 0 && (
        <section className={styles.storySection}>
          <h3 className={styles.storySectionTitle}>Key Pieces</h3>
          <div className={styles.keyPiecesList}>
            {brand.keyPieces.map((piece) => (
              <span key={piece} className={styles.keyPieceChip}>{piece}</span>
            ))}
          </div>
        </section>
      )}

      {brand.aesthetics?.length > 0 && (
        <section className={styles.storySection}>
          <h3 className={styles.storySectionTitle}>Aesthetics</h3>
          <div className={styles.aestheticChips}>
            {brand.aesthetics.map((id) => (
              <button
                key={id}
                className={styles.aestheticChip}
                onClick={() => navigate(`aesthetic:${id}`)}
              >
                {id}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Main BrandScreen ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'story',       label: 'Story' },
  { id: 'lines',       label: 'Lines' },
  { id: 'collections', label: 'Collections' },
  { id: 'shop',        label: 'Shop' },
]

export default function BrandScreen({ brandId, forceSubTab }) {
  const navigate                 = useNavigation()
  const { user }                 = useAuth()
  const { closeBrandTab, brandFromTab } = useExplore()

  const [subTab, setSubTab] = useState('story')
  const [heroBg, setHeroBg] = useState(null)

  const brand = getBrandById(brandId)

  // Record brand visit interest signal
  useEffect(() => {
    if (user && brandId) {
      recordSignal(user, 'brandVisit', { brandId })
    }
  }, [brandId, user])

  // Reset sub-tab when brand changes
  useEffect(() => {
    setSubTab('story')
    setHeroBg(null)
  }, [brandId])

  useEffect(() => {
    if (forceSubTab) setSubTab(forceSubTab)
  }, [forceSubTab])

  // Fetch hero image
  useEffect(() => {
    if (!brand) return
    let cancelled = false
    fetchPhotosWithFallback([brand.imageQuery, brand.name + ' fashion brand campaign'], 1)
      .then(([url] = []) => { if (!cancelled) setHeroBg(url ?? null) })
    return () => { cancelled = true }
  }, [brandId])

  if (!brand) return null

  function handleBack() {
    closeBrandTab()
    navigate(brandFromTab ?? 'explore')
  }

  const heroStyle = heroBg
    ? { backgroundImage: `url(${heroBg})`, backgroundSize: 'cover', backgroundPosition: 'center top' }
    : { background: 'linear-gradient(135deg, #1a1a1a 0%, #333 100%)' }

  return (
    <div className={styles.screen}>
      {/* ── Hero ── */}
      <div className={styles.hero} style={heroStyle}>
        <div className={styles.heroOverlay} />

        <button className={styles.backBtn} onClick={handleBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        <div className={styles.heroContent}>
          <p className={styles.heroFounded}>Est. {brand.founded} · {brand.origin}</p>
          <h1 className={styles.heroName}>{brand.name}</h1>
          <p className={styles.heroTagline}>{brand.tagline}</p>
        </div>
      </div>

      {/* ── Sub-tab bar ── */}
      <div className={styles.subTabBar}>
        <div className={styles.subTabGroup}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.subTab} ${subTab === tab.id ? styles.subTabActive : ''}`}
              onClick={() => setSubTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className={styles.tabContent}>
        {subTab === 'story'       && <StoryTab brand={brand} navigate={navigate} />}
        {subTab === 'lines'       && <LinesTab brand={brand} />}
        {subTab === 'collections' && <CollectionsTab brand={brand} />}
        {subTab === 'shop'        && <ShopTab brand={brand} />}
      </div>
    </div>
  )
}
