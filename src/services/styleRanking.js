// Personal ordering for the browse surfaces — Aesthetics, Brands and the
// Search suggestions. Everything here is pure: callers pass in the user's
// aesthetic affinity map (see useStyleAffinity) and the interest graph.

import { BRANDS, BRAND_NAME_TO_ID } from '../data/brands'

// Scales a raw tally to 0–1 relative to its strongest entry. Non-positive and
// non-numeric values are dropped, so an empty result means "no signal".
export function normalizeAffinities(map) {
  const entries = Object.entries(map ?? {}).filter(([, v]) => Number.isFinite(v) && v > 0)
  if (entries.length === 0) return {}
  const max = Math.max(...entries.map(([, v]) => v))
  return Object.fromEntries(entries.map(([k, v]) => [k, v / max]))
}

// Blends this session's quiz result with the persisted interest graph. Each
// source is normalised first so neither drowns the other: a quiz finished a
// minute ago reorders things right away without erasing long-term history.
export function blendStyleAffinities(liveScores, persistedScores) {
  const sum = {}
  for (const source of [normalizeAffinities(liveScores), normalizeAffinities(persistedScores)]) {
    for (const [style, v] of Object.entries(source)) sum[style] = (sum[style] ?? 0) + v
  }
  return normalizeAffinities(sum)
}

export function productAffinity(product, affinity) {
  let score = 0
  for (const [style, w] of Object.entries(product.styleWeights ?? {})) {
    score += w * (affinity[style] ?? 0)
  }
  return score
}

// Strongest first; equal scores keep their incoming order (sort is stable).
export function sortByScore(items, scoreOf) {
  return items
    .map((item) => ({ item, score: scoreOf(item) }))
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
}

// Ranks items and splits them where the match gets weak. Both halves stay
// strongest-first, so read top to bottom the whole list is one ranking.
export function splitByMatch(items, scoreOf, minScore) {
  const ranked = sortByScore(items, scoreOf)
  return {
    matches: ranked.filter((item) => scoreOf(item) >= minScore),
    rest:    ranked.filter((item) => scoreOf(item) < minScore),
  }
}

// Interest-graph brand keys are display names, both catalog spellings
// ("Polo Ralph Lauren") and profile names picked at onboarding ("Ralph Lauren").
const BRAND_ID_BY_NAME = {
  ...Object.fromEntries(Object.values(BRANDS).map((b) => [b.name, b.id])),
  ...BRAND_NAME_TO_ID,
}

// Kept below the aesthetic fit so liking one brand's pieces nudges it up
// without outranking brands that define the user's top aesthetic
const BRAND_LIKE_WEIGHT  = 0.4
const BRAND_VISIT_WEIGHT = 0.2

/**
 * Brand id → 0–1 fit. Aesthetic fit counts the brand's best-matching
 * aesthetic fully and each further one half as much as the last, so a brand
 * that nails your top aesthetic beats one that brushes against many.
 * Direct interest (liked products, onboarding favourites, page visits) is
 * layered on top. Returns {} when there's no signal at all.
 */
export function scoreBrands(brands, affinity, interests) {
  const fit = {}
  for (const brand of brands) {
    const matched = (brand.aesthetics ?? []).map((a) => affinity[a] ?? 0).sort((x, y) => y - x)
    fit[brand.id] = matched.reduce((sum, v, i) => sum + v / 2 ** i, 0)
  }

  const liked = {}
  for (const [name, v] of Object.entries(interests?.brandAffinities ?? {})) {
    const id = BRAND_ID_BY_NAME[name]
    if (id && Number.isFinite(v)) liked[id] = (liked[id] ?? 0) + v
  }

  const fitN    = normalizeAffinities(fit)
  const likedN  = normalizeAffinities(liked)
  const visitsN = normalizeAffinities(interests?.brandVisits)

  const scores = {}
  for (const brand of brands) {
    scores[brand.id] =
      (fitN[brand.id] ?? 0) +
      BRAND_LIKE_WEIGHT  * (likedN[brand.id] ?? 0) +
      BRAND_VISIT_WEIGHT * (visitsN[brand.id] ?? 0)
  }
  return normalizeAffinities(scores)
}

// ── Search suggestions ───────────────────────────────────────────────────────

// Catch-all garment types that make vague searches
const VAGUE_PIECES = new Set([
  'top', 'shirt', 'tee', 'tshirt', 'pants', 'trouser', 'cargo', 'wide-leg',
  'cami', 'longsleeve', 'vneck', 'casual-shirt', 'boot',
])

// Plain colour words only — no combos ("black/white"), prints or "multicolour"
const NOISY_COLOR = /[/&]|multi|stripe|print|floral|plaid|check|camo|pattern|leopard|dye/

// Minimum catalog depth (after the gender filter) so a chip always opens a
// real results page rather than one or two stragglers
const MIN_CATALOG = { brand: 5, type: 8, color: 12 }

const POOL_SIZE       = 200 // most-aligned products the facets are drawn from
const MIN_POOL_HITS   = 3
const INTEREST_WEIGHT = 0.75

const INTEREST_KEY = { brand: 'brandAffinities', type: 'typeAffinities', color: 'colorAffinities' }

export function titleCase(text) {
  return text.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function isEligible(facet, value) {
  if (!value) return false
  if (facet === 'type')  return !VAGUE_PIECES.has(value)
  if (facet === 'color') return !NOISY_COLOR.test(value)
  return true
}

/**
 * Ranks the values of one catalog facet ('brand' | 'type' | 'color') by how
 * strongly they run through the products that best fit the user's style. A
 * value scores by how much aligned weight it carries, scaled by how
 * over-represented it is versus the whole catalog (so "camel" can beat
 * "black" for an old-money profile even though black is everywhere), then
 * gets a boost from the matching interest-graph tally.
 *
 * `products` should already be gender-filtered. Returns a function
 * `(facet, limit) => values`, or null without a style signal.
 */
export function makeFacetRanker(products, affinity, interests) {
  const pool = products
    .map((p) => ({ p, a: productAffinity(p, affinity) }))
    .filter(({ a }) => a > 0)
    .sort((x, y) => y.a - x.a)
    .slice(0, POOL_SIZE)
  if (pool.length === 0) return null

  const poolTotal = pool.reduce((sum, { a }) => sum + a, 0)

  return function topValues(facet, limit) {
    const catalogCount = {}
    for (const p of products) catalogCount[p[facet]] = (catalogCount[p[facet]] ?? 0) + 1

    const weight = {}
    const hits   = {}
    for (const { p, a } of pool) {
      weight[p[facet]] = (weight[p[facet]] ?? 0) + a
      hits[p[facet]]   = (hits[p[facet]] ?? 0) + 1
    }

    const fromCatalog = {}
    for (const [value, w] of Object.entries(weight)) {
      if (hits[value] < MIN_POOL_HITS) continue
      const lift = (w / poolTotal) / (catalogCount[value] / products.length)
      fromCatalog[value] = w * Math.sqrt(lift)
    }

    const catalogN  = normalizeAffinities(fromCatalog)
    const interestN = normalizeAffinities(interests?.[INTEREST_KEY[facet]])
    const combined  = {}
    for (const value of new Set([...Object.keys(catalogN), ...Object.keys(interestN)])) {
      if ((catalogCount[value] ?? 0) < MIN_CATALOG[facet] || !isEligible(facet, value)) continue
      combined[value] = (catalogN[value] ?? 0) + INTEREST_WEIGHT * (interestN[value] ?? 0)
    }

    // Search is substring-based, so "Coat" would repeat "Overcoat" and
    // "Grey" would repeat "Mid Grey" — keep only the stronger of each pair
    const picked = []
    for (const [value] of Object.entries(combined).sort(([, x], [, y]) => y - x)) {
      if (picked.length === limit) break
      const text = value.toLowerCase().replace(/-/g, ' ')
      const overlaps = picked.some((p) => {
        const other = p.toLowerCase().replace(/-/g, ' ')
        return other.includes(text) || text.includes(other)
      })
      if (!overlaps) picked.push(value)
    }
    return picked
  }
}

/**
 * Brand / piece / colour searches for the Search empty state, drawn from
 * makeFacetRanker. Returns null without a style signal, otherwise
 * { brands, pieces, colors } of { label, hex? }.
 */
export function buildSearchSuggestions(products, affinity, interests, perGroup = 4) {
  const topValues = makeFacetRanker(products, affinity, interests)
  if (!topValues) return null

  const hexByColor = {}
  for (const p of products) {
    if (p.color && p.colorHex && !hexByColor[p.color]) hexByColor[p.color] = p.colorHex
  }

  return {
    brands: topValues('brand', perGroup).map((brand) => ({ label: brand })),
    pieces: topValues('type', perGroup).map((type) => ({ label: titleCase(type) })),
    colors: topValues('color', perGroup).map((color) => ({ label: titleCase(color), hex: hexByColor[color] })),
  }
}
