import styles from './OnboardingStep.module.css'

const GOALS = [
  { id: 'daily',    label: 'What to wear day-to-day', emoji: '🌅' },
  { id: 'buy',      label: 'Knowing what to buy next', emoji: '🛍️' },
  { id: 'capsule',  label: 'Building a capsule wardrobe', emoji: '🧳' },
  { id: 'identity', label: 'Finding my personal style', emoji: '🧭' },
  { id: 'smarter',  label: 'Shopping smarter, not more', emoji: '💸' },
  { id: 'other',    label: 'Something else', emoji: '✦' },
]

export default function GoalStep({ value, onSelect, onSkip }) {
  return (
    <div className={styles.step}>
      <div className={styles.iconBadge}>🎯</div>
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
            <span className={styles.tileEmoji}>{goal.emoji}</span>
            <span className={styles.tileLabel}>{goal.label}</span>
          </button>
        ))}
      </div>

      <button className={styles.skipBtn} onClick={onSkip}>Skip</button>
    </div>
  )
}
