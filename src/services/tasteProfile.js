// Sartima ⇄ TasteModel adapter. tasteModel.js knows nothing about Sartima;
// this file owns the Sartima-specific parts: the catalog shape, the shared
// model instance, turning interestTracker signals into model events, and
// seeding accounts that predate the taste profile.
//
// It imports the full catalog, so eager bundles (contexts, interestTracker)
// must load it with a dynamic import().

import { PRODUCTS, PRODUCTS_BY_ID } from '../data/products'
import { STYLES } from '../data/styles'
import { TasteModel, createProfile, createSession } from './tasteModel'

export { createSession }

// Catalog prices are tiers, not amounts. The model only compares log-prices,
// so a representative amount per tier is enough ('contemporary' sits between
// mid and premium).
const PRICE_BY_RANGE = { budget: 35, mid: 90, contemporary: 150, premium: 220, luxury: 500 }

// Catalog outfitCompanions is one flat list mixing garment types and product
// ids; the model wants them apart.
function normalizeProduct(p) {
  const companions = p.outfitCompanions ?? []
  return {
    ...p,
    price: PRICE_BY_RANGE[p.priceRange],
    outfitCompanions: {
      ids:   companions.filter((c) => PRODUCTS_BY_ID[c]),
      types: companions.filter((c) => !PRODUCTS_BY_ID[c]),
    },
  }
}

let model = null

// Built on first use (~7.5k products) and shared by the feed and the tracker
export function getTasteModel() {
  model ??= new TasteModel({
    catalog:    PRODUCTS.map(normalizeProduct),
    aesthetics: Object.keys(STYLES),
  })
  return model
}

// Raw aesthetic tally → percentage shares, the shape onboard_quiz expects
function toShares(scores) {
  const entries = Object.entries(scores ?? {}).filter(([id, v]) => STYLES[id] && Number.isFinite(v) && v > 0)
  const total = entries.reduce((sum, [, v]) => sum + v, 0)
  if (total <= 0) return null
  return Object.fromEntries(entries.map(([id, v]) => [id, (v / total) * 100]))
}

const PRODUCT_EVENTS = {
  like:      'like',
  unlike:    'unlike',
  save:      'save',
  unsave:    'unsave',
  closetAdd: 'closet_add',
  shop:      'shop_click',
  tryOn:     'tryon',
  view:      'view',
  skip:      'skip',
}

// interestTracker signal → model event, or null when the model has no use
// for it (brand/aesthetic page visits, non-catalog closet uploads, ...)
function toEvent(signal) {
  const { type, ts } = signal
  if (PRODUCT_EVENTS[type]) {
    if (!signal.productId) return null
    return { type: PRODUCT_EVENTS[type], ts, productId: signal.productId, slot: signal.slot, dwellMs: signal.dwellMs }
  }
  switch (type) {
    case 'aestheticPin':
      return signal.aestheticId ? { type: 'pin_aesthetic', ts, aestheticId: signal.aestheticId } : null
    case 'brandFavorite':
      return signal.brandName ? { type: 'onboard_brand', ts, brandId: signal.brandName } : null
    case 'quizComplete': {
      const scores = toShares(signal.styleScores)
      return scores ? { type: 'onboard_quiz', ts, scores } : null
    }
    default:
      return null
  }
}

/** Applies interestTracker-style signals to a taste profile (mutates it). */
export function applySignals(profile, signals, session) {
  const events = signals.map(toEvent).filter(Boolean)
  if (events.length > 0) getTasteModel().applyEvents(profile, events, session)
  return profile
}

/**
 * The taste profile to start from, given the interests doc. A copy, so the
 * caller can mutate it. Accounts from before the taste model have only the
 * legacy tallies; their aesthetic tally seeds the profile (as quiz shares)
 * so the feed doesn't start them cold.
 */
export function loadTasteProfile(interests, now = Date.now()) {
  if (interests?.taste?.v === 1) return structuredClone(interests.taste)
  const profile = createProfile(now)
  const scores = toShares(interests?.styleAffinities)
  if (scores) getTasteModel().applyEvent(profile, { type: 'onboard_quiz', ts: now, scores })
  return profile
}

const TYPES_BY_PARENT = {}
for (const p of PRODUCTS) (TYPES_BY_PARENT[p.parentType] ??= new Set()).add(p.type)

/**
 * The model's closet context. It knows a closet item only when it came from
 * the catalog (the item keeps the product id), and matches gaps by product
 * type, so each gap category is spread over that category's types.
 * `gaps` is useClosetGaps' output.
 */
export function tasteCloset(closetItems, gaps) {
  const items = []
  for (const item of closetItems ?? []) {
    const p = PRODUCTS_BY_ID[item.id]
    if (p) items.push({ id: p.id, type: p.type, color: p.color })
  }
  const byType = {}
  for (const { category, deficit } of gaps ?? []) {
    for (const type of TYPES_BY_PARENT[category] ?? []) byType[type] = Math.max(byType[type] ?? 0, deficit)
  }
  return { items, gaps: byType }
}
