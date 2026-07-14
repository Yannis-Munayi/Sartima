// Brand catalog expansion — generates validated product entries for a brand
// using Claude with the existing catalog as few-shot examples.
//
// Usage:  node scripts/expand-brand.js "Brand Name" [target-total]
//
// Output goes to scripts/output/<brand-slug>.js for review — nothing is
// appended to the catalog automatically. Review the file, paste the entries
// into the right src/data/products/ files, then run: npm run lint:catalog
//
// Requires ANTHROPIC_API_KEY in the environment or functions/.env.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'

import { STYLES } from '../src/data/styles.js'
import { CATEGORIES } from '../src/data/categories.js'
import { PRODUCTS, PRODUCTS_BY_BRAND } from './lib/catalog.js'

const brand = process.argv[2]
const targetTotal = Number(process.argv[3] || 40)
if (!brand) {
  console.error('Usage: node scripts/expand-brand.js "Brand Name" [target-total]')
  process.exit(1)
}

// Load API key from functions/.env if not already set
if (!process.env.ANTHROPIC_API_KEY && existsSync('functions/.env')) {
  const m = readFileSync('functions/.env', 'utf8').match(/^ANTHROPIC_API_KEY=(.+)$/m)
  if (m) process.env.ANTHROPIC_API_KEY = m[1].trim()
}

const client = new Anthropic()

const existing = PRODUCTS_BY_BRAND[brand] ?? []
const needed = targetTotal - existing.length
if (needed <= 0) {
  console.log(`${brand} already has ${existing.length} products (target ${targetTotal}) — nothing to do.`)
  process.exit(0)
}

const STYLE_IDS = Object.keys(STYLES)
const PARENT_TYPES = CATEGORIES.map((c) => c.id)

// Few-shot: the brand's own entries if any, else well-formed entries from
// aesthetically-adjacent brands.
const fewShot = (existing.length ? existing : PRODUCTS.filter((p) => p.styleWeights))
  .slice(0, 8)
  .map((p) => JSON.stringify(p))
  .join('\n')

const productSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id', 'name', 'brand', 'type', 'parentType', 'color', 'colorHex',
    'priceRange', 'description', 'seasons', 'gender', 'styleWeights',
    'outfitCompanions', 'shopUrl', 'shopFallbackUrl', 'googleQuery',
    'gradient', 'emoji',
  ],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    brand: { type: 'string' },
    type: { type: 'string' },
    parentType: { type: 'string', enum: PARENT_TYPES },
    color: { type: 'string' },
    colorHex: { type: 'string' },
    priceRange: { type: 'string', enum: ['budget', 'mid', 'contemporary', 'premium', 'luxury'] },
    description: { type: 'string' },
    seasons: { type: 'array', items: { type: 'string', enum: ['spring', 'summer', 'fall', 'winter'] } },
    gender: { type: 'string', enum: ['men', 'women', 'unisex'] },
    styleWeights: {
      type: 'object',
      additionalProperties: false,
      // every aesthetic as an optional 1–5 weight — dynamic keys aren't
      // allowed under strict schemas, so enumerate all 51
      properties: Object.fromEntries(STYLE_IDS.map((s) => [s, { type: 'integer', enum: [1, 2, 3, 4, 5] }])),
    },
    outfitCompanions: { type: 'array', items: { type: 'string' } },
    shopUrl: { type: 'string' },
    shopFallbackUrl: { type: 'string' },
    googleQuery: { type: 'string' },
    gradient: { type: 'string' },
    emoji: { type: 'string' },
  },
}

const existingIds = new Set(PRODUCTS.map((p) => p.id))

console.log(`${brand}: ${existing.length} existing, generating ${needed} new products…`)

const stream = client.messages.stream({
  model: 'claude-opus-4-8',
  max_tokens: 64000,
  thinking: { type: 'adaptive' },
  system:
    'You write product catalog entries for Sartima, a fashion discovery app. ' +
    'Entries must match the exact schema and style of the examples: real, iconic products the brand actually sells; ' +
    'editorial one-line descriptions (no marketing fluff, explain why the piece matters culturally); ' +
    'styleWeights use ONLY these aesthetic ids: ' + STYLE_IDS.join(', ') + '. ' +
    'shopUrl is a search URL on the brand\'s own site; gradient echoes the product color; ids are unique kebab-case.',
  messages: [
    {
      role: 'user',
      content:
        `Here are example catalog entries:\n${fewShot}\n\n` +
        `Generate exactly ${needed} new products for the brand "${brand}". ` +
        `Spread them across the categories this brand is actually known for. ` +
        `Do not reuse any of these existing ids: ${existing.map((p) => p.id).join(', ') || '(none)'}.`,
    },
  ],
  output_config: {
    format: {
      type: 'json_schema',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['products'],
        properties: { products: { type: 'array', items: productSchema } },
      },
    },
  },
})

const message = await stream.finalMessage()
if (message.stop_reason === 'refusal') {
  console.error('Request was refused — try again or adjust the brand name.')
  process.exit(1)
}
const text = message.content.find((b) => b.type === 'text')?.text ?? ''
const { products } = JSON.parse(text)

// Local validation before writing (full check: npm run lint:catalog after pasting)
const problems = []
const seen = new Set()
for (const p of products) {
  if (existingIds.has(p.id) || seen.has(p.id)) problems.push(`duplicate id: ${p.id}`)
  seen.add(p.id)
  if (!/^[a-z0-9-]+$/.test(p.id)) problems.push(`${p.id}: not kebab-case`)
  if (!/^#[0-9A-Fa-f]{6}$/.test(p.colorHex)) problems.push(`${p.id}: bad colorHex ${p.colorHex}`)
  for (const k of Object.keys(p.styleWeights)) {
    if (!STYLE_IDS.includes(k)) problems.push(`${p.id}: invalid aesthetic "${k}"`)
  }
  if (Object.keys(p.styleWeights).length === 0) problems.push(`${p.id}: empty styleWeights`)
}

mkdirSync('scripts/output', { recursive: true })
const slug = brand.toLowerCase().replace(/[^a-z0-9]+/g, '-')
const outPath = `scripts/output/${slug}.js`
const body = products.map((p) => '  ' + JSON.stringify(p) + ',').join('\n')
writeFileSync(outPath, `// Generated ${new Date().toISOString().slice(0, 10)} — review before merging into src/data/products/\n// Brand: ${brand} (${products.length} entries)\n\nexport default [\n${body}\n]\n`)

console.log(`\nWrote ${products.length} entries to ${outPath}`)
console.log(`Categories: ${[...new Set(products.map((p) => p.parentType))].join(', ')}`)
if (problems.length) {
  console.error(`\n⚠ ${problems.length} validation problem(s) — fix before merging:`)
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
console.log('✔ Local validation passed. Review the file, merge into src/data/products/, then run: npm run lint:catalog')
