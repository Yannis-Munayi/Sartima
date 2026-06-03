import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import { logError } from './logger'
import { createBoundedCache } from './cache'

const cache    = createBoundedCache()
const imagesFn = httpsCallable(functions, 'searchImages')

export async function fetchPhotos(query, count = 3) {
  const cacheKey = `unsplash:${query}:${count}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  try {
    const { data } = await imagesFn({ query, count, source: 'unsplash' })
    const urls = data.urls ?? []
    cache.set(cacheKey, urls)
    return urls
  } catch (err) {
    logError('unsplash', 'fetchPhotos failed', { query, count, error: err?.message })
    return []
  }
}
