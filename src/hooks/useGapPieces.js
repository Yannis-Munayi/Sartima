import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCloset } from '../context/ClosetContext'
import { useClosetGaps } from './useClosetGaps'
import { useGapSignals } from './useGapSignals'
import { loadDismissedCategories } from '../services/gapDismissals'
import { gapPieceOption } from '../services/wardrobeRecommend'

// Below this the closet is more likely un-uploaded than genuinely short
// (same floor the app uses before offering daily AI outfits)
const MIN_CLOSET_ITEMS = 3

/**
 * Shop Scout pieces for the categories the user's closet is short on,
 * biggest gap first: [{ piece, gap: { category, owned, target, deficit } }].
 * Uses the same gaps as the Home bell (closet vs. capsule baseline plus
 * outfit-generation misses) and honours categories dismissed there.
 */
export function useGapPieces({ affinity, interests, gender }) {
  const { user }                         = useAuth()
  const { closetItems, closetByCategory } = useCloset()
  const gapSignals                       = useGapSignals()
  const gaps                             = useClosetGaps(gapSignals)
  const [dismissed, setDismissed]        = useState(() => new Set())

  useEffect(() => {
    if (!user) { setDismissed(new Set()); return }
    let cancelled = false
    loadDismissedCategories(user.uid).then((set) => { if (!cancelled) setDismissed(set) })
    return () => { cancelled = true }
  }, [user])

  return useMemo(() => {
    if (!user || closetItems.length < MIN_CLOSET_ITEMS) return []
    const result = []
    for (const gap of gaps) {
      if (dismissed.has(gap.category)) continue
      const ownedNames = (closetByCategory[gap.category] ?? []).map((item) => item.name?.toLowerCase() ?? '')
      const piece = gapPieceOption(gap.category, affinity, interests, gender, ownedNames)
      if (piece && !result.some((r) => r.piece.id === piece.id)) result.push({ piece, gap })
    }
    return result
  }, [user, closetItems.length, closetByCategory, gaps, dismissed, affinity, interests, gender])
}
