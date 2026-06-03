import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './AuthContext'

const ShopContext = createContext(null)

export function ShopProvider({ children }) {
  const { user } = useAuth()

  // Shop list starts empty — populated from Firestore on sign-in.
  // Guest additions are session-only (cleared on sign-out).
  const [shopList, setShopList] = useState([])
  const [loadReady, setLoadReady] = useState(false)

  const loadedUid = useRef(null)

  // React to auth changes: load on sign-in, clear on sign-out
  useEffect(() => {
    if (!user) {
      setShopList([])
      setLoadReady(false)
      loadedUid.current = null
      return
    }

    if (loadedUid.current === user.uid) return
    loadedUid.current = user.uid
    setLoadReady(false)

    getDoc(doc(db, 'users', user.uid, 'prefs', 'shopList'))
      .then((snap) => {
        const stored = snap.exists() ? (snap.data().items ?? []) : []
        setShopList((current) => {
          const storedIds = new Set(stored.map((e) => e.item?.id))
          const pending   = current.filter((e) => !storedIds.has(e.item?.id))
          return pending.length > 0 ? [...pending, ...stored] : stored
        })
      })
      .catch(() => {})
      .finally(() => setLoadReady(true))
  }, [user])

  // Persist to Firestore — only after the initial load has completed
  useEffect(() => {
    if (!user || !loadReady || loadedUid.current !== user.uid) return
    setDoc(
      doc(db, 'users', user.uid, 'prefs', 'shopList'),
      { items: shopList },
      { merge: true }
    ).catch(() => {})
  }, [shopList, user, loadReady])

  const addToShop = useCallback((item, filters, retailers) => {
    // Strip non-serializable / bulky fields before storing
    const safeItem = {
      id:          item.id,
      name:        item.name,
      description: item.description,
      emoji:       item.emoji,
      gradient:    item.gradient,
      categoryId:  item.categoryId,
      seasons:     item.seasons,
    }

    setShopList((prev) => {
      const entry  = { item: safeItem, filters, retailers, addedAt: Date.now() }
      const exists = prev.findIndex((e) => e.item.id === item.id)
      if (exists !== -1) {
        const next = [...prev]
        next[exists] = entry
        return next
      }
      return [entry, ...prev]
    })
  }, [])

  const removeFromShop = useCallback((itemId) => {
    setShopList((prev) => prev.filter((e) => e.item.id !== itemId))
  }, [])

  const isInShop = useCallback(
    (itemId) => shopList.some((e) => e.item.id === itemId),
    [shopList]
  )

  return (
    <ShopContext.Provider value={{ shopList, addToShop, removeFromShop, isInShop }}>
      {children}
    </ShopContext.Provider>
  )
}

export function useShop() {
  return useContext(ShopContext)
}
