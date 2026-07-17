import { useEffect, useMemo } from 'react'
import { useApp, useAdaptiveTheme } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useInterests } from '../context/InterestContext'
import { AESTHETIC_FLAVORS, resolveAestheticFlavor } from '../data/aestheticThemes'

const FLAVOR_CACHE_KEY = 'sartima_aesthetic_flavor'

// Mirrors the user's #1 aesthetic onto :root as `data-aesthetic` so
// aestheticThemes.css can restyle fonts, accents and radii. The resolved
// flavor is cached in localStorage and re-applied by the inline script in
// index.html before first paint, so returning users never see a flash of
// the default branding. Call once at the app root (AppShell).
export function useAestheticFlavor() {
  const { state }                     = useApp()
  const { user }                      = useAuth()
  const { interests }                 = useInterests()
  const { adaptiveTheme, flavorPin }  = useAdaptiveTheme()

  const resolved = useMemo(() => {
    // A pinned flavor beats the derived one (and works without any quiz signal)
    if (flavorPin && AESTHETIC_FLAVORS[flavorPin]) {
      return { styleId: null, flavorId: flavorPin, pinned: true }
    }
    return resolveAestheticFlavor(state.styleScores, interests?.styleAffinities)
  }, [flavorPin, state.styleScores, interests])

  useEffect(() => {
    const root = document.documentElement
    if (!adaptiveTheme) {
      root.removeAttribute('data-aesthetic')
      localStorage.removeItem(FLAVOR_CACHE_KEY)
      return
    }
    if (resolved) {
      root.setAttribute('data-aesthetic', resolved.flavorId)
      localStorage.setItem(FLAVOR_CACHE_KEY, resolved.flavorId)
      return
    }
    // No signal yet. While a signed-in user's interest graph is still loading
    // (interests === null), keep whatever the boot script applied from cache
    // to avoid flashing back to default. Otherwise there genuinely is no top
    // aesthetic — clear any stale flavor.
    if (!user || interests !== null) {
      root.removeAttribute('data-aesthetic')
      localStorage.removeItem(FLAVOR_CACHE_KEY)
    }
  }, [adaptiveTheme, resolved, user, interests])

  return resolved
}
