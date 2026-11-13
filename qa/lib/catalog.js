// Reads the product catalog straight from src/data/products/*.js so tests can
// check what the app shows (a card's name → its brand, garment type, colour,
// price tier) without importing app code. Most files put each product on one
// line, but core.js spreads them over several, so products are split out of
// the whole file text at each `{ id: '…'` rather than line by line.

import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './env.js'

const FIELDS = ['id', 'name', 'brand', 'type', 'parentType', 'color', 'priceRange', 'gender', 'shopUrl']

function field(line, key) {
  const m = line.match(new RegExp(`\\b${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`))
  return m ? m[1].replace(/\\'/g, "'") : undefined
}

let cache = null

export function catalog() {
  if (cache) return cache
  const dir = path.join(ROOT, 'src/data/products')
  const products = []
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const chunks = fs.readFileSync(path.join(dir, file), 'utf8').split(/\{\s*(?=id:\s*')/).slice(1)
    for (const chunk of chunks) {
      const p = {}
      for (const key of FIELDS) p[key] = field(chunk, key)
      if (p.id && p.name) products.push(p)
    }
  }
  const byName = new Map()
  for (const p of products) {
    if (!byName.has(p.name)) byName.set(p.name, [])
    byName.get(p.name).push(p)
  }
  cache = { products, byName, byId: new Map(products.map((p) => [p.id, p])) }
  return cache
}

/** Every catalog product carrying this display name (names can repeat across brands). */
export function productsNamed(name) {
  return catalog().byName.get(name.trim()) ?? []
}

/** A few real products of one parentType, shaped like the app's liked/wishlist entries. */
export function sampleProducts(parentType, count, offset = 0) {
  return catalog().products
    .filter((p) => p.parentType === parentType && p.shopUrl)
    .slice(offset, offset + count)
    .map((p) => ({
      id: p.id, type: 'product', name: p.name, brand: p.brand,
      itemType: p.type, parentType: p.parentType, color: p.color,
      priceRange: p.priceRange, shopUrl: p.shopUrl, styleWeights: {}, addedAt: Date.now(),
    }))
}
