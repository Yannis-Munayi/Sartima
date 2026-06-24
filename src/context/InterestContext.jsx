import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { loadInterests } from '../services/interestTracker'

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

  return (
    <InterestContext.Provider value={{ interests }}>
      {children}
    </InterestContext.Provider>
  )
}

export function useInterests() {
  return useContext(InterestContext)
}
