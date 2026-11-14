import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import { outfitCandidates, targetSeasons } from './outfitPool'

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

function cacheKeyFor({ closetItems, occasion, dateStr, preferredSeasons }) {
  const seasonKey = [...targetSeasons(preferredSeasons)].sort().join('+')
  return `sartima_outfit_${dateStr}_${occasion}_${seasonKey}_${closetHash(closetItems)}`
}

/**
 * The outfit already generated this session for these inputs, or null.
 * Never calls the AI, so it costs nothing against the free daily generation.
 */
export function getCachedOutfit({ closetItems, occasion, dateStr, preferredSeasons }) {
  if (!closetItems || closetItems.length < 3) return null
  const cached = getCached(cacheKeyFor({ closetItems, occasion, dateStr, preferredSeasons }))
  if (!cached) return null
  const itemMap = Object.fromEntries(closetItems.map((i) => [i.id, i]))
  return { ...cached, items: cached.itemIds.map((id) => itemMap[id]).filter(Boolean) }
}

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
 * @param {string[]} [opts.preferredSeasons] - Settings → Preferred seasons; empty = current season
 * @returns {Promise<GeneratedOutfit|null>}
 */
export async function generateOutfit({ closetItems, weather, occasion, dateStr, gender, occupation, preferredSeasons }) {
  if (!closetItems || closetItems.length < 3) return null

  const cached = getCachedOutfit({ closetItems, occasion, dateStr, preferredSeasons })
  if (cached) return cached
  const cacheKey = cacheKeyFor({ closetItems, occasion, dateStr, preferredSeasons })

  const candidates = outfitCandidates(closetItems, { occasion, preferredSeasons })

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
