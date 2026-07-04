import { fetchPhotos as fetchGooglePhotos } from './google'
import { fetchPhotosWithFallback } from './pexels'

// `image` is the default/women's curated photo; `imageMen` is an optional
// alternate curated photo shown for unisex products when relevant.
export async function resolveProductImage(item, gender = 'both') {
  const curated = gender === 'men' && item.imageMen ? item.imageMen : item.image
  if (curated) return curated

  if (item.googleQuery) {
    const results = await fetchGooglePhotos(item.googleQuery, 1)
    if (results.length > 0) return results[0]
  }
  const [url] = await fetchPhotosWithFallback([item.pexelsQuery ?? item.name], 1)
  return url ?? null
}

// Returns the alternate curated photo to offer as a tap-to-swap toggle, or
// null when there's nothing to swap to (only relevant when both a curated
// `image` and `imageMen` exist and the gender filter isn't narrowed to one).
export function getAltProductImage(item, gender = 'both') {
  if (gender !== 'both') return null
  if (!item.image || !item.imageMen) return null
  return item.imageMen
}
