// Image backfill — resolves real product photo URLs for catalog entries that
// only have a gradient, using Google Custom Search (same keys the searchImages
// Firebase Function uses, read from functions/.env).
//
// Usage:
//   node scripts/backfill-images.js --brand "Polo Ralph Lauren" [--limit 50]
//   node scripts/backfill-images.js --limit 20                # any brand
//   node scripts/backfill-images.js --apply                   # write found URLs into product files
//
// Fetch results accumulate in scripts/output/images.json (id → url); --apply
// injects them as `image:` fields. Google CSE free tier = 100 queries/day,
// so run in batches. Always run npm run lint:catalog after --apply.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { PRODUCTS } from './lib/catalog.js'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const brandArg = args.includes('--brand') ? args[args.indexOf('--brand') + 1] : null
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : 50

const MAP_PATH = 'scripts/output/images.json'
const map = existsSync(MAP_PATH) ? JSON.parse(readFileSync(MAP_PATH, 'utf8')) : {}

const FILES = [
  'core', 'footwear-specialists', 'footwear-wide', 'tops', 'bottoms',
  'knitwear', 'outerwear', 'accessories', 'activewear',
]

if (APPLY) {
  let applied = 0
  let skipped = 0
  for (const f of FILES) {
    const path = `src/data/products/${f}.js`
    let src = readFileSync(path, 'utf8')
    let changed = false
    for (const [id, url] of Object.entries(map)) {
      // Only touch single-line entries that don't already have an image field
      const re = new RegExp(`^(\\s*\\{ id: '${id}',(?:(?!image:).)*?)gradient:`, 'm')
      const before = src
      src = src.replace(re, `$1image:'${url}', gradient:`)
      if (src !== before) { applied++; changed = true }
    }
    if (changed) writeFileSync(path, src)
  }
  skipped = Object.keys(map).length - applied
  console.log(`Applied ${applied} image URLs (${skipped} not matched — already applied, multi-line entries, or unknown ids).`)
  console.log('Run: npm run lint:catalog && npm run build')
  process.exit(0)
}

// ---- fetch mode ----
const env = existsSync('functions/.env') ? readFileSync('functions/.env', 'utf8') : ''
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || env.match(/^GOOGLE_API_KEY=(.+)$/m)?.[1]?.trim()
const GOOGLE_CX = process.env.GOOGLE_CX || env.match(/^GOOGLE_CX=(.+)$/m)?.[1]?.trim()
if (!GOOGLE_API_KEY || !GOOGLE_CX) {
  console.error('GOOGLE_API_KEY / GOOGLE_CX not found (env or functions/.env).')
  process.exit(1)
}

let candidates = PRODUCTS.filter((p) => !p.image && !map[p.id] && p.googleQuery)
if (brandArg) candidates = candidates.filter((p) => p.brand === brandArg)
candidates = candidates.slice(0, limit)

console.log(`Fetching images for ${candidates.length} products${brandArg ? ` (${brandArg})` : ''}…`)

let found = 0
for (const p of candidates) {
  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('key', GOOGLE_API_KEY)
  url.searchParams.set('cx', GOOGLE_CX)
  url.searchParams.set('q', p.googleQuery)
  url.searchParams.set('searchType', 'image')
  url.searchParams.set('num', '1')
  url.searchParams.set('imgSize', 'large')
  try {
    const res = await fetch(url)
    if (res.status === 429 || res.status === 403) {
      const err = await res.json().catch(() => null)
      console.error(`Stopping (${res.status}): ${err?.error?.message ?? 'quota or key restriction'}`)
      break
    }
    const data = await res.json()
    const link = data.items?.[0]?.link
    if (link) {
      map[p.id] = link
      found++
      console.log(`  ${p.id} → ${link.slice(0, 80)}`)
    } else {
      console.log(`  ${p.id} → no result`)
    }
  } catch (e) {
    console.error(`  ${p.id} → error: ${e.message}`)
  }
  await new Promise((r) => setTimeout(r, 150))
}

mkdirSync('scripts/output', { recursive: true })
writeFileSync(MAP_PATH, JSON.stringify(map, null, 2))
console.log(`\nFound ${found} new images. Map now has ${Object.keys(map).length} entries → ${MAP_PATH}`)
console.log('Review the URLs, then run: node scripts/backfill-images.js --apply')
