import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { savePrefsDoc } from '../services/prefsDoc'
import { useAuth } from './AuthContext'
import { useSubscription } from './SubscriptionContext'
import { recordSignal } from '../services/interestTracker'

const ExploreContext = createContext(null)

export function ExploreProvider({ children }) {
  const { user } = useAuth()
  const { isPro, limits, openPaywall } = useSubscription()

  // IDs of aesthetics the user has pinned as permanent tabs.
  // Starts empty — populated from Firestore when a user signs in.
  // Guest saves are session-only (cleared on sign-out or page refresh).
  const [savedAesthetics, setSavedAesthetics] = useState([])

  // True only after the Firestore fetch for the current user has resolved.
  // Blocks the persistence effect from writing stale [] before the read completes.
  const [loadReady, setLoadReady] = useState(false)

  // The currently open aesthetic (may be temporary or saved)
  const [openAesthetic, setOpenAesthetic] = useState(null)

  // The currently open brand page + the tab to return to on back
  const [openBrand, setOpenBrand]         = useState(null)
  const [brandFromTab, setBrandFromTab]   = useState('explore')

  const loadedUid = useRef(null)

  // React to auth changes: load on sign-in, clear on sign-out
  useEffect(() => {
    if (!user) {
      setSavedAesthetics([])
      setOpenAesthetic(null)
      setLoadReady(false)
      loadedUid.current = null
      return
    }

    // Same user already loaded — nothing to do
    if (loadedUid.current === user.uid) return
    loadedUid.current = user.uid
    setLoadReady(false) // block persistence until fetch resolves

    getDoc(doc(db, 'users', user.uid, 'prefs', 'savedAesthetics'))
      .then((snap) => {
        const stored = snap.exists() ? (snap.data().ids ?? []) : []
        setSavedAesthetics((current) => {
          const pending = current.filter((id) => !stored.includes(id))
          return pending.length > 0 ? [...pending, ...stored] : stored
        })
      })
      .catch(() => {})
      .finally(() => setLoadReady(true))
  }, [user])

  // Persist to Firestore — only after the initial load has completed
  useEffect(() => {
    if (!user || !loadReady || loadedUid.current !== user.uid) return
    savePrefsDoc(user.uid, 'savedAesthetics', { ids: savedAesthetics })
  }, [savedAesthetics, user, loadReady])

  const openAestheticTab = useCallback((id) => {
    setOpenAesthetic(id)
  }, [])

  const openBrandTab = useCallback((id, fromTab = 'explore') => {
    setOpenBrand(id)
    setBrandFromTab(fromTab)
  }, [])

  const closeBrandTab = useCallback(() => {
    setOpenBrand(null)
  }, [])

  const closeAestheticTab = useCallback(() => {
    setOpenAesthetic(null)
  }, [])

  const saveAesthetic = useCallback((id) => {
    const willPin =
      !savedAesthetics.includes(id) &&
      (isPro || savedAesthetics.length < limits.aestheticPins)
    if (willPin) recordSignal(user, 'aestheticPin', { aestheticId: id })
    setSavedAesthetics((prev) => {
      if (prev.includes(id)) return prev
      if (!isPro && prev.length >= limits.aestheticPins) { openPaywall('aestheticPins'); return prev }
      return [...prev, id]
    })
    setOpenAesthetic(id)
  }, [isPro, limits, openPaywall, savedAesthetics, user])

  const unsaveAesthetic = useCallback((id) => {
    setSavedAesthetics((prev) => prev.filter((s) => s !== id))
  }, [])

  const isSaved = useCallback(
    (id) => savedAesthetics.includes(id),
    [savedAesthetics]
  )

  // When navigating away from aesthetic tabs to main tabs, close unsaved ones.
  // Brand tabs are allowed to keep the aesthetic open (user may go back).
  const handleMainTabSwitch = useCallback(
    (newTab) => {
      if (
        openAesthetic &&
        !savedAesthetics.includes(openAesthetic) &&
        newTab !== 'explore' &&
        !newTab.startsWith('aesthetic:') &&
        !newTab.startsWith('brand:')
      ) {
        setOpenAesthetic(null)
      }
    },
    [openAesthetic, savedAesthetics]
  )

  return (
    <ExploreContext.Provider
      value={{
        savedAesthetics,
        openAesthetic,
        openAestheticTab,
        closeAestheticTab,
        saveAesthetic,
        unsaveAesthetic,
        isSaved,
        handleMainTabSwitch,
        openBrand,
        brandFromTab,
        openBrandTab,
        closeBrandTab,
      }}
    >
      {children}
    </ExploreContext.Provider>
  )
}

export function useExplore() {
  return useContext(ExploreContext)
}
