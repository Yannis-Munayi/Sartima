// Saved catalog entries (liked, wishlist, Shop Scout groups) carry the
// product's `gender` so cards can offer the men's/women's photo swap
// (canSwapGenderPhoto). Entries saved before that field existed are filled in
// once from the catalog after they load. Each helper returns the same array
// when nothing changes, so a functional setState bails out without a re-save.

const lacksGender = (e) => Boolean(e?.id) && !e.gender

export function entriesNeedGender(entries) {
  return Array.isArray(entries) && entries.some(lacksGender)
}

export function fillEntryGender(entries, productsById) {
  if (!Array.isArray(entries)) return entries
  let changed = false
  const next = entries.map((e) => {
    if (!lacksGender(e)) return e
    const gender = productsById[e.id]?.gender
    if (!gender) return e
    changed = true
    return { ...e, gender }
  })
  return changed ? next : entries
}

export function groupsNeedGender(groups) {
  return Array.isArray(groups) && groups.some((g) => entriesNeedGender(g?.products))
}

export function fillGroupGender(groups, productsById) {
  if (!Array.isArray(groups)) return groups
  let changed = false
  const next = groups.map((g) => {
    const products = fillEntryGender(g?.products, productsById)
    if (products === g?.products) return g
    changed = true
    return { ...g, products }
  })
  return changed ? next : groups
}

// The catalog is a separate ~5 MB chunk, so it's only fetched when a backfill
// is actually needed.
export function loadProductsById() {
  return import('../data/products').then((m) => m.PRODUCTS_BY_ID)
}
