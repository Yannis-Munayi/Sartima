import { fetchPhotosWithFallback } from './stockPhotos'

// `image` is the default/women's curated photo; `imageMen` is an optional
// alternate curated photo shown for unisex products when relevant. Without a
// curated photo, fall back to stock photography (Unsplash, then Pexels).
export async function resolveProductImage(item, gender = 'both') {
  const curated = gender === 'men' && item.imageMen ? item.imageMen : item.image
  if (curated) return curated

  const [url] = await fetchPhotosWithFallback([stockQuery(item)], 1)
  return url ?? null
}

function stockQuery(item) {
  return item.pexelsQuery ?? item.name
}

// Whether a card offers the men's/women's photo swap. Only with the gender
// filter on "Both" (a narrowed filter already picks the side). Products with
// both curated photos swap between them. Unisex products with no curated photo
// swap to gendered stock photos, fetched only when tapped. A product with a
// curated `image` and no `imageMen` keeps its real photo and gets no swap.
export function canSwapGenderPhoto(item, gender = 'both') {
  if (gender !== 'both' || !item) return false
  if (item.image && item.imageMen) return true
  return !item.image && item.gender === 'unisex'
}

// The photo for one side of the swap ('men' | 'women'), or null when none
// was found. Stock lookups go through fetchPhotos, so they share its
// in-memory and 7-day localStorage caches.
export async function resolveGenderPhoto(item, side) {
  if (side === 'men' && item.imageMen) return item.imageMen
  if (side === 'women' && item.image) return item.image
  const [url] = await fetchPhotosWithFallback([`${side} ${stockQuery(item)}`], 1)
  return url ?? null
}
