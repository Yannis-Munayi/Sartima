import { useState } from 'react'
import { useCloset } from '../context/ClosetContext'
import { useAuth } from '../context/AuthContext'
import LockedOverlay from '../components/LockedOverlay'
import { WASH_FREQUENCIES, CARE_SYMBOLS, inferColorGroup } from '../data/careSymbols'
import styles from './LaundryTab.module.css'

const FREQ_THRESHOLD = Object.fromEntries(
  WASH_FREQUENCIES.map((f) => [f.id, f.thresholdDays])
)

const COLOR_GROUPS = [
  { id: 'whites',    label: 'Whites',    emoji: '⬜', hint: 'Wash separately. Use hot or warm water.' },
  { id: 'lights',    label: 'Lights',    emoji: '🩶', hint: 'Cool or warm wash. Keep away from darks.' },
  { id: 'darks',     label: 'Darks',     emoji: '⬛', hint: 'Cold wash to prevent fading.' },
  { id: 'brights',   label: 'Brights',   emoji: '🟥', hint: 'Cold wash. May bleed on first few washes.' },
  { id: 'delicates', label: 'Delicates', emoji: '🌸', hint: 'Gentle or hand wash. Air dry only.' },
]

const CATEGORY_EMOJIS = {
  tops: '👕', bottoms: '👖', outerwear: '🧥',
  dresses: '👗', footwear: '👟', accessories: '👜',
}

function getDaysSince(isoStr) {
  if (!isoStr) return null
  return Math.floor((Date.now() - new Date(isoStr).getTime()) / 86400000)
}

function computeWashStatus(item) {
  const threshold = item.washFrequency ? FREQ_THRESHOLD[item.washFrequency] : null
  const days = getDaysSince(item.lastWashedAt)

  if (threshold === null) return 'spot-clean'  // spot-clean-only items never appear as due
  if (!item.lastWashedAt) return 'unknown'
  if (days >= threshold) return 'overdue'
  if (days >= threshold - 1) return 'due-soon'
  return 'clean'
}

const STATUS_ORDER = { overdue: 0, unknown: 1, 'due-soon': 2, clean: 3, 'spot-clean': 4 }

function ItemThumb({ item }) {
  const photo = item.prettifiedUrl ?? item.imageUrl ?? item.thumbnailUrl
  return (
    <div className={styles.thumb} title={item.name}>
      {photo ? (
        <img src={photo} alt={item.name} className={styles.thumbImg} />
      ) : (
        <span className={styles.thumbEmoji}>{CATEGORY_EMOJIS[item.category] ?? '👕'}</span>
      )}
    </div>
  )
}

// ── Section A — Due for wash ──────────────────────────────────────────
function DueForWashSection() {
  const { closetItems, updateClosetItem } = useCloset()

  const trackable = closetItems.filter((i) => i.washFrequency !== 'spot-clean-only')
  const withStatus = trackable.map((i) => ({ ...i, _status: computeWashStatus(i) }))
  withStatus.sort((a, b) => STATUS_ORDER[a._status] - STATUS_ORDER[b._status])

  if (trackable.length === 0) {
    return (
      <div className={styles.emptySection}>
        <p>Add care details to your closet items to track wash frequency.</p>
      </div>
    )
  }

  function markWashed(id) {
    updateClosetItem(id, { lastWashedAt: new Date().toISOString() })
  }

  return (
    <div className={styles.washList}>
      {withStatus.map((item) => {
        const days = getDaysSince(item.lastWashedAt)
        const threshold = item.washFrequency ? FREQ_THRESHOLD[item.washFrequency] : null
        let statusLabel = ''
        let statusClass = styles.statusUnknown

        if (item._status === 'overdue') {
          statusLabel = threshold ? `${days - threshold}d overdue` : 'Overdue'
          statusClass = styles.statusOverdue
        } else if (item._status === 'due-soon') {
          statusLabel = 'Due soon'
          statusClass = styles.statusDueSoon
        } else if (item._status === 'clean') {
          statusLabel = days === 0 ? 'Washed today' : `Washed ${days}d ago`
          statusClass = styles.statusClean
        } else {
          statusLabel = 'Not tracked'
          statusClass = styles.statusUnknown
        }

        return (
          <div key={item.id} className={styles.washRow}>
            <ItemThumb item={item} />
            <div className={styles.washInfo}>
              <p className={styles.washName}>{item.name}</p>
              <p className={styles.washCat}>{CATEGORY_EMOJIS[item.category] ?? '👕'} {item.category}</p>
            </div>
            <span className={`${styles.statusBadge} ${statusClass}`}>{statusLabel}</span>
            {item._status !== 'clean' && (
              <button
                className={styles.markWashedBtn}
                onClick={() => markWashed(item.id)}
                title="Mark as washed"
              >
                ✓
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Section B — Wash together ─────────────────────────────────────────
function WashTogetherSection() {
  const { closetItems } = useCloset()
  const [expandedGroup, setExpandedGroup] = useState(null)

  const grouped = {}
  for (const item of closetItems) {
    const group = item.colorGroup ?? inferColorGroup(item.color) ?? 'unsorted'
    if (!grouped[group]) grouped[group] = []
    grouped[group].push(item)
  }

  function hasConflict(items) {
    return items.some((i) =>
      i.careSymbols?.includes('wash-no') ||
      i.careSymbols?.includes('dryclean-ok') ||
      i.careSymbols?.includes('dryclean-gentle') ||
      i.careSymbols?.includes('dryclean-petroleum')
    )
  }

  const orderedGroups = [
    ...COLOR_GROUPS.filter((g) => grouped[g.id]?.length > 0),
    ...(grouped.unsorted?.length > 0
      ? [{ id: 'unsorted', label: 'Unsorted', emoji: '❓', hint: 'Add care info to sort these items.' }]
      : []),
  ]

  if (orderedGroups.length === 0) {
    return (
      <div className={styles.emptySection}>
        <p>Add colors to your closet items to see wash groupings.</p>
      </div>
    )
  }

  return (
    <div className={styles.groupList}>
      {orderedGroups.map((g) => {
        const items = grouped[g.id] ?? []
        const visible = expandedGroup === g.id ? items : items.slice(0, 5)
        const overflow = items.length - 5
        const conflict = hasConflict(items)

        const restrictiveSymbol = (() => {
          const hasCold = items.some((i) => i.careSymbols?.includes('wash-30'))
          const hasHand = items.some((i) => i.careSymbols?.includes('wash-hand'))
          if (hasHand) return 'Hand wash recommended'
          if (hasCold) return 'Cold wash recommended'
          return null
        })()

        return (
          <div key={g.id} className={styles.groupCard}>
            <div className={styles.groupHeader}>
              <span className={styles.groupEmoji}>{g.emoji}</span>
              <div className={styles.groupMeta}>
                <p className={styles.groupLabel}>{g.label}</p>
                <p className={styles.groupHint}>{restrictiveSymbol ?? g.hint}</p>
              </div>
              <span className={styles.groupCount}>{items.length}</span>
            </div>

            {conflict && (
              <div className={styles.conflictWarning}>
                ⚠ Contains dry-clean only items — wash separately
              </div>
            )}

            <div className={styles.thumbStrip}>
              {visible.map((item) => <ItemThumb key={item.id} item={item} />)}
              {overflow > 0 && expandedGroup !== g.id && (
                <button
                  className={styles.moreChip}
                  onClick={() => setExpandedGroup(g.id)}
                >
                  +{overflow}
                </button>
              )}
              {expandedGroup === g.id && (
                <button
                  className={styles.moreChip}
                  onClick={() => setExpandedGroup(null)}
                >
                  Less
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Section C — Laundry day picker ───────────────────────────────────
function LaundryDaySection() {
  const { closetItems } = useCloset()
  const [laundryDate, setLaundryDate] = useState('')
  const [planned, setPlanned]         = useState(false)

  const dueCount = closetItems.filter((i) => {
    const s = computeWashStatus(i)
    return s === 'overdue' || s === 'due-soon' || s === 'unknown'
  }).length

  const today = new Date().toISOString().slice(0, 10)

  function handlePlan() {
    if (laundryDate) setPlanned(true)
  }

  const formattedDate = laundryDate
    ? new Date(laundryDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : ''

  return (
    <div className={styles.laundryCard}>
      <h4 className={styles.laundryCardTitle}>Next laundry day</h4>
      {dueCount > 0 && (
        <p className={styles.laundryDueNote}>
          {dueCount} item{dueCount !== 1 ? 's' : ''} ready to wash
        </p>
      )}

      {planned ? (
        <div className={styles.plannedMsg}>
          <span className={styles.plannedCheck}>✓</span>
          <p>Laundry day set for <strong>{formattedDate}</strong>. You have {dueCount} item{dueCount !== 1 ? 's' : ''} to wash.</p>
          <button className={styles.changeDateBtn} onClick={() => setPlanned(false)}>Change date</button>
        </div>
      ) : (
        <>
          <div className={styles.datePickRow}>
            <input
              type="date"
              className={styles.dateInput}
              value={laundryDate}
              min={today}
              onChange={(e) => setLaundryDate(e.target.value)}
            />
            <button
              className={styles.planBtn}
              onClick={handlePlan}
              disabled={!laundryDate}
            >
              Plan it
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main LaundryTab ───────────────────────────────────────────────────
export default function LaundryTab() {
  const { user } = useAuth()

  if (!user) {
    return (
      <LockedOverlay message="Sign in to track your laundry care">
        <div style={{ height: 240 }} />
      </LockedOverlay>
    )
  }

  return (
    <div className={styles.root}>
      <section>
        <h3 className={styles.sectionTitle}>Due for Wash</h3>
        <DueForWashSection />
      </section>

      <section>
        <h3 className={styles.sectionTitle}>Wash Together</h3>
        <WashTogetherSection />
      </section>

      <section>
        <LaundryDaySection />
      </section>
    </div>
  )
}
