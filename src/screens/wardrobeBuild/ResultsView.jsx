import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useInterests } from '../../context/InterestContext'
import { fetchPhotosWithFallback } from '../../services/stockPhotos'
import { resolveProductImage, getAltProductImage } from '../../services/productImage'
import ProductImageToggle from '../../components/ProductImageToggle'
import { PIECE_BY_ID, PRIORITIES, BUDGET_BY_ID, countOutfits } from '../../services/wardrobeRecommend'
import styles from '../WardrobeBuildScreen.module.css'

const PRICE_LABELS = { budget: 'Budget', mid: 'Mid-range', premium: 'Premium', luxury: 'Luxury' }
const PRICE_COLORS = { budget: '#4CAF50', mid: '#2196F3', premium: '#FF9800', luxury: '#9C27B0' }

function ProductPhoto({ product }) {
  const [photo, setPhoto] = useState(null)
  const { state } = useApp()
  const gender = state.gender
  const altPhoto = getAltProductImage(product, gender)
  const ref     = useRef(null)
  const fetched = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fetched.current) {
        fetched.current = true
        resolveProductImage(product, gender).then((url) => setPhoto(url ?? null))
        obs.disconnect()
      }
    }, { rootMargin: '80px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [product.id, gender])

  return (
    <div ref={ref} className={styles.productPhoto}
      style={{ background: product.gradient ?? 'var(--surface)' }}
    >
      <ProductImageToggle photo={photo} altPhoto={altPhoto} alt={product.name} imgClassName={styles.productPhotoImg} />
    </div>
  )
}

function ProductCard({ product, priorities, isSelected, onToggle }) {
  const { recordInterest } = useInterests() ?? {}
  const priceColor = PRICE_COLORS[product.priceRange] ?? '#888'
  const priceLabel = PRICE_LABELS[product.priceRange] ?? ''

  // Derive a priority label for display
  let priorityLabel = null
  {
    let best = null; let bestScore = -1
    const weights = product.styleWeights ?? {}
    for (const pid of priorities) {
      const prio = PRIORITIES.find((p) => p.id === pid)
      if (!prio || prio.styleKeys.length === 0) continue
      const s = prio.styleKeys.reduce((acc, k) => acc + (weights[k] ?? 0), 0)
      if (s > bestScore) { bestScore = s; best = prio }
    }
    if (best) {
      const labelMap = { comfort: 'Comfort pick', clean: 'Clean & minimal', fitted: 'Tailored fit', versatile: 'Highly versatile', durable: 'Built to last', brand: 'Premium brand', affordable: 'Budget-friendly' }
      priorityLabel = labelMap[best.id] ?? null
    }
  }

  return (
    <div className={`${styles.productCard} ${onToggle && !isSelected ? styles.productCardDimmed : ''}`}>
      <div style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
        <ProductPhoto product={product} />
        {onToggle && (
          <button
            className={`${styles.productSelectBtn} ${isSelected ? styles.productSelectBtnOn : ''}`}
            onClick={onToggle}
            aria-label={isSelected ? 'Deselect' : 'Select'}
          >
            {isSelected && '✓'}
          </button>
        )}
      </div>
      <div className={styles.productCardBody}>
        <div className={styles.productCardTop}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className={styles.productBrand}>{product.brand}</p>
            <p className={styles.productName}>{product.name}</p>
          </div>
          <span className={styles.productPriceTag} style={{ color: priceColor }}>{priceLabel}</span>
        </div>
        <p className={styles.productDesc}>{product.description}</p>
        {priorityLabel && <span className={styles.productLabel}>{priorityLabel}</span>}
        <a href={product.shopUrl ?? product.shopFallbackUrl}
          target="_blank" rel="noopener noreferrer" className={styles.shopBtn}
          onClick={() => recordInterest?.('shop', { product })}
        >
          Shop {product.brand} →
        </a>
      </div>
    </div>
  )
}

function ComplementCard({ id, onAddPiece, gender }) {
  const option = PIECE_BY_ID[id]
  const [photo, setPhoto]   = useState(null)
  const [loaded, setLoaded] = useState(false)
  const cardRef  = useRef(null)
  const fetched  = useRef(false)

  useEffect(() => {
    const el = cardRef.current
    if (!el || !option) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fetched.current) {
        fetched.current = true
        const hint = gender === 'women' ? 'women' : gender === 'men' ? 'men' : ''
        fetchPhotosWithFallback([
          `${option.photoQuery} ${hint}`.trim(),
          `${option.name} ${hint} fashion outfit`.trim(),
          `${option.name} fashion`,
        ], 1).then(([url] = []) => setPhoto(url ?? null))
        obs.disconnect()
      }
    }, { rootMargin: '80px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [id, gender])

  if (!option) return null

  return (
    <button ref={cardRef} className={styles.complementCard} onClick={() => onAddPiece(id)}>
      <div className={styles.complementCardBg}>
        {photo && (
          <img src={photo} alt={option.name} className={styles.complementCardImg}
            style={{ opacity: loaded ? 1 : 0 }}
            onLoad={() => setLoaded(true)} onError={() => setLoaded(true)}
          />
        )}
        <div className={styles.complementCardOverlay} />
      </div>
      <div className={styles.complementCardFooter}>
        <span className={styles.complementName}>{option.name}</span>
        <span className={styles.complementAdd}>+ Add</span>
      </div>
    </button>
  )
}

export default function ResultsView({ recommendations, complements, budgets, priorities, gender, onReset, onAddPiece, onSave, saved }) {
  const pieces      = recommendations.map((r) => r.pieceId)
  const outfitCount = useMemo(() => countOutfits(pieces), [pieces])

  // Selected by default: primary + suggested (not OOF until revealed)
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(recommendations.flatMap((r) => [
      ...r.recs.primary, ...r.recs.suggested,
    ].map((p) => p.id)))
  )
  // Track which piece groups have revealed their out-of-filter products
  const [oofVisible, setOofVisible] = useState({})

  function toggleProduct(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function revealOof(pieceId, oofProducts) {
    setOofVisible(prev => ({ ...prev, [pieceId]: true }))
    setSelectedIds(prev => {
      const next = new Set(prev)
      oofProducts.forEach(p => next.add(p.id))
      return next
    })
  }

  const selectedCount = selectedIds.size

  return (
    <div className={styles.results}>
      <div className={styles.outfitBanner}>
        <div className={styles.outfitCount}>{outfitCount}</div>
        <div className={styles.outfitText}>
          <p className={styles.outfitMain}>estimated outfits</p>
          <p className={styles.outfitSub}>Mix and match your {pieces.length} pieces</p>
        </div>
      </div>

      <section className={styles.resultsSection}>
        <h3 className={styles.resultsSectionTitle}>Your Core Pieces</h3>
        <p className={styles.resultsSectionSub}>
          {onSave ? 'Tap a product to deselect it before saving' : 'Top picks for your budget and priorities'}
        </p>

        {recommendations.map(({ pieceId, option, recs }) => {
          const { primary, suggested, outOfFilter, filterMismatch, specificName } = recs
          const oof        = outOfFilter ?? []
          const oofShown   = oofVisible[pieceId] ?? false
          const hasMain    = primary.length > 0 || suggested.length > 0

          return (
            <div key={pieceId} className={styles.pieceGroup}>
              <div className={styles.pieceGroupHeader}>
                <span className={styles.pieceGroupName}>
                  {specificName || option.name}
                </span>
                <span className={styles.pieceGroupBudget}>{BUDGET_BY_ID[budgets[pieceId]]?.label ?? ''}</span>
              </div>

              {/* Exact-match products */}
              {primary.length > 0 && (
                <div className={styles.productList}>
                  {primary.map((p) => (
                    <ProductCard key={p.id} product={p} priorities={priorities}
                      isSelected={selectedIds.has(p.id)}
                      onToggle={onSave ? () => toggleProduct(p.id) : null}
                    />
                  ))}
                </div>
              )}

              {/* Broader category suggestions (fills up to maxCount) */}
              {suggested.length > 0 && (
                <>
                  <p className={styles.suggestedLabel}>
                    {primary.length > 0 ? 'You might also like' : 'Top picks'}
                  </p>
                  <div className={styles.productList}>
                    {suggested.map((p) => (
                      <ProductCard key={p.id} product={p} priorities={priorities}
                        isSelected={selectedIds.has(p.id)}
                        onToggle={onSave ? () => toggleProduct(p.id) : null}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Out-of-filter notice */}
              {!hasMain && oof.length > 0 && (
                <div className={styles.oofNotice}>
                  <p className={styles.oofText}>
                    No <strong>{specificName ?? option.name}</strong> found within your current filters
                    {filterMismatch
                      ? `, but ${oof.length} ${oof.length === 1 ? 'option is' : 'options are'} ${filterMismatch}`
                      : ''}.
                  </p>
                  {!oofShown ? (
                    <button className={styles.oofBtn} onClick={() => revealOof(pieceId, oof)}>
                      View anyway →
                    </button>
                  ) : (
                    <div className={styles.productList}>
                      {oof.map((p) => (
                        <ProductCard key={p.id} product={p} priorities={priorities}
                          isSelected={selectedIds.has(p.id)}
                          onToggle={onSave ? () => toggleProduct(p.id) : null}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!hasMain && oof.length === 0 && (
                <p className={styles.noProducts}>
                  No matches in catalog — browse {option.name.toLowerCase()}s on your favourite retailer.
                </p>
              )}
            </div>
          )
        })}
      </section>

      {complements.length > 0 && (
        <section className={styles.resultsSection}>
          <h3 className={styles.resultsSectionTitle}>Also Consider</h3>
          <p className={styles.resultsSectionSub}>These pair well with your picks</p>
          <div className={styles.complementGrid}>
            {complements.map((id) => (
              <ComplementCard key={id} id={id} onAddPiece={onAddPiece} gender={gender} />
            ))}
          </div>
        </section>
      )}

      {onSave && !saved && (
        <button
          className={styles.saveListBtn}
          onClick={() => onSave(selectedIds)}
          disabled={selectedCount === 0}
        >
          Save {selectedCount} {selectedCount === 1 ? 'product' : 'products'} to My List
        </button>
      )}
      {saved && (
        <div className={styles.savedBanner}>
          ✓ Saved to My List — view in My List tab
        </div>
      )}

      <button className={styles.resetBtn} onClick={onReset}>Start over</button>
    </div>
  )
}
