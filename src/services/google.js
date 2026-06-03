import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import { logError, logWarn } from './logger'
import { createBoundedCache } from './cache'

const cache    = createBoundedCache()
let disabled   = false  // circuit breaker: flips true on quota/auth failure
const imagesFn = httpsCallable(functions, 'searchImages')

export async function fetchPhotos(query, count = 3) {
  if (disabled) return []

  const cacheKey = `google:${query}:${count}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  try {
    const { data } = await imagesFn({ query, count, source: 'google' })
    if (data.quotaExceeded) {
      logWarn('google', 'quota exceeded — disabling for session', { query })
      disabled = true
      return []
    }
    const urls = data.urls ?? []
    cache.set(cacheKey, urls)
    return urls
  } catch (err) {
    logError('google', 'fetchPhotos failed', { query, count, error: err?.message })
    return []
  }
}
