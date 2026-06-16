import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../services/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  async function signup(email, password, displayName) {
    const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(newUser, { displayName })
    await sendEmailVerification(newUser)
    await setDoc(doc(db, 'users', newUser.uid), {
      displayName,
      email,
      createdAt: serverTimestamp(),
    })
    setUser({ ...newUser, displayName })
  }

  async function login(email, password) {
    const { user: loggedUser } = await signInWithEmailAndPassword(auth, email, password)
    return loggedUser
  }

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider()
    const result   = await signInWithPopup(auth, provider)
    const u        = result.user
    await setDoc(doc(db, 'users', u.uid), {
      displayName: u.displayName ?? '',
      email:       u.email ?? '',
      updatedAt:   serverTimestamp(),
    }, { merge: true })
  }

  async function logout() {
    await signOut(auth)
    // Remove any keys that were written by old code versions to prevent
    // them from leaking into the next user's session
    localStorage.removeItem('stylelab_saved_aesthetics')
    localStorage.removeItem('stylelab_shoplist')
  }

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, logout, signInWithGoogle }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
