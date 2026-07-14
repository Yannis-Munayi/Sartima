// Infers aesthetic styleWeights for wardrobe items that don't come from the
// catalog (manual uploads, AI-detected pieces). Garment-type words in the
// item's name/description are matched against catalog product type tokens,
// and the styleWeights of matching products are averaged — e.g. "Slim Jeans"
// picks up the aesthetic profile of the catalog's slim-jeans products.

let indexPromise = null

function buildIndex(products) {
  const index = {}
  for (const p of products) {
    if (!p.type || !p.styleWeights) continue
    for (const token of p.type.split('-')) {
      if (token.length < 3) continue
      const slot = (index[token] ??= { sums: {}, count: 0 })
      slot.count += 1
      for (const [style, w] of Object.entries(p.styleWeights)) {
        slot.sums[style] = (slot.sums[style] ?? 0) + w
      }
    }
  }
  return index
}

// Dynamic import keeps the heavy catalog chunk out of eager bundles
function getIndex() {
  if (!indexPromise) {
    indexPromise = import('../data/products')
      .then((m) => buildIndex(m.PRODUCTS))
      .catch(() => null)
  }
  return indexPromise
}

/**
 * Infer up to 3 aesthetics for a free-text item description.
 * Returns { [aestheticId]: weight } with weights 1–3, or null when the text
 * contains no recognisable garment words. Inferred weights cap at 3 — lower
 * confidence than the curated 1–5 weights on catalog products.
 */
export async function inferStyleWeights(text) {
  const index = await getIndex()
  if (!index || !text) return null

  const totals = {}
  let matched = false
  for (const raw of new Set(text.toLowerCase().split(/[^a-z]+/))) {
    if (raw.length < 3) continue
    const slot = index[raw] ?? index[raw.replace(/s$/, '')] ?? index[`${raw}s`]
    if (!slot) continue
    matched = true
    for (const [style, sum] of Object.entries(slot.sums)) {
      totals[style] = (totals[style] ?? 0) + sum / slot.count
    }
  }
  if (!matched) return null

  const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const max = top[0][1]
  const weights = {}
  for (const [style, avg] of top) {
    weights[style] = Math.max(1, Math.round((avg / max) * 3))
  }
  return weights
}
