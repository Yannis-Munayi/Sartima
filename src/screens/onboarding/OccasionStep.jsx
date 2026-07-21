import styles from './OnboardingStep.module.css'

const OCCASIONS = [
  { id: 'casual', label: 'Casual',  emoji: '☀️' },
  { id: 'work',   label: 'Work',    emoji: '💼' },
  { id: 'date',   label: 'Date',    emoji: '✨' },
  { id: 'gym',    label: 'Gym',     emoji: '💪' },
  { id: 'errand', label: 'Errands', emoji: '🛒' },
]

export default function OccasionStep({ value, onSelect, onSkip }) {
  return (
    <div className={styles.step}>
      <div className={styles.iconBadge}>📅</div>
      <h1 className={styles.title}>
        What occasion do<br />you want to <em>improve?</em>
      </h1>
      <p className={styles.sub}>We'll default your daily outfit picks to this.</p>

      <div className={styles.tileGrid}>
        {OCCASIONS.map((occ) => (
          <button
            key={occ.id}
            className={`${styles.tile} ${value === occ.id ? styles.tileActive : ''}`}
            onClick={() => onSelect(occ.id)}
          >
            <span className={styles.tileEmoji}>{occ.emoji}</span>
            <span className={styles.tileLabel}>{occ.label}</span>
          </button>
        ))}
      </div>

      <button className={styles.skipBtn} onClick={onSkip}>Skip</button>
    </div>
  )
}
