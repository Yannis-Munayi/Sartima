// Tracks which month's wardrobe recap the user has already been shown, so
// HomeScreen surfaces it once per month rather than on every visit. Rides in
// users/{uid}/prefs/recapSeen — covered by the generic /prefs/{prefId} rule.

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { logError } from './logger'

const SERVICE  = 'recapSeen'
const PREF_DOC = 'recapSeen'

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7) // "YYYY-MM"
}

export async function hasSeenRecapThisMonth(uid) {
  if (!uid) return true
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'prefs', PREF_DOC))
    return snap.exists() && snap.data().lastShownMonth === currentMonthKey()
  } catch (err) {
    logError(SERVICE, 'Failed to load recap-seen state', { error: err, uid })
    return true // fail closed — don't nag if we can't confirm
  }
}

export async function markRecapSeen(uid) {
  if (!uid) return
  try {
    await setDoc(doc(db, 'users', uid, 'prefs', PREF_DOC), { lastShownMonth: currentMonthKey() }, { merge: true })
  } catch (err) {
    logError(SERVICE, 'Failed to mark recap seen', { error: err, uid })
  }
}
