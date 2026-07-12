import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

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

const outfitFn = httpsCallable(functions, 'anthropicOutfit')

/**
 * Generate an outfit from the user's closet via the server-side proxy.
 *
 * @param {object} opts
 * @param {Array}  opts.closetItems  - full ClosetItem array
 * @param {object|null} opts.weather - WeatherData or null
 * @param {string} opts.occasion     - "casual" | "work" | "date" | "gym" | "errand"
 * @param {string} opts.dateStr      - "YYYY-MM-DD"
 * @param {string} opts.gender       - "men" | "women" | "both"
 * @param {string|null} opts.occupation
 * @returns {Promise<GeneratedOutfit|null>}
 */
export async function generateOutfit({ closetItems, weather, occasion, dateStr, gender, occupation }) {
  if (!closetItems || closetItems.length < 3) return null

  const cacheKey = `sartima_outfit_${dateStr}_${occasion}_${closetHash(closetItems)}`
  const cached   = getCached(cacheKey)
  if (cached) {
    const itemMap = Object.fromEntries(closetItems.map((i) => [i.id, i]))
    return { ...cached, items: cached.itemIds.map((id) => itemMap[id]).filter(Boolean) }
  }

  const season = currentSeason()
  const pool   = closetItems.filter(
    (i) => !i.seasons?.length || i.seasons.includes(season)
  )

  const occasionFiltered = pool.filter(
    (i) => !i.occasions?.length || i.occasions.includes(occasion)
  )
  const candidates = occasionFiltered.length >= 5 ? occasionFiltered : pool

  const items = candidates.map((i) => ({
    id:        i.id,
    name:      i.name,
    category:  i.category,
    color:     i.color ?? '',
    seasons:   i.seasons ?? [],
    occasions: i.occasions ?? [],
  }))

  try {
    const { data } = await outfitFn({ items, weather, occasion, dateStr, occupation })
    const selectedIds   = data.selectedIds ?? []
    const itemMap       = Object.fromEntries(closetItems.map((i) => [i.id, i]))
    const selectedItems = selectedIds.map((id) => itemMap[id]).filter(Boolean)

    const result = {
      items:           selectedItems,
      itemIds:         selectedIds,
      reasoning:       data.reasoning       ?? '',
      weatherNote:     data.weatherNote     ?? null,
      missingCategory: data.missingCategory ?? null,
      occasionTag:     occasion,
      generatedAt:     new Date().toISOString(),
    }

    setCache(cacheKey, { ...result, items: undefined })
    return result
  } catch {
    return null
  }
}
