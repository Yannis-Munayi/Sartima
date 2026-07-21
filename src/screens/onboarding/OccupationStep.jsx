import styles from './OnboardingStep.module.css'

const OCCUPATIONS = [
  { id: 'student',    label: 'Student',           emoji: '📚' },
  { id: 'creative',   label: 'Creative / Arts',   emoji: '🎨' },
  { id: 'office',     label: 'Office / Corporate',emoji: '💼' },
  { id: 'retail',     label: 'Retail / Service',  emoji: '🛍️' },
  { id: 'tech',       label: 'Tech',              emoji: '💻' },
  { id: 'healthcare', label: 'Healthcare',        emoji: '🏥' },
  { id: 'freelance',  label: 'Freelance',         emoji: '🎯' },
  { id: 'other',      label: 'Other',             emoji: '✦'  },
]

export default function OccupationScreen({ value, onSelect, onSkip }) {
  return (
    <div className={styles.step}>
      <div className={styles.iconBadge}>💼</div>
      <h1 className={styles.title}>
        What <em>do you do</em><br />for work?
      </h1>
      <p className={styles.sub}>We'll personalize recommendations for both weekdays and weekends.</p>

      <div className={styles.tileGrid}>
        {OCCUPATIONS.map((occ) => (
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
