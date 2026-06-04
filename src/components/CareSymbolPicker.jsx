import { useState } from 'react'
import { CARE_SYMBOLS, SYMBOL_CATEGORY_LABELS, SYMBOL_EXCLUSIONS } from '../data/careSymbols'
import styles from './CareSymbolPicker.module.css'

const CATEGORIES = ['wash', 'dry', 'iron', 'bleach', 'dryclean']

export default function CareSymbolPicker({ selected, onChange }) {
  const [openGuide, setOpenGuide] = useState(null) // category id

  function toggle(symbolId) {
    const exclusions = SYMBOL_EXCLUSIONS[symbolId] ?? []
    let next
    if (selected.includes(symbolId)) {
      next = selected.filter((s) => s !== symbolId)
    } else {
      next = [...selected.filter((s) => !exclusions.includes(s)), symbolId]
    }
    onChange(next)
  }

  return (
    <div className={styles.picker}>
      {CATEGORIES.map((cat) => {
        const symbols = CARE_SYMBOLS.filter((s) => s.category === cat)
        return (
          <div key={cat} className={styles.category}>
            <div className={styles.catHeader}>
              <span className={styles.catLabel}>{SYMBOL_CATEGORY_LABELS[cat]}</span>
              <button
                type="button"
                className={styles.guideBtn}
                onClick={() => setOpenGuide(openGuide === cat ? null : cat)}
                aria-label={`What do ${SYMBOL_CATEGORY_LABELS[cat]} symbols mean?`}
              >
                ?
              </button>
            </div>

            {openGuide === cat && (
              <div className={styles.guide}>
                {symbols.map((s) => (
                  <div key={s.id} className={styles.guideRow}>
                    <span className={styles.guideAbbr}>{s.abbreviation}</span>
                    <div>
                      <p className={styles.guideName}>{s.label}</p>
                      <p className={styles.guideDesc}>{s.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.chips}>
              {symbols.map((s) => {
                const active = selected.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`${styles.chip} ${active ? styles.chipActive : ''}`}
                    onClick={() => toggle(s.id)}
                  >
                    <span className={styles.symbolBox}>{s.abbreviation}</span>
                    <span className={styles.chipLabel}>{s.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
