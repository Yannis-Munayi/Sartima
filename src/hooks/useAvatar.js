import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { prettifyImage } from '../services/prettify'
import { normalizeForUpload, UnsupportedImageError } from '../services/imageNormalize'
import { logError } from '../services/logger'

export function useAvatar() {
  const { user } = useAuth()
  const [avatarUrl, setAvatarUrl]                   = useState(null)
  const [avatarPrettifiedUrl, setAvatarPrettifiedUrl] = useState(null)
  const [avatarUpdatedAt, setAvatarUpdatedAt]       = useState(null)
  const [uploading, setUploading]   = useState(false)
  const [prettifying, setPrettifying] = useState(false)
  const [prettifyFailed, setPrettifyFailed] = useState(false)
  const [uploadError, setUploadError] = useState(null)

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

  // Never throws — failures land in `uploadError` for the caller to display.
  async function uploadAvatar(picked) {
    if (!user || !picked) return null
    setUploading(true)
    setPrettifyFailed(false)
    setUploadError(null)
    try {
      // 1. Upload original (downscaled + re-encoded so Storage rules and the try-on model accept it)
      const file = await normalizeForUpload(picked)
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
    } catch (err) {
      if (err instanceof UnsupportedImageError) {
        setUploadError(err.message)
      } else {
        logError('useAvatar', 'avatar upload failed', { error: err, code: err?.code })
        setUploadError('Photo upload failed. Check your connection and try again.')
      }
      return null
    } finally {
      setUploading(false)
      setPrettifying(false)
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

  return { avatarUrl, avatarPrettifiedUrl, avatarUpdatedAt, displayUrl, uploadAvatar, deleteAvatar, uploading, prettifying, prettifyFailed, uploadError }
}
