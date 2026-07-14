import { useEffect, useMemo, useRef, useState } from 'react'
import { PRODUCTS } from '../../data/products'
import { getGuideForAesthetic } from '../../data/itemGuide'
import { fetchPhotos } from '../../services/pexels'
import { useApp } from '../../context/AppContext'
import { useInterests } from '../../context/InterestContext'
import { OutfitPhoto } from './shared'
import styles from '../AestheticScreen.module.css'

const GUIDE_CAT_PARENTS = {
  jeans:     ['bottoms'],
  outerwear: ['outerwear'],
  sneakers:  ['footwear'],
  boots:     ['footwear'],
  loafers:   ['footwear'],
  hoodies:   ['tops'],
  shirts:    ['tops'],
  suits:     ['outerwear'],
  trousers:  ['bottoms'],
}

function GuideItem({ type, catLabel, catId, aestheticId, isOpen, onToggle, gender }) {
  const [menPhotos, setMenPhotos]     = useState([])
  const [womenPhotos, setWomenPhotos] = useState([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const { recordInterest } = useInterests() ?? {}
  const fetchedRef = useRef(null)

  const picks = useMemo(() =>
    PRODUCTS
      .filter((p) =>
        (p.styleWeights?.[aestheticId] ?? 0) >= 1 &&
        (GUIDE_CAT_PARENTS[catId] ?? []).includes(p.parentType)
      )
      .sort((a, b) => (b.styleWeights?.[aestheticId] ?? 0) - (a.styleWeights?.[aestheticId] ?? 0))
      .slice(0, 3),
    [catId, aestheticId]
  )

  useEffect(() => {
    if (isOpen && fetchedRef.current !== gender) {
      fetchedRef.current = gender
      setPhotosLoading(true)
      const fetchMen   = gender !== 'women' ? fetchPhotos(`${type.name} men outfit`, 9)   : Promise.resolve([])
      const fetchWomen = gender !== 'men'   ? fetchPhotos(`${type.name} women outfit`, 9) : Promise.resolve([])
      Promise.all([fetchMen, fetchWomen]).then(([m, w]) => {
        setMenPhotos(m ?? [])
        setWomenPhotos(w ?? [])
        setPhotosLoading(false)
      })
    }
  }, [isOpen, type.name, catLabel, gender])

  return (
    <div className={styles.guideItem} onClick={onToggle} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onToggle()}>
      <div className={styles.guideItemTop}>
        <span className={styles.guideItemName}>{type.name}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      {isOpen && (
        <div className={styles.guideItemBody}>
          <p className={styles.guideItemDesc}>{type.description}</p>
          {type.iconic && (
            <p className={styles.guideItemIconic}>
              <span className={styles.guideIconicLabel}>Iconic examples: </span>
              {type.iconic}
            </p>
          )}
          {photosLoading ? (
            <div className={styles.outfitGridLoading}>Loading photos…</div>
          ) : (
            <>
              {menPhotos.length > 0 && (
                <>
                  {womenPhotos.length > 0 && <p className={styles.piecesLabel}>Men</p>}
                  <div className={styles.outfitGrid}>
                    {menPhotos.map((url, i) => (
                      <OutfitPhoto key={`m${i}`} url={url}
                        alt={`${type.name} ${catLabel} men ${i + 1}`}
                        wishlistEntry={{ id: `photo:${catLabel}:${type.name}:m${i}`, label: type.name, catLabel }}
                      />
                    ))}
                  </div>
                </>
              )}
              {womenPhotos.length > 0 && (
                <>
                  {menPhotos.length > 0 && <p className={styles.piecesLabel} style={{ marginTop: 12 }}>Women</p>}
                  <div className={styles.outfitGrid}>
                    {womenPhotos.map((url, i) => (
                      <OutfitPhoto key={`w${i}`} url={url}
                        alt={`${type.name} ${catLabel} women ${i + 1}`}
                        wishlistEntry={{ id: `photo:${catLabel}:${type.name}:w${i}`, label: type.name, catLabel }}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {picks.length > 0 && (
            <div className={styles.guideProductRow}>
              {picks.map((p) => (
                <div key={p.id} className={styles.guideProductPick}>
                  <div>
                    <p className={styles.guidePickBrand}>{p.brand}</p>
                    <p className={styles.guidePickName}>{p.name}</p>
                  </div>
                  {p.shopUrl && (
                    <a
                      href={p.shopUrl} target="_blank" rel="noopener noreferrer" className={styles.guidePickShop}
                      onClick={() => recordInterest?.('shop', { product: p })}
                    >
                      Shop ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function GuideTab({ aestheticId }) {
  const { state, dispatch } = useApp()
  const gender = state.gender
  const [expanded, setExpanded] = useState(null)
  const categories = useMemo(() => getGuideForAesthetic(aestheticId), [aestheticId])

  if (categories.length === 0) {
    return <p className={styles.emptyText}>No guide content for this aesthetic yet.</p>
  }

  return (
    <div className={styles.guideList}>
      {categories.map((cat) => (
        <section key={cat.id} className={styles.guideSection}>
          <div className={styles.guideSectionHeader}>
            <span className={styles.guideSectionEmoji}>{cat.emoji}</span>
            <div>
              <p className={styles.guideSectionTitle}>{cat.label}</p>
              <p className={styles.guideSectionIntro}>{cat.intro}</p>
            </div>
          </div>

          {cat.types.map((type) => {
            const typeId = `${cat.id}-${type.name}`
            return (
              <GuideItem
                key={`${typeId}-${gender}`}
                type={type}
                catLabel={cat.label}
                catId={cat.id}
                aestheticId={aestheticId}
                isOpen={expanded === typeId}
                onToggle={() => setExpanded(expanded === typeId ? null : typeId)}
                gender={gender}
              />
            )
          })}
        </section>
      ))}
    </div>
  )
}
