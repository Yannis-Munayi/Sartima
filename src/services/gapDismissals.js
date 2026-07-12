// Per-category dismissal state for the Home-screen wardrobe-gap card.
// Rides in users/{uid}/prefs/gapDismissals — already covered by the generic
// /prefs/{prefId} Firestore rule, no rules change needed.

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { logError } from './logger'

const SERVICE       = 'gapDismissals'
const PREF_DOC       = 'gapDismissals'
const SNOOZE_DAYS    = 14

function ref(uid) {
  return doc(db, 'users', uid, 'prefs', PREF_DOC)
}

export async function dismissGap(uid, category) {
  if (!uid || !category) return
  try {
    await setDoc(ref(uid), { [category]: Date.now() }, { merge: true })
  } catch (err) {
    logError(SERVICE, 'Failed to dismiss gap', { error: err, uid, category })
  }
}

// Returns the set of categories currently snoozed (dismissed within the last
// SNOOZE_DAYS days).
export async function loadDismissedCategories(uid) {
  if (!uid) return new Set()
  try {
    const snap = await getDoc(ref(uid))
    if (!snap.exists()) return new Set()
    const data   = snap.data()
    const cutoff = Date.now() - SNOOZE_DAYS * 24 * 60 * 60 * 1000
    return new Set(
      Object.entries(data)
        .filter(([, dismissedAt]) => dismissedAt > cutoff)
        .map(([category]) => category)
    )
  } catch (err) {
    logError(SERVICE, 'Failed to load gap dismissals', { error: err, uid })
    return new Set()
  }
}
