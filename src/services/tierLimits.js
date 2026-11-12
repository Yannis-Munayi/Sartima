// Client-side plan limits. These are UX only — the Cloud Functions re-check
// every metered action (see TIER_LIMITS in functions/index.js). Pure, so
// SubscriptionContext and tests share one implementation.

export const CLIENT_LIMITS = {
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

/** Custom claims (sartima_role / sartima_tier) → 'free' | 'pro' | 'admin'. */
export function tierFromClaims(claims) {
  if (claims?.sartima_role === 'admin') return 'admin'
  if (claims?.sartima_tier === 'pro') return 'pro'
  return 'free'
}

/**
 * Whether `feature` is used up for this tier, given the usage doc
 * (users/{uid}/prefs/usage). Monthly counters count as 0 once periodKey
 * (YYYY-MM) is from an earlier month; outfitGenerations is a per-day gate.
 */
export function isAtLimitFor(tier, usage, feature, now = new Date()) {
  if (tier === 'admin') return false
  const limits = CLIENT_LIMITS[tier] ?? CLIENT_LIMITS.free
  const limit = limits[feature]
  if (limit === Infinity || limit == null) return false

  if (feature === 'outfitGenerations') {
    const todayStr = now.toISOString().slice(0, 10)
    return tier === 'free' && usage?.lastOutfitDate === todayStr
  }
  const period = now.toISOString().slice(0, 7)
  const count  = usage?.periodKey !== period ? 0 : (usage?.[feature] ?? 0)
  return count >= limit
}
