// Merge-writes a users/{uid}/prefs/{docId} document without ever throwing.
// The persisted contexts (Wishlist, Shop, Closet, Explore) call this from
// effects. setDoc validates its payload synchronously, so a bad value throws
// before any promise exists. A bare .catch() misses that, and an uncaught throw
// inside an effect takes down the whole React tree via the error boundary.

import { doc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { logError } from './logger'

const SERVICE = 'prefsDoc'

export async function savePrefsDoc(uid, docId, data) {
  if (!uid) return
  try {
    await setDoc(doc(db, 'users', uid, 'prefs', docId), data, { merge: true })
  } catch (err) {
    logError(SERVICE, `Failed to save prefs/${docId}`, { error: err, uid })
  }
}
