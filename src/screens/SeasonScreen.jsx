import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useGuide } from '../context/GuideContext'
import styles from './screens.module.css'

const SEASONS = [
  { id: 'spring', label: 'Spring',  emoji: '🌸', desc: 'Transitional layers, fresh colours' },
  { id: 'summer', label: 'Summer',  emoji: '☀️', desc: 'Lightweight, breathable pieces' },
  { id: 'fall',   label: 'Fall',    emoji: '🍂', desc: 'Rich tones, cozy outerwear' },
  { id: 'winter', label: 'Winter',  emoji: '❄️', desc: 'Heavy layers, warm fabrics' },
]

export default function SeasonScreen() {
  const { state, dispatch }       = useApp()
  const { forceSeason, guideNext } = useGuide()
  const [selected, setSelected]   = useState(state.selectedSeasons ?? [])

  function toggle(id) {
    if (forceSeason) {
      // In guide mode: only the forced option is tappable
      if (id !== forceSeason) return
      dispatch({ type: 'SET_SEASONS', seasons: [forceSeason] })
      dispatch({ type: 'GO_TO_CATEGORIES' })
      guideNext()
      return
    }
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  function handleNext() {
    dispatch({ type: 'SET_SEASONS', seasons: selected })
    dispatch({ type: 'GO_TO_CATEGORIES' })
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        {!forceSeason && (
          <button className={styles.backBtn} onClick={() => dispatch({ type: 'GO_TO_WELCOME' })}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}
        <h2 className={styles.screenTitle}>Which seasons matter most?</h2>
        <p className={styles.screenSub}>We'll tailor items to what you actually need to wear. Pick all that apply.</p>
      </div>

      <div className={styles.seasonGrid}>
        {SEASONS.map((s) => {
          const isForced   = forceSeason === s.id
          const isLocked   = !!forceSeason && !isForced
          const isSelected = selected.includes(s.id)
          return (
            <button
              key={s.id}
              className={`${styles.seasonCard} ${isSelected || isForced ? styles.active : ''} ${isForced ? styles.guideForced : ''} ${isLocked ? styles.guideLocked : ''}`}
              onClick={() => toggle(s.id)}
              disabled={isLocked}
            >
              <span className={styles.seasonEmoji}>{s.emoji}</span>
              <span className={styles.seasonLabel}>{s.label}</span>
              <span className={styles.seasonDesc}>{s.desc}</span>
              {(isSelected || isForced) && !isLocked && (
                <span className={styles.checkmark}>✓</span>
              )}
              {isForced && <span className={styles.guidePulse} />}
            </button>
          )
        })}
      </div>

      {!forceSeason && (
        <div className={styles.footer}>
          <p className={styles.footerNote}>
            {selected.length === 0
              ? 'Select at least one season, or skip to see all'
              : `${selected.length} season${selected.length > 1 ? 's' : ''} selected`}
          </p>
          <button className={styles.primaryBtn} onClick={handleNext}>
            {selected.length === 0 ? 'Show all seasons' : 'Continue'}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
