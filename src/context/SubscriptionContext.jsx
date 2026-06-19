import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { onSnapshot, doc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './AuthContext'

const CLIENT_LIMITS = {
  free: {
    visionUploads:    3,
    tripPlans:        0,
    tryOns:           0,
    closetItems:      15,
    aestheticPins:    3,
    likedItems:       50,
    outfitBoards:     1,
    outfitGenerations: 1, // per day; checked client-side against lastOutfitDate
  },
  pro: {
    visionUploads:    30,
    tripPlans:        3,
    tryOns:           30,
    closetItems:      Infinity,
    aestheticPins:    Infinity,
    likedItems:       Infinity,
    outfitBoards:     Infinity,
    outfitGenerations: Infinity,
  },
  admin: {
    visionUploads:    Infinity,
    tripPlans:        Infinity,
    tryOns:           Infinity,
    closetItems:      Infinity,
    aestheticPins:    Infinity,
    likedItems:       Infinity,
    outfitBoards:     Infinity,
    outfitGenerations: Infinity,
  },
}

const SubscriptionContext = createContext(null)

export function SubscriptionProvider({ children }) {
  const { user } = useAuth()

  const [tier, setTier]               = useState('free')
  const [usage, setUsage]             = useState({})
  const [paywallFeature, setPaywallFeature] = useState(null)

  // Resolve tier from Firebase custom claims
  const refreshSubscription = useCallback(async () => {
    if (!user) { setTier('free'); return }
    const result = await user.getIdTokenResult(true)
    const claims = result.claims
    if (claims.sartima_role === 'admin') setTier('admin')
    else if (claims.sartima_tier === 'pro') setTier('pro')
    else setTier('free')
  }, [user])

  useEffect(() => {
    if (!user) { setTier('free'); setUsage({}); return }
    // Initial tier resolution (no force-refresh)
    user.getIdTokenResult().then((result) => {
      const claims = result.claims
      if (claims.sartima_role === 'admin') setTier('admin')
      else if (claims.sartima_tier === 'pro') setTier('pro')
      else setTier('free')
    })
    // Watch for ?upgrade=success in URL — force-refresh token to pick up new claims
    if (window.location.search.includes('upgrade=success')) {
      refreshSubscription()
    }
    // Live-sync usage counters from Firestore
    const unsub = onSnapshot(
      doc(db, `users/${user.uid}/prefs/usage`),
      (snap) => setUsage(snap.exists() ? snap.data() : {}),
      () => {}
    )
    return unsub
  }, [user, refreshSubscription])

  const limits = CLIENT_LIMITS[tier] ?? CLIENT_LIMITS.free
  const isPro  = tier === 'pro' || tier === 'admin'

  function isAtLimit(feature) {
    if (tier === 'admin') return false
    const limit = limits[feature]
    if (limit === Infinity || limit == null) return false

    if (feature === 'outfitGenerations') {
      const todayStr = new Date().toISOString().slice(0, 10)
      return tier === 'free' && usage.lastOutfitDate === todayStr
    }
    const used = usage[feature] ?? 0
    // Monthly counter resets when periodKey changes
    const period   = new Date().toISOString().slice(0, 7)
    const isNewPeriod = usage.periodKey !== period
    const count = isNewPeriod ? 0 : used
    return count >= limit
  }

  function openPaywall(feature) {
    setPaywallFeature(feature)
  }

  function closePaywall() {
    setPaywallFeature(null)
  }

  return (
    <SubscriptionContext.Provider value={{
      tier, isPro, limits, usage,
      isAtLimit, openPaywall, closePaywall, paywallFeature,
      refreshSubscription,
    }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  return useContext(SubscriptionContext)
}
