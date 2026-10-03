import { useEffect, useMemo, useRef, useState } from 'react'
import { STYLES, getPinterestUrl } from '../../data/styles'
import { CLOTHING_ITEMS } from '../../data/categories'
import { getLooks, getLookPieces } from '../../data/looks'
import { fetchPhotos } from '../../services/stockPhotos'
import { useApp } from '../../context/AppContext'
import { OutfitPhoto } from './shared'
import styles from '../AestheticScreen.module.css'

const ITEM_LOOKUP = (() => {
  const map = {}
  for (const [catId, items] of Object.entries(CLOTHING_ITEMS)) {
    for (const item of items) map[item.id] = { ...item, categoryId: catId }
  }
  return map
})()

const SEASONS = ['spring', 'summer', 'fall', 'winter']

function LookCard({ look, genderFilter }) {
  const [photo, setPhoto]           = useState(null)
  const [loaded, setLoaded]         = useState(false)
  const [open, setOpen]             = useState(false)
  const [menPhotos, setMenPhotos]   = useState([])
  const [womenPhotos, setWomenPhotos] = useState([])
  const [gridLoading, setGridLoading] = useState(false)
  const fetchedRef = useRef(false)

  const thumbQuery = genderFilter === 'women' ? (look.womenPexelsQuery ?? look.pexelsQuery) : look.pexelsQuery

  useEffect(() => {
    let cancelled = false
    setPhoto(null)
    setLoaded(false)
    fetchPhotos(thumbQuery, 1).then(([url] = []) => {
      if (!cancelled) setPhoto(url ?? null)
    })
    return () => { cancelled = true }
  }, [look.id, thumbQuery])

  function handleToggle() {
    const next = !open
    setOpen(next)
    if (next && !fetchedRef.current) {
      fetchedRef.current = true
      setGridLoading(true)
      const menQ   = look.pexelsQuery
      const womenQ = look.womenPexelsQuery ?? look.pexelsQuery
      const fetchMen   = genderFilter !== 'women' ? fetchPhotos(menQ, 9)   : Promise.resolve([])
      const fetchWomen = genderFilter !== 'men'   ? fetchPhotos(womenQ, 9) : Promise.resolve([])
      Promise.all([fetchMen, fetchWomen]).then(([m, w]) => {
        setMenPhotos(m ?? [])
        setWomenPhotos(w ?? [])
        setGridLoading(false)
      })
    }
  }

  const pieces = look.pieces
    .map((id) => ITEM_LOOKUP[id])
    .filter(Boolean)

  return (
    <div className={styles.lookCard}>
      <button className={styles.lookHeader} onClick={handleToggle}>
        <div className={styles.lookThumb} style={{ background: 'rgba(255,255,255,0.06)' }}>
          {photo && (
            <img
              src={photo}
              alt={look.name}
              className={styles.lookImg}
              style={{ opacity: loaded ? 1 : 0 }}
              onLoad={() => setLoaded(true)}
              onError={() => setLoaded(true)}
            />
          )}
        </div>
        <div className={styles.lookInfo}>
          <p className={styles.lookName}>{look.name}</p>
          <p className={styles.lookVibe}>{look.vibe}</p>
          <div className={styles.lookSeasons}>
            {look.seasons.map((s) => (
              <span key={s} className={styles.seasonChip}>{s}</span>
            ))}
          </div>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className={styles.lookBody}>
          {/* Outfit photo grid */}
          {gridLoading ? (
            <div className={styles.outfitGridLoading}>Loading outfits…</div>
          ) : (menPhotos.length > 0 || womenPhotos.length > 0) && (
            <>
              {menPhotos.length > 0 && (
                <>
                  {womenPhotos.length > 0 && <p className={styles.piecesLabel}>Men's looks</p>}
                  <div className={styles.outfitGrid}>
                    {menPhotos.map((url, i) => (
                      <OutfitPhoto key={`m${i}`} url={url} alt={`${look.name} men outfit ${i + 1}`} />
                    ))}
                  </div>
                </>
              )}
              {womenPhotos.length > 0 && (
                <>
                  {menPhotos.length > 0 && <p className={styles.piecesLabel} style={{ marginTop: 16 }}>Women's looks</p>}
                  <div className={styles.outfitGrid}>
                    {womenPhotos.map((url, i) => (
                      <OutfitPhoto key={`w${i}`} url={url} alt={`${look.name} women outfit ${i + 1}`} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Pieces chips */}
          <p className={styles.piecesLabel}>Pieces in this look</p>
          <div className={styles.piecesList}>
            {pieces.map((item) => (
              <span key={item.id} className={styles.pieceChip}>
                {item.emoji} {item.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function LooksTab({ aestheticId }) {
  const { state, dispatch } = useApp()
  const genderFilter = state.gender
  const [activeSeason, setActiveSeason] = useState(null)
  const [requiredPieces, setRequiredPieces] = useState([])

  const allPieces = useMemo(() => getLookPieces(aestheticId), [aestheticId])
  const filtered  = useMemo(
    () => getLooks(aestheticId, { season: activeSeason, requiredPieces }),
    [aestheticId, activeSeason, requiredPieces]
  )

  function togglePiece(id) {
    setRequiredPieces((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  const hasLooks = getLooks(aestheticId).length > 0
  const genderHint = genderFilter === 'women' ? 'women' : genderFilter === 'men' ? 'men' : ''

  if (!hasLooks) {
    return (
      <div className={styles.emptyLooks}>
        <p className={styles.emptyText}>
          Curated looks for this aesthetic are coming soon. Try browsing the Items tab.
        </p>
        <a
          href={getPinterestUrl(STYLES[aestheticId], genderFilter)}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.pinterestLink}
        >
          📌 Browse on Pinterest →
        </a>
      </div>
    )
  }

  return (
    <div>
      {/* Season filter */}
      <div className={styles.filterRow}>
        <button
          className={`${styles.filterPill} ${!activeSeason ? styles.filterActive : ''}`}
          onClick={() => setActiveSeason(null)}
        >
          All seasons
        </button>
        {SEASONS.map((s) => (
          <button
            key={s}
            className={`${styles.filterPill} ${activeSeason === s ? styles.filterActive : ''}`}
            onClick={() => setActiveSeason(activeSeason === s ? null : s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Piece filter */}
      {allPieces.length > 0 && (
        <div className={styles.pieceFilter}>
          <p className={styles.pieceFilterLabel}>Include piece</p>
          <div className={styles.filterRow}>
            {allPieces.map((id) => {
              const item = ITEM_LOOKUP[id]
              if (!item) return null
              return (
                <button
                  key={id}
                  className={`${styles.filterPill} ${requiredPieces.includes(id) ? styles.filterActive : ''}`}
                  onClick={() => togglePiece(id)}
                >
                  {item.emoji} {item.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Look cards */}
      {filtered.length === 0 ? (
        <p className={styles.emptyText}>No looks match the current filters.</p>
      ) : (
        <div className={styles.looksList}>
          {filtered.map((look) => (
            <LookCard key={`${look.id}-${genderFilter}`} look={look} genderFilter={genderFilter} />
          ))}
        </div>
      )}
    </div>
  )
}
