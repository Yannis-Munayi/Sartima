import { useEffect, useMemo, useRef, useState } from 'react'
import { PRODUCTS } from '../data/products'
import { useApp } from '../context/AppContext'
import { useWishlist } from '../context/WishlistContext'
import { useStyleAffinity } from '../hooks/useStyleAffinity'
import { resolveProductImage, getAltProductImage } from '../services/productImage'
import { buildSearchSuggestions, productAffinity } from '../services/styleRanking'
import ProductImageToggle from '../components/ProductImageToggle'
import ItemActionSheet from '../components/ItemActionSheet'
import AuthWidget from '../components/AuthWidget'
import styles from './SearchScreen.module.css'
import Icon from '../components/Icon'

const MAX_RESULTS = 60

// Shown until the user has a style profile to draw suggestions from
const SUGGESTED_SEARCHES = [
  'Ralph Lauren', 'Denim', 'Oxford Shirt', 'Sneakers', 'Knitwear', 'Outerwear', 'Cargo Pants', 'Blazer',
]

function genderFilter(gender) {
  return (p) => p.gender === 'unisex' || p.gender === gender || gender === 'both'
}

// How directly a product answers the query — lower is better, -1 is no
// match. An exact brand / colour / type hit leads (so "Red" lists red items
// before Red Wing boots), then partial brand, name, attribute and finally
// description hits ("Gant" before descriptions that merely say "elegant").
// Types are matched with hyphens as spaces so "oxford shirt" finds the
// `oxford-shirt` type.
function matchTier(p, query) {
  const spaced = query.replace(/-/g, ' ')
  const brand  = p.brand?.toLowerCase()
  const color  = p.color?.toLowerCase()
  const type   = p.type?.replace(/-/g, ' ')
  if (brand === query || color === query || type === spaced) return 0
  if (brand?.includes(query)) return 1
  if (p.name.toLowerCase().includes(query)) return 2
  if (type?.includes(spaced) || p.parentType?.toLowerCase().includes(query) || color?.includes(query)) return 3
  if (p.description?.toLowerCase().includes(query)) return 4
  return -1
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
  const { affinity, interests, hasProfile } = useStyleAffinity()
  const [search, setSearch] = useState('')
  const [activeItem, setActiveItem] = useState(null)

  useEffect(() => {
    if (forcedQuery) setSearch(forcedQuery)
  }, [forcedQuery])

  const query = search.toLowerCase().trim()

  const catalog = useMemo(() => PRODUCTS.filter(genderFilter(gender)), [gender])

  // Best match first, then — within equally good matches — best style fit
  const results = useMemo(() => {
    if (!query) return []
    const hits = []
    for (const p of catalog) {
      const tier = matchTier(p, query)
      if (tier >= 0) hits.push({ p, tier, fit: hasProfile ? productAffinity(p, affinity) : 0 })
    }
    return hits
      .sort((a, b) => a.tier - b.tier || b.fit - a.fit)
      .map(({ p }) => p)
  }, [query, catalog, hasProfile, affinity])

  const suggestions = useMemo(
    () => hasProfile ? buildSearchSuggestions(catalog, affinity, interests) : null,
    [hasProfile, catalog, affinity, interests],
  )

  const suggestionGroups = suggestions
    ? [
        { label: 'Brands', items: suggestions.brands },
        { label: 'Pieces', items: suggestions.pieces },
        { label: 'Colors', items: suggestions.colors },
      ].filter((g) => g.items.length > 0)
    : []

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
            data-page-search
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
            {suggestionGroups.length > 0 ? (
              <>
                <p className={styles.emptySub}>
                  Picked from your style profile, or search the full catalog by brand, item type, or color.
                </p>
                <div className={styles.suggestionGroups}>
                  {suggestionGroups.map((group) => (
                    <div key={group.label} className={styles.suggestionGroup}>
                      <p className={styles.suggestionLabel}>{group.label}</p>
                      <div className={styles.suggestions}>
                        {group.items.map((s) => (
                          <button key={s.label} className={styles.suggestionChip} onClick={() => setSearch(s.label)}>
                            {s.hex && <span className={styles.swatch} style={{ background: s.hex }} aria-hidden="true" />}
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className={styles.emptySub}>Search the full catalog by brand, item type, or color.</p>
                <div className={styles.suggestions}>
                  {SUGGESTED_SEARCHES.map((s) => (
                    <button key={s} className={styles.suggestionChip} onClick={() => setSearch(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
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
