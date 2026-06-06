import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { prettifyImage } from '../services/prettify'

export function useAvatar() {
  const { user } = useAuth()
  const [avatarUrl, setAvatarUrl]                   = useState(null)
  const [avatarPrettifiedUrl, setAvatarPrettifiedUrl] = useState(null)
  const [avatarUpdatedAt, setAvatarUpdatedAt]       = useState(null)
  const [uploading, setUploading]   = useState(false)
  const [prettifying, setPrettifying] = useState(false)
  const [prettifyFailed, setPrettifyFailed] = useState(false)

  useEffect(() => {
    if (!user) {
      setAvatarUrl(null)
      setAvatarPrettifiedUrl(null)
      setAvatarUpdatedAt(null)
      return
    }
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        if (snap.exists()) {
          setAvatarUrl(snap.data().avatarUrl ?? null)
          setAvatarPrettifiedUrl(snap.data().avatarPrettifiedUrl ?? null)
          setAvatarUpdatedAt(snap.data().avatarUpdatedAt ?? null)
        }
      })
      .catch(() => {})
  }, [user?.uid])

  async function uploadAvatar(file) {
    if (!user || !file) return null
    setUploading(true)
    setPrettifyFailed(false)
    try {
      // 1. Upload original
      const origRef = ref(storage, `users/${user.uid}/avatar/photo.jpg`)
      await uploadBytes(origRef, file)
      const url = await getDownloadURL(origRef)
      const updatedAt = Date.now()
      setAvatarUrl(url)
      setAvatarUpdatedAt(updatedAt)

      // 2. Remove background (WASM — can take 10-20s)
      setPrettifying(true)
      let prettifiedUrl = null
      try {
        const bgBlob  = await prettifyImage(file)
        const bgRef   = ref(storage, `users/${user.uid}/avatar/photo_bg.png`)
        await uploadBytes(bgRef, bgBlob)
        prettifiedUrl = await getDownloadURL(bgRef)
        setAvatarPrettifiedUrl(prettifiedUrl)
      } catch (_) {
        setPrettifyFailed(true)
      } finally {
        setPrettifying(false)
      }

      try {
        await setDoc(doc(db, 'users', user.uid), {
          avatarUrl: url,
          avatarUpdatedAt: updatedAt,
          ...(prettifiedUrl ? { avatarPrettifiedUrl: prettifiedUrl } : {}),
        }, { merge: true })
      } catch (_) {
        // URLs already in local state; persistence will retry on next avatar action
      }

      return url
    } finally {
      setUploading(false)
    }
  }

  async function deleteAvatar() {
    if (!user) return
    // Remove files — ignore errors if they don't exist
    await Promise.allSettled([
      deleteObject(ref(storage, `users/${user.uid}/avatar/photo.jpg`)),
      deleteObject(ref(storage, `users/${user.uid}/avatar/photo_bg.png`)),
    ])
    try {
      await setDoc(doc(db, 'users', user.uid), {
        avatarUrl: null,
        avatarPrettifiedUrl: null,
        avatarUpdatedAt: null,
      }, { merge: true })
    } catch (_) {
      // local state cleared below regardless
    }
    setAvatarUrl(null)
    setAvatarPrettifiedUrl(null)
    setAvatarUpdatedAt(null)
    setPrettifyFailed(false)
  }

  // Display the background-removed version when available
  const displayUrl = avatarPrettifiedUrl ?? avatarUrl

  return { avatarUrl, avatarPrettifiedUrl, avatarUpdatedAt, displayUrl, uploadAvatar, deleteAvatar, uploading, prettifying, prettifyFailed }
}
