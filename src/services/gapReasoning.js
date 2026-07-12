import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

const gapReasoningFn = httpsCallable(functions, 'anthropicGapReasoning')

function cacheKey(category, owned) {
  const day = new Date().toISOString().slice(0, 10)
  return `sartima_gap_reasoning_${day}_${category}_${owned}`
}

function getCached(key) {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function setCache(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

/**
 * Get a short, personalized reason to fill a wardrobe gap.
 * Cached per day+category+owned-count so the copy doesn't refetch on every
 * Home-screen mount, and only regenerates once the underlying deficit changes.
 */
export async function getGapReasoning({ category, owned, target, closetSummary, topStyles }) {
  const key    = cacheKey(category, owned)
  const cached = getCached(key)
  if (cached) return cached

  try {
    const { data } = await gapReasoningFn({ category, owned, target, closetSummary, topStyles })
    const reasoning = data.reasoning ?? ''
    setCache(key, reasoning)
    return reasoning
  } catch {
    return ''
  }
}
