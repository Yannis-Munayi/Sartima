import { useEffect, useState } from 'react'
import {
  addDoc, collection, getDocs,
  query, where, orderBy,
  doc, deleteDoc, getDoc,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { useCloset } from '../context/ClosetContext'
import LockedOverlay from '../components/LockedOverlay'
import styles from './OutfitCalendarScreen.module.css'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS   = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const CATEGORY_EMOJIS = {
  tops: '👕', bottoms: '👖', outerwear: '🧥',
  dresses: '👗', footwear: '👟', accessories: '👜',
}

function dateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

// ── Day Plan Sheet ────────────────────────────────────────────────────────────

function DayPlanSheet({ dateKey, plans, closetItems, logEntries, onSave, onDelete, onClose }) {
  const [selected, setSelected] = useState(plans.map((p) => p.itemIds).flat())
  const [tab,      setTab]      = useState('closet') // 'closet' | 'log'
  const [saving,   setSaving]   = useState(false)

  const itemMap = Object.fromEntries(closetItems.map((i) => [i.id, i]))

  function toggleItem(id) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  function applyLogEntry(entry) {
    setSelected(entry.itemIds)
    setTab('closet')
  }

  async function handleSave() {
    setSaving(true)
    await onSave(dateKey, selected)
    setSaving(false)
    onClose()
  }

  return (
    <div className={styles.sheetOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.sheet}>
        <div className={styles.sheetHandle} />
        <div className={styles.sheetHeader}>
          <h3 className={styles.sheetTitle}>Plan for {dateKey}</h3>
          <button className={styles.sheetClose} onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className={styles.sheetTabs}>
          <button
            className={`${styles.sheetTab} ${tab === 'closet' ? styles.sheetTabActive : ''}`}
            onClick={() => setTab('closet')}
          >
            Closet Items
          </button>
          <button
            className={`${styles.sheetTab} ${tab === 'log' ? styles.sheetTabActive : ''}`}
            onClick={() => setTab('log')}
          >
            From Log {logEntries.length > 0 && <span className={styles.logBadge}>{logEntries.length}</span>}
          </button>
        </div>

        {/* Closet items tab */}
        {tab === 'closet' && (
          closetItems.length === 0 ? (
            <p className={styles.emptyText}>Add items to your closet first.</p>
          ) : (
            <div className={styles.itemPickerGrid}>
              {closetItems.map((item) => {
                const photoUrl = item.prettifiedUrl ?? item.imageUrl ?? item.thumbnailUrl
                const sel = selected.includes(item.id)
                return (
                  <button
                    key={item.id}
                    className={`${styles.pickerItem} ${sel ? styles.pickerItemActive : ''}`}
                    onClick={() => toggleItem(item.id)}
                  >
                    <div className={styles.pickerPhoto}>
                      {photoUrl
                        ? <img src={photoUrl} alt={item.name} className={styles.pickerImg} />
                        : <span>{CATEGORY_EMOJIS[item.category] ?? '👕'}</span>
                      }
                    </div>
                    <p className={styles.pickerName}>{item.name}</p>
                    {sel && <span className={styles.pickerCheck}>✓</span>}
                  </button>
                )
              })}
            </div>
          )
        )}

        {/* From log tab */}
        {tab === 'log' && (
          logEntries.length === 0 ? (
            <p className={styles.emptyText}>No logged outfits yet — log one from the Today tab.</p>
          ) : (
            <div className={styles.logList}>
              {logEntries.map((entry) => {
                const items = (entry.itemIds ?? []).map((id) => itemMap[id]).filter(Boolean)
                return (
                  <button
                    key={entry.id}
                    className={styles.logEntry}
                    onClick={() => applyLogEntry(entry)}
                  >
                    <div className={styles.logEntryMeta}>
                      <span className={styles.logEntryDate}>{entry.date}</span>
                      {entry.occasion && <span className={styles.logEntryOccasion}>{entry.occasion}</span>}
                    </div>
                    <div className={styles.logEntryThumbs}>
                      {items.slice(0, 4).map((item) => {
                        const photo = item.prettifiedUrl ?? item.imageUrl ?? item.thumbnailUrl
                        return (
                          <div key={item.id} className={styles.logThumb}>
                            {photo
                              ? <img src={photo} alt={item.name} className={styles.logThumbImg} />
                              : <span className={styles.logThumbEmoji}>{CATEGORY_EMOJIS[item.category] ?? '👕'}</span>
                            }
                          </div>
                        )
                      })}
                      {items.length === 0 && (
                        <span className={styles.logNoItems}>{entry.itemIds?.length ?? 0} items</span>
                      )}
                    </div>
                    {entry.notes && <p className={styles.logEntryNotes}>"{entry.notes}"</p>}
                  </button>
                )
              })}
            </div>
          )
        )}

        <div className={styles.sheetBtns}>
          {plans.length > 0 && (
            <button className={styles.clearBtn} onClick={() => onDelete(dateKey)}>
              Clear day
            </button>
          )}
          <button className={styles.saveSheetBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Plan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function OutfitCalendarScreen() {
  const { user }       = useAuth()
  const { closetItems } = useCloset()

  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [plans, setPlans] = useState({}) // { "2026-06-01": [{ id, itemIds }] }
  const [daySheet, setDaySheet] = useState(null) // dateKey string or null
  const [loadingPlans, setLoadingPlans] = useState(true)

  const [logEntries, setLogEntries] = useState([])

  const cells = buildCalendar(year, month)

  if (!user) {
    const ghostCells = buildCalendar(year, month)
    const ghostPlanned = new Set([3, 7, 12, 15, 19, 22])
    return (
      <div className={styles.screen}>
        <div className={styles.monthNav}>
          <button className={styles.navBtn}>‹</button>
          <h2 className={styles.monthLabel}>{MONTHS[month]} {year}</h2>
          <button className={styles.navBtn}>›</button>
        </div>
        <div className={styles.weekRow}>
          {WEEKDAYS.map((d) => <span key={d} className={styles.weekDay}>{d}</span>)}
        </div>
        <LockedOverlay message="Sign in to plan your outfits">
          <div className={styles.calGrid}>
            {ghostCells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} className={styles.emptyCell} />
              const planned = ghostPlanned.has(day)
              return (
                <div key={day} className={`${styles.dayCell} ${planned ? styles.dayCellPlanned : ''}`}>
                  <span className={styles.dayNum}>{day}</span>
                  {planned && (
                    <div className={styles.dayThumbs}>
                      <div className={styles.dayThumb} style={{ background: 'linear-gradient(135deg,#2d3a4a,#1a2634)' }} />
                      <div className={styles.dayThumb} style={{ background: 'linear-gradient(135deg,#1a2a1a,#2a3a2a)' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </LockedOverlay>
      </div>
    )
  }

  // Load outfit log once on mount
  useEffect(() => {
    if (!user) return
    getDoc(doc(db, 'users', user.uid, 'prefs', 'outfitLog'))
      .then((snap) => {
        if (snap.exists()) setLogEntries(snap.data().entries ?? [])
      })
      .catch(() => {})
  }, [user])

  // Load plans for the visible month
  useEffect(() => {
    if (!user) return
    setLoadingPlans(true)
    const start = dateStr(year, month, 1)
    const end   = dateStr(year, month, new Date(year, month + 1, 0).getDate())
    const q = query(
      collection(db, 'users', user.uid, 'outfitPlans'),
      where('date', '>=', start),
      where('date', '<=', end),
      orderBy('date')
    )
    getDocs(q)
      .then((snap) => {
        const map = {}
        for (const d of snap.docs) {
          const data = { id: d.id, ...d.data() }
          if (!map[data.date]) map[data.date] = []
          map[data.date].push(data)
        }
        setPlans(map)
      })
      .catch(() => {})
      .finally(() => setLoadingPlans(false))
  }, [user, year, month])

  async function handleSavePlan(dateKey, itemIds) {
    if (!user) return
    // Delete existing plans for this day first
    const existing = plans[dateKey] ?? []
    for (const p of existing) {
      await deleteDoc(doc(db, 'users', user.uid, 'outfitPlans', p.id))
    }
    if (itemIds.length > 0) {
      await addDoc(collection(db, 'users', user.uid, 'outfitPlans'), {
        date:    dateKey,
        itemIds,
        savedAt: new Date().toISOString(),
      })
    }
    // Reload plans for the month
    const updatedPlans = { ...plans }
    if (itemIds.length > 0) {
      updatedPlans[dateKey] = [{ date: dateKey, itemIds }]
    } else {
      delete updatedPlans[dateKey]
    }
    setPlans(updatedPlans)
  }

  async function handleDeletePlan(dateKey) {
    if (!user) return
    const existing = plans[dateKey] ?? []
    for (const p of existing) {
      await deleteDoc(doc(db, 'users', user.uid, 'outfitPlans', p.id))
    }
    const updatedPlans = { ...plans }
    delete updatedPlans[dateKey]
    setPlans(updatedPlans)
  }

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11) }
    else setMonth((m) => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0) }
    else setMonth((m) => m + 1)
  }

  const todayKey = dateStr(today.getFullYear(), today.getMonth(), today.getDate())
  const itemMap  = Object.fromEntries(closetItems.map((i) => [i.id, i]))

  return (
    <div className={styles.screen}>
      {/* Month navigation */}
      <div className={styles.monthNav}>
        <button className={styles.navBtn} onClick={prevMonth}>‹</button>
        <h2 className={styles.monthLabel}>{MONTHS[month]} {year}</h2>
        <button className={styles.navBtn} onClick={nextMonth}>›</button>
      </div>

      {/* Weekday headers */}
      <div className={styles.weekRow}>
        {WEEKDAYS.map((d) => (
          <span key={d} className={styles.weekDay}>{d}</span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className={styles.calGrid}>
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className={styles.emptyCell} />
          const key      = dateStr(year, month, day)
          const dayPlans = plans[key] ?? []
          const isToday  = key === todayKey
          const thumbIds = dayPlans.flatMap((p) => p.itemIds).slice(0, 2)

          return (
            <button
              key={key}
              className={`${styles.dayCell} ${isToday ? styles.dayCellToday : ''} ${dayPlans.length > 0 ? styles.dayCellPlanned : ''}`}
              onClick={() => setDaySheet(key)}
            >
              <span className={styles.dayNum}>{day}</span>
              {thumbIds.length > 0 && (
                <div className={styles.dayThumbs}>
                  {thumbIds.map((id) => {
                    const item = itemMap[id]
                    if (!item) return null
                    const photo = item.prettifiedUrl ?? item.imageUrl ?? item.thumbnailUrl
                    return (
                      <div key={id} className={styles.dayThumb}>
                        {photo
                          ? <img src={photo} alt="" className={styles.dayThumbImg} />
                          : <span className={styles.dayThumbEmoji}>{CATEGORY_EMOJIS[item.category] ?? '👕'}</span>
                        }
                      </div>
                    )
                  })}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {!user && (
        <p className={styles.signInNote}>Sign in to save outfit plans.</p>
      )}

      {daySheet && (
        <DayPlanSheet
          dateKey={daySheet}
          plans={plans[daySheet] ?? []}
          closetItems={closetItems}
          logEntries={logEntries}
          onSave={handleSavePlan}
          onDelete={handleDeletePlan}
          onClose={() => setDaySheet(null)}
        />
      )}
    </div>
  )
}
