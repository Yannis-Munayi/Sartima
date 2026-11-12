export const RECAP_DAYS = 30

/**
 * Recap stats over the trailing 30 days: most-worn item, "closet ghosts"
 * (never worn in the window), unique items worn, and the repeat rate — the
 * % of wear events that re-wore an item already worn in the window.
 * Pure; useWardrobeRecap memoises it over the closet and outfit log.
 */
export function computeWardrobeRecap(closetItems, logEntries, now = Date.now()) {
  const cutoff = now - RECAP_DAYS * 24 * 60 * 60 * 1000
  const recentEntries = logEntries.filter((e) => {
    const t = new Date(e.date).getTime()
    return !Number.isNaN(t) && t >= cutoff
  })

  const wornCounts = {}
  let totalWearEvents = 0
  for (const entry of recentEntries) {
    for (const id of entry.itemIds ?? []) {
      wornCounts[id] = (wornCounts[id] ?? 0) + 1
      totalWearEvents += 1
    }
  }

  const wornIds = Object.keys(wornCounts)
  const mostWornId = wornIds.sort((a, b) => wornCounts[b] - wornCounts[a])[0] ?? null
  const mostWornItem = mostWornId ? (closetItems.find((i) => i.id === mostWornId) ?? null) : null

  const ghostItems = closetItems.filter((i) => !wornCounts[i.id])

  return {
    periodDays:       RECAP_DAYS,
    outfitsLogged:    recentEntries.length,
    uniqueItemsWorn:  wornIds.length,
    totalClosetItems: closetItems.length,
    mostWornItem,
    mostWornCount:    mostWornId ? wornCounts[mostWornId] : 0,
    ghostItems:       ghostItems.slice(0, 6),
    ghostCount:       ghostItems.length,
    repeatRate: totalWearEvents > 0
      ? Math.round(((totalWearEvents - wornIds.length) / totalWearEvents) * 100)
      : 0,
  }
}
