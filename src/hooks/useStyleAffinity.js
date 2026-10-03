import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { useInterests } from '../context/InterestContext'
import { blendStyleAffinities } from '../services/styleRanking'

// The user's aesthetic → 0–1 affinity map that orders the Aesthetics and
// Brands tabs and picks the Search suggestions. Reads the live quiz result
// as well as the persisted interest graph because InterestContext loads once
// per sign-in — without the live scores a quiz finished this session
// wouldn't reorder anything until the next reload. `hasProfile` is false
// until there is any style signal (e.g. guests before their first quiz).
export function useStyleAffinity() {
  const { state }     = useApp()
  const { interests } = useInterests() ?? {}

  const affinity = useMemo(
    () => blendStyleAffinities(state.styleScores, interests?.styleAffinities),
    [state.styleScores, interests],
  )

  return { affinity, interests, hasProfile: Object.keys(affinity).length > 0 }
}
