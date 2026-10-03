import { useEffect, useRef, useState } from 'react'
import { useHomeNotifications } from '../../hooks/useHomeNotifications'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { trackEvent } from '../../services/firebase'
import Icon from '../Icon'
import styles from './NotificationBell.module.css'

// Ids of notifications the user has already seen in the panel — drives the
// unread badge. Per-device on purpose: it's a UI nicety, not account state.
const SEEN_KEY = 'sartima_seen_notifications'

function loadSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function saveSeen(seen) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
  } catch {
    // Storage blocked (private mode) — badge just resets next visit.
  }
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  )
}

export default function NotificationBell({ navigate }) {
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(loadSeen)
  const rootRef         = useRef(null)
  const items           = useHomeNotifications({ navigate, panelOpen: open })

  const itemIds     = items.map((i) => i.id).join('|')
  const unseenCount = items.filter((i) => !seen.has(i.id)).length

  // Mark everything visible as seen while the panel is open — including items
  // that arrive after opening (e.g. the gap once dismissals finish loading).
  useEffect(() => {
    if (!open || unseenCount === 0) return
    setSeen((prev) => {
      const next = new Set(prev)
      items.forEach((i) => next.add(i.id))
      saveSeen(next)
      return next
    })
  }, [open, itemIds]) // eslint-disable-line react-hooks/exhaustive-deps

  useEscapeKey(() => setOpen(false), open)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function handleToggle() {
    if (!open) trackEvent('notifications_opened', { count: items.length, unseen: unseenCount })
    setOpen((o) => !o)
  }

  function handleOpenItem(item) {
    setOpen(false)
    item.onOpen()
  }

  return (
    <div
      ref={rootRef}
      className={styles.root}
      // Keep swipes inside the panel from flipping the hero carousel.
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <button
        className={`${styles.bellBtn} ${open ? styles.bellBtnActive : ''}`}
        onClick={handleToggle}
        aria-label={unseenCount > 0 ? `Notifications (${unseenCount} new)` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <BellIcon />
        {unseenCount > 0 && <span className={styles.badge}>{unseenCount}</span>}
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Notifications">
          <p className={styles.panelTitle}>Notifications</p>

          {items.length === 0 ? (
            <p className={styles.empty}>You're all caught up.</p>
          ) : (
            <ul className={styles.list}>
              {items.map((item) => (
                <li key={item.id} className={styles.item}>
                  <button className={styles.itemMain} onClick={() => handleOpenItem(item)}>
                    <span className={styles.itemIcon}><Icon name={item.icon} size={16} /></span>
                    <span className={styles.itemText}>
                      <span className={styles.itemTitle}>{item.title}</span>
                      <span className={styles.itemBody}>{item.body}</span>
                    </span>
                  </button>
                  {item.onDismiss && (
                    <button
                      className={styles.dismissBtn}
                      onClick={item.onDismiss}
                      aria-label={`Dismiss: ${item.title}`}
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
