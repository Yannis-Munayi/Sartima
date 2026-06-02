import { useEffect, useMemo, useRef, useState } from 'react'
import { PRODUCTS } from '../data/products'
import { LOOKS } from '../data/looks'
import { fetchPhotosWithFallback } from '../services/pexels'
import { useApp } from '../context/AppContext'
import styles from './WardrobeBuildScreen.module.css'

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
  { id: 'budget',  label: 'Under $40',    sub: 'Affordable finds',      priceTag: '$' },
  { id: 'mid',     label: '$40 – $100',   sub: 'Quality basics',        priceTag: '$$' },
  { id: 'premium', label: '$100 – $250',  sub: 'Investment pieces',     priceTag: '$$$' },
  { id: 'luxury',  label: '$250+',        sub: 'Designer quality',      priceTag: '$$$$' },
]

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

// ── Recommendation engine ─────────────────────────────────────────────────────

const PRICE_FALLBACK_ORDER = {
  budget:  ['budget', 'mid'],
  mid:     ['mid', 'budget', 'premium'],
  premium: ['premium', 'mid', 'luxury'],
  luxury:  ['luxury', 'premium'],
}

function scoreProduct(product, priorities) {
  let score = 0
  const weights = product.styleWeights ?? {}
  for (const priorityId of priorities) {
    const prio = PRIORITIES.find((p) => p.id === priorityId)
    if (!prio) continue
    for (const key of prio.styleKeys) {
      score += (weights[key] ?? 0) * 1.5
    }
  }
  // Boost for affordable if that priority selected
  if (priorities.includes('affordable') && product.priceRange === 'budget') score += 3
  if (priorities.includes('brand') && ['premium', 'luxury'].includes(product.priceRange)) score += 2
  return score
}

function getPriorityLabel(product, priorities) {
  let best = null
  let bestScore = -1
  const weights = product.styleWeights ?? {}
  for (const priorityId of priorities) {
    const prio = PRIORITIES.find((p) => p.id === priorityId)
    if (!prio || prio.styleKeys.length === 0) continue
    const s = prio.styleKeys.reduce((acc, k) => acc + (weights[k] ?? 0), 0)
    if (s > bestScore) { bestScore = s; best = prio }
  }
  if (!best) return null
  const labelMap = {
    comfort: 'Comfort pick',
    clean: 'Clean & minimal',
    fitted: 'Tailored fit',
    versatile: 'Highly versatile',
    durable: 'Built to last',
    brand: 'Premium brand',
    affordable: 'Budget-friendly',
  }
  return labelMap[best.id] ?? null
}

function recommendProducts(pieceOption, budgetTier, priorities, gender) {
  const tierOrder = PRICE_FALLBACK_ORDER[budgetTier] ?? [budgetTier]

  const genderMatch = (p) => {
    if (!gender || gender === 'nonbinary') return p.gender === 'unisex'
    if (gender === 'men')   return p.gender === 'mens'  || p.gender === 'unisex'
    if (gender === 'women') return p.gender === 'womens' || p.gender === 'unisex'
    return p.gender === 'unisex'
  }

  // Match by type first, fall back to parentType
  let candidates = PRODUCTS.filter(
    (p) => pieceOption.productTypes.includes(p.type) && genderMatch(p)
  )
  if (candidates.length === 0) {
    candidates = PRODUCTS.filter(
      (p) => p.parentType === pieceOption.parentType && genderMatch(p)
    )
  }

  // Try price tiers in fallback order
  for (const tier of tierOrder) {
    const tierCandidates = candidates.filter((p) => p.priceRange === tier)
    if (tierCandidates.length > 0) {
      return tierCandidates
        .map((p) => ({ ...p, _score: scoreProduct(p, priorities) }))
        .sort((a, b) => b._score - a._score)
        .slice(0, 3)
    }
  }

  // Final fallback: return top 3 regardless of price
  return candidates
    .map((p) => ({ ...p, _score: scoreProduct(p, priorities) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 3)
}

function findComplements(selectedIds) {
  const selectedSet = new Set(selectedIds)
  const freq = {}

  // Flatten all looks across all aesthetics
  const allLooks = Object.values(LOOKS).flat()

  for (const look of allLooks) {
    const pieces = look.pieces ?? []
    // Count how many selected pieces appear in this look
    const matches = pieces.filter((p) => selectedSet.has(p)).length
    if (matches < 2) continue
    // Collect non-selected pieces
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
  const tops     = selectedIds.filter((id) => PIECE_BY_ID[id]?.role === 'tops').length
  const bottoms  = selectedIds.filter((id) => PIECE_BY_ID[id]?.role === 'bottoms').length
  const shoes    = selectedIds.filter((id) => PIECE_BY_ID[id]?.role === 'shoes').length
  const outwear  = selectedIds.filter((id) => PIECE_BY_ID[id]?.role === 'outerwear').length

  const t = Math.max(tops, 1)
  const b = Math.max(bottoms, 1)
  const s = Math.max(shoes, 1)
  const base = t * b * s
  // Each outerwear piece multiplies outfit variety by ~1.5 (rough estimate)
  return Math.round(base * (1 + outwear * 0.5))
}

// ── Price display helpers ─────────────────────────────────────────────────────

const PRICE_LABELS = { budget: 'Budget', mid: 'Mid-range', premium: 'Premium', luxury: 'Luxury' }
const PRICE_COLORS = { budget: '#4CAF50', mid: '#2196F3', premium: '#FF9800', luxury: '#9C27B0' }

// ── Step components ───────────────────────────────────────────────────────────

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
          <img
            src={photo}
            alt={piece.name}
            className={styles.pieceCardImg}
            style={{ opacity: loaded ? 1 : 0 }}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        )}
        <div className={styles.pieceCardOverlay} />
      </div>
      {isSelected && (
        <div className={styles.pieceCardSelectedOverlay} />
      )}
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
          <PieceCard
            key={piece.id}
            piece={piece}
            isSelected={selected.includes(piece.id)}
            onToggle={onToggle}
            gender={gender}
          />
        ))}
      </div>

      <button className={styles.notSureBtn} onClick={onNotSure}>
        ✨ Not sure yet? Show me a starter capsule
      </button>

      <button
        className={styles.nextBtn}
        onClick={onNext}
        disabled={selected.length === 0}
      >
        Next: Set your budget →
      </button>
    </div>
  )
}

function StepBudget({ selected, onSelect, onNext, onBack }) {
  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>What's your budget per item?</h2>
      <p className={styles.stepSub}>We'll find the best quality within your range.</p>

      <div className={styles.budgetGrid}>
        {BUDGET_TIERS.map((tier) => (
          <button
            key={tier.id}
            className={`${styles.budgetCard} ${selected === tier.id ? styles.budgetCardSelected : ''}`}
            onClick={() => onSelect(tier.id)}
          >
            <span className={styles.budgetTag}>{tier.priceTag}</span>
            <span className={styles.budgetLabel}>{tier.label}</span>
            <span className={styles.budgetSub}>{tier.sub}</span>
          </button>
        ))}
      </div>

      <div className={styles.navRow}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <button
          className={styles.nextBtn}
          onClick={onNext}
          disabled={!selected}
          style={{ flex: 1 }}
        >
          Next: Your priorities →
        </button>
      </div>
    </div>
  )
}

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
            <button
              key={p.id}
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
        <button
          className={styles.nextBtn}
          onClick={onNext}
          style={{ flex: 1 }}
        >
          Build my wardrobe →
        </button>
      </div>
    </div>
  )
}

// ── Product card ──────────────────────────────────────────────────────────────

function ProductPhoto({ product }) {
  const [photo, setPhoto]   = useState(null)
  const [loaded, setLoaded] = useState(false)
  const ref     = useRef(null)
  const fetched = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fetched.current) {
        fetched.current = true
        fetchPhotosWithFallback([
          product.googleQuery ?? `${product.brand} ${product.name} fashion`,
          `${product.brand} ${product.name}`,
          `${product.name} fashion outfit`,
        ], 1).then(([url] = []) => setPhoto(url ?? null))
        obs.disconnect()
      }
    }, { rootMargin: '80px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [product.id])

  return (
    <div
      ref={ref}
      className={styles.productPhoto}
      style={{ background: product.gradient ?? 'rgba(255,255,255,0.05)' }}
    >
      {photo && (
        <img
          src={photo}
          alt={product.name}
          className={styles.productPhotoImg}
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      )}
    </div>
  )
}

function ProductCard({ product, priorities }) {
  const label      = getPriorityLabel(product, priorities)
  const priceColor = PRICE_COLORS[product.priceRange] ?? '#888'
  const priceLabel = PRICE_LABELS[product.priceRange] ?? ''

  return (
    <div className={styles.productCard}>
      <ProductPhoto product={product} />
      <div className={styles.productCardBody}>
        <div className={styles.productCardTop}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className={styles.productBrand}>{product.brand}</p>
            <p className={styles.productName}>{product.name}</p>
          </div>
          <span className={styles.productPriceTag} style={{ color: priceColor }}>
            {priceLabel}
          </span>
        </div>
        <p className={styles.productDesc}>{product.description}</p>
        {label && <span className={styles.productLabel}>{label}</span>}
        <a
          href={product.shopUrl ?? product.shopFallbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.shopBtn}
        >
          Shop {product.brand} →
        </a>
      </div>
    </div>
  )
}

// ── Complement card ───────────────────────────────────────────────────────────

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
    <button
      ref={cardRef}
      className={styles.complementCard}
      onClick={() => onAddPiece(id)}
    >
      <div className={styles.complementCardBg}>
        {photo && (
          <img
            src={photo}
            alt={option.name}
            className={styles.complementCardImg}
            style={{ opacity: loaded ? 1 : 0 }}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
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

// ── Results view ──────────────────────────────────────────────────────────────

function ResultsView({ pieces, budget, priorities, gender, onReset, onAddPiece }) {
  const outfitCount = useMemo(() => countOutfits(pieces), [pieces])

  const recommendations = useMemo(() => {
    return pieces.map((pieceId) => {
      const option = PIECE_BY_ID[pieceId]
      if (!option) return null
      const products = recommendProducts(option, budget, priorities, gender)
      return { pieceId, option, products }
    }).filter(Boolean)
  }, [pieces, budget, priorities, gender])

  const complements = useMemo(() => findComplements(pieces), [pieces])

  return (
    <div className={styles.results}>
      {/* Outfit count banner */}
      <div className={styles.outfitBanner}>
        <div className={styles.outfitCount}>{outfitCount}</div>
        <div className={styles.outfitText}>
          <p className={styles.outfitMain}>estimated outfits</p>
          <p className={styles.outfitSub}>Mix and match your {pieces.length} pieces</p>
        </div>
      </div>

      {/* Core pieces */}
      <section className={styles.resultsSection}>
        <h3 className={styles.resultsSectionTitle}>Your Core Pieces</h3>
        <p className={styles.resultsSectionSub}>
          Top picks for your budget and priorities
        </p>

        {recommendations.map(({ pieceId, option, products }) => (
          <div key={pieceId} className={styles.pieceGroup}>
            <div className={styles.pieceGroupHeader}>
              <span className={styles.pieceGroupEmoji}>{option.emoji}</span>
              <span className={styles.pieceGroupName}>{option.name}</span>
              <span className={styles.pieceGroupBudget}>
                {BUDGET_TIERS.find((t) => t.id === budget)?.label}
              </span>
            </div>
            {products.length > 0 ? (
              <div className={styles.productList}>
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} priorities={priorities} />
                ))}
              </div>
            ) : (
              <p className={styles.noProducts}>
                No exact match in catalog — browse {option.name.toLowerCase()}s on your favourite retailer.
              </p>
            )}
          </div>
        ))}
      </section>

      {/* Also consider */}
      {complements.length > 0 && (
        <section className={styles.resultsSection}>
          <h3 className={styles.resultsSectionTitle}>Also Consider</h3>
          <p className={styles.resultsSectionSub}>
            These pair well with your picks and boost your outfit count
          </p>
          <div className={styles.complementGrid}>
            {complements.map((id) => (
              <ComplementCard
                key={id}
                id={id}
                onAddPiece={onAddPiece}
                gender={gender}
              />
            ))}
          </div>
        </section>
      )}

      <button className={styles.resetBtn} onClick={onReset}>
        Start over
      </button>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function WardrobeBuildScreen({ onBack }) {
  const { state } = useApp()
  const gender    = state.gender

  const [step, setStep]           = useState(1) // 1 = pieces, 2 = budget, 3 = priorities, 4 = results
  const [pieces, setPieces]       = useState([])
  const [budget, setBudget]       = useState(null)
  const [priorities, setPriorities] = useState([])

  function togglePiece(id) {
    setPieces((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  function togglePriority(id) {
    setPriorities((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  function useStarterCapsule() {
    setPieces(STARTER_CAPSULE)
    setStep(2)
  }

  function handleAddComplement(id) {
    if (!pieces.includes(id)) setPieces((prev) => [...prev, id])
  }

  function reset() {
    setStep(1)
    setPieces([])
    setBudget(null)
    setPriorities([])
  }

  const STEP_LABELS = ['Pieces', 'Budget', 'Priorities', 'Results']

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.headerBack} onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className={styles.headerCenter}>
          <h1 className={styles.headerTitle}>Shop Scout</h1>
          {step < 4 && (
            <p className={styles.headerSub}>Step {step} of 3</p>
          )}
        </div>
        <div className={styles.headerSpacer} />
      </div>

      {/* Step indicator */}
      {step < 4 && (
        <div className={styles.stepIndicator}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`${styles.stepDot} ${s < step ? styles.stepDotDone : ''} ${s === step ? styles.stepDotActive : ''}`}
            >
              <div className={styles.stepDotInner} />
              <span className={styles.stepDotLabel}>{STEP_LABELS[s - 1]}</span>
            </div>
          ))}
          <div className={styles.stepLine} />
        </div>
      )}

      {/* Content */}
      <div className={styles.content}>
        {step === 1 && (
          <StepPieces
            selected={pieces}
            onToggle={togglePiece}
            onNotSure={useStarterCapsule}
            onNext={() => setStep(2)}
            gender={gender}
          />
        )}
        {step === 2 && (
          <StepBudget
            selected={budget}
            onSelect={setBudget}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <StepPriorities
            selected={priorities}
            onToggle={togglePriority}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <ResultsView
            pieces={pieces}
            budget={budget ?? 'mid'}
            priorities={priorities}
            gender={gender}
            onReset={reset}
            onAddPiece={handleAddComplement}
          />
        )}
      </div>
    </div>
  )
}
