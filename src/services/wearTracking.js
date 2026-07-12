// Denormalized wear-count tracking — bumps timesWorn/lastWorn on closet items
// whenever an outfit is logged. Piggybacks on ClosetContext's existing
// updateClosetItem() merge-and-persist, so no new Firestore document/rules
// are needed — the fields just ride inside users/{uid}/prefs/closet.

export function recordWear(closetItems, itemIds, updateClosetItem, dateStr) {
  if (!itemIds?.length) return
  const byId = new Map(closetItems.map((item) => [item.id, item]))
  for (const id of itemIds) {
    const item = byId.get(id)
    if (!item) continue // liked/non-closet items aren't wear-tracked
    updateClosetItem(id, {
      timesWorn: (item.timesWorn ?? 0) + 1,
      lastWorn:  dateStr,
    })
  }
}
