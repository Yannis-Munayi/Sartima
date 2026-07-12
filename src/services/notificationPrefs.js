// Persists FCM tokens + reminder preferences. Rides in
// users/{uid}/prefs/notifications — already covered by the generic
// /prefs/{prefId} Firestore rule, no rules change needed. The Cloud
// Scheduler function (sendDailyOutfitReminders) reads this via a
// collection-group query with the Admin SDK, which bypasses rules entirely.

import { doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore'
import { db } from './firebase'
import { logError } from './logger'

const SERVICE  = 'notificationPrefs'
const PREF_DOC = 'notifications'

function ref(uid) {
  return doc(db, 'users', uid, 'prefs', PREF_DOC)
}

export async function loadNotificationPrefs(uid) {
  if (!uid) return null
  try {
    const snap = await getDoc(ref(uid))
    return snap.exists() ? snap.data() : null
  } catch (err) {
    logError(SERVICE, 'Failed to load notification prefs', { error: err, uid })
    return null
  }
}

export async function saveNotificationToken(uid, token, reminderTime, timezone) {
  if (!uid || !token) return
  try {
    await setDoc(ref(uid), {
      fcmTokens:    arrayUnion(token),
      reminderTime: reminderTime ?? '08:00',
      timezone:     timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      enabled:      true,
      updatedAt:    Date.now(),
    }, { merge: true })
  } catch (err) {
    logError(SERVICE, 'Failed to save notification token', { error: err, uid })
  }
}

export async function saveReminderTime(uid, reminderTime, timezone) {
  if (!uid) return
  try {
    await setDoc(ref(uid), {
      reminderTime,
      timezone: timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      updatedAt: Date.now(),
    }, { merge: true })
  } catch (err) {
    logError(SERVICE, 'Failed to save reminder time', { error: err, uid })
  }
}

export async function disableNotifications(uid) {
  if (!uid) return
  try {
    await setDoc(ref(uid), { enabled: false, updatedAt: Date.now() }, { merge: true })
  } catch (err) {
    logError(SERVICE, 'Failed to disable notifications', { error: err, uid })
  }
}
