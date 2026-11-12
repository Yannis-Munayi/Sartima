import { useMemo } from 'react'
import { useCloset } from '../context/ClosetContext'
import { computeClosetGaps } from '../services/closetGaps'

// Cheap, instant "what's missing" signal — no AI call needed. Diffs the
// closet's per-category counts against CAPSULE_BASELINE and ranks the
// biggest deficits first. A category can also be bumped/added on top of
// this baseline result (e.g. by anthropicOutfit's missingCategory flag)
// without needing a second, separate gaps concept.
export function useClosetGaps(extraSeverity = {}) {
  const { closetByCategory } = useCloset()

  return useMemo(
    () => computeClosetGaps(closetByCategory, extraSeverity),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [closetByCategory, JSON.stringify(extraSeverity)],
  )
}
