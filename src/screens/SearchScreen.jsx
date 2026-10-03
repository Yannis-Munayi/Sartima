import { useEffect, useMemo, useRef, useState } from 'react'
import { PRODUCTS } from '../data/products'
import { useApp } from '../context/AppContext'
import { useWishlist } from '../context/WishlistContext'
import { resolveProductImage, getAltProductImage } from '../services/productImage'
import ProductImageToggle from '../components/ProductImageToggle'
import ItemActionSheet from '../components/ItemActionSheet'
import AuthWidget from '../components/AuthWidget'
import styles from './SearchScreen.module.css'
import Icon from '../components/Icon'

const MAX_RESULTS = 60

const SUGGESTED_SEARCHES = [
  'Ralph Lauren', 'Denim', 'Oxford Shirt', 'Sneakers', 'Knitwear', 'Outerwear', 'Cargo Pants', 'Blazer',
]

function genderFilter(gender) {
  return (p) => p.gender === 'unisex' || p.gender === gender || gender === 'both'
}

function productToEntry(product) {
  return {
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
  }
}

function SearchResultCard({ product, gender, onSelect }) {
  const [photo, setPhoto] = useState(null)
  const { addToLiked, removeFromLiked, isLiked } = useWishlist()
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
      resolveProductImage(product, gender).then((url) => { if (!cancelled) setPhoto(url ?? null) })
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => { cancelled = true; observer.disconnect() }
  }, [product.id, gender])

  function toggleLike(e) {
    e.stopPropagation()
    if (liked) removeFromLiked(product.id)
    else addToLiked(productToEntry(product))
  }

  return (
    <div className={styles.card} ref={cardRef} onClick={() => onSelect(productToEntry(product))}>
      <div className={styles.cardPhoto} style={{ background: product.gradient ?? 'var(--bg-elevated)' }}>
        <ProductImageToggle photo={photo} altPhoto={altPhoto} alt={product.name} imgClassName={styles.cardImg} />
        {product.brand && <span className={styles.brandBadge}>{product.brand}</span>}
        <button
          className={`${styles.heartBtn} ${liked ? styles.heartBtnActive : ''}`}
          onClick={toggleLike}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="2.2">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </button>
      </div>
      <p className={styles.cardName}>{product.name}</p>
      {product.priceRange && <p className={styles.cardPrice}>{product.priceRange}</p>}
    </div>
  )
}

export default function SearchScreen({ forcedQuery }) {
  const { state } = useApp()
  const gender = state.gender
  const [search, setSearch] = useState('')
  const [activeItem, setActiveItem] = useState(null)

  useEffect(() => {
    if (forcedQuery) setSearch(forcedQuery)
  }, [forcedQuery])

  const query = search.toLowerCase().trim()

  const results = useMemo(() => {
    if (!query) return []
    return PRODUCTS.filter(genderFilter(gender)).filter((p) =>
      p.name.toLowerCase().includes(query) ||
      p.brand?.toLowerCase().includes(query) ||
      p.type?.toLowerCase().includes(query) ||
      p.parentType?.toLowerCase().includes(query) ||
      p.color?.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query)
    )
  }, [query, gender])

  const shown = results.slice(0, MAX_RESULTS)

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.title}>Search</h1>
            <p className={styles.sub}>{PRODUCTS.length.toLocaleString()} products in the catalog</p>
          </div>
          <AuthWidget />
        </div>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            className={styles.search}
            placeholder="Search by brand, item, or color…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button className={styles.searchClear} onClick={() => setSearch('')}>×</button>
          )}
        </div>
      </div>

      <div className={styles.body}>
        {!query && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}><Icon name="search" size={24} /></span>
            <p className={styles.emptyTitle}>Find something specific</p>
            <p className={styles.emptySub}>Search the full catalog by brand, item type, or color.</p>
            <div className={styles.suggestions}>
              {SUGGESTED_SEARCHES.map((s) => (
                <button key={s} className={styles.suggestionChip} onClick={() => setSearch(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {query && results.length === 0 && (
          <p className={styles.noResults}>No products match &ldquo;{search}&rdquo;</p>
        )}

        {query && results.length > 0 && (
          <>
            <p className={styles.resultsCount}>
              {results.length > MAX_RESULTS
                ? `Showing ${MAX_RESULTS} of ${results.length} results`
                : `${results.length} result${results.length !== 1 ? 's' : ''}`}
            </p>
            <div className={styles.grid}>
              {shown.map((product) => (
                <SearchResultCard key={product.id} product={product} gender={gender} onSelect={setActiveItem} />
              ))}
            </div>
          </>
        )}
      </div>

      {activeItem && (
        <ItemActionSheet item={activeItem} onClose={() => setActiveItem(null)} />
      )}
    </div>
  )
}
