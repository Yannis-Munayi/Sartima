import styles from './OnboardingStep.module.css'
import Icon from '../../components/Icon'

const OCCASIONS = [
  { id: 'casual', label: 'Casual' },
  { id: 'work',   label: 'Work' },
  { id: 'date',   label: 'Date' },
  { id: 'gym',    label: 'Gym' },
  { id: 'errand', label: 'Errands' },
]

export default function OccasionStep({ value, onSelect, onSkip }) {
  return (
    <div className={styles.step}>
      <div className={styles.iconBadge}><Icon name="calendar" size={22} /></div>
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
            <span className={styles.tileLabel}>{occ.label}</span>
          </button>
        ))}
      </div>

      <button className={styles.skipBtn} onClick={onSkip}>Skip</button>
    </div>
  )
}
