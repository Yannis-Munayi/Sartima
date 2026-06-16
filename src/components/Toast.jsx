import { useEffect, useRef, useState } from 'react'
import styles from './Toast.module.css'

let _dispatch = null

export function showToast(message) {
  _dispatch?.(message)
}

export default function Toast() {
  const [msg, setMsg]         = useState('')
  const [visible, setVisible] = useState(false)
  const timerRef              = useRef(null)

  useEffect(() => {
    _dispatch = (message) => {
      setMsg(message)
      setVisible(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setVisible(false), 2200)
    }
    return () => { _dispatch = null; clearTimeout(timerRef.current) }
  }, [])

  return (
    <div className={`${styles.toast} ${visible ? styles.visible : ''}`} aria-live="polite">
      {msg}
    </div>
  )
}
