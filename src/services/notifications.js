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
 * permission if needed, and returns an FCM registration token — or null if
 * unsupported, denied, or misconfigured (missing VAPID key).
 */
export async function requestNotificationToken() {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return null

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
  if (!vapidKey) {
    logWarn(SERVICE, 'VITE_FIREBASE_VAPID_KEY is not set — generate one in Firebase Console → Cloud Messaging')
    return null
  }

  const messaging = await getMessagingInstance()
  if (!messaging) return null

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    const registration = await navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE })
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })
    return token ?? null
  } catch (err) {
    logError(SERVICE, 'Failed to acquire FCM token', { error: err })
    return null
  }
}

export async function onForegroundMessage(callback) {
  const messaging = await getMessagingInstance()
  if (!messaging) return () => {}
  return onMessage(messaging, callback)
}
