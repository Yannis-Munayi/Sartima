import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './AuthContext'

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
  const loadedUid               = useRef(null)
  // Block saves from running before the initial load resolves
  const loadReady               = useRef(false)

  // Load from Firestore when user changes
  useEffect(() => {
    if (!user) {
      setItems([])
      setLoading(false)
      loadedUid.current = null
      loadReady.current = false
      return
    }
    if (loadedUid.current === user.uid) return
    loadedUid.current = user.uid
    loadReady.current = false
    setLoading(true)

    getDoc(doc(db, 'users', user.uid, 'prefs', PREF_DOC))
      .then((snap) => {
        setItems(snap.exists() ? (snap.data().items ?? []) : [])
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false)
        loadReady.current = true
      })
  }, [user])

  // Persist whenever items change (after initial load)
  useEffect(() => {
    if (!user || !loadReady.current || loadedUid.current !== user.uid) return
    setDoc(
      doc(db, 'users', user.uid, 'prefs', PREF_DOC),
      { items },
      { merge: true }
    ).catch(() => {})
  }, [items, user])

  const addToCloset = useCallback((item) => {
    const newItem = {
      type:       'uploaded',
      aiDetected: false,
      favorite:   false,
      tags:       [],
      seasons:    [],
      occasions:  [],
      ...item,
      id:      item.id ?? makeId(),
      addedAt: item.addedAt ?? new Date().toISOString(),
    }
    setItems((prev) => {
      if (prev.some((e) => e.id === newItem.id)) return prev
      return [newItem, ...prev]
    })
  }, [])

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
