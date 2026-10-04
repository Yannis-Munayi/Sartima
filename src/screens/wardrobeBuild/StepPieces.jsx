import { useEffect, useRef, useState } from 'react'
import { fetchPhotosWithFallback } from '../../services/stockPhotos'
import { PIECE_OPTIONS } from '../../services/wardrobeRecommend'
import styles from '../WardrobeBuildScreen.module.css'

function gapNote({ category, owned, target }) {
  // A gap can come from outfit-generation misses even with the count met
  return owned < target ? `You have ${owned} of ${target} ${category}` : 'Missing from your outfits'
}

function PieceCard({ piece, isSelected, onToggle, gender, note }) {
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
        {note && <span className={styles.pieceNote}>{note}</span>}
      </div>
    </button>
  )
}

export default function StepPieces({ selected, onToggle, onNotSure, onNext, gender, gapPieces = [], drawnPieces = [] }) {
  // Gap pieces lead, then style picks, then the basics — each piece shows
  // once, in the first section that claims it
  const gapIds = new Set(gapPieces.map(({ piece }) => piece.id))
  const picks  = drawnPieces.filter((p) => !gapIds.has(p.id))
  const shown  = new Set([...gapIds, ...picks.map((p) => p.id)])
  const basics = PIECE_OPTIONS.filter((p) => !shown.has(p.id))

  const renderGrid = (list, noteFor = () => null) => (
    <div className={styles.pieceGrid}>
      {list.map((piece) => (
        <PieceCard key={piece.id} piece={piece}
          isSelected={selected.includes(piece.id)}
          onToggle={onToggle} gender={gender} note={noteFor(piece)}
        />
      ))}
    </div>
  )

  const sections = [
    {
      label: "You're short on",
      list:  gapPieces.map(({ piece }) => piece),
      noteFor: (piece) => gapNote(gapPieces.find((g) => g.piece.id === piece.id).gap),
    },
    { label: 'Picked for your style', list: picks },
  ].filter((s) => s.list.length > 0)

  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>What pieces are you looking for?</h2>
      <p className={styles.stepSub}>Select everything you're interested in — no limits.</p>

      {sections.length > 0 ? (
        <>
          {sections.map(({ label, list, noteFor }) => (
            <section key={label} className={styles.pieceSection}>
              <h3 className={styles.pieceSectionLabel}>{label}</h3>
              {renderGrid(list, noteFor)}
            </section>
          ))}
          <section className={styles.pieceSection}>
            <h3 className={styles.pieceSectionLabel}>Wardrobe basics</h3>
            {renderGrid(basics)}
          </section>
        </>
      ) : renderGrid(PIECE_OPTIONS)}

      <button className={styles.notSureBtn} onClick={onNotSure}>
        Not sure yet? Show me a starter capsule
      </button>

      <button className={styles.nextBtn} onClick={onNext} disabled={selected.length === 0}>
        Next: Set your budget →
      </button>
    </div>
  )
}
