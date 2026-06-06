import { httpsCallable } from 'firebase/functions'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { functions, db } from './firebase'

export const TRYON_CATEGORIES = ['tops', 'bottoms', 'outerwear', 'dresses']

const generateFn = httpsCallable(functions, 'generateTryOn', { timeout: 120000 })

const CACHE_DOC = 'tryOnCache'

// ── Cache helpers ──────────────────────────────────────────────────────────────

export async function getCachedTryOn(uid, itemId) {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'prefs', CACHE_DOC))
    if (!snap.exists()) return null
    return snap.data()[itemId] ?? null   // { url, generatedAt, avatarUrl }
  } catch {
    return null
  }
}

export async function saveTryOnResult(uid, itemId, url, avatarUpdatedAt) {
  const ref   = doc(db, 'users', uid, 'prefs', CACHE_DOC)
  const snap  = await getDoc(ref)
  const data  = snap.exists() ? snap.data() : {}
  await setDoc(ref, {
    ...data,
    [itemId]: { url, generatedAt: Date.now(), avatarUpdatedAt },
  })
}

// ── Generation ─────────────────────────────────────────────────────────────────

// Cache key for a set of items — order-independent (sorted before joining)
function itemsCacheKey(items) {
  return [...items].map((i) => i.id).sort().join(',')
}

/**
 * Returns the try-on result URL for the given items.
 * For multiple items the Cloud Function chains the predictions server-side.
 * Checks Firestore cache first; cache key is sorted item IDs + avatarUpdatedAt.
 *
 * @param {string}   uid
 * @param {object[]} items          — closet/liked items with { id, name, category, imageUrl, thumbnailUrl }
 * @param {string}   avatarUrl      — original avatar photo (not prettified — model prefers full photos)
 * @param {number}   avatarUpdatedAt — timestamp set when the avatar was last uploaded
 * @returns {Promise<string>}       — result image URL
 */
export async function generateTryOnResult(uid, items, avatarUrl, avatarUpdatedAt) {
  const cacheKey = itemsCacheKey(items)
  const cached   = await getCachedTryOn(uid, cacheKey)
  if (cached?.url && cached.avatarUpdatedAt === avatarUpdatedAt) {
    return cached.url
  }

  const garments = items.map((item) => ({
    garmentImageUrl: item.imageUrl ?? item.thumbnailUrl,
    garmentName:     item.name ?? 'clothing item',
    category:        item.category ?? 'tops',
  }))

  if (garments.some((g) => !g.garmentImageUrl)) throw new Error('One or more items have no image')

  const { data } = await generateFn({ personImageUrl: avatarUrl, garments })

  const outputUrl = data?.outputUrl
  if (!outputUrl) throw new Error('No output from try-on service')

  await saveTryOnResult(uid, cacheKey, outputUrl, avatarUpdatedAt)

  return outputUrl
}
