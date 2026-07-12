import { useMemo } from 'react'
import { useCloset } from '../context/ClosetContext'
import { useOutfitLog } from './useOutfitLog'

const RECAP_DAYS = 30

// Aggregates closetItems (wear data from wearTracking.js) + outfitLog entries
// over the trailing 30 days into recap stats — most-worn item, unread
// "closet ghosts" (never worn in the window), unique-items-worn count, and a
// simple repeat-rate signal. Returns null while data is still loading.
export function useWardrobeRecap(user) {
  const { closetItems }       = useCloset()
  const { logEntries }        = useOutfitLog(user)

  return useMemo(() => {
    if (!user || logEntries === null) return null

    const cutoff = Date.now() - RECAP_DAYS * 24 * 60 * 60 * 1000
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
      // % of wear events that were repeats of an already-worn item, not a first wear
      repeatRate: totalWearEvents > 0
        ? Math.round(((totalWearEvents - wornIds.length) / totalWearEvents) * 100)
        : 0,
    }
  }, [user, closetItems, logEntries])
}
