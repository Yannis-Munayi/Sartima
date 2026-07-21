import { CATEGORIES } from '../../data/categories'
import styles from './OnboardingStep.module.css'

export default function MissingItemsStep({ selected, onSelect, onNext, onSkip }) {
  function toggle(id) {
    onSelect((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  return (
    <div className={styles.step}>
      <div className={styles.iconBadge}>🧩</div>
      <h1 className={styles.title}>
        What's your<br /><em>closet missing?</em>
      </h1>
      <p className={styles.sub}>Pick any categories you feel like you're short on right now.</p>

      <div className={styles.tileGrid}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`${styles.tile} ${selected.includes(cat.id) ? styles.tileActive : ''}`}
            onClick={() => toggle(cat.id)}
          >
            <span className={styles.tileEmoji}>{cat.emoji}</span>
            <span className={styles.tileLabel}>{cat.label}</span>
          </button>
        ))}
      </div>

      <button
        className={styles.nextBtn}
        onClick={onNext}
        style={{ marginTop: 20 }}
      >
        {selected.length > 0 ? `Continue (${selected.length} selected)` : 'Continue'}
      </button>

      <button className={styles.skipBtn} onClick={onSkip}>Skip</button>
    </div>
  )
}
