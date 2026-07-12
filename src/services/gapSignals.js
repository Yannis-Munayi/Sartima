// Persists "missingCategory" hits from AI outfit generation so the Home-screen
// gap card (useClosetGaps) can factor everyday outfit failures in alongside
// the static capsule-baseline deficit — one coherent gaps surface, two triggers.
// Rides in users/{uid}/prefs/gapSignals — already covered by the generic
// /prefs/{prefId} Firestore rule, no rules change needed.

import { doc, getDoc, setDoc, increment, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { logError } from './logger'

const SERVICE  = 'gapSignals'
const PREF_DOC = 'gapSignals'

function ref(uid) {
  return doc(db, 'users', uid, 'prefs', PREF_DOC)
}

export async function recordGapSignal(uid, category) {
  if (!uid || !category) return
  try {
    await setDoc(ref(uid), {
      [category]: { count: increment(1), lastSeenAt: serverTimestamp() },
    }, { merge: true })
  } catch (err) {
    logError(SERVICE, 'Failed to record gap signal', { error: err, uid, category })
  }
}

// Returns a plain { [category]: count } map suitable for useClosetGaps'
// extraSeverity argument.
export async function loadGapSignals(uid) {
  if (!uid) return {}
  try {
    const snap = await getDoc(ref(uid))
    if (!snap.exists()) return {}
    const data = snap.data()
    return Object.fromEntries(
      Object.entries(data).map(([category, v]) => [category, v?.count ?? 0])
    )
  } catch (err) {
    logError(SERVICE, 'Failed to load gap signals', { error: err, uid })
    return {}
  }
}
