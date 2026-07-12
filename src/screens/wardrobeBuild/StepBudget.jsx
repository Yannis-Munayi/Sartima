import { PIECE_BY_ID, BUDGET_TIERS, COLOR_OPTIONS, MATERIAL_OPTIONS, SIZE_BY_ROLE } from '../../services/wardrobeRecommend'
import styles from '../WardrobeBuildScreen.module.css'

export default function StepBudget({ pieces, budgets, onSetBudget, filters, onSetFilter, sizeSystem, onNext, onBack }) {
  const allSet = pieces.every((id) => budgets[id])

  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>Budget & filters</h2>
      <p className={styles.stepSub}>Set price range and preferences per piece.</p>

      {pieces.map((pieceId) => {
        const piece    = PIECE_BY_ID[pieceId]
        const selected = budgets[pieceId] ?? null
        const pf       = filters[pieceId] ?? {}
        const sizeOpts = (SIZE_BY_ROLE[piece.role] ?? SIZE_BY_ROLE.tops)[sizeSystem] ?? []

        return (
          <div key={pieceId} className={styles.pieceBudgetSection}>
            <div className={styles.pieceBudgetTitle}>
              <span className={styles.pieceBudgetEmoji}>{piece.emoji}</span>
              <span>{piece.name}</span>
            </div>

            <div className={styles.budgetChipGrid}>
              {BUDGET_TIERS.map((tier) => (
                <button
                  key={tier.id}
                  className={`${styles.budgetChip} ${selected === tier.id ? styles.budgetChipSelected : ''}`}
                  onClick={() => onSetBudget(pieceId, tier.id)}
                >
                  <span className={styles.budgetChipTag}>{tier.priceTag}</span>
                  <span className={styles.budgetChipLabel}>{tier.label}</span>
                </button>
              ))}
            </div>

            <div className={styles.filterSection}>
              <p className={styles.filterLabel}>Color</p>
              <div className={styles.filterChipScroll}>
                <button
                  className={`${styles.filterChip} ${!pf.color ? styles.filterChipSelected : ''}`}
                  onClick={() => onSetFilter(pieceId, 'color', null)}
                >
                  Any
                </button>
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.id}
                    className={`${styles.colorDot} ${pf.color === c.id ? styles.colorDotSelected : ''}`}
                    style={{ background: c.hex }}
                    onClick={() => onSetFilter(pieceId, 'color', c.id)}
                    aria-label={c.label}
                    title={c.label}
                  >
                    {pf.color === c.id && <span className={styles.colorDotCheck}>✓</span>}
                  </button>
                ))}
              </div>

              <p className={styles.filterLabel}>Material</p>
              <div className={styles.filterChipScroll}>
                {MATERIAL_OPTIONS.map((m) => (
                  <button
                    key={m.id}
                    className={`${styles.filterChip} ${(pf.material ?? 'any') === m.id ? styles.filterChipSelected : ''}`}
                    onClick={() => onSetFilter(pieceId, 'material', m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <p className={styles.filterLabel}>
                Size <span className={styles.filterLabelHint}>({sizeSystem.toUpperCase()})</span>
              </p>
              <div className={styles.filterChipScroll}>
                <button
                  className={`${styles.filterChip} ${!pf.size ? styles.filterChipSelected : ''}`}
                  onClick={() => onSetFilter(pieceId, 'size', null)}
                >
                  Any
                </button>
                {sizeOpts.map((s) => (
                  <button
                    key={s}
                    className={`${styles.filterChip} ${pf.size === s ? styles.filterChipSelected : ''}`}
                    onClick={() => onSetFilter(pieceId, 'size', s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })}

      <div className={styles.navRow}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <button className={styles.nextBtn} onClick={onNext} disabled={!allSet} style={{ flex: 1 }}>
          Next: Your priorities →
        </button>
      </div>
    </div>
  )
}
