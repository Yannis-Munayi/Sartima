import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import { logError } from './logger'
import { createBoundedCache } from './cache'

const cache    = createBoundedCache()
const imagesFn = httpsCallable(functions, 'searchImages')

export async function fetchPhotos(query, count = 1) {
  const cacheKey = `pexels:${query}:${count}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  try {
    const { data } = await imagesFn({ query, count, source: 'pexels' })
    const urls = data.urls ?? []
    cache.set(cacheKey, urls)
    return urls
  } catch (err) {
    logError('pexels', 'fetchPhotos failed', { query, count, error: err?.message })
    return []
  }
}

export async function fetchPhotosWithFallback(queries, count = 1) {
  for (const query of queries) {
    const urls = await fetchPhotos(query, count)
    if (urls.length > 0) return urls
  }
  return []
}
