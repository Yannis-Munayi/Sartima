import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { savePrefsDoc } from '../services/prefsDoc'
import { useAuth } from './AuthContext'
import { showToast } from '../components/Toast'
import { useSubscription } from './SubscriptionContext'
import { recordSignal } from '../services/interestTracker'

const WishlistContext = createContext(null)

function usePersistedList(user, docId) {
  const [list, setList]         = useState([])
  const [loadReady, setReady]   = useState(false)
  const loadedUid               = useRef(null)

  useEffect(() => {
    if (!user) { setList([]); setReady(false); loadedUid.current = null; return }
    if (loadedUid.current === user.uid) return
    loadedUid.current = user.uid
    setReady(false)
    getDoc(doc(db, 'users', user.uid, 'prefs', docId))
      .then((snap) => {
        const stored = snap.exists() ? (snap.data().items ?? []) : []
        setList((current) => {
          const storedIds = new Set(stored.map((i) => i.id))
          const pending   = current.filter((i) => !storedIds.has(i.id))
          return pending.length > 0 ? [...pending, ...stored] : stored
        })
      })
      .catch(() => {})
      .finally(() => setReady(true))
  }, [user, docId])

  useEffect(() => {
    if (!user || !loadReady || loadedUid.current !== user.uid) return
    savePrefsDoc(user.uid, docId, { items: list })
  }, [list, user, loadReady, docId])

  return [list, setList]
}

export function WishlistProvider({ children }) {
  const { user } = useAuth()
  const { isPro, limits, openPaywall } = useSubscription()
  const [wishlist,      setWishlist]      = usePersistedList(user, 'wishlist')
  const [liked,         setLiked]         = usePersistedList(user, 'liked')
  const [outfitBoards,  setOutfitBoards]  = usePersistedList(user, 'outfitBoards')

  const addToWishlist = useCallback((entry) => {
    if (!wishlist.some((e) => e.id === entry.id)) {
      recordSignal(user, 'save', { product: entry })
    }
    setWishlist((prev) => {
      if (prev.some((e) => e.id === entry.id)) return prev
      showToast('Saved to wishlist')
      return [{ ...entry, addedAt: Date.now() }, ...prev]
    })
  }, [setWishlist, wishlist, user])

  const removeFromWishlist = useCallback((id) => {
    setWishlist((prev) => prev.filter((e) => e.id !== id))
    showToast('Removed from wishlist')
  }, [setWishlist])

  const isWishlisted = useCallback((id) => wishlist.some((e) => e.id === id), [wishlist])

  const addToLiked = useCallback((entry) => {
    if (!isPro && liked.length >= limits.likedItems) { openPaywall('likedItems'); return }
    if (!liked.some((e) => e.id === entry.id)) {
      recordSignal(user, 'like', { product: entry })
    }
    setLiked((prev) => {
      if (prev.some((e) => e.id === entry.id)) return prev
      showToast('Added to liked')
      return [{ ...entry, addedAt: Date.now() }, ...prev]
    })
  }, [setLiked, isPro, liked, limits, openPaywall, user])

  const removeFromLiked = useCallback((id) => {
    setLiked((prev) => prev.filter((e) => e.id !== id))
    showToast('Removed')
  }, [setLiked])

  const isLiked = useCallback((id) => liked.some((e) => e.id === id), [liked])

  const saveOutfitBoard = useCallback((board) => {
    setOutfitBoards((prev) => {
      const exists = prev.findIndex((b) => b.id === board.id)
      if (exists >= 0) {
        // updating existing board — always allowed
        const next = [...prev]
        next[exists] = board
        return next
      }
      // creating a new board — check limit
      if (!isPro && prev.length >= limits.outfitBoards) { openPaywall('outfitBoards'); return prev }
      return [board, ...prev]
    })
  }, [setOutfitBoards, isPro, limits, openPaywall])

  const deleteOutfitBoard = useCallback((id) => {
    setOutfitBoards((prev) => prev.filter((b) => b.id !== id))
  }, [setOutfitBoards])

  return (
    <WishlistContext.Provider value={{
      wishlist, addToWishlist, removeFromWishlist, isWishlisted,
      liked,    addToLiked,    removeFromLiked,    isLiked,
      outfitBoards, saveOutfitBoard, deleteOutfitBoard,
    }}>
      {children}
    </WishlistContext.Provider>
  )
}

export function useWishlist() {
  return useContext(WishlistContext)
}
