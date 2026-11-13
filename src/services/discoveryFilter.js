// Narrows the Discover feed to the seasons and categories picked on the
// setup screens (SeasonScreen → CategoryScreen) or the feed's season sheet.

// Formalwear isn't a catalog parentType — tailoring is spread across tops,
// bottoms, outerwear, footwear and accessories, so it's matched by type.
const FORMALWEAR_TYPES = new Set([
  'blazer', 'suit-jacket', 'tailored-trousers', 'trouser', 'dress-shirt', 'tie', 'oxford', 'loafer',
])

export function matchesCategory(product, category) {
  if (category === 'formalwear') return FORMALWEAR_TYPES.has(product.type)
  return product.parentType === category
}

// Products without season tags are treated as all-season
export function matchesSeasons(product, seasons) {
  if (!product.seasons?.length) return true
  return product.seasons.some((s) => seasons.includes(s))
}

/**
 * Predicate for the products the feed may show. With nothing picked, every
 * product passes. If the seasons rule out every product in the chosen
 * categories, the seasons are dropped rather than leaving the feed empty
 * (and categories that match nothing fall back to seasons alone).
 */
export function discoveryFilter(products, { categories = [], seasons = [] } = {}) {
  const byCategory = categories.length > 0
    ? (p) => categories.some((c) => matchesCategory(p, c))
    : null
  const bySeason = seasons.length > 0
    ? (p) => matchesSeasons(p, seasons)
    : null

  // Strictest first; the first one that still matches something wins
  const candidates = [
    byCategory && bySeason && ((p) => byCategory(p) && bySeason(p)),
    byCategory,
    bySeason,
  ].filter(Boolean)

  return candidates.find((test) => products.some(test)) ?? (() => true)
}
