import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import nodemailer from 'nodemailer'
import { checkEmail } from './emailValidation.js'
import { generateJson } from './ai.js'

admin.initializeApp()

// ─── Email helper ─────────────────────────────────────────────────────────────

function getMailTransporter() {
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!pass) return null
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: 'ytmunayi@gmail.com', pass },
  })
}

async function sendEmail(subject, text) {
  const transporter = getMailTransporter()
  if (!transporter) return
  await transporter.sendMail({
    from: '"Sartima" <ytmunayi@gmail.com>',
    to: 'ytmunayi@gmail.com',
    subject,
    text,
  })
}

function requireAuth(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required')
}

// ─── Subscription / Usage ─────────────────────────────────────────────────────

const TIER_LIMITS = {
  free:  { visionUploads: 3,    tripPlans: 0,    tryOns: 0,    gapReasoning: 20  },
  pro:   { visionUploads: 30,   tripPlans: 3,    tryOns: 30,   gapReasoning: 200 },
  admin: { visionUploads: null, tripPlans: null, tryOns: null, gapReasoning: null }, // null = no limit
}

// request.auth.token is the decoded ID token — custom claims are already on it,
// no need for a separate Admin SDK getUser() round-trip.
function getUserTier(authToken) {
  if (authToken?.sartima_role === 'admin') return 'admin'
  return authToken?.sartima_tier === 'pro' ? 'pro' : 'free'
}

// Usage doc: users/{uid}/prefs/usage
// tryOns + visionUploads + tripPlans reset monthly via periodKey; tryOnCredits never resets
async function checkAndIncrementUsage(uid, field, limit) {
  const ref    = admin.firestore().doc(`users/${uid}/prefs/usage`)
  const period = new Date().toISOString().slice(0, 7)
  return admin.firestore().runTransaction(async (tx) => {
    const snap  = await tx.get(ref)
    const data  = snap.exists ? snap.data() : {}
    const isNew = data.periodKey !== period
    const count = isNew ? 0 : (data[field] ?? 0)
    if (limit !== null && count >= limit) throw new HttpsError('resource-exhausted', `limit_${field}`)
    tx.set(ref,
      isNew ? { periodKey: period, [field]: 1 } : { [field]: FieldValue.increment(1) },
      { merge: true })
    return count + 1
  })
}

// Give back a counter slot when the work it paid for failed upstream.
async function refundUsage(uid, field) {
  await admin.firestore().doc(`users/${uid}/prefs/usage`)
    .set({ [field]: FieldValue.increment(-1) }, { merge: true })
    .catch((err) => console.warn('refundUsage failed', field, err.message))
}

// ─── Email Validation (no auth — called pre-signup) ──────────────────────────

// Syntax, throwaway domains, a real mail server, and typo suggestions — see
// emailValidation.js. A DNS outage surfaces as 'unavailable' rather than
// "this email doesn't exist", so clients fail open instead of blocking a
// real address.
export const validateEmail = onCall({ timeoutSeconds: 10, cors: true, invoker: 'public' }, async (request) => {
  const { email } = request.data
  if (!email || typeof email !== 'string') throw new HttpsError('invalid-argument', 'email required')
  try {
    return await checkEmail(email)
  } catch (err) {
    console.warn('validateEmail: DNS lookup failed', err.code ?? err.message)
    throw new HttpsError('unavailable', 'Could not verify email right now')
  }
})

// ─── Vision Analysis ──────────────────────────────────────────────────────────

const VISION_CATEGORIES = ['tops', 'bottoms', 'outerwear', 'dresses', 'footwear', 'accessories']

const VISION_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name:        { type: 'string' },
          category:    { type: 'string', enum: VISION_CATEGORIES },
          color:       { type: 'string' },
          description: { type: 'string' },
          box_2d:      { type: 'array', items: { type: 'integer' } },
        },
        required: ['name', 'category', 'color', 'description', 'box_2d'],
      },
    },
  },
  required: ['items'],
}

// Models return [ymin, xmin, ymax, xmax] on a 0–1000 scale (Gemini's native
// box format); the client crops with { x, y, w, h } percentages. A box that
// makes no sense becomes null, and the client falls back to the full photo.
function boxToBbox(box) {
  if (!Array.isArray(box) || box.length !== 4 || box.some((n) => typeof n !== 'number')) return null
  const [y0, x0, y1, x1] = box.map((n) => Math.min(1000, Math.max(0, n)))
  const bbox = {
    x: Math.round(x0 / 10),
    y: Math.round(y0 / 10),
    w: Math.round((x1 - x0) / 10),
    h: Math.round((y1 - y0) / 10),
  }
  return bbox.w > 0 && bbox.h > 0 ? bbox : null
}

export const anthropicVision = onCall({ timeoutSeconds: 90, cors: true, invoker: 'public' }, async (request) => {
  requireAuth(request)
  const uid  = request.auth.uid
  const tier = getUserTier(request.auth.token)

  const { imageBase64, mimeType = 'image/jpeg' } = request.data
  if (!imageBase64) throw new HttpsError('invalid-argument', 'imageBase64 required')

  await checkAndIncrementUsage(uid, 'visionUploads', TIER_LIMITS[tier].visionUploads)

  let parsed
  try {
    parsed = await generateJson({
      image:     { base64: imageBase64, mimeType },
      maxTokens: 1024,
      schema:    VISION_SCHEMA,
      budgetMs:  80_000,
      prompt: `Analyze this outfit photo and identify every visible clothing item and accessory being worn.

Return a JSON object with this exact shape — no markdown, no explanation, just raw JSON:
{
  "items": [
    {
      "name": "short descriptive name (3-5 words max)",
      "category": "one of: tops | bottoms | outerwear | dresses | footwear | accessories",
      "color": "primary color (one word)",
      "description": "one sentence describing the piece",
      "box_2d": [ymin, xmin, ymax, xmax]
    }
  ]
}

box_2d is the bounding box of that specific item within the image, as integers [ymin, xmin, ymax, xmax] normalized to 0–1000 of the image height/width.

Rules:
- Include every visible item (shirt, pants, shoes, bag, hat, jewellery, etc.)
- Use lowercase for category
- If the full outfit is a dress or jumpsuit, list it as a single "dresses" item
- A pair of shoes is one item
- Maximum 10 items
- Every item MUST include a box_2d — estimate as accurately as possible`,
    })
  } catch (err) {
    await refundUsage(uid, 'visionUploads')
    throw err
  }

  const items = (Array.isArray(parsed.items) ? parsed.items : [])
    .slice(0, 10)
    .map(({ box_2d: box, ...item }) => ({ ...item, bbox: boxToBbox(box) }))
  return { items }
})

// ─── Outfit Generation ────────────────────────────────────────────────────────

export const anthropicOutfit = onCall({ timeoutSeconds: 60, cors: true, invoker: 'public' }, async (request) => {
  requireAuth(request)
  const uid  = request.auth.uid
  const tier = getUserTier(request.auth.token)
  if (tier === 'free') {
    const todayStr = new Date().toISOString().slice(0, 10)
    const ref      = admin.firestore().doc(`users/${uid}/prefs/usage`)
    await admin.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const data = snap.exists ? snap.data() : {}
      if (data.lastOutfitDate === todayStr) {
        throw new HttpsError('resource-exhausted', 'limit_outfitGenerations')
      }
      tx.set(ref, { lastOutfitDate: todayStr }, { merge: true })
    })
  }

  const { items, weather, occasion, dateStr, occupation } = request.data
  if (!items || items.length < 3) throw new HttpsError('invalid-argument', 'Need at least 3 items')

  const weatherLine    = weather ? `Weather: ${weather.description}, ${weather.temp}°C, condition: ${weather.condition}.` : ''
  const occupationLine = occupation ? `User occupation: ${occupation}.` : ''

  const prompt = `You are a personal stylist. Select 2–4 items from this wardrobe JSON to form a complete, cohesive outfit.

Wardrobe:
${JSON.stringify(items)}

Today: ${dateStr}. Occasion: ${occasion}. ${weatherLine} ${occupationLine}

Rules:
- Must include at least one top AND one bottom (or a dress that covers both)
- Add outerwear only if temp < 16°C or condition is Rain or Snow
- You may include one footwear and one accessory item if they are in the wardrobe
- Vary the selection; use the date as a seed for variety
- Prefer items whose occasions match "${occasion}"
- If the wardrobe genuinely cannot satisfy the top+bottom rule (e.g. no bottoms/dresses at all), pick the closest partial outfit you can and set "missingCategory" to the single category that's blocking a complete outfit (one of: "tops", "bottoms", "outerwear", "footwear", "accessories"). Otherwise set it to null.

Return ONLY valid JSON, no markdown:
{
  "selectedIds": ["id1", "id2"],
  "reasoning": "1-2 sentences why this outfit works for the occasion and weather.",
  "weatherNote": "Short suitability note or null",
  "missingCategory": "category name or null"
}`

  try {
    return await generateJson({ prompt, maxTokens: 512, budgetMs: 50_000 })
  } catch (err) {
    // Free tier gets one generation a day — a failed one shouldn't use it up
    if (tier === 'free') {
      await admin.firestore().doc(`users/${uid}/prefs/usage`)
        .set({ lastOutfitDate: FieldValue.delete() }, { merge: true })
        .catch(() => {})
    }
    throw err
  }
})

// ─── Gap Reasoning ────────────────────────────────────────────────────────────
// Cheap, personalized 1-2 sentence copy for the Home-screen "what to buy next"
// card. The deficit itself comes free client-side (useClosetGaps diffs the
// closet against capsuleBaseline) — this just adds a stylist's voice on top.

export const anthropicGapReasoning = onCall({ timeoutSeconds: 30, cors: true, invoker: 'public' }, async (request) => {
  requireAuth(request)
  const uid  = request.auth.uid
  const tier = getUserTier(request.auth.token)
  await checkAndIncrementUsage(uid, 'gapReasoning', TIER_LIMITS[tier].gapReasoning)

  const { category, owned, target, closetSummary, topStyles } = request.data
  if (!category) throw new HttpsError('invalid-argument', 'category is required')

  const styleLine = Array.isArray(topStyles) && topStyles.length
    ? `Their strongest aesthetics are: ${topStyles.join(', ')}.`
    : ''
  const summaryLine = Array.isArray(closetSummary) && closetSummary.length
    ? `Their closet currently has: ${closetSummary.join(', ')}.`
    : 'Their closet is mostly empty so far.'

  const prompt = `You are a personal stylist writing a short, encouraging nudge inside a wardrobe app.
This user owns ${owned} ${category} item(s) out of a healthy baseline of ${target} for a versatile capsule wardrobe.
${summaryLine} ${styleLine}

Write 1-2 short, warm sentences (under 30 words total) telling them why picking up a ${category} piece would round out their wardrobe. Be specific and personal, not generic. No markdown, no quotes around the output.

Return ONLY valid JSON, no markdown:
{
  "reasoning": "1-2 sentences"
}`

  let parsed
  try {
    parsed = await generateJson({ prompt, maxTokens: 200, budgetMs: 25_000 })
  } catch (err) {
    await refundUsage(uid, 'gapReasoning')
    throw err
  }
  return { reasoning: parsed.reasoning ?? '' }
})

// ─── Trip Planning ────────────────────────────────────────────────────────────

export const anthropicTrip = onCall({ timeoutSeconds: 120, cors: true, invoker: 'public' }, async (request) => {
  requireAuth(request)
  const uid  = request.auth.uid
  const tier = getUserTier(request.auth.token)
  await checkAndIncrementUsage(uid, 'tripPlans', TIER_LIMITS[tier].tripPlans)

  const { destination, nights, items, gender } = request.data
  if (!destination) throw new HttpsError('invalid-argument', 'destination required')
  if (!items || items.length < 3) throw new HttpsError('invalid-argument', 'Need at least 3 items')

  const prompt = `You are a personal travel stylist. Create a packing list and daily outfit plan for a ${nights}-night trip to ${destination}.

Available wardrobe:
${JSON.stringify(items)}

Gender preference: ${gender}

Rules:
- Choose items ONLY from the wardrobe above (use their IDs)
- Suggest 1 outfit per day (reference item IDs)
- Create a concise packing list (item IDs + names)
- Add 2-3 items to "also consider buying" if the wardrobe has gaps for this destination

Return ONLY valid JSON:
{
  "destination": "${destination}",
  "nights": ${nights},
  "packingList": [
    { "itemId": "id or null if suggested purchase", "name": "item name", "note": "why pack it", "fromCloset": true }
  ],
  "dailyOutfits": [
    { "day": 1, "label": "Day 1 - Arrival", "itemIds": ["id1", "id2"], "note": "styling tip" }
  ],
  "gapItems": ["description of items to consider buying if any"]
}`

  try {
    return await generateJson({ prompt, maxTokens: 1500, budgetMs: 110_000 })
  } catch (err) {
    await refundUsage(uid, 'tripPlans')
    throw err
  }
})

// ─── Weather Proxy ────────────────────────────────────────────────────────────

export const getWeather = onCall({ timeoutSeconds: 30, cors: true, invoker: 'public' }, async (request) => {
  requireAuth(request)
  const { lat, lon } = request.data
  if (lat == null || lon == null) throw new HttpsError('invalid-argument', 'lat and lon required')

  const apiKey = process.env.OPENWEATHER_KEY
  if (!apiKey) throw new HttpsError('failed-precondition', 'Weather service not configured')

  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`
  )
  if (!res.ok) throw new HttpsError('unavailable', 'Weather service unavailable')
  const json = await res.json()

  return {
    city:        json.name,
    temp:        Math.round(json.main.temp),
    feelsLike:   Math.round(json.main.feels_like),
    condition:   json.weather[0]?.main ?? 'Clear',
    description: json.weather[0]?.description ?? '',
    icon:        json.weather[0]?.icon ?? '01d',
    humidity:    json.main.humidity,
    windSpeed:   Math.round(json.wind?.speed ?? 0),
    fetchedAt:   Date.now(),
  }
})

// ─── Image Search Proxy ───────────────────────────────────────────────────────

// In-process token bucket per caller (uid, or IP for guests): a screen full
// of cards can burst up to SEARCH_IMAGES_BURST upstream searches at once, then
// refills steadily. The old fixed 2s gap rejected every parallel card fetch
// after the first. Resets on cold start — sufficient to stop scripted hammering.
const searchImagesBuckets = new Map()
const SEARCH_IMAGES_BURST = 60
const SEARCH_IMAGES_REFILL_PER_SEC = 1

function takeSearchToken(callerKey) {
  const now    = Date.now()
  const bucket = searchImagesBuckets.get(callerKey) ?? { tokens: SEARCH_IMAGES_BURST, at: now }
  bucket.tokens = Math.min(
    SEARCH_IMAGES_BURST,
    bucket.tokens + ((now - bucket.at) / 1000) * SEARCH_IMAGES_REFILL_PER_SEC,
  )
  bucket.at = now
  searchImagesBuckets.set(callerKey, bucket)
  if (bucket.tokens < 1) return false
  bucket.tokens -= 1
  return true
}

// Queries are deterministic (aesthetic / product names), so users mostly ask
// for the same ones. Repeats are served from memory without spending the
// caller's tokens or the app-wide Unsplash/Pexels hourly quota. Only non-empty
// results are cached so a transient provider failure isn't pinned for hours.
const searchImagesCache = new Map()
const SEARCH_IMAGES_CACHE_MAX = 2_000
const SEARCH_IMAGES_CACHE_TTL_MS = 6 * 60 * 60_000

// Unsplash answers 403/429 once the app's hourly quota is spent; skip it until
// the window rolls over so `stock` searches go straight to Pexels.
let unsplashCooldownUntil = 0
const UNSPLASH_COOLDOWN_MS = 15 * 60_000

async function searchUnsplash(query, count) {
  const key = process.env.UNSPLASH_KEY
  if (!key || Date.now() < unsplashCooldownUntil) return []
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=portrait`,
    { headers: { Authorization: `Client-ID ${key}` } }
  )
  if (res.status === 403 || res.status === 429) {
    unsplashCooldownUntil = Date.now() + UNSPLASH_COOLDOWN_MS
    return []
  }
  if (!res.ok) return []
  const data = await res.json()
  // `regular` is fixed at 1080px wide, which blurs once stretched across a
  // full-width desktop hero/card on a large or high-DPI viewport. Build a
  // wider derivative from `raw` (must keep its ixid param per Unsplash API
  // guidelines) instead of falling back to `full`, which is uncompressed
  // and far heavier than needed.
  return (data.results ?? []).map((p) => `${p.urls.raw}&w=1600&q=80&fit=max&auto=format`)
}

async function searchPexels(query, count) {
  const key = process.env.PEXELS_KEY
  if (!key) return []
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=portrait`,
    { headers: { Authorization: key } }
  )
  if (!res.ok) return []
  const data = await res.json()
  // `large` caps at 940x650 with no dpr multiplier — on a portrait source
  // that clips to ~430px wide, which upscales (blurs) once it's stretched
  // across a full-width desktop hero or card. `large2x` renders the same
  // bounding box at dpr=2 (~1880x1300), giving enough source resolution
  // for large/high-DPI viewports while still respecting the source aspect
  // ratio (no forced crop).
  return (data.photos ?? []).map((p) => p.src.large2x)
}

// 'stock' — and any retired source (e.g. 'google' from a stale cached PWA
// build): Unsplash first, Pexels fallback. Chained here rather than on the
// client so the fallback doesn't cost the caller a second token.
async function searchBySource(source, query, count) {
  if (source === 'unsplash') return searchUnsplash(query, count)
  if (source === 'pexels')   return searchPexels(query, count)
  const unsplash = await searchUnsplash(query, count)
  if (unsplash.length > 0) return unsplash
  return searchPexels(query, count)
}

// No requireAuth: guest browsing ("Continue as guest") renders the same photo
// cards, and without a user every card fell back to a gradient. Guests are
// rate-limited by IP instead of uid.
export const searchImages = onCall({ timeoutSeconds: 30, cors: true, invoker: 'public' }, async (request) => {
  const { query, count = 3, source = 'stock' } = request.data
  if (!query) throw new HttpsError('invalid-argument', 'query required')

  const cacheKey = `${source}:${count}:${query}`
  const cached   = searchImagesCache.get(cacheKey)
  if (cached && Date.now() - cached.at < SEARCH_IMAGES_CACHE_TTL_MS) return { urls: cached.urls }

  const callerKey = request.auth?.uid ?? `ip:${request.rawRequest.ip}`
  if (!takeSearchToken(callerKey)) {
    throw new HttpsError('resource-exhausted', 'Please slow down')
  }

  const urls = await searchBySource(source, query, count)
  if (urls.length > 0) {
    // Delete first so a refreshed entry moves to the back of the FIFO order.
    searchImagesCache.delete(cacheKey)
    if (searchImagesCache.size >= SEARCH_IMAGES_CACHE_MAX) {
      searchImagesCache.delete(searchImagesCache.keys().next().value)
    }
    searchImagesCache.set(cacheKey, { urls, at: Date.now() })
  }
  return { urls }
})

// ─── Image Proxy (server-side fetch to bypass CORS) ──────────────────────────

const PROXY_ALLOWED_HOSTS = [
  'images.pexels.com',
  'lh3.googleusercontent.com',
  'images.unsplash.com',
]

// Google Image Search thumbnails: encrypted-tbn0-3.gstatic.com
const PROXY_ALLOWED_HOST_PATTERN = /^encrypted-tbn\d*\.gstatic\.com$/

function isProxyHostAllowed(hostname) {
  return (
    PROXY_ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`)) ||
    PROXY_ALLOWED_HOST_PATTERN.test(hostname)
  )
}

export const proxyImage = onCall({ timeoutSeconds: 30, cors: true, invoker: 'public' }, async (request) => {
  requireAuth(request)
  const { url } = request.data
  if (!url || typeof url !== 'string') throw new HttpsError('invalid-argument', 'url required')

  let hostname
  try {
    hostname = new URL(url).hostname
  } catch {
    throw new HttpsError('invalid-argument', 'invalid url')
  }

  if (!isProxyHostAllowed(hostname)) {
    throw new HttpsError('permission-denied', 'Host not allowed')
  }

  const res = await fetch(url)
  if (!res.ok) throw new HttpsError('unavailable', `Fetch failed: ${res.status}`)

  const buffer   = await res.arrayBuffer()
  const base64   = Buffer.from(buffer).toString('base64')
  const mimeType = res.headers.get('content-type') ?? 'image/jpeg'
  return { dataUrl: `data:${mimeType};base64,${base64}` }
})

// ─── AI Virtual Try-On (cuuupid/idm-vton) ─────────────────────────────────────

// Pinned version of cuuupid/idm-vton on Replicate (replaces removed yisol/idm-vton)
const IDM_VTON_VERSION = '0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985'

// In-process cooldown: prevents rapid-fire calls from burning Replicate quota.
// Resets on cold start — sufficient to stop accidental double-taps.
const tryOnCooldown = new Map()

// Layer order for chaining: base layers first so outer garments render on top
const VTON_LAYER_ORDER = ['bottoms', 'dresses', 'tops', 'outerwear']

// Map closet category to IDM-VTON category param
function toVtonCategory(category) {
  if (['tops', 'outerwear'].includes(category)) return 'upper_body'
  if (category === 'bottoms')                   return 'lower_body'
  if (category === 'dresses')                   return 'dresses'
  return null  // footwear, accessories — not supported
}

// Submit one Replicate prediction and poll until complete (~110s per piece)
// Assumes garment has already been validated by the caller.
async function runOnePrediction(apiKey, personImageUrl, garment) {
  const vtonCategory = toVtonCategory(garment.category)

  const createRes = await fetch('https://api.replicate.com/v1/predictions', {
    method:  'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: IDM_VTON_VERSION,
      input: {
        human_img:   personImageUrl,
        garm_img:    garment.garmentImageUrl,
        garment_des: garment.garmentName ?? 'clothing item',
        category:    vtonCategory,
        steps:       30,
        seed:        42,
      },
    }),
  })

  if (!createRes.ok) {
    const errBody = await createRes.text().catch(() => '')
    console.error('Replicate error:', createRes.status, errBody)
    throw new HttpsError('unavailable', `Try-on generation failed (${createRes.status})`)
  }

  const prediction = await createRes.json()
  const pollUrl    = prediction.urls?.get ?? `https://api.replicate.com/v1/predictions/${prediction.id}`
  const deadline   = Date.now() + 110_000

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000))
    const pollRes  = await fetch(pollUrl, { headers: { Authorization: `Bearer ${apiKey}` } })
    const pollData = await pollRes.json()
    if (pollData.status === 'succeeded') {
      const out = pollData.output
      return Array.isArray(out) ? out[0] : out
    }
    if (pollData.status === 'failed') throw new HttpsError('internal', 'Try-on generation failed')
  }
  throw new HttpsError('deadline-exceeded', 'Try-on timed out')
}

// Accepts garments[] so multi-piece chaining happens server-side in one call.
// Timeout 300s covers up to 3 pieces × ~90s each.
export const generateTryOn = onCall({ timeoutSeconds: 300, cors: true, invoker: 'public' }, async (request) => {
  requireAuth(request)
  const uid  = request.auth.uid
  const last = tryOnCooldown.get(uid)
  if (last && Date.now() - last < 30_000) {
    throw new HttpsError('resource-exhausted', 'Please wait before generating again')
  }
  tryOnCooldown.set(uid, Date.now())

  const tier = getUserTier(request.auth.token)
  if (tier === 'free') throw new HttpsError('permission-denied', 'limit_tryOns')
  if (tier !== 'admin') {
    // Pro: drain monthly allowance first, then purchased credits
    const ref    = admin.firestore().doc(`users/${uid}/prefs/usage`)
    const period = new Date().toISOString().slice(0, 7)
    await admin.firestore().runTransaction(async (tx) => {
      const snap         = await tx.get(ref)
      const data         = snap.exists ? snap.data() : {}
      const isNew        = data.periodKey !== period
      const monthlyUsed  = isNew ? 0 : (data.tryOns ?? 0)
      const credits      = data.tryOnCredits ?? 0
      if (monthlyUsed < TIER_LIMITS.pro.tryOns) {
        tx.set(ref,
          isNew ? { periodKey: period, tryOns: 1 } : { tryOns: FieldValue.increment(1) },
          { merge: true })
      } else if (credits > 0) {
        tx.set(ref, { tryOnCredits: FieldValue.increment(-1) }, { merge: true })
      } else {
        throw new HttpsError('resource-exhausted', 'limit_tryOns')
      }
    })
  }

  const { personImageUrl, garments } = request.data

  if (typeof personImageUrl !== 'string' || !personImageUrl.startsWith('https://')) {
    throw new HttpsError('invalid-argument', 'personImageUrl must be a valid https URL')
  }
  if (!Array.isArray(garments) || garments.length === 0) {
    throw new HttpsError('invalid-argument', 'garments must be a non-empty array')
  }
  if (garments.length > 3) {
    throw new HttpsError('invalid-argument', 'Maximum 3 pieces per try-on')
  }

  // Validate all garments upfront — fail fast before spending any Replicate quota
  for (const g of garments) {
    if (typeof g.garmentImageUrl !== 'string' || !g.garmentImageUrl.startsWith('https://')) {
      throw new HttpsError('invalid-argument', 'Each garment must have a valid https garmentImageUrl')
    }
    if (!toVtonCategory(g.category)) {
      throw new HttpsError('invalid-argument', `Category '${g.category}' is not supported for try-on`)
    }
  }

  const apiKey = process.env.REPLICATE_API_KEY
  if (!apiKey) throw new HttpsError('internal', 'Try-On service not configured — add REPLICATE_API_KEY')

  // Sort by layer order, then chain: each output becomes the next person image
  const sorted = [...garments].sort((a, b) => {
    const ai = VTON_LAYER_ORDER.indexOf(a.category)
    const bi = VTON_LAYER_ORDER.indexOf(b.category)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  let currentPersonUrl = personImageUrl
  for (const garment of sorted) {
    currentPersonUrl = await runOnePrediction(apiKey, currentPersonUrl, garment)
  }

  return { outputUrl: currentPersonUrl }
})

// ─── User Feedback ────────────────────────────────────────────────────────────

export const submitFeedback = onCall({ timeoutSeconds: 30, cors: true, invoker: 'public' }, async (request) => {
  const { category, message, contactEmail } = request.data
  if (!message || typeof message !== 'string' || message.trim().length < 5) {
    throw new HttpsError('invalid-argument', 'message is required')
  }

  const doc = {
    category:     (category ?? 'General').slice(0, 50),
    message:      message.trim().slice(0, 2000),
    contactEmail: contactEmail ? String(contactEmail).slice(0, 200) : null,
    uid:          request.auth?.uid ?? null,
    submittedAt:  Date.now(),
  }

  await admin.firestore().collection('feedback').add(doc)

  await sendEmail(
    `[Sartima Feedback] ${doc.category}`,
    [
      `Category: ${doc.category}`,
      `From: ${doc.contactEmail ?? 'Anonymous'} (uid: ${doc.uid ?? 'none'})`,
      '',
      doc.message,
    ].join('\n')
  )

  return { ok: true }
})

// ─── Crash Reports ────────────────────────────────────────────────────────────

export const submitCrashReport = onCall({ timeoutSeconds: 30, cors: true, invoker: 'public' }, async (request) => {
  const { doing, saw, diagnostics } = request.data

  const doc = {
    doing:       doing ? String(doing).slice(0, 500) : null,
    saw:         saw   ? String(saw).slice(0, 500)   : null,
    diagnostics: diagnostics ?? null,
    uid:         request.auth?.uid ?? null,
    submittedAt: Date.now(),
  }

  await admin.firestore().collection('crashReports').add(doc)

  const logs = diagnostics?.logs ?? []
  const errors = logs.filter((l) => ['error', 'uncaught', 'unhandledRejection'].includes(l.type))
  const recentErrors = errors
    .slice(-5)
    .map((e) => `  [${e.type}] ${e.message}${e.source ? ` (${e.source})` : ''}`)
    .join('\n')

  await sendEmail(
    '[Sartima] Problem Report',
    [
      `UID: ${doc.uid ?? 'anonymous'}`,
      `Browser: ${diagnostics?.browser?.userAgent ?? 'unknown'}`,
      `Screen: ${diagnostics?.browser?.url ?? 'unknown'}`,
      '',
      `What they were doing: ${doc.doing ?? '(not provided)'}`,
      `What they saw: ${doc.saw ?? '(not provided)'}`,
      '',
      `Errors in session (${errors.length} total, last 5):`,
      recentErrors || '  (none)',
      '',
      `Network failures: ${logs.filter((l) => l.type === 'networkError').length}`,
    ].join('\n')
  )

  return { ok: true }
})

// ─── Scheduled Notifications ───────────────────────────────────────────────────
// Runs every 15 minutes; sends a push to any user whose local reminderTime
// falls in the current bucket. Uses a collectionGroup query over 'prefs' —
// filtering on `enabled` naturally excludes every other prefs doc shape
// (closet, wishlist, usage, ...) since none of them have that field.

function minutesSinceMidnight(hhmm) {
  const [h, m] = (hhmm ?? '08:00').split(':').map(Number)
  return (h ?? 8) * 60 + (m ?? 0)
}

function localMinutesNow(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date())
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
    return h * 60 + m
  } catch {
    return null // unknown/invalid timezone — skip this user rather than guess
  }
}

export const sendDailyOutfitReminders = onSchedule('every 15 minutes', async () => {
  const snap = await admin.firestore().collectionGroup('prefs').where('enabled', '==', true).get()

  await Promise.all(snap.docs.map(async (docSnap) => {
    const data   = docSnap.data()
    const tokens = data.fcmTokens
    if (!Array.isArray(tokens) || tokens.length === 0) return

    const nowMin = localMinutesNow(data.timezone)
    if (nowMin == null) return
    const targetMin = minutesSinceMidnight(data.reminderTime)
    if (nowMin < targetMin || nowMin >= targetMin + 15) return

    const uid = docSnap.ref.parent.parent?.id
    if (!uid) return

    const staleTokens = []
    await Promise.all(tokens.map(async (token) => {
      try {
        await admin.messaging().send({
          token,
          notification: { title: 'Sartima', body: "Your outfit's ready — tap to see today's look." },
          webpush: { fcmOptions: { link: '/?tab=daily' } },
        })
      } catch (err) {
        if (err?.code === 'messaging/registration-token-not-registered') staleTokens.push(token)
      }
    }))

    if (staleTokens.length) {
      await docSnap.ref.set(
        { fcmTokens: tokens.filter((t) => !staleTokens.includes(t)) },
        { merge: true }
      )
    }
  }))
})

// ─── Stripe ───────────────────────────────────────────────────────────────────

import Stripe from 'stripe'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

// Billing lifecycle (users/{uid}/prefs/subscription mirrors Stripe; claims grant access):
// - Renewal fails (past_due/unpaid) → Pro kept for GRACE_PERIOD_MS from the first
//   failure; the client shows a red warning while graceEndsAt is set.
// - User cancels → Pro kept until the end of the period they paid for.
// Delayed downgrades live in billingDowngrades/{uid} { downgradeAt } and are applied
// by the hourly enforceBillingDowngrades sweep.
const GRACE_PERIOD_MS     = 7 * 24 * 60 * 60 * 1000
const TRYON_PACK_CREDITS  = 30
const LIVE_SUB_STATUSES   = ['active', 'trialing', 'past_due', 'unpaid']
const ACCOUNT_DELETED_TAG = 'account_deleted'

const subscriptionRef = (uid) => admin.firestore().doc(`users/${uid}/prefs/subscription`)
const downgradeRef    = (uid) => admin.firestore().doc(`billingDowngrades/${uid}`)

// Merge into existing claims — setCustomUserClaims replaces the whole object,
// so writing { sartima_tier } alone would wipe sartima_role: 'admin'.
async function setTierClaim(uid, tier) {
  const user = await admin.auth().getUser(uid)
  await admin.auth().setCustomUserClaims(uid, { ...(user.customClaims ?? {}), sartima_tier: tier })
}

// Stripe API 2025-03-31+ moved current_period_end from the subscription onto its items
function periodEndMs(sub) {
  const secs = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end
  return secs ? secs * 1000 : null
}

// Resolve or create a Stripe customer for the given uid
async function getOrCreateCustomer(stripe, uid) {
  const subSnap = await subscriptionRef(uid).get()
  if (subSnap.exists && subSnap.data().stripeCustomerId) {
    return subSnap.data().stripeCustomerId
  }
  const user     = await admin.auth().getUser(uid)
  const customer = await stripe.customers.create({ email: user.email, metadata: { uid } })
  // Persist now so abandoned checkouts don't leave a new orphan customer each time
  await subscriptionRef(uid).set({ stripeCustomerId: customer.id }, { merge: true })
  return customer.id
}

export const createStripeCheckout = onCall({ timeoutSeconds: 30, cors: true, invoker: 'public', secrets: ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID_MONTHLY', 'STRIPE_PRICE_ID_ANNUAL'] }, async (request) => {
  requireAuth(request)
  const uid    = request.auth.uid
  const plan   = request.data.plan === 'annual' ? 'annual' : 'monthly'
  const stripe = getStripe()

  // Already subscribed (including a failed renewal) — they should manage billing
  // in the portal, not start a second subscription and get double-charged.
  const subSnap = await subscriptionRef(uid).get()
  const current = subSnap.exists ? subSnap.data() : {}
  if (current.stripeSubscriptionId && LIVE_SUB_STATUSES.includes(current.status)) {
    throw new HttpsError('already-exists', 'already_subscribed')
  }

  const priceId    = plan === 'annual' ? process.env.STRIPE_PRICE_ID_ANNUAL : process.env.STRIPE_PRICE_ID_MONTHLY
  const customerId = await getOrCreateCustomer(stripe, uid)
  const appUrl     = process.env.APP_URL ?? 'https://sartima.ca'

  const session = await stripe.checkout.sessions.create({
    customer:          customerId,
    mode:              'subscription',
    line_items:        [{ price: priceId, quantity: 1 }],
    success_url:       `${appUrl}?upgrade=success`,
    cancel_url:        appUrl,
    metadata:          { uid },
    subscription_data: { metadata: { uid } },
  })

  return { url: session.url }
})

export const createStripeBillingPortal = onCall({ timeoutSeconds: 30, cors: true, invoker: 'public', secrets: ['STRIPE_SECRET_KEY'] }, async (request) => {
  requireAuth(request)
  const uid    = request.auth.uid
  const subDoc = await subscriptionRef(uid).get()
  if (!subDoc.exists || !subDoc.data().stripeCustomerId) {
    throw new HttpsError('not-found', 'No active subscription found')
  }
  const stripe  = getStripe()
  const appUrl  = process.env.APP_URL ?? 'https://sartima.ca'
  const session = await stripe.billingPortal.sessions.create({
    customer:   subDoc.data().stripeCustomerId,
    return_url: appUrl,
  })
  return { url: session.url }
})

export const purchaseTryOnPack = onCall({ timeoutSeconds: 30, cors: true, invoker: 'public', secrets: ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID_TRYON_PACK'] }, async (request) => {
  requireAuth(request)
  const uid  = request.auth.uid
  const tier = getUserTier(request.auth.token)
  if (tier === 'free') throw new HttpsError('permission-denied', 'Pro subscription required')

  const stripe     = getStripe()
  const customerId = await getOrCreateCustomer(stripe, uid)
  const appUrl     = process.env.APP_URL ?? 'https://sartima.ca'

  const session = await stripe.checkout.sessions.create({
    customer:    customerId,
    mode:        'payment',
    line_items:  [{ price: process.env.STRIPE_PRICE_ID_TRYON_PACK, quantity: 1 }],
    success_url: `${appUrl}?pack=success`,
    cancel_url:  appUrl,
    metadata:    { uid, type: 'tryon_pack', qty: String(TRYON_PACK_CREDITS) },
  })

  return { url: session.url }
})

// Called for checkout.session.completed and checkout.session.async_payment_succeeded
async function fulfillCheckout(session) {
  const uid = session.metadata?.uid
  if (!uid) return
  // Delayed payment methods (e.g. pre-authorized debit) complete checkout before the
  // money arrives — fulfil only once async_payment_succeeded reports it paid.
  if (session.payment_status === 'unpaid') return

  if (session.mode === 'subscription') {
    await setTierClaim(uid, 'pro')
    await downgradeRef(uid).delete()
    await subscriptionRef(uid).set({
      stripeCustomerId:     session.customer,
      stripeSubscriptionId: session.subscription,
      status:               'active',
      cancelAtPeriodEnd:    false,
      paymentFailedAt:      null,
      graceEndsAt:          null,
      downgradeAt:          null,
      updatedAt:            FieldValue.serverTimestamp(),
    }, { merge: true })
  } else if (session.mode === 'payment' && session.metadata?.type === 'tryon_pack') {
    // Marker + credit commit atomically, keyed on the session so a redelivered event
    // (or completed + async_payment_succeeded for one session) never credits twice.
    const db    = admin.firestore()
    const batch = db.batch()
    batch.create(db.doc(`fulfilledCheckouts/${session.id}`), {
      uid, type: 'tryon_pack', createdAt: FieldValue.serverTimestamp(),
    })
    batch.set(db.doc(`users/${uid}/prefs/usage`),
      { tryOnCredits: FieldValue.increment(TRYON_PACK_CREDITS) },
      { merge: true })
    try {
      await batch.commit()
    } catch (err) {
      if (err.code !== 6) throw err // 6 = ALREADY_EXISTS → already fulfilled
    }
  }
}

// Resolve the Sartima uid for a subscription event, or null if it should be ignored
// (unknown customer, deleted account, or a stale subscription that isn't the user's current one).
async function uidForSubscription(sub) {
  if (sub.cancellation_details?.comment === ACCOUNT_DELETED_TAG) return null

  let uid = sub.metadata?.uid
  if (!uid) {
    const customer = await getStripe().customers.retrieve(sub.customer)
    uid = customer.deleted ? null : customer.metadata?.uid
  }
  if (!uid) return null

  try {
    await admin.auth().getUser(uid)
  } catch (err) {
    if (err.code === 'auth/user-not-found') return null
    throw err
  }

  const subSnap  = await subscriptionRef(uid).get()
  const storedId = subSnap.exists ? subSnap.data().stripeSubscriptionId : null
  if (storedId && storedId !== sub.id) return null
  return uid
}

async function syncSubscription(sub) {
  const uid = await uidForSubscription(sub)
  if (!uid) return

  const now    = Date.now()
  const update = {
    status:            sub.status,
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    currentPeriodEnd:  periodEndMs(sub),
    updatedAt:         FieldValue.serverTimestamp(),
  }

  if (sub.status === 'active' || sub.status === 'trialing') {
    // Paid up — new, renewed, or recovered from a failed payment (restores Pro even
    // if the grace period already ran out). A pending cancellation keeps Pro too:
    // Stripe sends customer.subscription.deleted when the paid period ends.
    await setTierClaim(uid, 'pro')
    await downgradeRef(uid).delete()
    Object.assign(update, { paymentFailedAt: null, graceEndsAt: null, downgradeAt: null })
  } else if (sub.status === 'past_due' || sub.status === 'unpaid') {
    // Renewal failed — grace period runs from the FIRST failure, not each retry
    const existing    = (await subscriptionRef(uid).get()).data() ?? {}
    const graceEndsAt = existing.graceEndsAt ?? now + GRACE_PERIOD_MS
    await downgradeRef(uid).set({ uid, downgradeAt: graceEndsAt, reason: 'payment_failed' })
    Object.assign(update, {
      paymentFailedAt: existing.paymentFailedAt ?? now,
      graceEndsAt,
      downgradeAt:     graceEndsAt,
    })
  }

  await subscriptionRef(uid).set(update, { merge: true })
}

async function endSubscription(sub) {
  const uid = await uidForSubscription(sub)
  if (!uid) return

  const now      = Date.now()
  const existing = (await subscriptionRef(uid).get()).data() ?? {}
  // Ended for non-payment → access ends with the grace period. Otherwise the user
  // canceled: they keep Pro through the period they paid for. With the portal's
  // cancel-at-period-end that's now; an immediate cancellation still honours it.
  const nonPayment  = sub.cancellation_details?.reason === 'payment_failed' || existing.graceEndsAt != null
  const downgradeAt = nonPayment ? (existing.graceEndsAt ?? now) : (periodEndMs(sub) ?? now)

  if (downgradeAt <= now) {
    await setTierClaim(uid, 'free')
    await downgradeRef(uid).delete()
  } else {
    await downgradeRef(uid).set({ uid, downgradeAt, reason: nonPayment ? 'payment_failed' : 'canceled' })
  }

  await subscriptionRef(uid).set({
    status:            'canceled',
    cancelAtPeriodEnd: false,
    paymentFailedAt:   null,
    graceEndsAt:       null,
    downgradeAt:       downgradeAt > now ? downgradeAt : null,
    updatedAt:         FieldValue.serverTimestamp(),
  }, { merge: true })
}

export const stripeWebhook = onRequest({ timeoutSeconds: 60, invoker: 'public', secrets: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] }, async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event
  try {
    event = getStripe().webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    res.status(400).send(`Webhook error: ${err.message}`)
    return
  }

  // Every handler is idempotent, so a 500 here safely lets Stripe retry
  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await fulfillCheckout(event.data.object)
        break
      case 'customer.subscription.updated':
        await syncSubscription(event.data.object)
        break
      case 'customer.subscription.deleted':
        await endSubscription(event.data.object)
        break
    }
  } catch (err) {
    console.error(`stripeWebhook ${event.type} (${event.id}) failed:`, err)
    res.status(500).send('Webhook handler failed')
    return
  }

  res.json({ ok: true })
})

// Applies delayed downgrades: grace periods that ran out, and canceled
// subscriptions whose paid period has ended.
export const enforceBillingDowngrades = onSchedule('every 60 minutes', async () => {
  const due = await admin.firestore().collection('billingDowngrades')
    .where('downgradeAt', '<=', Date.now())
    .get()

  for (const snap of due.docs) {
    const uid = snap.id
    try {
      await setTierClaim(uid, 'free')
      await subscriptionRef(uid).set({
        downgradeAt: null,
        updatedAt:   FieldValue.serverTimestamp(),
      }, { merge: true })
    } catch (err) {
      if (err.code !== 'auth/user-not-found') {
        console.error(`enforceBillingDowngrades: ${uid} failed:`, err)
        continue // keep the doc so the next run retries
      }
    }
    await snap.ref.delete()
  }
})

// Full account deletion — cancels billing, wipes Storage photos and the
// Firestore document tree, then deletes the Auth user last (in that order,
// so a mid-failure leaves the user able to retry this same callable rather
// than an unreachable Auth-less orphaned account).
export const deleteAccount = onCall({ timeoutSeconds: 120, cors: true, invoker: 'public', secrets: ['STRIPE_SECRET_KEY'] }, async (request) => {
  requireAuth(request)
  const uid = request.auth.uid
  const db  = admin.firestore()

  const subSnap = await subscriptionRef(uid).get()
  const { stripeSubscriptionId, status } = subSnap.exists ? subSnap.data() : {}
  if (stripeSubscriptionId && status !== 'canceled') {
    try {
      // Tagged so the resulting customer.subscription.deleted webhook is ignored
      // instead of racing this deletion and re-creating the subscription doc
      await getStripe().subscriptions.cancel(stripeSubscriptionId, {
        cancellation_details: { comment: ACCOUNT_DELETED_TAG },
      })
    } catch (err) {
      if (err.code !== 'resource_missing') throw err
    }
  }
  await downgradeRef(uid).delete()

  const bucket = admin.storage().bucket()
  await bucket.deleteFiles({ prefix: `users/${uid}/wardrobe/` })
  await bucket.deleteFiles({ prefix: `users/${uid}/avatar/` })

  await db.recursiveDelete(db.doc(`users/${uid}`))
  await admin.auth().deleteUser(uid)

  return { ok: true }
})
