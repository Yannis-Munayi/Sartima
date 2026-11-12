import { useMemo } from 'react'
import { useCloset } from '../context/ClosetContext'
import { useOutfitLog } from './useOutfitLog'
import { computeWardrobeRecap } from '../services/wardrobeRecap'

// Aggregates closetItems (wear data from wearTracking.js) + outfitLog entries
// over the trailing 30 days into recap stats — see computeWardrobeRecap.
// Returns null while data is still loading.
export function useWardrobeRecap(user) {
  const { closetItems }       = useCloset()
  const { logEntries }        = useOutfitLog(user)

  return useMemo(() => {
    if (!user || logEntries === null) return null
    return computeWardrobeRecap(closetItems, logEntries)
  }, [user, closetItems, logEntries])
}
