import { CAPSULE_BASELINE } from '../data/capsuleBaseline'

/**
 * Diffs per-category closet counts against the capsule baseline and ranks the
 * biggest deficits first. `extraSeverity` ({ category: n }) bumps a category
 * on top of the baseline — e.g. AI outfit `missingCategory` signals.
 * Pure; useClosetGaps memoises it over the closet context.
 */
export function computeClosetGaps(closetByCategory, extraSeverity = {}, baseline = CAPSULE_BASELINE) {
  return Object.entries(baseline)
    .map(([category, target]) => {
      const owned   = closetByCategory?.[category]?.length ?? 0
      const bump    = extraSeverity?.[category] ?? 0
      const deficit = Math.max(0, target - owned) + bump
      return { category, owned, target, deficit }
    })
    .filter((g) => g.deficit > 0)
    .sort((a, b) => b.deficit - a.deficit)
}
