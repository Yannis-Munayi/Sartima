import { PRIORITIES } from '../../services/wardrobeRecommend'
import styles from '../WardrobeBuildScreen.module.css'

export default function StepPriorities({ selected, onToggle, onNext, onBack }) {
  const maxReached = selected.length >= 3

  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>What matters most to you?</h2>
      <p className={styles.stepSub}>Pick up to 3 priorities — we'll use these to rank picks.</p>

      <div className={styles.priorityGrid}>
        {PRIORITIES.map((p) => {
          const isSelected = selected.includes(p.id)
          const isDisabled = !isSelected && maxReached
          return (
            <button key={p.id}
              className={`${styles.priorityChip} ${isSelected ? styles.priorityChipSelected : ''} ${isDisabled ? styles.priorityChipDisabled : ''}`}
              onClick={() => !isDisabled && onToggle(p.id)}
            >
              <span className={styles.priorityEmoji}>{p.emoji}</span>
              <span className={styles.priorityLabel}>{p.label}</span>
              {isSelected && <span className={styles.priorityCheck}>✓</span>}
            </button>
          )
        })}
      </div>

      <div className={styles.navRow}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <button className={styles.nextBtn} onClick={onNext} style={{ flex: 1 }}>
          Find my picks →
        </button>
      </div>
    </div>
  )
}
