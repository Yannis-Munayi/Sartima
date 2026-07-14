import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { loadInterests, recordSignal } from '../services/interestTracker'

const InterestContext = createContext(null)

export function InterestProvider({ children }) {
  const { user } = useAuth()
  const [interests, setInterests] = useState(null)
  const loadedUid = useRef(null)

  useEffect(() => {
    if (!user) {
      setInterests(null)
      loadedUid.current = null
      return
    }
    if (loadedUid.current === user.uid) return
    loadedUid.current = user.uid

    loadInterests(user.uid).then((data) => {
      if (loadedUid.current === user.uid) {
        setInterests(data)
      }
    })
  }, [user])

  // Convenience wrapper so components can emit interest signals without
  // pulling in useAuth themselves
  const recordInterest = useCallback((signalType, payload) => {
    recordSignal(user, signalType, payload)
  }, [user])

  return (
    <InterestContext.Provider value={{ interests, recordInterest }}>
      {children}
    </InterestContext.Provider>
  )
}

export function useInterests() {
  return useContext(InterestContext)
}
