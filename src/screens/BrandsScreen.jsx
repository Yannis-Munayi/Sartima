import { useEffect, useMemo, useRef, useState } from 'react'
import { BRANDS } from '../data/brands'
import { useNavigation } from '../context/NavigationContext'
import { useStyleAffinity } from '../hooks/useStyleAffinity'
import { fetchPhotosWithFallback } from '../services/stockPhotos'
import { scoreBrands, sortByScore, splitByMatch } from '../services/styleRanking'
import AuthWidget from '../components/AuthWidget'
import styles from './BrandsScreen.module.css'

const ALL_BRANDS = Object.values(BRANDS)

// Brands at or above this share of the best brand fit are listed under
// "Closest to your style"; the rest follow, still strongest first
const MATCH_THRESHOLD = 0.35

const POSITIONING_GROUPS = [
  { label: 'Luxury',       key: 'luxury' },
  { label: 'Premium',      key: 'premium' },
  { label: 'Contemporary', key: 'contemporary' },
  { label: 'Streetwear',   key: 'streetwear' },
  { label: 'Value',        key: 'value' },
]

const BADGE_LABEL = {
  luxury:       '✦ Luxury',
  premium:      '◆ Premium',
  contemporary: '● Contemporary',
  streetwear:   '▲ Streetwear',
  value:        '○ Value',
}

const BADGE_COLOR = {
  luxury:       '#b8956a',
  premium:      '#7a8c6e',
  contemporary: '#5a7fa0',
  streetwear:   '#e8735a',
  value:        '#888',
}

function BrandCard({ brand, onOpen }) {
  const [photo, setPhoto]   = useState(null)
  const [loaded, setLoaded] = useState(false)
  const cardRef    = useRef(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !fetchedRef.current) {
          fetchedRef.current = true
          fetchPhotosWithFallback([
            brand.imageQuery ?? `${brand.name} fashion brand editorial campaign`,
            `${brand.name} fashion`,
          ], 1).then(([url] = []) => setPhoto(url ?? null))
          obs.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [brand.id, brand.name, brand.imageQuery])

  const color = BADGE_COLOR[brand.positioning] ?? '#888'
  const label = BADGE_LABEL[brand.positioning] ?? brand.positioning

  return (
    <div ref={cardRef} className={styles.card} onClick={() => onOpen(brand.id)}>
      <div className={styles.cardBg}>
        {photo && (
          <img
            src={photo}
            alt={brand.name}
            className={styles.cardImg}
            style={{ opacity: loaded ? 1 : 0 }}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        )}
      </div>
      <div className={styles.cardOverlay} />
      {label && (
        <span className={styles.positioningChip} style={{ color, borderColor: `${color}55` }}>
          {label}
        </span>
      )}
      <div className={styles.cardFooter}>
        <span className={styles.cardName}>{brand.name}</span>
        {brand.tagline && <span className={styles.cardTagline}>{brand.tagline}</span>}
      </div>
    </div>
  )
}

export default function BrandsScreen() {
  const navigate = useNavigation()
  const { affinity, interests } = useStyleAffinity()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const query = search.toLowerCase().trim()

  const brandScores = useMemo(() => scoreBrands(ALL_BRANDS, affinity, interests), [affinity, interests])
  const isRanked    = Object.keys(brandScores).length > 0

  const displayBrands = useMemo(() => {
    let list = ALL_BRANDS
    if (filter !== 'all') list = list.filter((b) => b.positioning === filter)
    if (query) {
      list = list.filter((b) =>
        b.name.toLowerCase().includes(query) ||
        b.tagline?.toLowerCase().includes(query) ||
        b.aesthetics?.some((a) => a.toLowerCase().includes(query))
      )
    }
    return isRanked ? sortByScore(list, (b) => brandScores[b.id] ?? 0) : list
  }, [filter, query, isRanked, brandScores])

  // Default view once the user has a style profile: every brand, best fit
  // first, in place of the positioning groups
  const ranked = useMemo(
    () => isRanked ? splitByMatch(ALL_BRANDS, (b) => brandScores[b.id] ?? 0, MATCH_THRESHOLD) : null,
    [isRanked, brandScores],
  )

  function handleOpen(id) {
    navigate('brand:' + id)
  }

  const showFlat = filter !== 'all' || !!query

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.title}>Brands</h1>
            <p className={styles.sub}>
              {ALL_BRANDS.length} brands{isRanked ? ' · sorted by your style' : ''}
            </p>
          </div>
          <AuthWidget />
        </div>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            className={styles.search}
            placeholder="Search brands…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-page-search
          />
          {search && (
            <button className={styles.searchClear} onClick={() => setSearch('')}>×</button>
          )}
        </div>
        <div className={styles.filterRow}>
          {[
            { key: 'all',          label: 'All' },
            { key: 'luxury',       label: '✦ Luxury' },
            { key: 'premium',      label: '◆ Premium' },
            { key: 'streetwear',   label: '▲ Street' },
            { key: 'contemporary', label: '● Contemporary' },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`${styles.filterBtn} ${filter === key ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.body}>
        {showFlat ? (
          displayBrands.length === 0 ? (
            <p className={styles.noResults}>
              No brands match &ldquo;{query || filter}&rdquo;
            </p>
          ) : (
            <div className={styles.grid}>
              {displayBrands.map((b) => (
                <BrandCard key={b.id} brand={b} onOpen={handleOpen} />
              ))}
            </div>
          )
        ) : ranked ? (
          [
            { label: 'Closest to your style', items: ranked.matches },
            { label: 'More to explore',       items: ranked.rest },
          ].map(({ label, items }) => items.length > 0 && (
            <section key={label} className={styles.section}>
              <h2 className={styles.sectionLabel}>{label}</h2>
              <div className={styles.grid}>
                {items.map((b) => (
                  <BrandCard key={b.id} brand={b} onOpen={handleOpen} />
                ))}
              </div>
            </section>
          ))
        ) : (
          POSITIONING_GROUPS.map((group) => {
            const grouped = ALL_BRANDS.filter((b) => b.positioning === group.key)
            if (grouped.length === 0) return null
            return (
              <section key={group.key} className={styles.section}>
                <h2 className={styles.sectionLabel}>{group.label}</h2>
                <div className={styles.grid}>
                  {grouped.map((b) => (
                    <BrandCard key={b.id} brand={b} onOpen={handleOpen} />
                  ))}
                </div>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
