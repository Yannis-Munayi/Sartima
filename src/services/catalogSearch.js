// Text matching for the Search screen. Pure so it can be unit-tested.

// "boots" → "boot", "dresses" → "dress", "shoes" → "shoe". Words ending in
// "ss" ("dress") or "us" are already singular. Deliberately simple: the
// caller tries both the original and the singular query, so a word that is
// wrongly singularised still matches through the original.
function singularWord(w) {
  if (w.length <= 3) return w
  if (/(ss|us)$/.test(w)) return w
  if (/(sses|shes|ches|xes|zes)$/.test(w)) return w.slice(0, -2)
  if (/ies$/.test(w)) return `${w.slice(0, -3)}y`
  if (w.endsWith('s')) return w.slice(0, -1)
  return w
}

export function singularQuery(query) {
  return query.split(/\s+/).map(singularWord).join(' ')
}

// How directly a product answers one form of the query — lower is better,
// -1 is no match. An exact brand / colour / type hit leads (so "Red" lists
// red items before Red Wing boots), then partial brand, name, attribute and
// finally description hits ("Gant" before descriptions that merely say
// "elegant"). Types are matched with hyphens as spaces so "oxford shirt"
// finds the `oxford-shirt` type.
function tierFor(p, query) {
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

// `query` must already be lower-cased and trimmed. Tries the query as typed
// and its singular form ("boots" must find the `boot` / `chelsea-boot`
// types, not just products whose description mentions boots) and keeps the
// better tier.
export function matchTier(p, query) {
  const asTyped = tierFor(p, query)
  const singular = singularQuery(query)
  if (singular === query) return asTyped
  const single = tierFor(p, singular)
  if (asTyped < 0) return single
  if (single < 0) return asTyped
  return Math.min(asTyped, single)
}
