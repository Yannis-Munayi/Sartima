// Starting "healthy capsule" thresholds per closet category, used by useClosetGaps
// to flag categories that are thin or empty. Tunable — these are reasonable
// defaults, not researched targets, and can be adjusted once real usage data
// exists. Not gender-conditional: PRODUCTS recommendations already respect
// gender via existing catalog filters, so the category-count floor doesn't need to.
//
// 'dresses' intentionally has no floor — it's a preference category, not
// something every wardrobe needs, so it should never generate a false gap.
export const CAPSULE_BASELINE = {
  tops:         5,
  bottoms:      3,
  outerwear:    1,
  footwear:     2,
  accessories:  2,
}
