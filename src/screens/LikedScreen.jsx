import { useState, useEffect } from 'react'
import { useWishlist } from '../context/WishlistContext'
import { useApp } from '../context/AppContext'
import { STYLES, getPinterestUrl } from '../data/styles'
import { LABEL_WEIGHTS, getItemLabels } from '../data/labels'
import { fetchPhotosWithFallback } from '../services/stockPhotos'
import styles from './LikedScreen.module.css'

function calculateAesthetics(likedItems) {
  const scores = Object.fromEntries(Object.keys(STYLES).map((k) => [k, 0]))
  for (const item of likedItems) {
    for (const [style, weight] of Object.entries(item.styleWeights || {})) {
      if (scores[style] !== undefined) scores[style] += weight
    }
    for (const label of getItemLabels(item)) {
      const lw = LABEL_WEIGHTS[label]
      if (!lw) continue
      for (const [style, weight] of Object.entries(lw)) {
        if (scores[style] !== undefined) scores[style] += weight
      }
    }
  }
  return Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .filter(([, s]) => s > 0)
    .slice(0, 5)
}

function LikedItemCard({ entry, onRemove }) {
  const [photo, setPhoto]   = useState(null)
  const [loaded, setLoaded] = useState(false)
  const { state } = useApp()
  const gender = state.gender

  useEffect(() => {
    let cancelled = false
    const hint = gender === 'women' ? 'women' : gender === 'men' ? 'men' : ''
    const queries = [
      `${entry.name} ${hint} fashion outfit`.trim(),
      `${entry.name} ${hint} outfit`.trim(),
      `${entry.name} fashion`,
    ]
    fetchPhotosWithFallback(queries, 1).then(([url] = []) => {
      if (!cancelled) setPhoto(url ?? null)
    })
    return () => { cancelled = true }
  }, [entry.id, entry.name, gender])

  return (
    <div className={styles.itemCard}>
      <div className={styles.itemPhoto} style={{ background: entry.gradient }}>
        {photo && (
          <img
            src={photo}
            alt={entry.name}
            className={styles.itemImg}
            style={{ opacity: loaded ? 1 : 0 }}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        )}
        <button className={styles.removeBtn} onClick={() => onRemove(entry.id)} aria-label="Remove">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p className={styles.itemName}>{entry.name}</p>
    </div>
  )
}

function AestheticResult({ rank, styleId, score, maxScore, gender }) {
  const s = STYLES[styleId]
  if (!s) return null
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0

  return (
    <a
      href={getPinterestUrl(s, gender)}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.resultRow}
    >
      <div className={styles.resultSwatch} style={{ background: s.gradient }}>
        <span>{s.icon}</span>
      </div>
      <div className={styles.resultInfo}>
        <div className={styles.resultTop}>
          <span className={styles.resultRank}>#{rank}</span>
          <span className={styles.resultName}>{s.name}</span>
          <span className={styles.resultArrow}>↗</span>
        </div>
        <div className={styles.resultBarTrack}>
          <div className={styles.resultBarFill} style={{ width: `${pct}%`, background: s.color }} />
        </div>
      </div>
    </a>
  )
}

export default function LikedScreen() {
  const { liked, removeFromLiked } = useWishlist()
  const { state } = useApp()
  const gender = state.gender
  const [results, setResults] = useState(null)
  const [generating, setGenerating] = useState(false)

  function generate() {
    setGenerating(true)
    setTimeout(() => {
      setResults(calculateAesthetics(liked))
      setGenerating(false)
    }, 600)
  }

  const maxScore = results?.[0]?.[1] ?? 1

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <h1 className={styles.title}>Liked</h1>
        {liked.length > 0 && (
          <p className={styles.sub}>{liked.length} item{liked.length !== 1 ? 's' : ''} liked</p>
        )}
      </div>

      {liked.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>♥</span>
          <p className={styles.emptyTitle}>No liked items yet</p>
          <p className={styles.emptySub}>Swipe right on items in the Discover tab to like them.</p>
        </div>
      ) : (
        <div className={styles.body}>
          {/* Items grid */}
          <div className={styles.itemGrid}>
            {liked.map((entry) => (
              <LikedItemCard key={entry.id} entry={entry} onRemove={removeFromLiked} />
            ))}
          </div>

          {/* Generate button */}
          <button
            className={styles.generateBtn}
            onClick={generate}
            disabled={generating}
          >
            {generating ? 'Analysing…' : results ? 'Regenerate aesthetics' : '✦ Generate my aesthetics'}
          </button>

          {/* Results */}
          {results && (
            <div className={styles.resultsPanel}>
              <p className={styles.resultsLabel}>Your aesthetic profile</p>
              {results.length === 0 ? (
                <p className={styles.noResults}>Not enough data — like more items to get a reading.</p>
              ) : (
                <div className={styles.resultsList}>
                  {results.map(([id, score], i) => (
                    <AestheticResult
                      key={id}
                      rank={i + 1}
                      styleId={id}
                      score={score}
                      maxScore={maxScore}
                      gender={gender}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
