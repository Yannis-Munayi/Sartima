import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import { logError } from './logger'
import { createBoundedCache } from './cache'

// Stock photography: Unsplash first, Pexels fallback. The provider chain runs
// inside the searchImages Function (`source: 'stock'`) so a fallback doesn't
// cost a second call against its per-user rate limit.
const cache    = createBoundedCache()
const pending  = new Map()   // cacheKey → in-flight promise, so duplicate queries share one call
const imagesFn = httpsCallable(functions, 'searchImages')

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

  const request = searchStock(query, count)
    .then((urls) => {
      cache.set(cacheKey, urls)
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
