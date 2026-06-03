import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

const tripFn = httpsCallable(functions, 'anthropicTrip', { timeout: 90000 })

/**
 * Generate a trip packing list and daily outfit plan via the server-side proxy.
 *
 * @param {object} opts
 * @param {string} opts.destination   - e.g. "Paris, France"
 * @param {number} opts.nights        - number of nights
 * @param {Array}  opts.closetItems   - full ClosetItem array
 * @param {string} opts.gender        - "men" | "women" | "both"
 * @returns {Promise<TripPlan>} - { destination, nights, packingList, dailyOutfits, gapItems }
 */
export async function generateTrip({ destination, nights, closetItems, gender }) {
  const items = closetItems.map((i) => ({
    id:       i.id,
    name:     i.name,
    category: i.category,
    color:    i.color ?? '',
    seasons:  i.seasons ?? [],
  }))

  const { data } = await tripFn({ destination, nights, items, gender })
  return data
}
