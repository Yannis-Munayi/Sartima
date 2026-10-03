import { useState } from 'react'
import { STYLES, getStyleName } from '../../data/styles'
import styles from './OnboardingStep.module.css'
import Icon from '../../components/Icon'

const REQUIRED = 3
const ALL_IDS  = Object.keys(STYLES)

export default function AestheticsStep({ selected, gender, onSelect, onNext, onSkip }) {
  const [search, setSearch] = useState('')

  const filtered = ALL_IDS.filter((id) =>
    getStyleName(STYLES[id], gender).toLowerCase().includes(search.toLowerCase())
  )

  function toggle(id) {
    onSelect((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id)
      if (prev.length >= REQUIRED) return prev
      return [...prev, id]
    })
  }

  const canContinue = selected.length === REQUIRED

  return (
    <div className={styles.step}>
      <div className={styles.iconBadge}><Icon name="compass" size={22} /></div>
      <h1 className={styles.title}>
        Pick <em>3 aesthetics</em><br />that speak to you
      </h1>
      <p className={styles.sub}>We'll use these to shape your very first recommendations.</p>

      <input
        className={styles.searchInput}
        placeholder="Search 51 aesthetics…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className={styles.chipGrid}>
        {filtered.map((id) => (
          <button
            key={id}
            className={`${styles.brandChip} ${selected.includes(id) ? styles.brandChipActive : ''}`}
            onClick={() => toggle(id)}
          >
            {getStyleName(STYLES[id], gender)}
            {selected.includes(id) && <span className={styles.brandCheck}>✓</span>}
          </button>
        ))}
      </div>

      <button
        className={styles.nextBtn}
        onClick={onNext}
        disabled={!canContinue}
        style={{ marginTop: 'var(--space-5)' }}
      >
        {canContinue ? 'Continue' : `${selected.length} of ${REQUIRED} selected`}
      </button>

      <button className={styles.skipBtn} onClick={onSkip}>Skip</button>
    </div>
  )
}
