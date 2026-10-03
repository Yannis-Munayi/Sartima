import styles from './OnboardingStep.module.css'
import Icon from '../../components/Icon'

const GOALS = [
  { id: 'daily',    label: 'What to wear day-to-day' },
  { id: 'buy',      label: 'Knowing what to buy next' },
  { id: 'capsule',  label: 'Building a capsule wardrobe' },
  { id: 'identity', label: 'Finding my personal style' },
  { id: 'smarter',  label: 'Shopping smarter, not more' },
  { id: 'other',    label: 'Something else' },
]

export default function GoalStep({ value, onSelect, onSkip }) {
  return (
    <div className={styles.step}>
      <div className={styles.iconBadge}><Icon name="target" size={22} /></div>
      <h1 className={styles.title}>
        What's your<br />biggest <em>fashion goal?</em>
      </h1>
      <p className={styles.sub}>We'll focus your home feed and recommendations around this.</p>

      <div className={styles.tileGrid}>
        {GOALS.map((goal) => (
          <button
            key={goal.id}
            className={`${styles.tile} ${value === goal.id ? styles.tileActive : ''}`}
            onClick={() => onSelect(goal.id)}
          >
            <span className={styles.tileLabel}>{goal.label}</span>
          </button>
        ))}
      </div>

      <button className={styles.skipBtn} onClick={onSkip}>Skip</button>
    </div>
  )
}
