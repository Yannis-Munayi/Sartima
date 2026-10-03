import { useEffect, useRef } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { useCloset } from '../context/ClosetContext'
import { useWishlist } from '../context/WishlistContext'
import { useSubscription } from '../context/SubscriptionContext'
import { useApp } from '../context/AppContext'
import { useInterests } from '../context/InterestContext'
import { PRODUCTS } from '../data/products'
import { STYLES } from '../data/styles'
import { CAPSULE_BASELINE } from '../data/capsuleBaseline'
import { installHubBridge, parseOrigins } from '../services/hubBridge'
import { sartimaHubActions } from '../services/hubActions'
import { recordWear } from '../services/wearTracking'

const MAX_LOG_ENTRIES = 200 // TodayTab's cap
// The hub also answers on other addresses (its phone address over Tailscale); list them in VITE_HUB_ORIGINS.
const HUB_ORIGINS = parseOrigins(import.meta.env.VITE_HUB_ORIGINS)

async function logOutfit(user, entry) {
  const ref = doc(db, 'users', user.uid, 'prefs', 'outfitLog')
  const snap = await getDoc(ref)
  const entries = snap.exists() ? (snap.data().entries ?? []) : []
  await setDoc(ref, { entries: [entry, ...entries].slice(0, MAX_LOG_ENTRIES) }, { merge: true })
}

// Answers the Jarvis hub when it shows Sartima in a frame (services/hubBridge.js). Renders nothing, and does
// nothing when Sartima is opened on its own. Mounted inside every data provider so the actions see the same
// closet, wishlist and plan the screens do.
export default function HubBridge() {
  const ctx = {
    user: useAuth().user,
    closet: useCloset(),
    wishlist: useWishlist(),
    subscription: useSubscription(),
    app: useApp(),
    interests: useInterests().interests,
  }
  const latest = useRef(ctx)
  useEffect(() => { latest.current = ctx })

  useEffect(() => {
    if (window.parent === window) return
    return installHubBridge(sartimaHubActions({
      get: () => latest.current,
      catalog: PRODUCTS,
      styles: STYLES,
      baseline: CAPSULE_BASELINE,
      logOutfit,
      recordWear,
    }), window, { origins: HUB_ORIGINS })
  }, [])

  return null
}
