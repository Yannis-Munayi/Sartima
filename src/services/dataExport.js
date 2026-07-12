import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from './firebase'
import { logError } from './logger'

const PREFS_DOCS = ['closet', 'wishlist', 'liked', 'outfitBoards', 'savedAesthetics', 'shopList', 'outfitLog', 'interests']
const SUBCOLLECTIONS = ['quizzes', 'outfitPlans', 'uploadedItems']

function snapToData(snap) {
  return snap.exists() ? snap.data() : null
}

function collectionToArray(snap) {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Excludes prefs/usage and prefs/subscription — internal counters and Stripe
// customer/subscription IDs, not user-facing data.
export async function exportAllUserData(uid) {
  const profileSnap = await getDoc(doc(db, 'users', uid))

  const prefsEntries = await Promise.all(
    PREFS_DOCS.map(async (id) => [id, snapToData(await getDoc(doc(db, 'users', uid, 'prefs', id)))])
  )

  const subcollectionEntries = await Promise.all(
    SUBCOLLECTIONS.map(async (name) => [name, collectionToArray(await getDocs(collection(db, 'users', uid, name)))])
  )

  return {
    profile: snapToData(profileSnap),
    ...Object.fromEntries(prefsEntries),
    ...Object.fromEntries(subcollectionEntries),
    exportedAt: new Date().toISOString(),
  }
}

export async function downloadAllUserData(uid) {
  try {
    const data = await exportAllUserData(uid)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `sartima-data-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    logError('dataExport', 'Failed to export user data', { error: err })
    throw err
  }
}
