#!/usr/bin/env node
// Maintenance script: checks every shopUrl in products.js for broken links.
// Run with:  node scripts/checkShopLinks.js
// Logs IDs whose shopUrl returns a 4xx/5xx status or fails to connect.

import { readFileSync } from 'fs'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const productsPath = resolve(__dirname, '../src/data/products.js')

// Dynamic import with file:// URL for ESM compatibility
const { PRODUCTS } = await import(pathToFileURL(productsPath).href)

const TIMEOUT_MS   = 8000
const CONCURRENCY  = 5

async function checkUrl(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SartimaLinkChecker/1.0)' },
    })
    clearTimeout(timer)
    return { ok: res.ok, status: res.status }
  } catch (err) {
    clearTimeout(timer)
    return { ok: false, status: err.name === 'AbortError' ? 'TIMEOUT' : 'ERROR' }
  }
}

async function runInBatches(items, fn, concurrency) {
  const results = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults)
    process.stdout.write(`\rChecked ${Math.min(i + concurrency, items.length)}/${items.length}...`)
  }
  console.log()
  return results
}

console.log(`\nChecking ${PRODUCTS.length} shop URLs...\n`)

const checks = await runInBatches(PRODUCTS, async (product) => {
  const result = await checkUrl(product.shopUrl)
  return { id: product.id, brand: product.brand, name: product.name, url: product.shopUrl, ...result }
}, CONCURRENCY)

const broken = checks.filter((c) => !c.ok)
const working = checks.filter((c) => c.ok)

console.log(`\n✅ Working: ${working.length}`)
console.log(`❌ Broken:  ${broken.length}\n`)

if (broken.length > 0) {
  console.log('Broken links to fix in src/data/products.js:\n')
  for (const item of broken) {
    console.log(`  [${item.status}] ${item.id}`)
    console.log(`         ${item.brand} — ${item.name}`)
    console.log(`         ${item.url}\n`)
  }
  process.exit(1)
} else {
  console.log('All links are working!')
}
