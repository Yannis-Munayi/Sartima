import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { onSnapshot, doc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './AuthContext'
import { CLIENT_LIMITS, tierFromClaims, isAtLimitFor } from '../services/tierLimits'

const SubscriptionContext = createContext(null)

export function SubscriptionProvider({ children }) {
  const { user } = useAuth()

  const [tier, setTier]               = useState('free')
  const [usage, setUsage]             = useState({})
  const [billing, setBilling]         = useState(null)
  const [paywallFeature, setPaywallFeature] = useState(null)

  // Resolve tier from Firebase custom claims
  const refreshSubscription = useCallback(async () => {
    if (!user) { setTier('free'); return }
    const result = await user.getIdTokenResult(true)
    setTier(tierFromClaims(result.claims))
  }, [user])

  useEffect(() => {
    if (!user) { setTier('free'); setUsage({}); setBilling(null); return }
    // Initial tier resolution (no force-refresh)
    user.getIdTokenResult().then((result) => setTier(tierFromClaims(result.claims)))
    // Returning from Stripe Checkout — drop the flag so a reload doesn't re-trigger it.
    // The claims refresh itself happens below, once the webhook updates the subscription doc.
    if (/[?&](upgrade|pack)=success/.test(window.location.search)) {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash)
    }
    // Live-sync usage counters from Firestore
    const unsubUsage = onSnapshot(
      doc(db, `users/${user.uid}/prefs/usage`),
      (snap) => setUsage((prev) => (snap.exists() ? { ...prev, ...snap.data() } : {})),
      () => {}
    )
    // Live-sync billing state. The webhook sets claims BEFORE writing this doc, so
    // force-refreshing the token on each change picks up upgrades/downgrades immediately.
    const unsubBilling = onSnapshot(
      doc(db, `users/${user.uid}/prefs/subscription`),
      (snap) => {
        if (!snap.exists()) { setBilling(null); return }
        setBilling(snap.data())
        refreshSubscription().catch(() => {})
      },
      () => {}
    )
    return () => { unsubUsage(); unsubBilling() }
  }, [user, refreshSubscription])

  const limits = CLIENT_LIMITS[tier] ?? CLIENT_LIMITS.free
  const isPro  = tier === 'pro' || tier === 'admin'
  // A renewal payment failed; graceEndsAt (ms) is when Pro access stops
  const paymentDue = billing?.status === 'past_due' || billing?.status === 'unpaid'

  function isAtLimit(feature) {
    return isAtLimitFor(tier, usage, feature)
  }

  function openPaywall(feature) {
    setPaywallFeature(feature)
  }

  function closePaywall() {
    setPaywallFeature(null)
  }

  return (
    <SubscriptionContext.Provider value={{
      tier, isPro, limits, usage, billing, paymentDue,
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
