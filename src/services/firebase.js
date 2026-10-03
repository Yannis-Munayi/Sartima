import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'
import { getAnalytics, isSupported as isAnalyticsSupported, logEvent } from 'firebase/analytics'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const app = initializeApp(firebaseConfig)
export { app }

export const auth      = getAuth(app)
// Liked/wishlist/shop/closet entries copy optional catalog fields (imageMen,
// image, …) that most products don't have. Without this, setDoc rejects the
// whole write with "Unsupported field value: undefined" — thrown synchronously,
// so it escapes the callers' .catch(). Undefined fields are now just omitted.
export const db        = initializeFirestore(app, { ignoreUndefinedProperties: true })
export const storage   = getStorage(app)
export const functions = getFunctions(app)

export const ANALYTICS_CONSENT_KEY = 'sartima_analytics_consent'

export let analytics = null
export function enableAnalytics() {
  isAnalyticsSupported().then((supported) => {
    if (supported) analytics = getAnalytics(app)
  })
}

export function getAnalyticsConsent() {
  return localStorage.getItem(ANALYTICS_CONSENT_KEY)
}

export function setAnalyticsConsent(granted) {
  localStorage.setItem(ANALYTICS_CONSENT_KEY, granted ? 'granted' : 'denied')
  if (granted) enableAnalytics()
}

if (getAnalyticsConsent() === 'granted') enableAnalytics()

// No-op until consent is granted and isAnalyticsSupported() resolves —
// every call site can fire-and-forget without checking `analytics` itself.
export function trackEvent(name, params) {
  if (!analytics) return
  try {
    logEvent(analytics, name, params)
  } catch {}
}

if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, 'localhost', 5001)
}
