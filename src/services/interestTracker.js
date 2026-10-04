import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { logError } from './logger'

const SERVICE = 'interestTracker'

// Debounce map — one pending flush per user UID
const pendingFlush = {}

function getInterestsRef(uid) {
  return doc(db, 'users', uid, 'prefs', 'interests')
}

const MAX_KEY_LENGTH = 100

// Affinity keys can originate from free text (closet uploads, AI-extracted
// garment fields), but they become Firestore field names. Firestore rejects
// names matching __.*__ — one bad key would fail the whole flush forever —
// and '__proto__' is silently swallowed by JS object assignment. Normalise
// rather than drop so odd-but-honest names still count.
function sanitizeKey(key) {
  if (typeof key !== 'string') return null
  const safe = key.trim().replace(/^_+|_+$/g, '').slice(0, MAX_KEY_LENGTH)
  return safe.length > 0 ? safe : null
}

// Merge a delta object into a parent affinities map (numeric accumulation)
function mergeAffinities(base = {}, delta = {}) {
  const result = { ...base }
  for (const [key, val] of Object.entries(delta)) {
    const safe = sanitizeKey(key)
    if (!safe || !Number.isFinite(val)) continue
    result[safe] = (Object.hasOwn(result, safe) ? result[safe] : 0) + val
  }
  return result
}

// A taste-model failure must not cost the legacy tallies the rest of the app
// reads, so on error the stored profile is kept and the signals dropped.
// Rebuilt from the stored copy on every call, so a transaction retry never
// applies the same signals twice.
function nextTaste(taste, current, signals, uid) {
  if (!taste) return current.taste
  try {
    return taste.applySignals(taste.loadTasteProfile(current), signals)
  } catch (err) {
    logError(SERVICE, 'Failed to apply taste signals', { error: err, uid })
    return current.taste
  }
}

// Core write — reads current doc, applies delta, writes back. Runs in a
// transaction so concurrent flushes (second tab, another device) compose
// instead of last-writer-wins clobbering the whole document. The taste
// profile is rebuilt by replaying the queued signals onto the stored one —
// it can't be merged as a delta because it decays and compacts itself.
async function flushDelta(uid, delta) {
  try {
    const ref = getInterestsRef(uid)
    // Dynamic import keeps the catalog-heavy taste model out of eager bundles
    const taste = delta.signals.length > 0
      ? await import('./tasteProfile').catch((error) => {
        logError(SERVICE, 'Failed to load taste model', { error, uid })
        return null
      })
      : null
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref)
      const current = snap.exists() ? snap.data() : {}

      tx.set(ref, {
        taste:                nextTaste(taste, current, delta.signals, uid),
        brandAffinities:     mergeAffinities(current.brandAffinities,      delta.brandAffinities),
        typeAffinities:       mergeAffinities(current.typeAffinities,       delta.typeAffinities),
        parentTypeAffinities: mergeAffinities(current.parentTypeAffinities, delta.parentTypeAffinities),
        styleAffinities:      mergeAffinities(current.styleAffinities,      delta.styleAffinities),
        colorAffinities:      mergeAffinities(current.colorAffinities,      delta.colorAffinities),
        brandVisits:          mergeAffinities(current.brandVisits,          delta.brandVisits),
        aestheticVisits:      mergeAffinities(current.aestheticVisits,      delta.aestheticVisits),
        recentLikes:      [
          ...(delta.recentLikes ?? []),
          ...(current.recentLikes ?? []),
        ].slice(0, 20),
        updatedAt: serverTimestamp(),
      })
    })
  } catch (err) {
    logError(SERVICE, 'Failed to flush interest delta', { error: err, uid })
  }
}

// Pending accumulators per user — batched before each debounced write
const pendingDelta = {}

function initDelta() {
  return {
    brandAffinities:      {},
    typeAffinities:       {},
    parentTypeAffinities: {},
    styleAffinities:      {},
    colorAffinities:      {},
    brandVisits:          {},
    aestheticVisits:      {},
    recentLikes:          [],
    // Raw signals for the taste model (see tasteProfile.js), replayed in order
    signals:              [],
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

  if (patch.brandAffinities)      d.brandAffinities      = mergeAffinities(d.brandAffinities,      patch.brandAffinities)
  if (patch.typeAffinities)       d.typeAffinities       = mergeAffinities(d.typeAffinities,       patch.typeAffinities)
  if (patch.parentTypeAffinities) d.parentTypeAffinities = mergeAffinities(d.parentTypeAffinities, patch.parentTypeAffinities)
  if (patch.styleAffinities)      d.styleAffinities      = mergeAffinities(d.styleAffinities,      patch.styleAffinities)
  if (patch.colorAffinities)      d.colorAffinities      = mergeAffinities(d.colorAffinities,      patch.colorAffinities)
  if (patch.brandVisits)          d.brandVisits          = mergeAffinities(d.brandVisits,          patch.brandVisits)
  if (patch.aestheticVisits)      d.aestheticVisits      = mergeAffinities(d.aestheticVisits,      patch.aestheticVisits)
  if (patch.recentLikes)          d.recentLikes          = [...patch.recentLikes, ...d.recentLikes].slice(0, 20)
  if (patch.signal)               d.signals.push(patch.signal)

  // Debounce: reset 2-second window on every new signal
  clearTimeout(pendingFlush[uid])
  pendingFlush[uid] = setTimeout(() => scheduledFlush(uid), 2000)
}

// Liked/wishlist/closet entries reuse `type` as an entry-kind flag rather
// than a garment type — never let those values into the type tally.
const ENTRY_KIND_FLAGS = new Set(['product', 'item', 'photo', 'uploaded'])

// Per-signal strength. `style` scales the aesthetic-tally points, `meta`
// scales brand/type/color. Likes and high-intent actions (save, shop click,
// try-on) award full aesthetic points; a passing product view awards a
// fraction so browsing can't outweigh deliberate actions.
const PRODUCT_SIGNALS = {
  like:      { style: 1,    meta: 1,    recentLike: true },
  save:      { style: 1,    meta: 0.5 },
  closetAdd: { style: 1,    meta: 0.5 },
  shop:      { style: 1,    meta: 0.5 },
  tryOn:     { style: 1,    meta: 0.5 },
  view:      { style: 0.25, meta: 0.25 },
}

// Product signals only the taste model learns from — the legacy tallies
// never counted skips or removals, and their readers expect that
const TASTE_ONLY_SIGNALS = new Set(['skip', 'unlike', 'unsave'])

// The taste-model copy of a signal: product signals keep only the catalog
// id (plus feed slot / view dwell when present); the rest pass through.
function tasteSignal(signalType, ts, payload, productId) {
  return {
    type:        signalType,
    ts,
    productId,
    slot:        payload.slot,
    dwellMs:     payload.dwellMs,
    aestheticId: payload.aestheticId,
    brandName:   payload.brandName,
    styleScores: payload.styleScores,
  }
}

// Some surfaces persist stripped product entries without styleWeights (e.g.
// Shop Scout groups). Recover the full catalog product by id when possible.
// Dynamic import keeps the heavy catalog chunk out of eager context bundles.
function resolveProduct(product) {
  if (Object.keys(product.styleWeights ?? {}).length > 0 || !product.id) {
    return Promise.resolve(product)
  }
  return import('../data/products')
    .then((m) => m.PRODUCTS_BY_ID[product.id] ?? product)
    .catch(() => product)
}

// Build a queueDelta patch from a product-ish object. Entries come from many
// surfaces (catalog products, liked/wishlist entries, closet items) with
// varying shapes, so every field is optional.
function productDelta(product, strength) {
  const patch = {}
  const styleAffinities = {}
  for (const [style, w] of Object.entries(product.styleWeights ?? {})) {
    styleAffinities[style] = w * strength.style
  }
  if (Object.keys(styleAffinities).length > 0) patch.styleAffinities = styleAffinities

  const rawType     = product.itemType ?? product.type
  const garmentType = rawType && !ENTRY_KIND_FLAGS.has(rawType) ? rawType : null
  if (product.brand)      patch.brandAffinities      = { [product.brand]: 2 * strength.meta }
  if (garmentType)        patch.typeAffinities       = { [garmentType]: 3 * strength.meta }
  if (product.parentType) patch.parentTypeAffinities = { [product.parentType]: strength.meta }
  if (product.color)      patch.colorAffinities      = { [product.color]: strength.meta }
  return patch
}

/**
 * Record a user interest signal.
 *
 * signalType:
 *   'like'          — user liked a product (discovery swipe or heart anywhere)
 *   'save'          — user saved a product to the wishlist
 *   'closetAdd'     — user added a piece to their closet / wardrobe
 *   'skip'          — user skipped a product in the discovery feed (taste model only)
 *   'unlike' / 'unsave' — user removed a product from liked / wishlist (taste model only)
 *   'shop'          — user clicked out to shop for a product
 *   'tryOn'         — user virtually tried a product on
 *   'view'          — user opened a product's detail sheet
 *   'brandVisit'    — user opened a brand page
 *   'aestheticVisit'— user opened an aesthetic page (also +1 to that aesthetic's tally)
 *   'aestheticPin'  — user pinned an aesthetic (+5 to that aesthetic's tally)
 *   'brandFavorite' — user favorited a brand by name at onboarding (+5 brand affinity,
 *                     same `brandAffinities` map the discovery feed scores against —
 *                     distinct from 'brandVisit', which only tallies brand-page visits)
 *   'quizComplete'  — quiz finished; bulk style affinity write
 *
 * payload for product signals:  { product: { id, brand, type|itemType, color, parentType, styleWeights },
 *                                  slot? (discovery feed slot), dwellMs? (view) }
 * payload for 'brandVisit':     { brandId }
 * payload for 'brandFavorite':  { brandName }
 * payload for 'aestheticVisit' / 'aestheticPin': { aestheticId }
 * payload for 'quizComplete':   { styleScores: { [aestheticId]: number } }
 */
export function recordSignal(user, signalType, payload) {
  if (!user?.uid) return

  const uid = user.uid
  // Stamped now, not at flush, so the taste model replays signals in order
  const ts  = Date.now()

  if (TASTE_ONLY_SIGNALS.has(signalType)) {
    const id = payload.product?.id
    if (id) queueDelta(uid, { signal: tasteSignal(signalType, ts, payload, id) })
    return
  }

  const strength = PRODUCT_SIGNALS[signalType]
  if (strength) {
    const { product } = payload
    if (!product) return
    resolveProduct(product).then((resolved) => {
      const patch = productDelta(resolved, strength)
      if (strength.recentLike && resolved.id) patch.recentLikes = [resolved.id]
      if (resolved.id) patch.signal = tasteSignal(signalType, ts, payload, resolved.id)
      if (Object.keys(patch).length === 0) return
      queueDelta(uid, patch)
    })
    return
  }

  switch (signalType) {
    case 'brandVisit': {
      const { brandId } = payload
      if (!brandId) return
      queueDelta(uid, { brandVisits: { [brandId]: 1 } })
      break
    }
    case 'aestheticVisit': {
      const { aestheticId } = payload
      if (!aestheticId) return
      queueDelta(uid, {
        aestheticVisits: { [aestheticId]: 1 },
        styleAffinities: { [aestheticId]: 1 },
      })
      break
    }
    case 'aestheticPin': {
      const { aestheticId } = payload
      if (!aestheticId) return
      queueDelta(uid, {
        styleAffinities: { [aestheticId]: 5 },
        signal:          tasteSignal(signalType, ts, payload),
      })
      break
    }
    case 'brandFavorite': {
      const { brandName } = payload
      if (!brandName) return
      queueDelta(uid, {
        brandAffinities: { [brandName]: 5 },
        signal:          tasteSignal(signalType, ts, payload),
      })
      break
    }
    case 'quizComplete': {
      const { styleScores } = payload
      if (!styleScores) return
      queueDelta(uid, {
        styleAffinities: styleScores,
        signal:          tasteSignal(signalType, ts, payload),
      })
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
