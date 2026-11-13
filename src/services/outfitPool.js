// Picks which closet items are offered to the outfit AI. Pure, so it can be
// unit-tested without Firebase.

const SEASON_MAP = {
  1: 'winter', 2: 'winter', 3: 'spring', 4: 'spring',
  5: 'spring', 6: 'summer', 7: 'summer', 8: 'summer',
  9: 'fall',   10: 'fall',  11: 'fall',  12: 'winter',
}

export const MIN_POOL = 3

export function currentSeason(date = new Date()) {
  return SEASON_MAP[date.getMonth() + 1]
}

/**
 * The seasons an outfit should suit: the user's preferred seasons from
 * Settings when they set any, otherwise the current calendar season.
 */
export function targetSeasons(preferredSeasons, date = new Date()) {
  return preferredSeasons?.length ? preferredSeasons : [currentSeason(date)]
}

/**
 * Items that suit the target seasons (untagged items suit every season), then
 * narrowed to the occasion when enough items are tagged for it. Falls back to
 * the wider set whenever a filter would leave too few items to build an outfit.
 */
export function outfitCandidates(items, { occasion, preferredSeasons, date } = {}) {
  const all = items ?? []
  const seasons = targetSeasons(preferredSeasons, date)
  const seasonal = all.filter(
    (i) => !i.seasons?.length || i.seasons.some((s) => seasons.includes(s))
  )
  const pool = seasonal.length >= MIN_POOL ? seasonal : all

  const forOccasion = pool.filter(
    (i) => !i.occasions?.length || i.occasions.includes(occasion)
  )
  return forOccasion.length >= 5 ? forOccasion : pool
}
