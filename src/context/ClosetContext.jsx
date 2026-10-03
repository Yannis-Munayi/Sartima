import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { savePrefsDoc } from '../services/prefsDoc'
import { useAuth } from './AuthContext'
import { recordSignal } from '../services/interestTracker'
import { inferStyleWeights } from '../services/styleInference'

const ClosetContext = createContext(null)

// Stores under users/{uid}/prefs/closet  — same path pattern as WishlistContext
// so existing Firestore rules permit writes.
const PREF_DOC = 'closet'

function makeId() {
  return `ci_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function ClosetProvider({ children }) {
  const { user } = useAuth()
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const loadedUid               = useRef(null)
  // Block saves from running before the initial load resolves
  const loadReady               = useRef(false)

  const loadItems = useCallback(() => {
    if (!user) return
    setLoading(true)
    setError(null)
    loadReady.current = false

    getDoc(doc(db, 'users', user.uid, 'prefs', PREF_DOC))
      .then((snap) => {
        const stored = snap.exists() ? (snap.data().items ?? []) : []
        setItems((current) => {
          // Preserve any items added while the load was in-flight
          const storedIds = new Set(stored.map((i) => i.id))
          const pending   = current.filter((i) => !storedIds.has(i.id))
          return pending.length > 0 ? [...pending, ...stored] : stored
        })
      })
      .catch((err) => setError(err))
      .finally(() => {
        setLoading(false)
        loadReady.current = true
      })
  }, [user])

  // Load from Firestore when user changes
  useEffect(() => {
    if (!user) {
      setItems([])
      setLoading(false)
      setError(null)
      loadedUid.current = null
      loadReady.current = false
      return
    }
    if (loadedUid.current === user.uid) return
    loadedUid.current = user.uid
    loadItems()
  }, [user, loadItems])

  // Persist whenever items change (after initial load)
  useEffect(() => {
    if (!user || !loadReady.current || loadedUid.current !== user.uid) return
    savePrefsDoc(user.uid, PREF_DOC, { items })
  }, [items, user])

  const addToCloset = useCallback((item) => {
    const newItem = {
      type:        'uploaded',
      aiDetected:  false,
      favorite:    false,
      tags:        [],
      seasons:     [],
      occasions:   [],
      careSymbols: [],
      ...item,
      id:      item.id ?? makeId(),
      addedAt: item.addedAt ?? new Date().toISOString(),
    }
    // Every wardrobe add feeds the aesthetic tally. Catalog-sourced items
    // carry styleWeights; for photo uploads the aesthetics are inferred from
    // the item's name/description. Closet `type` is the source flag
    // ('uploaded'), not a garment type, so pass only garment fields through.
    const recordSave = (styleWeights) => recordSignal(user, 'save', {
      product: {
        styleWeights,
        brand:      newItem.brand,
        itemType:   newItem.itemType,
        parentType: newItem.parentType ?? newItem.category,
        color:      newItem.color,
      },
    })
    if (Object.keys(newItem.styleWeights ?? {}).length > 0) {
      recordSave(newItem.styleWeights)
    } else {
      inferStyleWeights(`${newItem.name ?? ''} ${newItem.description ?? ''}`)
        .then((inferred) => { if (inferred) recordSave(inferred) })
    }
    setItems((prev) => {
      if (prev.some((e) => e.id === newItem.id)) return prev
      return [newItem, ...prev]
    })
  }, [user])

  const updateClosetItem = useCallback((id, patch) => {
    setItems((prev) =>
      prev.map((e) => e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e)
    )
  }, [])

  const removeFromCloset = useCallback((id) => {
    setItems((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const closetByCategory = useMemo(() => {
    const map = {}
    for (const item of items) {
      const cat = item.category ?? 'tops'
      if (!map[cat]) map[cat] = []
      map[cat].push(item)
    }
    return map
  }, [items])

  return (
    <ClosetContext.Provider value={{
      closetItems: items,
      closetLoading: loading,
      closetError: error,
      retryLoadCloset: loadItems,
      closetByCategory,
      totalClosetCount: items.length,
      addToCloset,
      updateClosetItem,
      removeFromCloset,
    }}>
      {children}
    </ClosetContext.Provider>
  )
}

export function useCloset() {
  return useContext(ClosetContext)
}
