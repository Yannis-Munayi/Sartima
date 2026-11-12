import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import { logError, logWarn } from './logger'
import { createBoundedCache } from './cache'

// Stock photography: Unsplash first, Pexels fallback. The provider chain runs
// inside the searchImages Function (`source: 'stock'`) so a fallback doesn't
// cost a second call against its per-user rate limit.
const cache    = createBoundedCache()
const pending  = new Map()   // cacheKey → in-flight promise, so duplicate queries share one call
const imagesFn = httpsCallable(functions, 'searchImages')

// Persistent layer: photo URLs survive reloads and app relaunches. Without it,
// every launch of the Android app (a fresh page) re-asked the Function for every
// card's photo — slow, and enough repeat calls drain the free Unsplash/Pexels
// hourly quotas, after which cards stay on their gradient. The image bytes are
// already cached by the service worker (CacheFirst, 7 days), so a cached URL
// renders without touching the network.
const STORE_KEY   = 'sartima_photo_urls_v1'
const STORE_TTL   = 7 * 24 * 60 * 60_000
const STORE_MAX   = 600
let store = null          // cacheKey → { urls, at }
let saveTimer = null

function loadStore() {
  if (store) return store
  store = {}
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}')
    const now = Date.now()
    for (const [k, v] of Object.entries(raw)) {
      if (v && Array.isArray(v.urls) && now - v.at < STORE_TTL) store[k] = v
    }
  } catch { /* storage blocked or corrupt — start empty */ }
  return store
}

function saveStoreSoon() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    try {
      const entries = Object.entries(store)
      if (entries.length > STORE_MAX) {
        entries.sort((a, b) => b[1].at - a[1].at)
        store = Object.fromEntries(entries.slice(0, STORE_MAX))
      }
      localStorage.setItem(STORE_KEY, JSON.stringify(store))
    } catch (err) {
      logWarn('stockPhotos', 'could not persist photo cache', { error: err?.message })
    }
  }, 1000)
}

function readStored(cacheKey) {
  const hit = loadStore()[cacheKey]
  return hit && Date.now() - hit.at < STORE_TTL ? hit.urls : null
}

function writeStored(cacheKey, urls) {
  loadStore()[cacheKey] = { urls, at: Date.now() }
  saveStoreSoon()
}

// A grid of cards mounting at once would otherwise fire dozens of calls in
// the same tick; cap concurrency so bursts stay inside the server's budget.
const MAX_IN_FLIGHT = 4
let inFlight = 0
const waiting = []

function acquireSlot() {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight++
    return Promise.resolve()
  }
  return new Promise((resolve) => waiting.push(resolve))
}

function releaseSlot() {
  const next = waiting.shift()
  if (next) next()   // hand the slot straight to the next caller
  else inFlight--
}

// When the server says slow down, wait and retry the same query rather than
// returning [] — otherwise fetchPhotosWithFallback moves straight on to its
// next query and burns more calls that get rejected too.
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000]

async function searchStock(query, count) {
  for (let attempt = 0; ; attempt++) {
    await acquireSlot()
    try {
      const { data } = await imagesFn({ query, count, source: 'stock' })
      return data.urls ?? []
    } catch (err) {
      const throttled = String(err?.code ?? '').includes('resource-exhausted')
      if (!throttled || attempt >= RETRY_DELAYS_MS.length) throw err
    } finally {
      releaseSlot()
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
  }
}

export async function fetchPhotos(query, count = 1) {
  const cacheKey = `stock:${query}:${count}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)
  if (pending.has(cacheKey)) return pending.get(cacheKey)
  const stored = readStored(cacheKey)
  if (stored) {
    cache.set(cacheKey, stored)
    return stored
  }

  const request = searchStock(query, count)
    .then((urls) => {
      cache.set(cacheKey, urls)
      // Only persist hits: an empty result is usually a spent quota, not a
      // query with no photos, so it should be retried on the next launch.
      if (urls.length > 0) writeStored(cacheKey, urls)
      return urls
    })
    .catch((err) => {
      logError('stockPhotos', 'fetchPhotos failed', { query, count, error: err?.message })
      return []
    })
    .finally(() => pending.delete(cacheKey))
  pending.set(cacheKey, request)
  return request
}

// Tries each query in order, returns the first that has results.
export async function fetchPhotosWithFallback(queries, count = 1) {
  for (const query of queries) {
    const urls = await fetchPhotos(query, count)
    if (urls.length > 0) return urls
  }
  return []
}
