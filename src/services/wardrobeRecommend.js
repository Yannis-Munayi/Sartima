import { PRODUCTS } from '../data/products'
import { LOOKS } from '../data/looks'
import { makeFacetRanker, titleCase } from './styleRanking'

// ── Piece options shown in the wizard ────────────────────────────────────────

export const PIECE_OPTIONS = [
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

export const PIECE_BY_ID = Object.fromEntries(PIECE_OPTIONS.map((p) => [p.id, p]))

// ── Personal pieces ──────────────────────────────────────────────────────────
// Beyond the basics above, the wizard offers catalog garment types the user
// is drawn to. They live under `type:{catalogType}` ids so any step can
// rebuild the option from the id alone — no extra state to thread through.

const TYPE_PIECE_PREFIX = 'type:'

// Catalog type → the basic piece it's the headline type of. Only the first
// productType counts: "Baggy Jeans" also searches wide-leg trousers, but a
// user drawn to wide-leg trousers should see them by name, not as jeans.
const BASIC_PIECE_FOR_TYPE = Object.fromEntries(
  PIECE_OPTIONS.map((piece) => [piece.productTypes[0], piece.id]),
)

const ROLE_FOR_PARENT = { tops: 'tops', knitwear: 'tops', bottoms: 'bottoms', footwear: 'shoes', outerwear: 'outerwear' }

// Activewear mixes tops and bottoms under one parent type
const ACTIVEWEAR_BOTTOM = /legging|short|jogger|pant|tight|skirt/

// Shop Scout builds clothing capsules, so accessories stay out of the picks
const PERSONAL_PIECE_PARENTS = new Set(['tops', 'knitwear', 'bottoms', 'footwear', 'outerwear', 'activewear'])

const PRODUCTS_BY_TYPE = PRODUCTS.reduce((acc, p) => {
  (acc[p.type] ??= []).push(p)
  return acc
}, {})

const typePieceCache = {}

function buildTypePiece(type) {
  const products = PRODUCTS_BY_TYPE[type]
  if (!products?.length) return null

  // Placeholder glyph, like the basics: the type's most common product emoji
  const emojiCount = {}
  for (const p of products) if (p.emoji) emojiCount[p.emoji] = (emojiCount[p.emoji] ?? 0) + 1
  const emoji = Object.entries(emojiCount).sort(([, a], [, b]) => b - a)[0]?.[0] ?? ''

  const parentType = products[0].parentType
  const role = parentType === 'activewear'
    ? (ACTIVEWEAR_BOTTOM.test(type) ? 'bottoms' : 'tops')
    : ROLE_FOR_PARENT[parentType] ?? 'tops'
  const name = titleCase(type)

  return {
    id: `${TYPE_PIECE_PREFIX}${type}`,
    name,
    emoji,
    productTypes: [type],
    parentType,
    role,
    photoQuery: `${name.toLowerCase()} fashion outfit`,
    personal: true,
  }
}

/** Resolves a piece id — a basic piece or a `type:{catalogType}` personal one. */
export function getPieceOption(id) {
  if (PIECE_BY_ID[id]) return PIECE_BY_ID[id]
  if (typeof id !== 'string' || !id.startsWith(TYPE_PIECE_PREFIX)) return null
  const type = id.slice(TYPE_PIECE_PREFIX.length)
  if (!(type in typePieceCache)) typePieceCache[type] = buildTypePiece(type)
  return typePieceCache[type]
}

/**
 * The garment types the user is drawn to, as piece options, strongest first.
 * A type a basic piece already covers comes back as that basic piece (so
 * "Loafers" moves up rather than appearing twice); anything else becomes a
 * personal `type:` piece. Empty without a style signal.
 */
export function drawnPieceOptions(affinity, interests, gender, limit = 6) {
  const products = PRODUCTS.filter((p) => matchesScoutGender(p, gender) && PERSONAL_PIECE_PARENTS.has(p.parentType))
  const topValues = makeFacetRanker(products, affinity, interests)
  if (!topValues) return []

  const picked = []
  for (const type of topValues('type', limit * 2)) {
    const option = getPieceOption(BASIC_PIECE_FOR_TYPE[type] ?? `${TYPE_PIECE_PREFIX}${type}`)
    if (option && !picked.includes(option)) picked.push(option)
    if (picked.length === limit) break
  }
  return picked
}

// ── Gap pieces ───────────────────────────────────────────────────────────────
// Closet gaps (useClosetGaps) are per closet category; Shop Scout turns each
// into one concrete piece to shop for.

// Fallback basic piece per gap category — also the Home bell's deep link.
// 'accessories' has no Shop Scout piece.
export const GAP_PIECE_FOR_CATEGORY = {
  tops:        'plain-tee',
  bottoms:     'slim-jeans',
  outerwear:   'bomber',
  footwear:    'clean-sneakers',
  accessories: null,
}

const PARENTS_FOR_GAP_CATEGORY = {
  tops:      ['tops', 'knitwear'],
  bottoms:   ['bottoms'],
  outerwear: ['outerwear'],
  footwear:  ['footwear'],
}

function ownsPiece(option, ownedNames) {
  return option.productTypes.some((type) => {
    const words = type.replace(/-/g, ' ')
    return ownedNames.some((name) => name.includes(words))
  })
}

/**
 * The piece to shop for a closet gap: the best style fit within the gap's
 * category that the closet doesn't already hold (matched on item names),
 * else that category's basic piece. `ownedNames` are the lower-cased names
 * of closet items in the category. Null for categories Scout doesn't cover.
 */
export function gapPieceOption(category, affinity, interests, gender, ownedNames = []) {
  const parents = PARENTS_FOR_GAP_CATEGORY[category]
  if (!parents) return null

  const products  = PRODUCTS.filter((p) => matchesScoutGender(p, gender) && parents.includes(p.parentType))
  const topValues = makeFacetRanker(products, affinity, interests)
  for (const type of topValues ? topValues('type', 10) : []) {
    const option = getPieceOption(BASIC_PIECE_FOR_TYPE[type] ?? `${TYPE_PIECE_PREFIX}${type}`)
    if (option && !ownsPiece(option, ownedNames)) return option
  }
  return getPieceOption(GAP_PIECE_FOR_CATEGORY[category])
}

export const STARTER_CAPSULE = ['plain-tee', 'slim-jeans', 'hoodie', 'clean-sneakers', 'bomber']

// ── Budget tiers ──────────────────────────────────────────────────────────────

export const BUDGET_TIERS = [
  { id: 'any',     label: 'Any price',   sub: 'No budget limit',   priceTag: '✦',    priceRange: null },
  { id: 'budget',  label: 'Under $50',   sub: 'Affordable finds',  priceTag: '$',    priceRange: 'Under $50' },
  { id: 'mid',     label: '$50 – $150',  sub: 'Quality basics',    priceTag: '$$',   priceRange: '$50 – $150' },
  { id: 'premium', label: '$100 – $250', sub: 'Investment pieces', priceTag: '$$$',  priceRange: '$150 – $300' },
  { id: 'luxury',  label: '$250+',       sub: 'Designer quality',  priceTag: '$$$$', priceRange: '$300+' },
]

export const BUDGET_BY_ID = Object.fromEntries(BUDGET_TIERS.map((t) => [t.id, t]))

// ── Priority options ──────────────────────────────────────────────────────────

export const PRIORITIES = [
  { id: 'comfort',    label: 'Comfort / Relaxed fit',  emoji: '😌', styleKeys: ['streetwear', 'athleisure', 'normcore', 'gorpcore'] },
  { id: 'clean',      label: 'Clean / Minimal look',   emoji: '🤍', styleKeys: ['minimalist', 'scandi', 'cleangirl', 'normcore'] },
  { id: 'fitted',     label: 'Fitted / Tailored look', emoji: '✂️', styleKeys: ['oldmoney', 'preppy', 'businesscasual', 'minimalist'] },
  { id: 'versatile',  label: 'Versatility',            emoji: '🔄', styleKeys: ['normcore', 'minimalist', 'oldmoney'] },
  { id: 'durable',    label: 'Durability / Quality',   emoji: '🛡️', styleKeys: ['workwear', 'gorpcore', 'military'] },
  { id: 'brand',      label: 'Brand name / Prestige',  emoji: '⭐', styleKeys: [] },
  { id: 'affordable', label: 'Stretch my budget',      emoji: '💰', styleKeys: [] },
]

// ── Filter options ────────────────────────────────────────────────────────────

export const COLOR_OPTIONS = [
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

export const MATERIAL_OPTIONS = [
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

export const SIZE_BY_ROLE = {
  tops:     { us: ['XS','S','M','L','XL','XXL'],            eu: ['34','36','38','40','42','44','46'] },
  outerwear:{ us: ['XS','S','M','L','XL','XXL'],            eu: ['34','36','38','40','42','44','46'] },
  bottoms:  { us: ['28','29','30','31','32','34','36','38'], eu: ['28','29','30','31','32','34','36','38'] },
  shoes:    { us: ['6','7','8','9','10','11','12'],          eu: ['37','38','39','40','41','42','43','44'] },
}

// ── Recommendation engine ─────────────────────────────────────────────────────
// Products in the chosen budget tier are prioritised (+5 score boost).
// Result count comes from the user's Settings preference (default 10, range 5–100).

function scoreProduct(product, priorities, budgetTier, styleAffinities = {}) {
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
  // Bias toward the user's known taste — quiz/like-derived style affinities
  // (InterestContext), same source that seeds the discovery feed.
  for (const [style, weight] of Object.entries(weights)) {
    score += (styleAffinities[style] ?? 0) * weight * 0.5
  }
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

// Catalog products are tagged 'men' / 'women' / 'unisex' ('mens' / 'womens'
// also accepted). The "Both" preference sees everything, like Search does.
export function matchesScoutGender(p, gender) {
  if (p.gender === 'unisex' || gender === 'both') return true
  if (gender === 'men')   return p.gender === 'men' || p.gender === 'mens'
  if (gender === 'women') return p.gender === 'women' || p.gender === 'womens'
  return false
}

export function recommendProducts(pieceOption, budgetTier, priorities, gender, pieceFilters, maxCount = 10, specificName = null, styleAffinities = {}) {
  const genderMatch = (p) => matchesScoutGender(p, gender)

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
      let s = scoreProduct(p, priorities, budgetTier, styleAffinities)
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

export function findComplements(selectedIds) {
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

export function countOutfits(selectedIds) {
  const role    = (id) => getPieceOption(id)?.role
  const tops    = selectedIds.filter((id) => role(id) === 'tops').length
  const bottoms = selectedIds.filter((id) => role(id) === 'bottoms').length
  const shoes   = selectedIds.filter((id) => role(id) === 'shoes').length
  const outwear = selectedIds.filter((id) => role(id) === 'outerwear').length
  const t = Math.max(tops, 1)
  const b = Math.max(bottoms, 1)
  const s = Math.max(shoes, 1)
  return Math.round(t * b * s * (1 + outwear * 0.5))
}
