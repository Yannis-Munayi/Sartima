import { onCall, HttpsError } from 'firebase-functions/v2/https'
import Anthropic from '@anthropic-ai/sdk'

const CLAUDE_HAIKU = 'claude-haiku-4-5-20251001'

let _anthropic = null
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _anthropic
}

function requireAuth(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required')
}

// ─── Vision Analysis ──────────────────────────────────────────────────────────

export const anthropicVision = onCall({ timeoutSeconds: 90 }, async (request) => {
  requireAuth(request)
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
      "description": "one sentence describing the piece"
    }
  ]
}

Rules:
- Include every visible item (shirt, pants, shoes, bag, hat, jewellery, etc.)
- Use lowercase for category
- If the full outfit is a dress or jumpsuit, list it as a single "dresses" item
- Maximum 10 items`,
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

export const anthropicOutfit = onCall({ timeoutSeconds: 60 }, async (request) => {
  requireAuth(request)
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

export const anthropicTrip = onCall({ timeoutSeconds: 120 }, async (request) => {
  requireAuth(request)
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

export const getWeather = onCall({ timeoutSeconds: 30 }, async (request) => {
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

export const searchImages = onCall({ timeoutSeconds: 30 }, async (request) => {
  requireAuth(request)
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
