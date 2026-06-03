import { useEffect, useMemo, useRef, useState } from 'react'
import { STYLES, getPinterestUrl, getStyleName } from '../data/styles'
import { CLOTHING_ITEMS } from '../data/categories'
import { AESTHETIC_ITEMS, TYPE_EMOJI, inferCat, inferSeasons, inferGender } from '../data/aestheticItems'
import { AESTHETIC_DEPTH } from '../data/aestheticDepth'
import { getLooks, getLookPieces } from '../data/looks'
import { getGuideForAesthetic } from '../data/itemGuide'
import { fetchPhotos, fetchPhotosWithFallback } from '../services/pexels'
import { fetchPhotos as fetchGooglePhotos } from '../services/google'
import { PRODUCTS } from '../data/products'
import { useExplore } from '../context/ExploreContext'
import { useWishlist } from '../context/WishlistContext'
import { useApp } from '../context/AppContext'
import { useNavigation } from '../context/NavigationContext'
import ItemActionSheet from '../components/ItemActionSheet'
import ShopPanel from '../components/ShopPanel'
import styles from './AestheticScreen.module.css'

// ── Helpers ─────────────────────────────────────────────────────────────────

const ITEM_LOOKUP = (() => {
  const map = {}
  for (const [catId, items] of Object.entries(CLOTHING_ITEMS)) {
    for (const item of items) map[item.id] = { ...item, categoryId: catId }
  }
  return map
})()

const SEASONS = ['spring', 'summer', 'fall', 'winter']

// ── Product grid (used in Items + Guide tabs) ────────────────────────────────

const GUIDE_CAT_PARENTS = {
  jeans:     ['bottoms'],
  outerwear: ['outerwear'],
  sneakers:  ['footwear'],
  boots:     ['footwear'],
  loafers:   ['footwear'],
  hoodies:   ['tops'],
  shirts:    ['tops'],
  suits:     ['outerwear'],
  trousers:  ['bottoms'],
}

async function loadProductImage(product) {
  if (product.googleQuery) {
    const results = await fetchGooglePhotos(product.googleQuery, 1)
    if (results.length) return results[0]
  }
  const [url] = await fetchPhotosWithFallback([product.name], 1)
  return url ?? null
}

function ProductGridCard({ product }) {
  const [photo, setPhoto]   = useState(null)
  const [loaded, setLoaded] = useState(false)
  const { addToLiked, removeFromLiked, isLiked } = useWishlist()
  const liked = isLiked(product.id)

  useEffect(() => {
    let cancelled = false
    loadProductImage(product).then((url) => {
      if (!cancelled) setPhoto(url ?? null)
    })
    return () => { cancelled = true }
  }, [product.id])

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
      })
    }
  }

  return (
    <div className={styles.productGridCard}>
      <div className={styles.productGridPhoto} style={{ background: product.gradient }}>
        {photo && (
          <img
            src={photo}
            alt={product.name}
            className={styles.itemImg}
            style={{ opacity: loaded ? 1 : 0 }}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        )}
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
      {product.shopUrl && (
        <a href={product.shopUrl} target="_blank" rel="noopener noreferrer" className={styles.shopLink}>
          Shop ↗
        </a>
      )}
    </div>
  )
}

// ── Items sub-tab ────────────────────────────────────────────────────────────

function HeartButton({ wishlisted, onToggle }) {
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

function ItemsTab({ aestheticId }) {
  const { state } = useApp()
  const genderFilter = state.gender
  const styleData = STYLES[aestheticId]
  const gradient  = styleData?.gradient ?? 'linear-gradient(135deg, #1a1a1a 0%, #333 100%)'

  const [activeItem, setActiveItem] = useState(null)
  const [shopItem,   setShopItem]   = useState(null)

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
    setShopItem(activeItem)
    setActiveItem(null)
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

      {shopItem && (
        <ShopPanel
          item={shopItem}
          onClose={() => setShopItem(null)}
        />
      )}
    </>
  )
}

// ── Looks sub-tab ────────────────────────────────────────────────────────────

function LookCard({ look, genderFilter }) {
  const [photo, setPhoto]           = useState(null)
  const [loaded, setLoaded]         = useState(false)
  const [open, setOpen]             = useState(false)
  const [menPhotos, setMenPhotos]   = useState([])
  const [womenPhotos, setWomenPhotos] = useState([])
  const [gridLoading, setGridLoading] = useState(false)
  const fetchedRef = useRef(false)

  const thumbQuery = genderFilter === 'women' ? (look.womenPexelsQuery ?? look.pexelsQuery) : look.pexelsQuery

  useEffect(() => {
    let cancelled = false
    setPhoto(null)
    setLoaded(false)
    fetchPhotos(thumbQuery, 1).then(([url] = []) => {
      if (!cancelled) setPhoto(url ?? null)
    })
    return () => { cancelled = true }
  }, [look.id, thumbQuery])

  function handleToggle() {
    const next = !open
    setOpen(next)
    if (next && !fetchedRef.current) {
      fetchedRef.current = true
      setGridLoading(true)
      const menQ   = look.pexelsQuery
      const womenQ = look.womenPexelsQuery ?? look.pexelsQuery
      const fetchMen   = genderFilter !== 'women' ? fetchPhotos(menQ, 9)   : Promise.resolve([])
      const fetchWomen = genderFilter !== 'men'   ? fetchPhotos(womenQ, 9) : Promise.resolve([])
      Promise.all([fetchMen, fetchWomen]).then(([m, w]) => {
        setMenPhotos(m ?? [])
        setWomenPhotos(w ?? [])
        setGridLoading(false)
      })
    }
  }

  const pieces = look.pieces
    .map((id) => ITEM_LOOKUP[id])
    .filter(Boolean)

  return (
    <div className={styles.lookCard}>
      <button className={styles.lookHeader} onClick={handleToggle}>
        <div className={styles.lookThumb} style={{ background: 'rgba(255,255,255,0.06)' }}>
          {photo && (
            <img
              src={photo}
              alt={look.name}
              className={styles.lookImg}
              style={{ opacity: loaded ? 1 : 0 }}
              onLoad={() => setLoaded(true)}
              onError={() => setLoaded(true)}
            />
          )}
        </div>
        <div className={styles.lookInfo}>
          <p className={styles.lookName}>{look.name}</p>
          <p className={styles.lookVibe}>{look.vibe}</p>
          <div className={styles.lookSeasons}>
            {look.seasons.map((s) => (
              <span key={s} className={styles.seasonChip}>{s}</span>
            ))}
          </div>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className={styles.lookBody}>
          {/* Outfit photo grid */}
          {gridLoading ? (
            <div className={styles.outfitGridLoading}>Loading outfits…</div>
          ) : (menPhotos.length > 0 || womenPhotos.length > 0) && (
            <>
              {menPhotos.length > 0 && (
                <>
                  {womenPhotos.length > 0 && <p className={styles.piecesLabel}>Men's looks</p>}
                  <div className={styles.outfitGrid}>
                    {menPhotos.map((url, i) => (
                      <OutfitPhoto key={`m${i}`} url={url} alt={`${look.name} men outfit ${i + 1}`} />
                    ))}
                  </div>
                </>
              )}
              {womenPhotos.length > 0 && (
                <>
                  {menPhotos.length > 0 && <p className={styles.piecesLabel} style={{ marginTop: 16 }}>Women's looks</p>}
                  <div className={styles.outfitGrid}>
                    {womenPhotos.map((url, i) => (
                      <OutfitPhoto key={`w${i}`} url={url} alt={`${look.name} women outfit ${i + 1}`} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Pieces chips */}
          <p className={styles.piecesLabel}>Pieces in this look</p>
          <div className={styles.piecesList}>
            {pieces.map((item) => (
              <span key={item.id} className={styles.pieceChip}>
                {item.emoji} {item.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function OutfitPhoto({ url, alt, wishlistEntry }) {
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

function LooksTab({ aestheticId }) {
  const { state, dispatch } = useApp()
  const genderFilter = state.gender
  const [activeSeason, setActiveSeason] = useState(null)
  const [requiredPieces, setRequiredPieces] = useState([])

  const allPieces = useMemo(() => getLookPieces(aestheticId), [aestheticId])
  const filtered  = useMemo(
    () => getLooks(aestheticId, { season: activeSeason, requiredPieces }),
    [aestheticId, activeSeason, requiredPieces]
  )

  function togglePiece(id) {
    setRequiredPieces((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  const hasLooks = getLooks(aestheticId).length > 0
  const genderHint = genderFilter === 'women' ? 'women' : genderFilter === 'men' ? 'men' : ''

  if (!hasLooks) {
    return (
      <div className={styles.emptyLooks}>
        <p className={styles.emptyText}>
          Curated looks for this aesthetic are coming soon. Try browsing the Items tab.
        </p>
        <a
          href={getPinterestUrl(STYLES[aestheticId], genderFilter)}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.pinterestLink}
        >
          📌 Browse on Pinterest →
        </a>
      </div>
    )
  }

  return (
    <div>
      {/* Season filter */}
      <div className={styles.filterRow}>
        <button
          className={`${styles.filterPill} ${!activeSeason ? styles.filterActive : ''}`}
          onClick={() => setActiveSeason(null)}
        >
          All seasons
        </button>
        {SEASONS.map((s) => (
          <button
            key={s}
            className={`${styles.filterPill} ${activeSeason === s ? styles.filterActive : ''}`}
            onClick={() => setActiveSeason(activeSeason === s ? null : s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Piece filter */}
      {allPieces.length > 0 && (
        <div className={styles.pieceFilter}>
          <p className={styles.pieceFilterLabel}>Include piece</p>
          <div className={styles.filterRow}>
            {allPieces.map((id) => {
              const item = ITEM_LOOKUP[id]
              if (!item) return null
              return (
                <button
                  key={id}
                  className={`${styles.filterPill} ${requiredPieces.includes(id) ? styles.filterActive : ''}`}
                  onClick={() => togglePiece(id)}
                >
                  {item.emoji} {item.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Look cards */}
      {filtered.length === 0 ? (
        <p className={styles.emptyText}>No looks match the current filters.</p>
      ) : (
        <div className={styles.looksList}>
          {filtered.map((look) => (
            <LookCard key={`${look.id}-${genderFilter}`} look={look} genderFilter={genderFilter} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Guide sub-tab ────────────────────────────────────────────────────────────

function GuideItem({ type, catLabel, catId, aestheticId, isOpen, onToggle, gender }) {
  const [menPhotos, setMenPhotos]     = useState([])
  const [womenPhotos, setWomenPhotos] = useState([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const fetchedRef = useRef(null)

  const picks = useMemo(() =>
    PRODUCTS
      .filter((p) =>
        (p.styleWeights?.[aestheticId] ?? 0) >= 1 &&
        (GUIDE_CAT_PARENTS[catId] ?? []).includes(p.parentType)
      )
      .sort((a, b) => (b.styleWeights?.[aestheticId] ?? 0) - (a.styleWeights?.[aestheticId] ?? 0))
      .slice(0, 3),
    [catId, aestheticId]
  )

  useEffect(() => {
    if (isOpen && fetchedRef.current !== gender) {
      fetchedRef.current = gender
      setPhotosLoading(true)
      const fetchMen   = gender !== 'women' ? fetchPhotos(`${type.name} men outfit`, 9)   : Promise.resolve([])
      const fetchWomen = gender !== 'men'   ? fetchPhotos(`${type.name} women outfit`, 9) : Promise.resolve([])
      Promise.all([fetchMen, fetchWomen]).then(([m, w]) => {
        setMenPhotos(m ?? [])
        setWomenPhotos(w ?? [])
        setPhotosLoading(false)
      })
    }
  }, [isOpen, type.name, catLabel, gender])

  return (
    <div className={styles.guideItem} onClick={onToggle} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onToggle()}>
      <div className={styles.guideItemTop}>
        <span className={styles.guideItemName}>{type.name}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      {isOpen && (
        <div className={styles.guideItemBody}>
          <p className={styles.guideItemDesc}>{type.description}</p>
          {type.iconic && (
            <p className={styles.guideItemIconic}>
              <span className={styles.guideIconicLabel}>Iconic examples: </span>
              {type.iconic}
            </p>
          )}
          {photosLoading ? (
            <div className={styles.outfitGridLoading}>Loading photos…</div>
          ) : (
            <>
              {menPhotos.length > 0 && (
                <>
                  {womenPhotos.length > 0 && <p className={styles.piecesLabel}>Men</p>}
                  <div className={styles.outfitGrid}>
                    {menPhotos.map((url, i) => (
                      <OutfitPhoto key={`m${i}`} url={url}
                        alt={`${type.name} ${catLabel} men ${i + 1}`}
                        wishlistEntry={{ id: `photo:${catLabel}:${type.name}:m${i}`, label: type.name, catLabel }}
                      />
                    ))}
                  </div>
                </>
              )}
              {womenPhotos.length > 0 && (
                <>
                  {menPhotos.length > 0 && <p className={styles.piecesLabel} style={{ marginTop: 12 }}>Women</p>}
                  <div className={styles.outfitGrid}>
                    {womenPhotos.map((url, i) => (
                      <OutfitPhoto key={`w${i}`} url={url}
                        alt={`${type.name} ${catLabel} women ${i + 1}`}
                        wishlistEntry={{ id: `photo:${catLabel}:${type.name}:w${i}`, label: type.name, catLabel }}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {picks.length > 0 && (
            <div className={styles.guideProductRow}>
              {picks.map((p) => (
                <div key={p.id} className={styles.guideProductPick}>
                  <div>
                    <p className={styles.guidePickBrand}>{p.brand}</p>
                    <p className={styles.guidePickName}>{p.name}</p>
                  </div>
                  {p.shopUrl && (
                    <a href={p.shopUrl} target="_blank" rel="noopener noreferrer" className={styles.guidePickShop}>
                      Shop ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function GuideTab({ aestheticId }) {
  const { state, dispatch } = useApp()
  const gender = state.gender
  const [expanded, setExpanded] = useState(null)
  const categories = useMemo(() => getGuideForAesthetic(aestheticId), [aestheticId])

  if (categories.length === 0) {
    return <p className={styles.emptyText}>No guide content for this aesthetic yet.</p>
  }

  return (
    <div className={styles.guideList}>
      {categories.map((cat) => (
        <section key={cat.id} className={styles.guideSection}>
          <div className={styles.guideSectionHeader}>
            <span className={styles.guideSectionEmoji}>{cat.emoji}</span>
            <div>
              <p className={styles.guideSectionTitle}>{cat.label}</p>
              <p className={styles.guideSectionIntro}>{cat.intro}</p>
            </div>
          </div>

          {cat.types.map((type) => {
            const typeId = `${cat.id}-${type.name}`
            return (
              <GuideItem
                key={`${typeId}-${gender}`}
                type={type}
                catLabel={cat.label}
                catId={cat.id}
                aestheticId={aestheticId}
                isOpen={expanded === typeId}
                onToggle={() => setExpanded(expanded === typeId ? null : typeId)}
                gender={gender}
              />
            )
          })}
        </section>
      ))}
    </div>
  )
}

// ── Story sub-tab ─────────────────────────────────────────────────────────────

function StorySection({ emoji, title, children }) {
  return (
    <section className={styles.storySection}>
      <div className={styles.storySectionHeader}>
        <span className={styles.storySectionEmoji}>{emoji}</span>
        <h3 className={styles.storySectionTitle}>{title}</h3>
      </div>
      {children}
    </section>
  )
}

function StoryTab({ aestheticId }) {
  const data  = AESTHETIC_DEPTH[aestheticId]
  const style = STYLES[aestheticId]
  if (!data) {
    return <p className={styles.emptyText}>Deep dive coming soon for this aesthetic.</p>
  }

  return (
    <div className={styles.storyTab}>
      <div className={styles.storyMeta}>
        <span className={styles.storyPill}>{data.era}</span>
        <span className={styles.storyPill}>{data.origin}</span>
      </div>

      <StorySection emoji="📖" title="History & Origin">
        <p className={styles.storyBody}>{data.history}</p>
      </StorySection>

      <StorySection emoji="👕" title="Key Garments">
        <div className={styles.garmentList}>
          {data.keyGarments.map((g) => (
            <div key={g.name} className={styles.garmentRow}>
              <span className={styles.garmentName}>{g.name}</span>
              <span className={styles.garmentDesc}>{g.desc}</span>
            </div>
          ))}
        </div>
      </StorySection>

      <StorySection emoji="⭐" title="Icons Who Shaped It">
        <div className={styles.personList}>
          {data.icons.map((p) => (
            <div key={p.name} className={styles.personCard}>
              <span className={styles.personName}>{p.name}</span>
              <span className={styles.personMeta}>{p.role} · {p.era}</span>
            </div>
          ))}
        </div>
      </StorySection>

      <StorySection emoji="🔥" title="Modern Representatives">
        <div className={styles.personList}>
          {data.modernReps.map((p) => (
            <div key={p.name} className={styles.personCard}>
              <span className={styles.personName}>{p.name}</span>
              <span className={styles.personMeta}>{p.type}</span>
            </div>
          ))}
        </div>
      </StorySection>

      <StorySection emoji="🌍" title="Cultural Context">
        <p className={styles.storyBody}>{data.culturalContext}</p>
      </StorySection>

      {style?.brands?.length > 0 && (
        <StorySection emoji="🏷️" title="Brands to Know">
          <div className={styles.brandChips}>
            {style.brands.map((b) => (
              <span key={b} className={styles.brandChip}>{b}</span>
            ))}
          </div>
        </StorySection>
      )}
    </div>
  )
}

// ── Main AestheticScreen ─────────────────────────────────────────────────────

const TABS = [
  { id: 'story', label: 'Story' },
  { id: 'items', label: 'Items' },
  { id: 'looks', label: 'Looks' },
  { id: 'guide', label: 'Guide' },
]

export default function AestheticScreen({ aestheticId, forceSubTab }) {
  const navigate = useNavigation()
  const { closeAestheticTab, saveAesthetic, unsaveAesthetic, isSaved } = useExplore()
  const { state } = useApp()
  const gender = state.gender
  const [subTab, setSubTab] = useState('story')
  const [heroBg, setHeroBg] = useState(null)

  const style = STYLES[aestheticId]
  const saved = isSaved(aestheticId)

  useEffect(() => {
    setSubTab('story')
  }, [aestheticId])

  useEffect(() => {
    if (forceSubTab) setSubTab(forceSubTab)
  }, [forceSubTab])

  useEffect(() => {
    setHeroBg(null)
    let cancelled = false
    const genderHint = gender === 'women' ? 'women' : gender === 'men' ? 'men' : ''
    const heroQueries = style?.backgroundQuery
      ? [style.backgroundQuery, style.outfitQuery, `${style.name} aesthetic`].filter(Boolean)
      : [
          `${style?.name ?? ''} ${genderHint} fashion aesthetic`.trim(),
          `${style?.name ?? ''} ${genderHint} fashion`.trim(),
          `${style?.name ?? ''} style`,
        ]
    fetchPhotosWithFallback(heroQueries, 1).then(([url] = []) => {
      if (!cancelled && url) setHeroBg(url)
    })
    return () => { cancelled = true }
  }, [aestheticId, gender])

  if (!style) return null

  function handleBack() {
    closeAestheticTab()
    navigate('explore')
  }

  function handleSaveToggle() {
    if (saved) unsaveAesthetic(aestheticId)
    else saveAesthetic(aestheticId)
  }

  const heroStyle = heroBg
    ? { backgroundImage: `url(${heroBg})`, backgroundSize: 'cover', backgroundPosition: 'center top' }
    : { background: style.gradient }

  return (
    <div className={styles.screen}>
      {/* ── Hero header ── */}
      <div className={styles.hero} style={heroStyle}>
        <div className={styles.heroOverlay} />

        <button className={styles.backBtn} onClick={handleBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          className={`${styles.saveBtn} ${saved ? styles.saveBtnActive : ''}`}
          onClick={handleSaveToggle}
          title={saved ? 'Unpin this tab' : 'Pin this tab'}
        >
          {saved ? '📌 Saved' : '+ Save tab'}
        </button>

        <div className={styles.heroContent}>
          <span className={styles.heroIcon}>{style.icon}</span>
          <h1 className={styles.heroName}>{getStyleName(style, gender)}</h1>
          <p className={styles.heroTagline}>{style.tagline}</p>
          {style.description && (
            <p className={styles.heroDesc}>{style.description}</p>
          )}
        </div>

        {/* Pinterest link */}
        <a
          href={getPinterestUrl(style, gender)}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.pinterestBtn}
        >
          📌 Pinterest
        </a>
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
        {subTab === 'story' && <StoryTab aestheticId={aestheticId} />}
        {subTab === 'items' && <ItemsTab aestheticId={aestheticId} />}
        {subTab === 'looks' && <LooksTab aestheticId={aestheticId} />}
        {subTab === 'guide' && <GuideTab aestheticId={aestheticId} />}
      </div>
    </div>
  )
}
