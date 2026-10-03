import styles from './OnboardingStep.module.css'
import Icon from '../../components/Icon'

const OCCUPATIONS = [
  { id: 'student',    label: 'Student' },
  { id: 'creative',   label: 'Creative / Arts' },
  { id: 'office',     label: 'Office / Corporate' },
  { id: 'retail',     label: 'Retail / Service' },
  { id: 'tech',       label: 'Tech' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'freelance',  label: 'Freelance' },
  { id: 'other',      label: 'Other' },
]

export default function OccupationScreen({ value, onSelect, onSkip }) {
  return (
    <div className={styles.step}>
      <div className={styles.iconBadge}><Icon name="briefcase" size={22} /></div>
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
            <span className={styles.tileLabel}>{occ.label}</span>
          </button>
        ))}
      </div>

      <button className={styles.skipBtn} onClick={onSkip}>Skip</button>
    </div>
  )
}
