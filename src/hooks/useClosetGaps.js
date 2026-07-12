import { useMemo } from 'react'
import { useCloset } from '../context/ClosetContext'
import { CAPSULE_BASELINE } from '../data/capsuleBaseline'

// Cheap, instant "what's missing" signal — no AI call needed. Diffs the
// closet's per-category counts against CAPSULE_BASELINE and ranks the
// biggest deficits first. A category can also be bumped/added on top of
// this baseline result (e.g. by anthropicOutfit's missingCategory flag)
// without needing a second, separate gaps concept.
export function useClosetGaps(extraSeverity = {}) {
  const { closetByCategory } = useCloset()

  return useMemo(() => {
    const gaps = Object.entries(CAPSULE_BASELINE)
      .map(([category, target]) => {
        const owned  = closetByCategory[category]?.length ?? 0
        const bump   = extraSeverity[category] ?? 0
        const deficit = Math.max(0, target - owned) + bump
        return { category, owned, target, deficit }
      })
      .filter((g) => g.deficit > 0)
      .sort((a, b) => b.deficit - a.deficit)

    return gaps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closetByCategory, JSON.stringify(extraSeverity)])
}
