import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PRODUCTS } from '../data/products'
import { LOOKS } from '../data/looks'
import { fetchPhotos, fetchPhotosWithFallback } from '../services/pexels'
import { resolveProductImage, getAltProductImage } from '../services/productImage'
import { useApp } from '../context/AppContext'
import { useShop } from '../context/ShopContext'
import ShopPanel from '../components/ShopPanel'
import ProductImageToggle from '../components/ProductImageToggle'
import styles from './WardrobeBuildScreen.module.css'
import listStyles from './ShopList.module.css'

// ── Piece options shown in the wizard ────────────────────────────────────────

const PIECE_OPTIONS = [
  // Tops
  { id: 'plain-tee',    name: 'Plain T-Shirt',     emoji: '⬜', productTypes: ['plain-tee'],                                parentType: 'tops',     role: 'tops',     photoQuery: 'plain white t-shirt minimal fashion outfit' },
  { id: 'graphic-tee',  name: 'Graphic Tee',        emoji: '🎨', productTypes: ['graphic-tee'],                              parentType: 'tops',     role: 'tops',     photoQuery: 'graphic tee streetwear outfit fashion' },
  { id: 'oxford',       name: 'Shirt / Oxford',     emoji: '👔', productTypes: ['oxford-shirt', 'linen-shirt', 'camp-shirt'], parentType: 'tops',    role: 'tops',     photoQuery: 'oxford button down shirt fashion outfit' },
  { id: 'polo',         name: 'Polo Shirt',         emoji: '⛳', productTypes: ['polo'],                                     parentType: 'tops',     role: 'tops',     photoQuery: 'polo shirt preppy fashion outfit' },
  // Knitwear
  { id: 'hoodie',       name: 'Hoodie',             emoji: '🫶', productTypes: ['hoodie'],                                   parentType: 'knitwear', role: 'tops',     photoQuery: 'hoodie streetwear casual fashion outfit' },
  { id: 'crewneck',     name: 'Crewneck Sweater',   emoji: '🌰', productTypes: ['crewneck', 'turtleneck'],                   parentType: 'knitwear', role: 'tops',     photoQuery: 'crewneck sweater minimal fashion outfit' },
  // Bottoms
  { id: 'slim-jeans',   name: 'Slim Jeans',         emoji: '💙', productTypes: ['slim-jeans'],                               parentType: 'bottoms',  role: 'bottoms',  photoQuery: 'slim fit jeans fashion outfit minimal' },
  { id: 'baggy-jeans',  name: 'Baggy Jeans',        emoji: '💧', productTypes: ['baggy-jeans', 'wide-leg-trousers'],         parentType: 'bottoms',  role: 'bottoms',  photoQuery: 'baggy jeans streetwear outfit fashion' },
  { id: 'chinos',       name: 'Chinos',             emoji: '🟡', productTypes: ['chinos'],                                   parentType: 'bottoms',  role: 'bottoms',  photoQuery: 'chinos trousers preppy fashion outfit' },
  { id: 'cargo',        name: 'Cargo Pants',        emoji: '🪖', productTypes: ['cargo-pants'],                              parentType: 'bottoms',  role: 'bottoms',  photoQuery: 'cargo pants streetwear utility outfit' },
  { id: 'shorts',       name: 'Shorts',             emoji: '🏄', productTypes: ['cycling-shorts'],                           parentType: 'bottoms',  role: 'bottoms',  photoQuery: 'shorts casual summer fashion outfit' },
  // Footwear
  { id: 'clean-sneakers', name: 'White Sneakers',   emoji: '🤍', productTypes: ['sneaker', 'runner'],                       parentType: 'footwear', role: 'shoes',    photoQuery: 'white sneakers clean minimal fashion' },
  { id: 'high-tops',    name: 'High-Top Sneakers',  emoji: '🏀', productTypes: ['high-top'],                                 parentType: 'footwear', role: 'shoes',    photoQuery: 'high top sneakers streetwear outfit' },
  { id: 'boots',        name: 'Boots',              emoji: '🥾', productTypes: ['chelsea-boot', 'combat-boot', 'work-boot'], parentType: 'footwear', role: 'shoes',    photoQuery: 'boots outfit fashion clean' },
  { id: 'loafers',      name: 'Loafers',            emoji: '🪙', productTypes: ['loafer'],                                   parentType: 'footwear', role: 'shoes',    photoQuery: 'loafers preppy old money fashion outfit' },
  // Outerwear
  { id: 'bomber',       name: 'Bomber Jacket',      emoji: '✈️', productTypes: ['bomber'],                                   parentType: 'outerwear', role: 'outerwear', photoQuery: 'bomber jacket streetwear outfit fashion' },
  { id: 'puffer',       name: 'Puffer Jacket',      emoji: '🫧', productTypes: ['puffer', 'insulated-jacket'],               parentType: 'outerwear', role: 'outerwear', photoQuery: 'puffer jacket winter outfit fashion' },
  { id: 'denim-jacket', name: 'Denim Jacket',       emoji: '🔵', productTypes: ['denim-jacket'],                             parentType: 'outerwear', role: 'outerwear', photoQuery: 'denim jacket outfit casual fashion' },
  { id: 'trench',       name: 'Trench / Overcoat',  emoji: '🟤', productTypes: ['trench', 'trench-coat', 'overcoat'],        parentType: 'outerwear', role: 'outerwear', photoQuery: 'trench coat outfit minimal fashion' },
]

const PIECE_BY_ID = Object.fromEntries(PIECE_OPTIONS.map((p) => [p.id, p]))

const STARTER_CAPSULE = ['plain-tee', 'slim-jeans', 'hoodie', 'clean-sneakers', 'bomber']

// ── Budget tiers ──────────────────────────────────────────────────────────────

const BUDGET_TIERS = [
  { id: 'any',     label: 'Any price',   sub: 'No budget limit',   priceTag: '✦',    priceRange: null },
  { id: 'budget',  label: 'Under $50',   sub: 'Affordable finds',  priceTag: '$',    priceRange: 'Under $50' },
  { id: 'mid',     label: '$50 – $150',  sub: 'Quality basics',    priceTag: '$$',   priceRange: '$50 – $150' },
  { id: 'premium', label: '$100 – $250', sub: 'Investment pieces', priceTag: '$$$',  priceRange: '$150 – $300' },
  { id: 'luxury',  label: '$250+',       sub: 'Designer quality',  priceTag: '$$$$', priceRange: '$300+' },
]

const BUDGET_BY_ID = Object.fromEntries(BUDGET_TIERS.map((t) => [t.id, t]))

// ── Priority options ──────────────────────────────────────────────────────────

const PRIORITIES = [
  { id: 'comfort',    label: 'Comfort / Relaxed fit',  emoji: '😌', styleKeys: ['streetwear', 'athleisure', 'normcore', 'gorpcore'] },
  { id: 'clean',      label: 'Clean / Minimal look',   emoji: '🤍', styleKeys: ['minimalist', 'scandi', 'cleangirl', 'normcore'] },
  { id: 'fitted',     label: 'Fitted / Tailored look', emoji: '✂️', styleKeys: ['oldmoney', 'preppy', 'businesscasual', 'minimalist'] },
  { id: 'versatile',  label: 'Versatility',            emoji: '🔄', styleKeys: ['normcore', 'minimalist', 'oldmoney'] },
  { id: 'durable',    label: 'Durability / Quality',   emoji: '🛡️', styleKeys: ['workwear', 'gorpcore', 'military'] },
  { id: 'brand',      label: 'Brand name / Prestige',  emoji: '⭐', styleKeys: [] },
  { id: 'affordable', label: 'Stretch my budget',      emoji: '💰', styleKeys: [] },
]

// ── Filter options ────────────────────────────────────────────────────────────

const COLOR_OPTIONS = [
  { id: 'black',   label: 'Black',  hex: '#1a1a1a' },
  { id: 'white',   label: 'White',  hex: '#f5f5f5' },
  { id: 'grey',    label: 'Grey',   hex: '#888888' },
  { id: 'navy',    label: 'Navy',   hex: '#1B2A4A' },
  { id: 'brown',   label: 'Brown',  hex: '#7B4F2E' },
  { id: 'beige',   label: 'Beige',  hex: '#C8A882' },
  { id: 'red',     label: 'Red',    hex: '#C0392B' },
  { id: 'blue',    label: 'Blue',   hex: '#2980B9' },
  { id: 'green',   label: 'Green',  hex: '#27AE60' },
  { id: 'olive',   label: 'Olive',  hex: '#6B7A2A' },
]

const MATERIAL_OPTIONS = [
  { id: 'any',       label: 'Any'       },
  { id: 'cotton',    label: 'Cotton'    },
  { id: 'linen',     label: 'Linen'     },
  { id: 'wool',      label: 'Wool'      },
  { id: 'denim',     label: 'Denim'     },
  { id: 'leather',   label: 'Leather'   },
  { id: 'polyester', label: 'Polyester' },
  { id: 'cashmere',  label: 'Cashmere'  },
  { id: 'fleece',    label: 'Fleece'    },
  { id: 'silk',      label: 'Silk'      },
]

const SIZE_BY_ROLE = {
  tops:     { us: ['XS','S','M','L','XL','XXL'],            eu: ['34','36','38','40','42','44','46'] },
  outerwear:{ us: ['XS','S','M','L','XL','XXL'],            eu: ['34','36','38','40','42','44','46'] },
  bottoms:  { us: ['28','29','30','31','32','34','36','38'], eu: ['28','29','30','31','32','34','36','38'] },
  shoes:    { us: ['6','7','8','9','10','11','12'],          eu: ['37','38','39','40','41','42','43','44'] },
}

// ── Recommendation engine ─────────────────────────────────────────────────────
// Products in the chosen budget tier are prioritised (+5 score boost).
// Result count comes from the user's Settings preference (default 10, range 5–100).

function scoreProduct(product, priorities, budgetTier) {
  let score = 0
  const weights = product.styleWeights ?? {}
  for (const priorityId of priorities) {
    const prio = PRIORITIES.find((p) => p.id === priorityId)
    if (!prio) continue
    for (const key of prio.styleKeys) {
      score += (weights[key] ?? 0) * 1.5
    }
  }
  if (priorities.includes('affordable') && product.priceRange === 'budget') score += 3
  if (priorities.includes('brand') && ['premium', 'luxury'].includes(product.priceRange)) score += 2
  // Boost products that match the chosen budget tier so they surface first
  if (product.priceRange === budgetTier) score += 5
  return score
}

const BUDGET_LABELS = { budget: 'Under $50', mid: '$50–$150', premium: '$150–$300', luxury: '$300+' }

function matchesSpecificName(productName, specificWords) {
  const name = productName.toLowerCase()
  return specificWords.every(w => name.includes(w))
}

function describeFilterMismatch(products, budgetTier, colorFilter) {
  const reasons = []
  if (budgetTier && budgetTier !== 'any') {
    const tiers = [...new Set(products.map(p => p.priceRange).filter(t => t && t !== budgetTier))]
    if (tiers.length) reasons.push(`priced ${tiers.map(t => BUDGET_LABELS[t] ?? t).join(' / ')}`)
  }
  if (colorFilter) {
    const colors = [...new Set(products.map(p => p.color).filter(Boolean))]
    if (colors.length) reasons.push(`available in ${colors.slice(0, 3).join(', ')}`)
  }
  return reasons.length ? reasons.join(' and ') : null
}

function recommendProducts(pieceOption, budgetTier, priorities, gender, pieceFilters, maxCount = 10, specificName = null) {
  const genderMatch = (p) => {
    if (!gender || gender === 'nonbinary') return p.gender === 'unisex'
    if (gender === 'men')   return p.gender === 'mens'  || p.gender === 'unisex'
    if (gender === 'women') return p.gender === 'womens' || p.gender === 'unisex'
    return p.gender === 'unisex'
  }

  // All category candidates matching gender
  let allCandidates = PRODUCTS.filter(p => pieceOption.productTypes.includes(p.type) && genderMatch(p))
  if (allCandidates.length === 0) {
    allCandidates = PRODUCTS.filter(p => p.parentType === pieceOption.parentType && genderMatch(p))
  }

  const colorFilter = pieceFilters?.color ? pieceFilters.color.toLowerCase() : null

  // Split into specific-match pool vs broader category pool
  let primaryPool, suggestedPool
  const hasSpecific = !!(specificName && specificName.trim())
  if (hasSpecific) {
    const words = specificName.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    if (words.length) {
      primaryPool   = allCandidates.filter(p => matchesSpecificName(p.name, words))
      suggestedPool = allCandidates.filter(p => !matchesSpecificName(p.name, words))
    } else {
      primaryPool = allCandidates; suggestedPool = []
    }
  } else {
    primaryPool = allCandidates; suggestedPool = []
  }

  // Hard filters applied only when searching for a specific item
  const passesHard = (p) => {
    if (!hasSpecific) return true
    if (budgetTier && budgetTier !== 'any' && p.priceRange && p.priceRange !== budgetTier) return false
    if (colorFilter && !p.color?.toLowerCase().includes(colorFilter)) return false
    return true
  }

  const scoreAll = (arr) =>
    arr.map(p => {
      let s = scoreProduct(p, priorities, budgetTier)
      if (colorFilter && p.color?.toLowerCase().includes(colorFilter)) s += 6
      return { ...p, _score: s }
    }).sort((a, b) => b._score - a._score)

  const primaryFiltered    = primaryPool.filter(passesHard)
  const primaryOutOfFilter = primaryPool.filter(p => !passesHard(p))

  const scoredPrimary    = scoreAll(primaryFiltered).slice(0, maxCount)
  const need             = maxCount - scoredPrimary.length
  const scoredSuggested  = need > 0 ? scoreAll(suggestedPool.filter(passesHard)).slice(0, need) : []
  const scoredOutOfFilter = scoreAll(primaryOutOfFilter).slice(0, maxCount)

  return {
    primary:       scoredPrimary,
    suggested:     scoredSuggested,
    outOfFilter:   primaryFiltered.length === 0 ? scoredOutOfFilter : [],
    filterMismatch: primaryFiltered.length === 0 && primaryOutOfFilter.length > 0
      ? describeFilterMismatch(primaryOutOfFilter, budgetTier, colorFilter)
      : null,
    specificName,
  }
}

function findComplements(selectedIds) {
  const selectedSet = new Set(selectedIds)
  const freq = {}
  const allLooks = Object.values(LOOKS).flat()

  for (const look of allLooks) {
    const pieces = look.pieces ?? []
    const matches = pieces.filter((p) => selectedSet.has(p)).length
    if (matches < 2) continue
    for (const p of pieces) {
      if (!selectedSet.has(p) && PIECE_BY_ID[p]) {
        freq[p] = (freq[p] ?? 0) + 1
      }
    }
  }

  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([id]) => id)
}

function countOutfits(selectedIds) {
  const tops    = selectedIds.filter((id) => PIECE_BY_ID[id]?.role === 'tops').length
  const bottoms = selectedIds.filter((id) => PIECE_BY_ID[id]?.role === 'bottoms').length
  const shoes   = selectedIds.filter((id) => PIECE_BY_ID[id]?.role === 'shoes').length
  const outwear = selectedIds.filter((id) => PIECE_BY_ID[id]?.role === 'outerwear').length
  const t = Math.max(tops, 1)
  const b = Math.max(bottoms, 1)
  const s = Math.max(shoes, 1)
  return Math.round(t * b * s * (1 + outwear * 0.5))
}

// ── Price display helpers ─────────────────────────────────────────────────────

const PRICE_LABELS = { budget: 'Budget', mid: 'Mid-range', premium: 'Premium', luxury: 'Luxury' }
const PRICE_COLORS = { budget: '#4CAF50', mid: '#2196F3', premium: '#FF9800', luxury: '#9C27B0' }

// ── Step 1: Piece selection ───────────────────────────────────────────────────

function PieceCard({ piece, isSelected, onToggle, gender }) {
  const [photo, setPhoto]   = useState(null)
  const [loaded, setLoaded] = useState(false)
  const cardRef  = useRef(null)
  const fetched  = useRef(false)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fetched.current) {
        fetched.current = true
        const hint = gender === 'women' ? 'women' : gender === 'men' ? 'men' : ''
        fetchPhotosWithFallback([
          `${piece.photoQuery} ${hint}`.trim(),
          `${piece.name} ${hint} fashion outfit`.trim(),
          `${piece.name} fashion`,
        ], 1).then(([url] = []) => setPhoto(url ?? null))
        obs.disconnect()
      }
    }, { rootMargin: '120px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [piece.id, gender])

  return (
    <button
      ref={cardRef}
      className={`${styles.pieceCard} ${isSelected ? styles.pieceCardSelected : ''}`}
      onClick={() => onToggle(piece.id)}
    >
      <div className={styles.pieceCardBg}>
        {photo && (
          <img src={photo} alt={piece.name} className={styles.pieceCardImg}
            style={{ opacity: loaded ? 1 : 0 }}
            onLoad={() => setLoaded(true)} onError={() => setLoaded(true)}
          />
        )}
        <div className={styles.pieceCardOverlay} />
      </div>
      {isSelected && <div className={styles.pieceCardSelectedOverlay} />}
      {isSelected && <span className={styles.pieceCheck}>✓</span>}
      <div className={styles.pieceCardFooter}>
        <span className={styles.pieceName}>{piece.name}</span>
      </div>
    </button>
  )
}

function StepPieces({ selected, onToggle, onNotSure, onNext, gender }) {
  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>What pieces are you looking for?</h2>
      <p className={styles.stepSub}>Select everything you're interested in — no limits.</p>

      <div className={styles.pieceGrid}>
        {PIECE_OPTIONS.map((piece) => (
          <PieceCard key={piece.id} piece={piece}
            isSelected={selected.includes(piece.id)}
            onToggle={onToggle} gender={gender}
          />
        ))}
      </div>

      <button className={styles.notSureBtn} onClick={onNotSure}>
        ✨ Not sure yet? Show me a starter capsule
      </button>

      <button className={styles.nextBtn} onClick={onNext} disabled={selected.length === 0}>
        Next: Set your budget →
      </button>
    </div>
  )
}

// ── Step 2: Per-piece budget ──────────────────────────────────────────────────

function StepBudget({ pieces, budgets, onSetBudget, filters, onSetFilter, sizeSystem, onNext, onBack }) {
  const allSet = pieces.every((id) => budgets[id])

  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>Budget & filters</h2>
      <p className={styles.stepSub}>Set price range and preferences per piece.</p>

      {pieces.map((pieceId) => {
        const piece    = PIECE_BY_ID[pieceId]
        const selected = budgets[pieceId] ?? null
        const pf       = filters[pieceId] ?? {}
        const sizeOpts = (SIZE_BY_ROLE[piece.role] ?? SIZE_BY_ROLE.tops)[sizeSystem] ?? []

        return (
          <div key={pieceId} className={styles.pieceBudgetSection}>
            <div className={styles.pieceBudgetTitle}>
              <span className={styles.pieceBudgetEmoji}>{piece.emoji}</span>
              <span>{piece.name}</span>
            </div>

            <div className={styles.budgetChipGrid}>
              {BUDGET_TIERS.map((tier) => (
                <button
                  key={tier.id}
                  className={`${styles.budgetChip} ${selected === tier.id ? styles.budgetChipSelected : ''}`}
                  onClick={() => onSetBudget(pieceId, tier.id)}
                >
                  <span className={styles.budgetChipTag}>{tier.priceTag}</span>
                  <span className={styles.budgetChipLabel}>{tier.label}</span>
                </button>
              ))}
            </div>

            <div className={styles.filterSection}>
              <p className={styles.filterLabel}>Color</p>
              <div className={styles.filterChipScroll}>
                <button
                  className={`${styles.filterChip} ${!pf.color ? styles.filterChipSelected : ''}`}
                  onClick={() => onSetFilter(pieceId, 'color', null)}
                >
                  Any
                </button>
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.id}
                    className={`${styles.colorDot} ${pf.color === c.id ? styles.colorDotSelected : ''}`}
                    style={{ background: c.hex }}
                    onClick={() => onSetFilter(pieceId, 'color', c.id)}
                    aria-label={c.label}
                    title={c.label}
                  >
                    {pf.color === c.id && <span className={styles.colorDotCheck}>✓</span>}
                  </button>
                ))}
              </div>

              <p className={styles.filterLabel}>Material</p>
              <div className={styles.filterChipScroll}>
                {MATERIAL_OPTIONS.map((m) => (
                  <button
                    key={m.id}
                    className={`${styles.filterChip} ${(pf.material ?? 'any') === m.id ? styles.filterChipSelected : ''}`}
                    onClick={() => onSetFilter(pieceId, 'material', m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <p className={styles.filterLabel}>
                Size <span className={styles.filterLabelHint}>({sizeSystem.toUpperCase()})</span>
              </p>
              <div className={styles.filterChipScroll}>
                <button
                  className={`${styles.filterChip} ${!pf.size ? styles.filterChipSelected : ''}`}
                  onClick={() => onSetFilter(pieceId, 'size', null)}
                >
                  Any
                </button>
                {sizeOpts.map((s) => (
                  <button
                    key={s}
                    className={`${styles.filterChip} ${pf.size === s ? styles.filterChipSelected : ''}`}
                    onClick={() => onSetFilter(pieceId, 'size', s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })}

      <div className={styles.navRow}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <button className={styles.nextBtn} onClick={onNext} disabled={!allSet} style={{ flex: 1 }}>
          Next: Your priorities →
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Priorities ────────────────────────────────────────────────────────

function StepPriorities({ selected, onToggle, onNext, onBack }) {
  const maxReached = selected.length >= 3

  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>What matters most to you?</h2>
      <p className={styles.stepSub}>Pick up to 3 priorities — we'll use these to rank picks.</p>

      <div className={styles.priorityGrid}>
        {PRIORITIES.map((p) => {
          const isSelected = selected.includes(p.id)
          const isDisabled = !isSelected && maxReached
          return (
            <button key={p.id}
              className={`${styles.priorityChip} ${isSelected ? styles.priorityChipSelected : ''} ${isDisabled ? styles.priorityChipDisabled : ''}`}
              onClick={() => !isDisabled && onToggle(p.id)}
            >
              <span className={styles.priorityEmoji}>{p.emoji}</span>
              <span className={styles.priorityLabel}>{p.label}</span>
              {isSelected && <span className={styles.priorityCheck}>✓</span>}
            </button>
          )
        })}
      </div>

      <div className={styles.navRow}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <button className={styles.nextBtn} onClick={onNext} style={{ flex: 1 }}>
          Find my picks →
        </button>
      </div>
    </div>
  )
}

// ── Step 4: Results ───────────────────────────────────────────────────────────

function ProductPhoto({ product }) {
  const [photo, setPhoto] = useState(null)
  const { state } = useApp()
  const gender = state.gender
  const altPhoto = getAltProductImage(product, gender)
  const ref     = useRef(null)
  const fetched = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fetched.current) {
        fetched.current = true
        resolveProductImage(product, gender).then((url) => setPhoto(url ?? null))
        obs.disconnect()
      }
    }, { rootMargin: '80px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [product.id, gender])

  return (
    <div ref={ref} className={styles.productPhoto}
      style={{ background: product.gradient ?? 'rgba(255,255,255,0.05)' }}
    >
      <ProductImageToggle photo={photo} altPhoto={altPhoto} alt={product.name} imgClassName={styles.productPhotoImg} />
    </div>
  )
}

function ProductCard({ product, priorities, isSelected, onToggle }) {
  const priceColor = PRICE_COLORS[product.priceRange] ?? '#888'
  const priceLabel = PRICE_LABELS[product.priceRange] ?? ''

  // Derive a priority label for display
  let priorityLabel = null
  {
    let best = null; let bestScore = -1
    const weights = product.styleWeights ?? {}
    for (const pid of priorities) {
      const prio = PRIORITIES.find((p) => p.id === pid)
      if (!prio || prio.styleKeys.length === 0) continue
      const s = prio.styleKeys.reduce((acc, k) => acc + (weights[k] ?? 0), 0)
      if (s > bestScore) { bestScore = s; best = prio }
    }
    if (best) {
      const labelMap = { comfort: 'Comfort pick', clean: 'Clean & minimal', fitted: 'Tailored fit', versatile: 'Highly versatile', durable: 'Built to last', brand: 'Premium brand', affordable: 'Budget-friendly' }
      priorityLabel = labelMap[best.id] ?? null
    }
  }

  return (
    <div className={`${styles.productCard} ${onToggle && !isSelected ? styles.productCardDimmed : ''}`}>
      <div style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
        <ProductPhoto product={product} />
        {onToggle && (
          <button
            className={`${styles.productSelectBtn} ${isSelected ? styles.productSelectBtnOn : ''}`}
            onClick={onToggle}
            aria-label={isSelected ? 'Deselect' : 'Select'}
          >
            {isSelected && '✓'}
          </button>
        )}
      </div>
      <div className={styles.productCardBody}>
        <div className={styles.productCardTop}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className={styles.productBrand}>{product.brand}</p>
            <p className={styles.productName}>{product.name}</p>
          </div>
          <span className={styles.productPriceTag} style={{ color: priceColor }}>{priceLabel}</span>
        </div>
        <p className={styles.productDesc}>{product.description}</p>
        {priorityLabel && <span className={styles.productLabel}>{priorityLabel}</span>}
        <a href={product.shopUrl ?? product.shopFallbackUrl}
          target="_blank" rel="noopener noreferrer" className={styles.shopBtn}
        >
          Shop {product.brand} →
        </a>
      </div>
    </div>
  )
}

function ComplementCard({ id, onAddPiece, gender }) {
  const option = PIECE_BY_ID[id]
  const [photo, setPhoto]   = useState(null)
  const [loaded, setLoaded] = useState(false)
  const cardRef  = useRef(null)
  const fetched  = useRef(false)

  useEffect(() => {
    const el = cardRef.current
    if (!el || !option) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fetched.current) {
        fetched.current = true
        const hint = gender === 'women' ? 'women' : gender === 'men' ? 'men' : ''
        fetchPhotosWithFallback([
          `${option.photoQuery} ${hint}`.trim(),
          `${option.name} ${hint} fashion outfit`.trim(),
          `${option.name} fashion`,
        ], 1).then(([url] = []) => setPhoto(url ?? null))
        obs.disconnect()
      }
    }, { rootMargin: '80px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [id, gender])

  if (!option) return null

  return (
    <button ref={cardRef} className={styles.complementCard} onClick={() => onAddPiece(id)}>
      <div className={styles.complementCardBg}>
        {photo && (
          <img src={photo} alt={option.name} className={styles.complementCardImg}
            style={{ opacity: loaded ? 1 : 0 }}
            onLoad={() => setLoaded(true)} onError={() => setLoaded(true)}
          />
        )}
        <div className={styles.complementCardOverlay} />
      </div>
      <div className={styles.complementCardFooter}>
        <span className={styles.complementName}>{option.name}</span>
        <span className={styles.complementAdd}>+ Add</span>
      </div>
    </button>
  )
}

function ResultsView({ recommendations, complements, budgets, priorities, gender, onReset, onAddPiece, onSave, saved }) {
  const pieces      = recommendations.map((r) => r.pieceId)
  const outfitCount = useMemo(() => countOutfits(pieces), [pieces])

  // Selected by default: primary + suggested (not OOF until revealed)
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(recommendations.flatMap((r) => [
      ...r.recs.primary, ...r.recs.suggested,
    ].map((p) => p.id)))
  )
  // Track which piece groups have revealed their out-of-filter products
  const [oofVisible, setOofVisible] = useState({})

  function toggleProduct(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function revealOof(pieceId, oofProducts) {
    setOofVisible(prev => ({ ...prev, [pieceId]: true }))
    setSelectedIds(prev => {
      const next = new Set(prev)
      oofProducts.forEach(p => next.add(p.id))
      return next
    })
  }

  const selectedCount = selectedIds.size

  return (
    <div className={styles.results}>
      <div className={styles.outfitBanner}>
        <div className={styles.outfitCount}>{outfitCount}</div>
        <div className={styles.outfitText}>
          <p className={styles.outfitMain}>estimated outfits</p>
          <p className={styles.outfitSub}>Mix and match your {pieces.length} pieces</p>
        </div>
      </div>

      <section className={styles.resultsSection}>
        <h3 className={styles.resultsSectionTitle}>Your Core Pieces</h3>
        <p className={styles.resultsSectionSub}>
          {onSave ? 'Tap a product to deselect it before saving' : 'Top picks for your budget and priorities'}
        </p>

        {recommendations.map(({ pieceId, option, recs }) => {
          const { primary, suggested, outOfFilter, filterMismatch, specificName } = recs
          const oof        = outOfFilter ?? []
          const oofShown   = oofVisible[pieceId] ?? false
          const hasMain    = primary.length > 0 || suggested.length > 0

          return (
            <div key={pieceId} className={styles.pieceGroup}>
              <div className={styles.pieceGroupHeader}>
                <span className={styles.pieceGroupEmoji}>{option.emoji}</span>
                <span className={styles.pieceGroupName}>
                  {specificName || option.name}
                </span>
                <span className={styles.pieceGroupBudget}>{BUDGET_BY_ID[budgets[pieceId]]?.label ?? ''}</span>
              </div>

              {/* Exact-match products */}
              {primary.length > 0 && (
                <div className={styles.productList}>
                  {primary.map((p) => (
                    <ProductCard key={p.id} product={p} priorities={priorities}
                      isSelected={selectedIds.has(p.id)}
                      onToggle={onSave ? () => toggleProduct(p.id) : null}
                    />
                  ))}
                </div>
              )}

              {/* Broader category suggestions (fills up to maxCount) */}
              {suggested.length > 0 && (
                <>
                  <p className={styles.suggestedLabel}>
                    {primary.length > 0 ? 'You might also like' : 'Top picks'}
                  </p>
                  <div className={styles.productList}>
                    {suggested.map((p) => (
                      <ProductCard key={p.id} product={p} priorities={priorities}
                        isSelected={selectedIds.has(p.id)}
                        onToggle={onSave ? () => toggleProduct(p.id) : null}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Out-of-filter notice */}
              {!hasMain && oof.length > 0 && (
                <div className={styles.oofNotice}>
                  <p className={styles.oofText}>
                    No <strong>{specificName ?? option.name}</strong> found within your current filters
                    {filterMismatch
                      ? `, but ${oof.length} ${oof.length === 1 ? 'option is' : 'options are'} ${filterMismatch}`
                      : ''}.
                  </p>
                  {!oofShown ? (
                    <button className={styles.oofBtn} onClick={() => revealOof(pieceId, oof)}>
                      View anyway →
                    </button>
                  ) : (
                    <div className={styles.productList}>
                      {oof.map((p) => (
                        <ProductCard key={p.id} product={p} priorities={priorities}
                          isSelected={selectedIds.has(p.id)}
                          onToggle={onSave ? () => toggleProduct(p.id) : null}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!hasMain && oof.length === 0 && (
                <p className={styles.noProducts}>
                  No matches in catalog — browse {option.name.toLowerCase()}s on your favourite retailer.
                </p>
              )}
            </div>
          )
        })}
      </section>

      {complements.length > 0 && (
        <section className={styles.resultsSection}>
          <h3 className={styles.resultsSectionTitle}>Also Consider</h3>
          <p className={styles.resultsSectionSub}>These pair well with your picks</p>
          <div className={styles.complementGrid}>
            {complements.map((id) => (
              <ComplementCard key={id} id={id} onAddPiece={onAddPiece} gender={gender} />
            ))}
          </div>
        </section>
      )}

      {onSave && !saved && (
        <button
          className={styles.saveListBtn}
          onClick={() => onSave(selectedIds)}
          disabled={selectedCount === 0}
        >
          Save {selectedCount} {selectedCount === 1 ? 'product' : 'products'} to My List
        </button>
      )}
      {saved && (
        <div className={styles.savedBanner}>
          ✓ Saved to My List — view in My List tab
        </div>
      )}

      <button className={styles.resetBtn} onClick={onReset}>Start over</button>
    </div>
  )
}

// ── My List tab ───────────────────────────────────────────────────────────────

function ProductRowPhoto({ product }) {
  const [photo, setPhoto] = useState(null)
  const { state } = useApp()
  const gender = state.gender
  const altPhoto = getAltProductImage(product, gender)
  const ref     = useRef(null)
  const fetched = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fetched.current) {
        fetched.current = true
        resolveProductImage(product, gender).then((url) => setPhoto(url ?? null))
        obs.disconnect()
      }
    }, { rootMargin: '60px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [product.id, gender])

  return (
    <div ref={ref} className={listStyles.productRowPhoto}>
      <ProductImageToggle photo={photo} altPhoto={altPhoto} alt={product.name} imgClassName={listStyles.productRowImg} />
    </div>
  )
}

function ScoutedGroupCard({ group, onRemove }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={listStyles.card}>
      <button className={listStyles.cardHeader} onClick={() => setOpen(!open)}>
        <div className={listStyles.cardPhoto} style={{ background: 'rgba(255,255,255,0.06)' }}>
          <span className={listStyles.cardEmoji}>{group.emoji}</span>
        </div>
        <div className={listStyles.cardInfo}>
          <p className={listStyles.cardName}>{group.pieceName}</p>
          <p className={listStyles.cardFilters}>
            {[
              group.budgetLabel,
              group.filters?.color,
              group.filters?.material && group.filters.material !== 'any' && group.filters.material,
              group.filters?.size,
            ].filter(Boolean).join(' · ')}
          </p>
          <p className={listStyles.cardCount}>{group.products.length} products</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" className={listStyles.chevron}
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className={listStyles.cardBody}>
          <div className={listStyles.productRows}>
            {group.products.map((product) => (
              <div key={product.id} className={listStyles.productRow}>
                <ProductRowPhoto product={product} />
                <div className={listStyles.productRowBody}>
                  <p className={listStyles.productRowBrand}>{product.brand}</p>
                  <p className={listStyles.productRowName}>{product.name}</p>
                  <p className={listStyles.productRowDesc}>{product.description}</p>
                </div>
                <a
                  href={product.shopUrl ?? product.shopFallbackUrl}
                  target="_blank" rel="noopener noreferrer"
                  className={listStyles.productRowBuy}
                >
                  Buy →
                </a>
              </div>
            ))}
          </div>
          <div className={listStyles.cardActions}>
            <button className={listStyles.removeBtn} onClick={() => onRemove(group.id)}>
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ShopItemCard({ entry, onRemove, onReopen }) {
  const { item, filters, retailers } = entry
  const [photo, setPhoto]   = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen]     = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchPhotos(`${item.name} fashion outfit`, 1).then(([url] = []) => {
      if (!cancelled) setPhoto(url ?? null)
    })
    return () => { cancelled = true }
  }, [item.id])

  const filterSummary = [filters.colour, filters.material, filters.size, filters.fit, filters.priceRange]
    .filter(Boolean).join(' · ')

  return (
    <div className={listStyles.card}>
      <button className={listStyles.cardHeader} onClick={() => setOpen(!open)}>
        <div className={listStyles.cardPhoto} style={{ background: item.gradient ?? 'rgba(255,255,255,0.06)' }}>
          {photo && (
            <img src={photo} alt={item.name} className={listStyles.cardImg}
              style={{ opacity: loaded ? 1 : 0 }}
              onLoad={() => setLoaded(true)} onError={() => setLoaded(true)}
            />
          )}
          <span className={listStyles.cardEmoji}>{item.emoji}</span>
        </div>
        <div className={listStyles.cardInfo}>
          <p className={listStyles.cardName}>{item.name}</p>
          <p className={listStyles.cardFilters}>{filterSummary || 'No filters applied'}</p>
          <p className={listStyles.cardCount}>{retailers.length} stores</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" className={listStyles.chevron}
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className={listStyles.cardBody}>
          <div className={listStyles.storeList}>
            {retailers.map((r, i) => (
              <a key={r.id} href={r.searchUrl} target="_blank" rel="noopener noreferrer"
                className={listStyles.storeRow}
              >
                <span className={listStyles.storeRank}>#{i + 1}</span>
                <span className={listStyles.storeName}>{r.emoji} {r.name}</span>
                <span className={listStyles.storeTagline}>{r.tagline}</span>
                <span className={listStyles.shopNow}>Shop →</span>
              </a>
            ))}
          </div>
          <div className={listStyles.cardActions}>
            <button className={listStyles.reopenBtn} onClick={() => onReopen(entry)}>Update filters</button>
            <button className={listStyles.removeBtn} onClick={() => onRemove(item.id)}>Remove</button>
          </div>
        </div>
      )}
    </div>
  )
}

function MyListView() {
  const { shopList, removeFromShop, scoutedGroups, removeScoutedGroup } = useShop()
  const [reopenEntry, setReopenEntry] = useState(null)

  const isEmpty = shopList.length === 0 && scoutedGroups.length === 0

  return (
    <div>
      {isEmpty && (
        <div className={listStyles.empty}>
          <span className={listStyles.emptyIcon}>🛍️</span>
          <p className={listStyles.emptyTitle}>Nothing here yet</p>
          <p className={listStyles.emptySub}>
            Complete a Scout search to save products here, or tap "Shop this item" anywhere in the app.
          </p>
        </div>
      )}

      {scoutedGroups.length > 0 && (
        <>
          <p className={listStyles.sectionTitle}>Scout Results</p>
          <div className={listStyles.list}>
            {scoutedGroups.map((group) => (
              <ScoutedGroupCard key={group.id} group={group} onRemove={removeScoutedGroup} />
            ))}
          </div>
        </>
      )}

      {shopList.length > 0 && (
        <>
          <p className={listStyles.sectionTitle}>Saved Items</p>
          <div className={listStyles.list}>
            {shopList.map((entry) => (
              <ShopItemCard key={entry.item.id} entry={entry}
                onRemove={removeFromShop} onReopen={setReopenEntry}
              />
            ))}
          </div>
        </>
      )}

      {reopenEntry && (
        <ShopPanel item={reopenEntry.item} onClose={() => setReopenEntry(null)} />
      )}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function WardrobeBuildScreen({ onBack, initialPiece = null, initialSpecificName = null }) {
  const { state } = useApp()
  const gender    = state.gender
  const { shopList, addScoutedGroup } = useShop()

  const hasInitial = !!(initialPiece && PIECE_BY_ID[initialPiece])

  const [activeView, setActiveView] = useState('scout') // 'scout' | 'list'
  const [step, setStep]             = useState(hasInitial ? 2 : 1)
  const [pieces, setPieces]         = useState(hasInitial ? [initialPiece] : [])
  const [budgets, setBudgets]       = useState({}) // { [pieceId]: tierId }
  const [filters, setFilters]       = useState({}) // { [pieceId]: { color, material, size } }
  const [priorities, setPriorities] = useState([])
  const [sizeSystem]                = useState(() => localStorage.getItem('sartima_size_system') || 'us')

  function togglePiece(id) {
    setPieces((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])
  }

  function setBudget(pieceId, tierId) {
    setBudgets((prev) => ({ ...prev, [pieceId]: tierId }))
  }

  function setPieceFilter(pieceId, key, value) {
    setFilters((prev) => ({
      ...prev,
      [pieceId]: { ...prev[pieceId], [key]: value },
    }))
  }

  function togglePriority(id) {
    setPriorities((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])
  }

  function useStarterCapsule() {
    setPieces(STARTER_CAPSULE)
    setStep(2)
  }

  function handleAddComplement(id) {
    if (!pieces.includes(id)) {
      setPieces((prev) => [...prev, id])
      setStep(2) // user must assign a budget for the new piece
    }
  }

  const [saved, setSaved]     = useState(false)
  const [autoSave]            = useState(() => localStorage.getItem('sartima_scout_autosave') === 'true')

  function reset() {
    setStep(1)
    setPieces([])
    setBudgets({})
    setFilters({})
    setPriorities([])
    setSaved(false)
  }

  // Compute recommendations when on step 4
  const recommendations = useMemo(() => {
    if (step < 4) return []
    return pieces.map((pieceId) => {
      const option       = PIECE_BY_ID[pieceId]
      if (!option) return null
      const budgetTier   = budgets[pieceId] ?? 'mid'
      const pieceFilters = filters[pieceId] ?? {}
      const maxCount     = Math.min(100, Math.max(5, parseInt(localStorage.getItem('sartima_scout_result_count') ?? '10', 10) || 10))
      const recs         = recommendProducts(option, budgetTier, priorities, gender, pieceFilters, maxCount, initialSpecificName)
      return { pieceId, option, recs, budgetTier, pieceFilters }
    }).filter(Boolean)
  }, [step, pieces, budgets, filters, priorities, gender, initialSpecificName])

  const complements = useMemo(
    () => (step === 4 ? findComplements(pieces) : []),
    [step, pieces]
  )

  const performSave = useCallback((selectedIds) => {
    recommendations.forEach(({ pieceId, option, recs, budgetTier, pieceFilters }) => {
      const tier        = BUDGET_BY_ID[budgetTier]
      const allProducts = [...recs.primary, ...recs.suggested, ...recs.outOfFilter]
      const safeProducts = allProducts
        .filter((p) => selectedIds.has(p.id))
        .map(({ id, brand, name, description, shopUrl, shopFallbackUrl, googleQuery, priceRange, image, imageMen }) =>
          ({ id, brand, name, description, shopUrl, shopFallbackUrl, googleQuery, priceRange, image, imageMen })
        )
      if (safeProducts.length === 0) return
      addScoutedGroup({
        id:          `${pieceId}_${budgetTier}`,
        pieceId,
        pieceName:   recs.specificName || option.name,
        emoji:       option.emoji,
        budgetTier,
        budgetLabel: tier?.label ?? '',
        filters:     pieceFilters ?? {},
        products:    safeProducts,
        savedAt:     Date.now(),
      })
    })
    setSaved(true)
  }, [recommendations, addScoutedGroup])

  // Auto-save when the setting is enabled — saves all products (opt-in, default off)
  useEffect(() => {
    if (!autoSave || step !== 4 || recommendations.length === 0 || saved) return
    const allIds = new Set(recommendations.flatMap((r) =>
      [...r.recs.primary, ...r.recs.suggested].map((p) => p.id)
    ))
    performSave(allIds)
  }, [autoSave, step, recommendations.length, saved, performSave])

  // Clear saved flag when user goes back to earlier steps
  useEffect(() => {
    if (step < 4) setSaved(false)
  }, [step])

  const { scoutedGroups } = useShop()
  const totalListCount    = shopList.length + scoutedGroups.length

  const STEP_LABELS = ['Pieces', 'Budget', 'Priorities', 'Results']

  return (
    <div className={styles.screen}>
      {/* Sticky header + tabs */}
      <div className={styles.stickyTop}>
        <div className={styles.header}>
          <button className={styles.headerBack} onClick={onBack} aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className={styles.headerCenter}>
            <h1 className={styles.headerTitle}>Shop Scout</h1>
            {activeView === 'scout' && step < 4 && (
              <p className={styles.headerSub}>Step {step} of 3</p>
            )}
          </div>
          <div className={styles.headerSpacer} />
        </div>

        <div className={styles.viewTabsRow}>
          <button
            className={`${styles.viewTab} ${activeView === 'scout' ? styles.viewTabActive : ''}`}
            onClick={() => setActiveView('scout')}
          >
            Scout
          </button>
          <button
            className={`${styles.viewTab} ${activeView === 'list' ? styles.viewTabActive : ''}`}
            onClick={() => setActiveView('list')}
          >
            My List
            {totalListCount > 0 && (
              <span className={styles.viewTabBadge}>{totalListCount}</span>
            )}
          </button>
        </div>
      </div>

      {activeView === 'scout' && step < 4 && (
        <div className={styles.stepIndicator}>
          {[1, 2, 3].map((s) => (
            <div key={s}
              className={`${styles.stepDot} ${s < step ? styles.stepDotDone : ''} ${s === step ? styles.stepDotActive : ''}`}
            >
              <div className={styles.stepDotInner} />
              <span className={styles.stepDotLabel}>{STEP_LABELS[s - 1]}</span>
            </div>
          ))}
          <div className={styles.stepLine} />
        </div>
      )}

      <div className={styles.content}>
        {activeView === 'list' && <MyListView />}
        {activeView === 'scout' && (
          <>
            {step === 1 && (
              <StepPieces selected={pieces} onToggle={togglePiece}
                onNotSure={useStarterCapsule} onNext={() => setStep(2)} gender={gender}
              />
            )}
            {step === 2 && (
              <StepBudget pieces={pieces} budgets={budgets}
                onSetBudget={setBudget} filters={filters} onSetFilter={setPieceFilter}
                sizeSystem={sizeSystem}
                onNext={() => setStep(3)} onBack={() => setStep(1)}
              />
            )}
            {step === 3 && (
              <StepPriorities selected={priorities} onToggle={togglePriority}
                onNext={() => setStep(4)} onBack={() => setStep(2)}
              />
            )}
            {step === 4 && (
              <ResultsView
                recommendations={recommendations} complements={complements}
                budgets={budgets} priorities={priorities} gender={gender}
                onReset={reset} onAddPiece={handleAddComplement}
                onSave={autoSave ? null : performSave}
                saved={saved}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
