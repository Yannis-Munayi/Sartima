// Catalog linter — validates every product entry in src/data/products/
// against the app's real vocabularies (categories, aesthetics, brands).
// Run: npm run lint:catalog   (exit code 1 on errors; warnings don't fail)

import { STYLES } from '../src/data/styles.js'
import { CATEGORIES } from '../src/data/categories.js'
import { BRAND_NAME_TO_ID } from '../src/data/brands.js'

import coreProducts from '../src/data/products/core.js'
import footwearSpecialists from '../src/data/products/footwear-specialists.js'
import footwearWide from '../src/data/products/footwear-wide.js'
import topsProducts from '../src/data/products/tops.js'
import bottomsProducts from '../src/data/products/bottoms.js'
import knitwearProducts from '../src/data/products/knitwear.js'
import outerwearProducts from '../src/data/products/outerwear.js'
import accessoriesProducts from '../src/data/products/accessories.js'
import activewearProducts from '../src/data/products/activewear.js'

const FILES = {
  'core.js': coreProducts,
  'footwear-specialists.js': footwearSpecialists,
  'footwear-wide.js': footwearWide,
  'tops.js': topsProducts,
  'bottoms.js': bottomsProducts,
  'knitwear.js': knitwearProducts,
  'outerwear.js': outerwearProducts,
  'accessories.js': accessoriesProducts,
  'activewear.js': activewearProducts,
}

const REQUIRED_FIELDS = [
  'id', 'name', 'brand', 'type', 'parentType', 'color', 'colorHex',
  'priceRange', 'description', 'seasons', 'gender', 'styleWeights',
  'shopUrl', 'googleQuery', 'gradient', 'emoji',
]
const PARENT_TYPES = new Set(CATEGORIES.map((c) => c.id))
const STYLE_IDS = new Set(Object.keys(STYLES))
const BRAND_NAMES = new Set(Object.keys(BRAND_NAME_TO_ID))
const PRICE_RANGES = new Set(['budget', 'mid', 'contemporary', 'premium', 'luxury'])
const GENDERS = new Set(['men', 'women', 'unisex'])
const SEASONS = new Set(['spring', 'summer', 'fall', 'winter'])
const HEX_RE = /^#[0-9A-Fa-f]{6}$/

const errors = []
const warnings = []
const seenIds = new Map() // id -> first file
const allTypes = new Set()
const all = []

for (const [file, products] of Object.entries(FILES)) {
  if (!Array.isArray(products)) {
    errors.push(`${file}: default export is not an array`)
    continue
  }
  for (const p of products) {
    allTypes.add(p.type)
    all.push({ file, p })
  }
}

for (const { file, p } of all) {
  const tag = `${file} → ${p.id ?? p.name ?? '<no id>'}`

  for (const f of REQUIRED_FIELDS) {
    if (p[f] === undefined || p[f] === null || p[f] === '') {
      errors.push(`${tag}: missing required field "${f}"`)
    }
  }
  if (p.id) {
    if (seenIds.has(p.id)) errors.push(`${tag}: duplicate id (first seen in ${seenIds.get(p.id)})`)
    else seenIds.set(p.id, file)
    if (!/^[a-z0-9-]+$/.test(p.id)) errors.push(`${tag}: id is not kebab-case`)
  }
  if (p.parentType && !PARENT_TYPES.has(p.parentType)) {
    errors.push(`${tag}: unknown parentType "${p.parentType}"`)
  }
  if (p.priceRange && !PRICE_RANGES.has(p.priceRange)) {
    errors.push(`${tag}: unknown priceRange "${p.priceRange}"`)
  }
  if (p.gender && !GENDERS.has(p.gender)) {
    errors.push(`${tag}: unknown gender "${p.gender}"`)
  }
  if (p.colorHex && !HEX_RE.test(p.colorHex)) {
    errors.push(`${tag}: colorHex "${p.colorHex}" is not #RRGGBB`)
  }
  if (Array.isArray(p.seasons)) {
    for (const s of p.seasons) {
      if (!SEASONS.has(s)) errors.push(`${tag}: unknown season "${s}"`)
    }
    if (p.seasons.length === 0) errors.push(`${tag}: seasons is empty`)
  }
  if (p.styleWeights && typeof p.styleWeights === 'object') {
    const keys = Object.keys(p.styleWeights)
    if (keys.length === 0) errors.push(`${tag}: styleWeights is empty`)
    for (const k of keys) {
      if (!STYLE_IDS.has(k)) errors.push(`${tag}: styleWeights key "${k}" is not one of the ${STYLE_IDS.size} aesthetics`)
      const v = p.styleWeights[k]
      if (typeof v !== 'number' || v < 1 || v > 5) errors.push(`${tag}: styleWeights.${k} = ${v} (expected number 1–5)`)
    }
  }
  if (p.shopUrl && !/^https:\/\//.test(p.shopUrl)) {
    errors.push(`${tag}: shopUrl is not https`)
  }

  // Warnings — suspicious but not fatal
  if (p.brand && !BRAND_NAMES.has(p.brand)) {
    warnings.push(`${tag}: brand "${p.brand}" not found in BRAND_NAME_TO_ID (brand page + affinity scoring won't link it)`)
  }
  if (!p.shopFallbackUrl) warnings.push(`${tag}: missing shopFallbackUrl`)
  if (!p.outfitCompanions || p.outfitCompanions.length === 0) {
    warnings.push(`${tag}: no outfitCompanions`)
  }
  if (p.gradient && !/^linear-gradient\(/.test(p.gradient)) {
    warnings.push(`${tag}: gradient doesn't look like a linear-gradient()`)
  }
}

// Second pass: outfitCompanions should reference real product types.
// Aggregated (not per-product) — there are thousands of aspirational refs.
const unknownCompanions = new Map()
for (const { p } of all) {
  if (!Array.isArray(p.outfitCompanions)) continue
  for (const c of p.outfitCompanions) {
    if (!allTypes.has(c)) unknownCompanions.set(c, (unknownCompanions.get(c) ?? 0) + 1)
  }
}
if (unknownCompanions.size) {
  const top = [...unknownCompanions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
  warnings.push(
    `outfitCompanions reference ${unknownCompanions.size} names that match no product type ` +
    `(top: ${top.map(([k, v]) => `${k}×${v}`).join(', ')})`
  )
}

const total = all.length
console.log(`Linted ${total} products across ${Object.keys(FILES).length} files.`)
if (warnings.length) {
  console.log(`\n⚠ ${warnings.length} warning(s):`)
  for (const w of warnings.slice(0, 200)) console.log(`  ${w}`)
  if (warnings.length > 200) console.log(`  …and ${warnings.length - 200} more`)
}
if (errors.length) {
  console.error(`\n✖ ${errors.length} error(s):`)
  for (const e of errors.slice(0, 200)) console.error(`  ${e}`)
  if (errors.length > 200) console.error(`  …and ${errors.length - 200} more`)
  process.exit(1)
}
console.log('\n✔ Catalog is valid.')
