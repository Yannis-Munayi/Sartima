import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../services/firebase'

// Extracted from DailyLookScreen so useWardrobeRecap (a second consumer) can
// share it instead of duplicating the fetch.
export function useOutfitLog(user) {
  const [logEntries, setLogEntries] = useState(null)
  useEffect(() => {
    if (!user) return
    getDoc(doc(db, 'users', user.uid, 'prefs', 'outfitLog'))
      .then((snap) => setLogEntries(snap.exists() ? (snap.data().entries ?? []) : []))
      .catch(() => setLogEntries([]))
  }, [user])
  return { logEntries }
}
