import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { loadGapSignals } from '../services/gapSignals'

// Loads the persisted missingCategory hit-counts from outfit generation,
// shaped for useClosetGaps' extraSeverity argument.
export function useGapSignals() {
  const { user } = useAuth()
  const [signals, setSignals] = useState({})

  useEffect(() => {
    if (!user) { setSignals({}); return }
    let cancelled = false
    loadGapSignals(user.uid).then((s) => { if (!cancelled) setSignals(s) })
    return () => { cancelled = true }
  }, [user])

  return signals
}
