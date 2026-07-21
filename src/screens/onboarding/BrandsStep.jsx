import { useMemo, useState } from 'react'
import { BRANDS } from '../../data/brands'
import styles from './OnboardingStep.module.css'

const MAX_BRANDS = 5

const ALL_BRANDS = Object.values(BRANDS)
  .map((b) => b.name)
  .sort((a, b) => a.localeCompare(b))

export default function BrandsStep({ selected, onSelect, onNext, onSkip }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(
    () => ALL_BRANDS.filter((b) => b.toLowerCase().includes(search.toLowerCase())),
    [search]
  )

  function toggle(brand) {
    onSelect((prev) => {
      if (prev.includes(brand)) return prev.filter((b) => b !== brand)
      if (prev.length >= MAX_BRANDS) return prev
      return [...prev, brand]
    })
  }

  return (
    <div className={styles.step}>
      <div className={styles.iconBadge}>🏷️</div>
      <h1 className={styles.title}>
        Any <em>favorite</em><br />brands?
      </h1>
      <p className={styles.sub}>Choose up to 5 brands of clothes you currently own or want.</p>

      <input
        className={styles.searchInput}
        placeholder="Search 190 brands…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className={styles.chipGrid}>
        {filtered.map((brand) => (
          <button
            key={brand}
            className={`${styles.brandChip} ${selected.includes(brand) ? styles.brandChipActive : ''}`}
            onClick={() => toggle(brand)}
          >
            {brand}
            {selected.includes(brand) && <span className={styles.brandCheck}>✓</span>}
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
