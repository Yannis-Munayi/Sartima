import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './AuthContext'

const ShopContext = createContext(null)

export function ShopProvider({ children }) {
  const { user } = useAuth()

  // shopList — items saved via ShopPanel (item type + filters + retailer list)
  // scoutedGroups — product groups saved by Shop Scout (piece + budget + up to 10 products)
  const [shopList,      setShopList]      = useState([])
  const [scoutedGroups, setScoutedGroups] = useState([])
  const [loadReady,     setLoadReady]     = useState(false)

  const loadedUid = useRef(null)

  // React to auth changes: load on sign-in, clear on sign-out
  useEffect(() => {
    if (!user) {
      setShopList([])
      setScoutedGroups([])
      setLoadReady(false)
      loadedUid.current = null
      return
    }

    if (loadedUid.current === user.uid) return
    loadedUid.current = user.uid
    setLoadReady(false)

    getDoc(doc(db, 'users', user.uid, 'prefs', 'shopList'))
      .then((snap) => {
        const data         = snap.exists() ? snap.data() : {}
        const storedItems  = data.items         ?? []
        const storedGroups = data.scoutedGroups ?? []

        setShopList((current) => {
          const storedIds = new Set(storedItems.map((e) => e.item?.id))
          const pending   = current.filter((e) => !storedIds.has(e.item?.id))
          return pending.length > 0 ? [...pending, ...storedItems] : storedItems
        })

        setScoutedGroups((current) => {
          const storedIds = new Set(storedGroups.map((g) => g.id))
          const pending   = current.filter((g) => !storedIds.has(g.id))
          return pending.length > 0 ? [...pending, ...storedGroups] : storedGroups
        })
      })
      .catch(() => {})
      .finally(() => setLoadReady(true))
  }, [user])

  // Persist both lists to Firestore — only after initial load completes
  useEffect(() => {
    if (!user || !loadReady || loadedUid.current !== user.uid) return
    setDoc(
      doc(db, 'users', user.uid, 'prefs', 'shopList'),
      { items: shopList, scoutedGroups },
      { merge: true }
    ).catch(() => {})
  }, [shopList, scoutedGroups, user, loadReady])

  // ── ShopPanel items ───────────────────────────────────────────────────────

  const addToShop = useCallback((item, filters, retailers) => {
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

  // ── Scout result groups ───────────────────────────────────────────────────
  // group shape: { id, pieceId, pieceName, emoji, budgetTier, budgetLabel, products, savedAt }
  // products shape (stripped for Firestore): { id, brand, name, description, shopUrl, shopFallbackUrl, googleQuery, priceRange }

  const addScoutedGroup = useCallback((group) => {
    setScoutedGroups((prev) => {
      const exists = prev.findIndex((g) => g.id === group.id)
      if (exists !== -1) {
        const next = [...prev]
        next[exists] = group
        return next
      }
      return [group, ...prev]
    })
  }, [])

  const removeScoutedGroup = useCallback((groupId) => {
    setScoutedGroups((prev) => prev.filter((g) => g.id !== groupId))
  }, [])

  return (
    <ShopContext.Provider value={{
      shopList, addToShop, removeFromShop, isInShop,
      scoutedGroups, addScoutedGroup, removeScoutedGroup,
    }}>
      {children}
    </ShopContext.Provider>
  )
}

export function useShop() {
  return useContext(ShopContext)
}
