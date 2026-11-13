// What a try-on needs from an item: its photo and its garment category.
// Closet items carry `imageUrl` / `thumbnailUrl` and `category`; catalog
// products (Liked, Brands, Search) carry their photo as `image` and their
// category as `parentType`. Every try-on path reads items through these so
// both shapes work.

export const TRYON_CATEGORIES = ['tops', 'bottoms', 'outerwear', 'dresses']

/** The garment photo to send to the try-on model, or null when the item has none. */
export function garmentPhoto(item) {
  return item?.imageUrl || item?.thumbnailUrl || item?.image || null
}

/** The photo to show for the item in the sheet (prefers the background-removed one). */
export function garmentDisplayPhoto(item) {
  return item?.prettifiedUrl || garmentPhoto(item)
}

/** The item's try-on category ('tops' | 'bottoms' | 'outerwear' | 'dresses'), or null. */
export function garmentCategory(item) {
  const category = item?.category ?? item?.parentType
  return TRYON_CATEGORIES.includes(category) ? category : null
}
