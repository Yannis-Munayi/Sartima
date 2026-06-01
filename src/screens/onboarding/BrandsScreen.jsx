import { useState } from 'react'
import styles from './OnboardingStep.module.css'

const POPULAR_BRANDS = [
  'Zara', 'H&M', 'ASOS', 'Uniqlo', 'Nike', 'Adidas', 'New Balance',
  'Ralph Lauren', 'Tommy Hilfiger', 'Lacoste', 'COS', 'A.P.C.',
  'Acne Studios', 'Supreme', 'Off-White', 'Stüssy', 'Carhartt WIP',
  'J.Crew', 'Gap', 'Levi\'s', 'Madewell', 'Everlane', 'Patagonia',
  'The North Face', 'Gucci', 'Prada', 'Burberry', 'Valentino',
  'Totême', 'Arket',
]

export default function BrandsScreen({ selected, onSelect, onNext, onSkip }) {
  const [search, setSearch] = useState('')

  const filtered = POPULAR_BRANDS.filter((b) =>
    b.toLowerCase().includes(search.toLowerCase())
  )

  function toggle(brand) {
    onSelect((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    )
  }

  const canNext = selected.length >= 3

  return (
    <div className={styles.step}>
      <div className={styles.iconBadge}>🏷️</div>
      <h1 className={styles.title}>
        Choose 3 or<br /><em>more brands</em>
      </h1>
      <p className={styles.sub}>Choose brands of clothes you currently own or want.</p>

      <input
        className={styles.searchInput}
        placeholder="Search or add brands…"
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
        disabled={!canNext}
        style={{ marginTop: 20 }}
      >
        {canNext ? `Continue (${selected.length} selected)` : `Like at least 3 brands`}
      </button>

      <button className={styles.skipBtn} onClick={onSkip}>Skip</button>
    </div>
  )
}
