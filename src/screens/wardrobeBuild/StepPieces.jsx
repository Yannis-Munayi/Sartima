import { useEffect, useRef, useState } from 'react'
import { fetchPhotosWithFallback } from '../../services/pexels'
import { PIECE_OPTIONS } from '../../services/wardrobeRecommend'
import styles from '../WardrobeBuildScreen.module.css'

function PieceCard({ piece, isSelected, onToggle, gender }) {
  const [photo, setPhoto]   = useState(null)
  const [loaded, setLoaded] = useState(false)
  const cardRef  = useRef(null)
  const fetched  = useRef(false)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fetched.current) {
        fetched.current = true
        const hint = gender === 'women' ? 'women' : gender === 'men' ? 'men' : ''
        fetchPhotosWithFallback([
          `${piece.photoQuery} ${hint}`.trim(),
          `${piece.name} ${hint} fashion outfit`.trim(),
          `${piece.name} fashion`,
        ], 1).then(([url] = []) => setPhoto(url ?? null))
        obs.disconnect()
      }
    }, { rootMargin: '120px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [piece.id, gender])

  return (
    <button
      ref={cardRef}
      className={`${styles.pieceCard} ${isSelected ? styles.pieceCardSelected : ''}`}
      onClick={() => onToggle(piece.id)}
    >
      <div className={styles.pieceCardBg}>
        {photo && (
          <img src={photo} alt={piece.name} className={styles.pieceCardImg}
            style={{ opacity: loaded ? 1 : 0 }}
            onLoad={() => setLoaded(true)} onError={() => setLoaded(true)}
          />
        )}
        <div className={styles.pieceCardOverlay} />
      </div>
      {isSelected && <div className={styles.pieceCardSelectedOverlay} />}
      {isSelected && <span className={styles.pieceCheck}>✓</span>}
      <div className={styles.pieceCardFooter}>
        <span className={styles.pieceName}>{piece.name}</span>
      </div>
    </button>
  )
}

export default function StepPieces({ selected, onToggle, onNotSure, onNext, gender }) {
  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>What pieces are you looking for?</h2>
      <p className={styles.stepSub}>Select everything you're interested in — no limits.</p>

      <div className={styles.pieceGrid}>
        {PIECE_OPTIONS.map((piece) => (
          <PieceCard key={piece.id} piece={piece}
            isSelected={selected.includes(piece.id)}
            onToggle={onToggle} gender={gender}
          />
        ))}
      </div>

      <button className={styles.notSureBtn} onClick={onNotSure}>
        ✨ Not sure yet? Show me a starter capsule
      </button>

      <button className={styles.nextBtn} onClick={onNext} disabled={selected.length === 0}>
        Next: Set your budget →
      </button>
    </div>
  )
}
