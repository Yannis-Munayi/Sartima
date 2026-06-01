import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

const SEASON_MAP = {
  1: 'winter', 2: 'winter', 3: 'spring', 4: 'spring',
  5: 'spring', 6: 'summer', 7: 'summer', 8: 'summer',
  9: 'fall',   10: 'fall',  11: 'fall',  12: 'winter',
}

function currentSeason() {
  return SEASON_MAP[new Date().getMonth() + 1]
}

function closetHash(items) {
  return items.slice(0, 5).map((i) => i.id).join('-')
}

function getCached(key) {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)
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
 * Generate an outfit from the user's closet using Claude Haiku.
 *
 * @param {object} opts
 * @param {Array}  opts.closetItems  - full ClosetItem array
 * @param {object|null} opts.weather - WeatherData or null
 * @param {string} opts.occasion     - "casual" | "work" | "date" | "gym" | "errand"
 * @param {string} opts.dateStr      - "YYYY-MM-DD"
 * @param {string} opts.gender       - "men" | "women" | "both"
 * @param {string|null} opts.occupation
 * @returns {Promise<GeneratedOutfit|null>}
 *   GeneratedOutfit: { items: ClosetItem[], reasoning, weatherNote, occasionTag, generatedAt }
 */
export async function generateOutfit({ closetItems, weather, occasion, dateStr, gender, occupation }) {
  if (!closetItems || closetItems.length < 3) return null

  const cacheKey = `stylelab_outfit_${dateStr}_${occasion}_${closetHash(closetItems)}`
  const cached   = getCached(cacheKey)
  if (cached) {
    // Re-hydrate items from the closet (in case prettifiedUrl changed)
    const itemMap = Object.fromEntries(closetItems.map((i) => [i.id, i]))
    return { ...cached, items: cached.itemIds.map((id) => itemMap[id]).filter(Boolean) }
  }

  // Pre-filter to current season to keep prompt small
  const season = currentSeason()
  const pool = closetItems.filter(
    (i) => !i.seasons?.length || i.seasons.includes(season)
  )

  // Further filter by occasion if enough items exist
  const occasionFiltered = pool.filter(
    (i) => !i.occasions?.length || i.occasions.includes(occasion)
  )
  const candidates = occasionFiltered.length >= 5 ? occasionFiltered : pool

  const itemList = candidates.map((i) => ({
    id:       i.id,
    name:     i.name,
    category: i.category,
    color:    i.color ?? '',
    seasons:  i.seasons ?? [],
    occasions: i.occasions ?? [],
  }))

  const weatherLine = weather
    ? `Weather: ${weather.description}, ${weather.temp}°C, condition: ${weather.condition}.`
    : ''
  const occupationLine = occupation ? `User occupation: ${occupation}.` : ''

  const prompt = `You are a personal stylist. Select 2–4 items from this wardrobe JSON to form a complete, cohesive outfit.

Wardrobe:
${JSON.stringify(itemList)}

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

  try {
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages:   [{ role: 'user', content: prompt }],
    })

    const text = response.content[0]?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    const selectedIds = parsed.selectedIds ?? []

    const itemMap     = Object.fromEntries(closetItems.map((i) => [i.id, i]))
    const selectedItems = selectedIds.map((id) => itemMap[id]).filter(Boolean)

    const result = {
      items:       selectedItems,
      itemIds:     selectedIds,
      reasoning:   parsed.reasoning   ?? '',
      weatherNote: parsed.weatherNote ?? null,
      occasionTag: occasion,
      generatedAt: new Date().toISOString(),
    }

    setCache(cacheKey, { ...result, items: undefined }) // don't cache full item objects
    return result
  } catch {
    return null
  }
}
