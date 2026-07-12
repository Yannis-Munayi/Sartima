import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useShop } from '../context/ShopContext'
import { useInterests } from '../context/InterestContext'
import { PIECE_BY_ID, STARTER_CAPSULE, BUDGET_BY_ID, recommendProducts, findComplements } from '../services/wardrobeRecommend'
import StepPieces from './wardrobeBuild/StepPieces'
import StepBudget from './wardrobeBuild/StepBudget'
import StepPriorities from './wardrobeBuild/StepPriorities'
import ResultsView from './wardrobeBuild/ResultsView'
import MyListView from './wardrobeBuild/MyListView'
import styles from './WardrobeBuildScreen.module.css'

export default function WardrobeBuildScreen({ onBack, initialPiece = null, initialSpecificName = null }) {
  const { state } = useApp()
  const gender    = state.gender
  const { shopList, addScoutedGroup } = useShop()
  const { interests } = useInterests() ?? {}
  const styleAffinities = interests?.styleAffinities ?? {}

  const hasInitial = !!(initialPiece && PIECE_BY_ID[initialPiece])

  const [activeView, setActiveView] = useState('scout') // 'scout' | 'list'
  const [step, setStep]             = useState(hasInitial ? 2 : 1)
  const [pieces, setPieces]         = useState(hasInitial ? [initialPiece] : [])
  const [budgets, setBudgets]       = useState({}) // { [pieceId]: tierId }
  const [filters, setFilters]       = useState({}) // { [pieceId]: { color, material, size } }
  const [priorities, setPriorities] = useState([])
  const [sizeSystem]                = useState(() => localStorage.getItem('sartima_size_system') || 'us')

  function togglePiece(id) {
    setPieces((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])
  }

  function setBudget(pieceId, tierId) {
    setBudgets((prev) => ({ ...prev, [pieceId]: tierId }))
  }

  function setPieceFilter(pieceId, key, value) {
    setFilters((prev) => ({
      ...prev,
      [pieceId]: { ...prev[pieceId], [key]: value },
    }))
  }

  function togglePriority(id) {
    setPriorities((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])
  }

  function useStarterCapsule() {
    setPieces(STARTER_CAPSULE)
    setStep(2)
  }

  function handleAddComplement(id) {
    if (!pieces.includes(id)) {
      setPieces((prev) => [...prev, id])
      setStep(2) // user must assign a budget for the new piece
    }
  }

  const [saved, setSaved]     = useState(false)
  const [autoSave]            = useState(() => localStorage.getItem('sartima_scout_autosave') === 'true')

  function reset() {
    setStep(1)
    setPieces([])
    setBudgets({})
    setFilters({})
    setPriorities([])
    setSaved(false)
  }

  // Compute recommendations when on step 4
  const recommendations = useMemo(() => {
    if (step < 4) return []
    return pieces.map((pieceId) => {
      const option       = PIECE_BY_ID[pieceId]
      if (!option) return null
      const budgetTier   = budgets[pieceId] ?? 'mid'
      const pieceFilters = filters[pieceId] ?? {}
      const maxCount     = Math.min(100, Math.max(5, parseInt(localStorage.getItem('sartima_scout_result_count') ?? '10', 10) || 10))
      const recs         = recommendProducts(option, budgetTier, priorities, gender, pieceFilters, maxCount, initialSpecificName, styleAffinities)
      return { pieceId, option, recs, budgetTier, pieceFilters }
    }).filter(Boolean)
  }, [step, pieces, budgets, filters, priorities, gender, initialSpecificName, styleAffinities])

  const complements = useMemo(
    () => (step === 4 ? findComplements(pieces) : []),
    [step, pieces]
  )

  const performSave = useCallback((selectedIds) => {
    recommendations.forEach(({ pieceId, option, recs, budgetTier, pieceFilters }) => {
      const tier        = BUDGET_BY_ID[budgetTier]
      const allProducts = [...recs.primary, ...recs.suggested, ...recs.outOfFilter]
      const safeProducts = allProducts
        .filter((p) => selectedIds.has(p.id))
        .map(({ id, brand, name, description, shopUrl, shopFallbackUrl, googleQuery, priceRange, image, imageMen }) =>
          ({ id, brand, name, description, shopUrl, shopFallbackUrl, googleQuery, priceRange, image, imageMen })
        )
      if (safeProducts.length === 0) return
      addScoutedGroup({
        id:          `${pieceId}_${budgetTier}`,
        pieceId,
        pieceName:   recs.specificName || option.name,
        emoji:       option.emoji,
        budgetTier,
        budgetLabel: tier?.label ?? '',
        filters:     pieceFilters ?? {},
        products:    safeProducts,
        savedAt:     Date.now(),
      })
    })
    setSaved(true)
  }, [recommendations, addScoutedGroup])

  // Auto-save when the setting is enabled — saves all products (opt-in, default off)
  useEffect(() => {
    if (!autoSave || step !== 4 || recommendations.length === 0 || saved) return
    const allIds = new Set(recommendations.flatMap((r) =>
      [...r.recs.primary, ...r.recs.suggested].map((p) => p.id)
    ))
    performSave(allIds)
  }, [autoSave, step, recommendations.length, saved, performSave])

  // Clear saved flag when user goes back to earlier steps
  useEffect(() => {
    if (step < 4) setSaved(false)
  }, [step])

  const { scoutedGroups } = useShop()
  const totalListCount    = shopList.length + scoutedGroups.length

  const STEP_LABELS = ['Pieces', 'Budget', 'Priorities', 'Results']

  return (
    <div className={styles.screen}>
      {/* Sticky header + tabs */}
      <div className={styles.stickyTop}>
        <div className={styles.header}>
          <button className={styles.headerBack} onClick={onBack} aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className={styles.headerCenter}>
            <h1 className={styles.headerTitle}>Shop Scout</h1>
            {activeView === 'scout' && step < 4 && (
              <p className={styles.headerSub}>Step {step} of 3</p>
            )}
          </div>
          <div className={styles.headerSpacer} />
        </div>

        <div className={styles.viewTabsRow}>
          <button
            className={`${styles.viewTab} ${activeView === 'scout' ? styles.viewTabActive : ''}`}
            onClick={() => setActiveView('scout')}
          >
            Scout
          </button>
          <button
            className={`${styles.viewTab} ${activeView === 'list' ? styles.viewTabActive : ''}`}
            onClick={() => setActiveView('list')}
          >
            My List
            {totalListCount > 0 && (
              <span className={styles.viewTabBadge}>{totalListCount}</span>
            )}
          </button>
        </div>
      </div>

      {activeView === 'scout' && step < 4 && (
        <div className={styles.stepIndicator}>
          {[1, 2, 3].map((s) => (
            <div key={s}
              className={`${styles.stepDot} ${s < step ? styles.stepDotDone : ''} ${s === step ? styles.stepDotActive : ''}`}
            >
              <div className={styles.stepDotInner} />
              <span className={styles.stepDotLabel}>{STEP_LABELS[s - 1]}</span>
            </div>
          ))}
          <div className={styles.stepLine} />
        </div>
      )}

      <div className={styles.content}>
        {activeView === 'list' && <MyListView />}
        {activeView === 'scout' && (
          <>
            {step === 1 && (
              <StepPieces selected={pieces} onToggle={togglePiece}
                onNotSure={useStarterCapsule} onNext={() => setStep(2)} gender={gender}
              />
            )}
            {step === 2 && (
              <StepBudget pieces={pieces} budgets={budgets}
                onSetBudget={setBudget} filters={filters} onSetFilter={setPieceFilter}
                sizeSystem={sizeSystem}
                onNext={() => setStep(3)} onBack={() => setStep(1)}
              />
            )}
            {step === 3 && (
              <StepPriorities selected={priorities} onToggle={togglePriority}
                onNext={() => setStep(4)} onBack={() => setStep(2)}
              />
            )}
            {step === 4 && (
              <ResultsView
                recommendations={recommendations} complements={complements}
                budgets={budgets} priorities={priorities} gender={gender}
                onReset={reset} onAddPiece={handleAddComplement}
                onSave={autoSave ? null : performSave}
                saved={saved}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
