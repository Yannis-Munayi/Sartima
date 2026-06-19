import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
import Anthropic from '@anthropic-ai/sdk'
import dns from 'dns/promises'
import admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import nodemailer from 'nodemailer'

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

const CLAUDE_HAIKU = 'claude-haiku-4-5-20251001'

let _anthropic = null
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _anthropic
}

function requireAuth(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required')
}

// ─── Subscription / Usage ─────────────────────────────────────────────────────

const TIER_LIMITS = {
  free:  { visionUploads: 3,    tripPlans: 0,    tryOns: 0  },
  pro:   { visionUploads: 30,   tripPlans: 3,    tryOns: 30 },
  admin: { visionUploads: null, tripPlans: null, tryOns: null }, // null = no limit
}

async function getUserTier(uid) {
  const user = await admin.auth().getUser(uid)
  if (user.customClaims?.sartima_role === 'admin') return 'admin'
  return user.customClaims?.sartima_tier === 'pro' ? 'pro' : 'free'
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

// ─── Email Validation (no auth — called pre-signup) ──────────────────────────

export const validateEmail = onCall({ timeoutSeconds: 10, cors: true, invoker: 'public' }, async (request) => {
  const { email } = request.data
  if (!email || typeof email !== 'string') throw new HttpsError('invalid-argument', 'email required')
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return { valid: false }
  try {
    const records = await dns.resolveMx(domain)
    return { valid: Array.isArray(records) && records.length > 0 }
  } catch {
    return { valid: false }
  }
})

// ─── Vision Analysis ──────────────────────────────────────────────────────────

export const anthropicVision = onCall({ timeoutSeconds: 90, cors: true, invoker: 'public' }, async (request) => {
  requireAuth(request)
  const uid  = request.auth.uid
  const tier = await getUserTier(uid)
  await checkAndIncrementUsage(uid, 'visionUploads', TIER_LIMITS[tier].visionUploads)

  const { imageBase64, mimeType = 'image/jpeg' } = request.data
  if (!imageBase64) throw new HttpsError('invalid-argument', 'imageBase64 required')

  const response = await getAnthropic().messages.create({
    model:      CLAUDE_HAIKU,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
        {
          type: 'text',
          text: `Analyze this outfit photo and identify every visible clothing item and accessory being worn.

Return a JSON object with this exact shape — no markdown, no explanation, just raw JSON:
{
  "items": [
    {
      "name": "short descriptive name (3-5 words max)",
      "category": "one of: tops | bottoms | outerwear | dresses | footwear | accessories",
      "color": "primary color (one word)",
      "description": "one sentence describing the piece",
      "bbox": { "x": 10, "y": 20, "w": 30, "h": 40 }
    }
  ]
}

bbox is the bounding box of that specific item within the image, as integer percentages (0–100) of the image dimensions:
- x, y = top-left corner (x is from left edge, y is from top edge)
- w, h = width and height of the box

Rules:
- Include every visible item (shirt, pants, shoes, bag, hat, jewellery, etc.)
- Use lowercase for category
- If the full outfit is a dress or jumpsuit, list it as a single "dresses" item
- Maximum 10 items
- Every item MUST include a bbox — estimate as accurately as possible`,
        },
      ],
    }],
  })

  const text = response.content[0]?.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new HttpsError('internal', 'Malformed AI response')

  const parsed = JSON.parse(jsonMatch[0])
  return { items: parsed.items ?? [] }
})

// ─── Outfit Generation ────────────────────────────────────────────────────────

export const anthropicOutfit = onCall({ timeoutSeconds: 60, cors: true, invoker: 'public' }, async (request) => {
  requireAuth(request)
  const uid  = request.auth.uid
  const tier = await getUserTier(uid)
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

Return ONLY valid JSON, no markdown:
{
  "selectedIds": ["id1", "id2"],
  "reasoning": "1-2 sentences why this outfit works for the occasion and weather.",
  "weatherNote": "Short suitability note or null"
}`

  const response = await getAnthropic().messages.create({
    model:      CLAUDE_HAIKU,
    max_tokens: 512,
    messages:   [{ role: 'user', content: prompt }],
  })

  const text = response.content[0]?.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new HttpsError('internal', 'Malformed AI response')

  return JSON.parse(jsonMatch[0])
})

// ─── Trip Planning ────────────────────────────────────────────────────────────

export const anthropicTrip = onCall({ timeoutSeconds: 120, cors: true, invoker: 'public' }, async (request) => {
  requireAuth(request)
  const uid  = request.auth.uid
  const tier = await getUserTier(uid)
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

  const response = await getAnthropic().messages.create({
    model:      CLAUDE_HAIKU,
    max_tokens: 1500,
    messages:   [{ role: 'user', content: prompt }],
  })

  const text = response.content[0]?.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new HttpsError('internal', 'Malformed AI response')

  return JSON.parse(jsonMatch[0])
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

export const searchImages = onCall({ timeoutSeconds: 30, cors: true, invoker: 'public' }, async (request) => {
  const { query, count = 3, source = 'pexels' } = request.data
  if (!query) throw new HttpsError('invalid-argument', 'query required')

  if (source === 'pexels') {
    const key = process.env.PEXELS_KEY
    if (!key) return { urls: [] }
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=portrait`,
      { headers: { Authorization: key } }
    )
    if (!res.ok) return { urls: [] }
    const data = await res.json()
    return { urls: (data.photos ?? []).map((p) => p.src.large) }
  }

  if (source === 'google') {
    const key = process.env.GOOGLE_API_KEY
    const cx  = process.env.GOOGLE_CX
    if (!key || !cx) return { urls: [] }
    const params = new URLSearchParams({
      key, cx, q: query,
      searchType: 'image',
      num:        String(count),
      imgSize:    'large',
      imgType:    'photo',
      safe:       'active',
    })
    const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`)
    if (res.status === 403 || res.status === 401 || res.status === 429) {
      return { urls: [], quotaExceeded: true }
    }
    if (!res.ok) return { urls: [] }
    const data = await res.json()
    return { urls: (data.items ?? []).map((item) => item.link) }
  }

  if (source === 'unsplash') {
    const key = process.env.UNSPLASH_KEY
    if (!key) return { urls: [] }
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=portrait`,
      { headers: { Authorization: `Client-ID ${key}` } }
    )
    if (!res.ok) return { urls: [] }
    const data = await res.json()
    return { urls: (data.results ?? []).map((p) => p.urls.regular) }
  }

  return { urls: [] }
})

// ─── Image Proxy (server-side fetch to bypass CORS) ──────────────────────────

const PROXY_ALLOWED_HOSTS = [
  'images.pexels.com',
  'lh3.googleusercontent.com',
  'encrypted-tbn',
  'images.unsplash.com',
]

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

  if (!PROXY_ALLOWED_HOSTS.some((h) => hostname.includes(h))) {
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

  const tier = await getUserTier(uid)
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

// ─── Stripe ───────────────────────────────────────────────────────────────────

import Stripe from 'stripe'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

// Resolve or create a Stripe customer for the given uid
async function getOrCreateCustomer(stripe, uid) {
  const subSnap = await admin.firestore().doc(`users/${uid}/prefs/subscription`).get()
  if (subSnap.exists && subSnap.data().stripeCustomerId) {
    return subSnap.data().stripeCustomerId
  }
  const user     = await admin.auth().getUser(uid)
  const customer = await stripe.customers.create({ email: user.email, metadata: { uid } })
  return customer.id
}

export const createStripeCheckout = onCall({ timeoutSeconds: 30, cors: true, invoker: 'public' }, async (request) => {
  requireAuth(request)
  const uid    = request.auth.uid
  const plan   = request.data.plan === 'annual' ? 'annual' : 'monthly'
  const stripe = getStripe()

  const priceId    = plan === 'annual' ? process.env.STRIPE_PRICE_ID_ANNUAL : process.env.STRIPE_PRICE_ID_MONTHLY
  const customerId = await getOrCreateCustomer(stripe, uid)
  const appUrl     = process.env.APP_URL ?? 'https://sartima.ca'

  const session = await stripe.checkout.sessions.create({
    customer:        customerId,
    mode:            'subscription',
    line_items:      [{ price: priceId, quantity: 1 }],
    success_url:     `${appUrl}?upgrade=success`,
    cancel_url:      appUrl,
    metadata:        { uid },
    automatic_tax:   { enabled: true },
    customer_update: { address: 'auto' },
  })

  return { url: session.url }
})

export const createStripeBillingPortal = onCall({ timeoutSeconds: 30, cors: true, invoker: 'public' }, async (request) => {
  requireAuth(request)
  const uid    = request.auth.uid
  const subDoc = await admin.firestore().doc(`users/${uid}/prefs/subscription`).get()
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

export const purchaseTryOnPack = onCall({ timeoutSeconds: 30, cors: true, invoker: 'public' }, async (request) => {
  requireAuth(request)
  const uid  = request.auth.uid
  const tier = await getUserTier(uid)
  if (tier === 'free') throw new HttpsError('permission-denied', 'Pro subscription required')

  const stripe     = getStripe()
  const customerId = await getOrCreateCustomer(stripe, uid)
  const appUrl     = process.env.APP_URL ?? 'https://sartima.ca'

  const session = await stripe.checkout.sessions.create({
    customer:        customerId,
    mode:            'payment',
    line_items:      [{ price: process.env.STRIPE_PRICE_ID_TRYON_PACK, quantity: 1 }],
    success_url:     `${appUrl}?pack=success`,
    cancel_url:      appUrl,
    metadata:        { uid, type: 'tryon_pack', qty: '30' },
    automatic_tax:   { enabled: true },
    customer_update: { address: 'auto' },
  })

  return { url: session.url }
})

export const stripeWebhook = onRequest({ timeoutSeconds: 60, invoker: 'public' }, async (req, res) => {
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

  const db = admin.firestore()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const uid     = session.metadata?.uid
    if (!uid) { res.json({ ok: true }); return }

    if (session.mode === 'subscription') {
      await admin.auth().setCustomUserClaims(uid, { sartima_tier: 'pro' })
      await db.doc(`users/${uid}/prefs/subscription`).set({
        stripeCustomerId:     session.customer,
        stripeSubscriptionId: session.subscription,
        status:               'active',
        updatedAt:            FieldValue.serverTimestamp(),
      }, { merge: true })
    } else if (session.mode === 'payment' && session.metadata?.type === 'tryon_pack') {
      await db.doc(`users/${uid}/prefs/usage`).set(
        { tryOnCredits: FieldValue.increment(30) },
        { merge: true }
      )
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const sub      = event.data.object
    const customer = await getStripe().customers.retrieve(sub.customer)
    const uid      = customer.metadata?.uid
    if (!uid) { res.json({ ok: true }); return }

    await db.doc(`users/${uid}/prefs/subscription`).set({
      status:            sub.status,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      currentPeriodEnd:  sub.current_period_end,
      updatedAt:         FieldValue.serverTimestamp(),
    }, { merge: true })
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub      = event.data.object
    const customer = await getStripe().customers.retrieve(sub.customer)
    const uid      = customer.metadata?.uid
    if (!uid) { res.json({ ok: true }); return }

    await admin.auth().setCustomUserClaims(uid, { sartima_tier: 'free' })
    await db.doc(`users/${uid}/prefs/subscription`).set({
      status:    'canceled',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
  }

  res.json({ ok: true })
})
