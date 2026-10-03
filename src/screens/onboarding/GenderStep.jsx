import styles from './OnboardingStep.module.css'
import Icon from '../../components/Icon'

const OPTIONS = [
  { id: 'women', label: 'Women' },
  { id: 'men',   label: 'Men' },
  { id: 'both',  label: 'Mixed' },
]

export default function GenderStep({ value, onSelect, onSkip }) {
  return (
    <div className={styles.step}>
      <div className={styles.iconBadge}><Icon name="bag" size={22} /></div>
      <h1 className={styles.title}>
        Who are you<br /><em>shopping for?</em>
      </h1>
      <p className={styles.sub}>We'll tailor everything — aesthetics, brands, and recommendations — around this.</p>

      <div className={styles.tileGrid} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            className={`${styles.tile} ${value === opt.id ? styles.tileActive : ''}`}
            onClick={() => onSelect(opt.id)}
          >
            <span className={styles.tileLabel}>{opt.label}</span>
          </button>
        ))}
      </div>

      <button className={styles.skipBtn} onClick={onSkip}>Skip</button>
    </div>
  )
}
