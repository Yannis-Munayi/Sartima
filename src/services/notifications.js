// Push notification setup — FCM token acquisition + a dedicated-scope service
// worker registration so it coexists with vite-plugin-pwa's root-scope
// Workbox SW. iOS Safari only delivers web push to a PWA that's been added to
// the home screen (standalone display mode); isIOSStandaloneRequired() lets
// the UI gate accordingly instead of silently failing.

import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'
import { app } from './firebase'
import { logError, logWarn } from './logger'

const SERVICE = 'notifications'
const SW_PATH  = '/firebase-messaging-sw.js'
const SW_SCOPE = '/firebase-cloud-messaging-push-scope'

// The VAPID key is the *public* half of the web-push key pair (it is handed
// to every browser as applicationServerKey), so like the Firebase config in
// firebase-messaging-sw.js it is safe to ship. The env var still overrides
// it; the fallback exists because a deploy without the env var compiled
// requestNotificationToken() down to a silent no-op.
const PUBLIC_VAPID_KEY = 'BJYuaAfFokt-rTnjoulxoTSRh_IjQ-02dAwxzT5hxiPzV4T6PENpp5eulILPs4bX20Hb12UdS8M2ziK-OH_Faco'

let messagingInstance = null

export async function isMessagingSupported() {
  try {
    return await isSupported()
  } catch {
    return false
  }
}

async function getMessagingInstance() {
  if (messagingInstance) return messagingInstance
  if (!(await isMessagingSupported())) return null
  messagingInstance = getMessaging(app)
  return messagingInstance
}

/**
 * Registers the dedicated FCM service worker, requests notification
 * permission if needed, and resolves to `{ token, reason }`. On success
 * `token` is the FCM registration token and `reason` is null; otherwise
 * `token` is null and `reason` is one of 'unsupported' | 'denied' | 'error',
 * so the UI can tell the user why instead of silently doing nothing.
 */
export async function requestNotificationToken() {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    return { token: null, reason: 'unsupported' }
  }

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || PUBLIC_VAPID_KEY

  const messaging = await getMessagingInstance()
  if (!messaging) {
    logWarn(SERVICE, 'Firebase Messaging is not supported in this browser')
    return { token: null, reason: 'unsupported' }
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { token: null, reason: 'denied' }

    const registration = await navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE })
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })
    return token ? { token, reason: null } : { token: null, reason: 'error' }
  } catch (err) {
    logError(SERVICE, 'Failed to acquire FCM token', { error: err })
    return { token: null, reason: 'error' }
  }
}

export async function onForegroundMessage(callback) {
  const messaging = await getMessagingInstance()
  if (!messaging) return () => {}
  return onMessage(messaging, callback)
}
