import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { logError } from './logger'

const SERVICE = 'interestTracker'

// Debounce map — one pending flush per user UID
const pendingFlush = {}

function getInterestsRef(uid) {
  return doc(db, 'users', uid, 'prefs', 'interests')
}

// Merge a delta object into a parent affinities map (numeric accumulation)
function mergeAffinities(base = {}, delta = {}) {
  const result = { ...base }
  for (const [key, val] of Object.entries(delta)) {
    result[key] = (result[key] ?? 0) + val
  }
  return result
}

// Core write — reads current doc, applies delta, writes back
async function flushDelta(uid, delta) {
  try {
    const ref  = getInterestsRef(uid)
    const snap = await getDoc(ref)
    const current = snap.exists() ? snap.data() : {}

    const updated = {
      brandAffinities:  mergeAffinities(current.brandAffinities,  delta.brandAffinities),
      typeAffinities:   mergeAffinities(current.typeAffinities,   delta.typeAffinities),
      styleAffinities:  mergeAffinities(current.styleAffinities,  delta.styleAffinities),
      colorAffinities:  mergeAffinities(current.colorAffinities,  delta.colorAffinities),
      brandVisits:      mergeAffinities(current.brandVisits,      delta.brandVisits),
      aestheticVisits:  mergeAffinities(current.aestheticVisits,  delta.aestheticVisits),
      recentLikes:      [
        ...(delta.recentLikes ?? []),
        ...(current.recentLikes ?? []),
      ].slice(0, 20),
      updatedAt: serverTimestamp(),
    }

    await setDoc(ref, updated, { merge: false })
  } catch (err) {
    logError(SERVICE, 'Failed to flush interest delta', { error: err, uid })
  }
}

// Pending accumulators per user — batched before each debounced write
const pendingDelta = {}

function initDelta() {
  return {
    brandAffinities: {},
    typeAffinities:  {},
    styleAffinities: {},
    colorAffinities: {},
    brandVisits:     {},
    aestheticVisits: {},
    recentLikes:     [],
  }
}

function scheduledFlush(uid) {
  const delta = pendingDelta[uid]
  delete pendingDelta[uid]
  delete pendingFlush[uid]
  if (delta) flushDelta(uid, delta)
}

function queueDelta(uid, patch) {
  if (!pendingDelta[uid]) pendingDelta[uid] = initDelta()
  const d = pendingDelta[uid]

  if (patch.brandAffinities) d.brandAffinities = mergeAffinities(d.brandAffinities, patch.brandAffinities)
  if (patch.typeAffinities)  d.typeAffinities  = mergeAffinities(d.typeAffinities,  patch.typeAffinities)
  if (patch.styleAffinities) d.styleAffinities = mergeAffinities(d.styleAffinities, patch.styleAffinities)
  if (patch.colorAffinities) d.colorAffinities = mergeAffinities(d.colorAffinities, patch.colorAffinities)
  if (patch.brandVisits)     d.brandVisits     = mergeAffinities(d.brandVisits,     patch.brandVisits)
  if (patch.aestheticVisits) d.aestheticVisits = mergeAffinities(d.aestheticVisits, patch.aestheticVisits)
  if (patch.recentLikes)     d.recentLikes     = [...patch.recentLikes, ...d.recentLikes].slice(0, 20)

  // Debounce: reset 2-second window on every new signal
  clearTimeout(pendingFlush[uid])
  pendingFlush[uid] = setTimeout(() => scheduledFlush(uid), 2000)
}

/**
 * Record a user interest signal.
 *
 * signalType:
 *   'like'          — user liked a product in the discovery feed or wishlist
 *   'brandVisit'    — user opened a brand page
 *   'aestheticVisit'— user opened an aesthetic page
 *   'quizComplete'  — quiz finished; bulk style affinity write
 *
 * payload for 'like':        { product: { brand, type, color, parentType, styleWeights } }
 * payload for 'brandVisit':  { brandId }
 * payload for 'aestheticVisit': { aestheticId }
 * payload for 'quizComplete':   { styleScores: { [aestheticId]: number } }
 */
export function recordSignal(user, signalType, payload) {
  if (!user?.uid) return

  const uid = user.uid

  switch (signalType) {
    case 'like': {
      const { product } = payload
      if (!product) return
      const styleAffinities = {}
      for (const [style, w] of Object.entries(product.styleWeights ?? {})) {
        styleAffinities[style] = w
      }
      queueDelta(uid, {
        brandAffinities:  { [product.brand]: 2 },
        typeAffinities:   { [product.type]: 3 },
        colorAffinities:  { [product.color]: 1 },
        styleAffinities,
        recentLikes: [product.id],
      })
      break
    }
    case 'brandVisit': {
      const { brandId } = payload
      if (!brandId) return
      queueDelta(uid, { brandVisits: { [brandId]: 1 } })
      break
    }
    case 'aestheticVisit': {
      const { aestheticId } = payload
      if (!aestheticId) return
      queueDelta(uid, { aestheticVisits: { [aestheticId]: 1 } })
      break
    }
    case 'quizComplete': {
      const { styleScores } = payload
      if (!styleScores) return
      queueDelta(uid, { styleAffinities: styleScores })
      break
    }
    default:
      break
  }
}

/**
 * Load the full persisted interest document for a user.
 * Returns null if the document doesn't exist yet.
 */
export async function loadInterests(uid) {
  if (!uid) return null
  try {
    const snap = await getDoc(getInterestsRef(uid))
    return snap.exists() ? snap.data() : null
  } catch (err) {
    logError(SERVICE, 'Failed to load interests', { error: err, uid })
    return null
  }
}
