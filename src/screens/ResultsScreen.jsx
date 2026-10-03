import { useEffect, useState } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { useNavigation } from '../context/NavigationContext'
import { recordSignal } from '../services/interestTracker'
import { STYLES, getPinterestUrl, getStyleName } from '../data/styles'
import styles from './screens.module.css'

// Quiz completions already persisted this session (survives remounts)
const savedQuizIds = new Set()

function getTopStyles(scores, count = 3) {
  return Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .filter(([, score]) => score > 0)
    .slice(0, count)
}

function AestheticBlend({ styleScores, gender }) {
  const top = getTopStyles(styleScores, 4)
  if (top.length < 2) return null

  const total = top.reduce((s, [, v]) => s + v, 0)
  const segments = top.map(([id, score]) => ({
    style: STYLES[id],
    pct:   Math.round((score / total) * 100),
  }))

  // Adjust so percentages sum to exactly 100
  const diff = 100 - segments.reduce((s, seg) => s + seg.pct, 0)
  segments[0].pct += diff

  return (
    <section className={styles.resultSection}>
      <h3 className={styles.sectionTitle}>Your aesthetic blend</h3>

      {/* Stacked bar */}
      <div className={styles.blendBar}>
        {segments.map((seg, i) => (
          <div
            key={seg.style.id}
            className={styles.blendSegment}
            style={{
              width:        `${seg.pct}%`,
              background:   seg.style.color,
              borderRadius: i === 0 ? '8px 0 0 8px' : i === segments.length - 1 ? '0 8px 8px 0' : '0',
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className={styles.blendLegend}>
        {segments.map((seg) => (
          <div key={seg.style.id} className={styles.blendLegendItem}>
            <span className={styles.blendDot} style={{ background: seg.style.color }} />
            <span className={styles.blendPct}>{seg.pct}%</span>
            <span className={styles.blendName}>{getStyleName(seg.style, gender)}</span>
          </div>
        ))}
      </div>

      {/* Human-readable sentence */}
      <p className={styles.blendSentence}>
        You are{' '}
        {segments.map((seg, i) => (
          <span key={seg.style.id}>
            <strong style={{ color: seg.style.color }}>{seg.pct}% {getStyleName(seg.style, gender)}</strong>
            {i < segments.length - 2 ? ', ' : i === segments.length - 2 ? ' and ' : ''}
          </span>
        ))}
        .
      </p>
    </section>
  )
}

function ScoreBar({ score, max, color }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0
  return (
    <div className={styles.scoreBarTrack}>
      <div
        className={styles.scoreBarFill}
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

function PinterestIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
    </svg>
  )
}

function ShareResults({ primaryStyle, gender }) {
  const [copied, setCopied] = useState(false)
  const text = `My style aesthetic is ${getStyleName(primaryStyle, gender)} — I just took the Sartima quiz.`
  const url  = window.location.href

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Sartima Results', text, url })
      } catch {}
      return
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {}
  }

  return (
    <button
      onClick={handleShare}
      className={styles.shareBtn}
      style={{ background: primaryStyle.gradient }}
    >
      {copied ? '✓ Copied to clipboard!' : '↗ Share your results'}
    </button>
  )
}

export default function ResultsScreen() {
  const { user }            = useAuth()
  const { state, dispatch } = useApp()
  const navigate            = useNavigation()
  const { styleScores, responses, selectedSeasons, selectedCategories, itemQueue, gender } = state

  function openAesthetic(id) {
    navigate(`aesthetic:${id}`)
  }

  // Auto-save results to Firestore if signed in. Keyed by the quiz's stable
  // id (module-level set + fixed doc id) so remounts — e.g. the sign-in →
  // onboarding → back-to-results flow — can't double-save or double-signal.
  useEffect(() => {
    const quizId = state.quizId
    if (!user || !quizId || savedQuizIds.has(quizId)) return
    savedQuizIds.add(quizId)

    const likedItems = itemQueue
      .filter((item) => responses[item.id]?.liked)
      .map((item) => ({
        id:         item.id,
        name:       item.name,
        categoryId: item.categoryId ?? item.parentType ?? item.type ?? null,
      }))

    setDoc(doc(db, 'users', user.uid, 'quizzes', quizId), {
      timestamp: serverTimestamp(),
      styleScores,
      likedItems,
      selectedSeasons,
      selectedCategories,
    }).catch(() => {}) // fail silently

    recordSignal(user, 'quizComplete', { styleScores })
  }, [user])  // eslint-disable-line

  const topStyles = getTopStyles(styleScores)
  const maxScore = topStyles[0]?.[1] ?? 1
  const likedCount = Object.values(responses).filter((r) => r.liked).length

  const primary = topStyles[0]
  const secondaries = topStyles.slice(1)
  const isMixed = secondaries.length > 0 && secondaries[0][1] / maxScore > 0.55

  if (topStyles.length === 0) {
    return (
      <div className={styles.screen} style={{ alignItems: 'center', justifyContent: 'center', gap: 'var(--space-6)' }}>
        <h2 style={{ color: '#fff', textAlign: 'center' }}>Not enough data yet</h2>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
          Go back and interact with more items to get a reading.
        </p>
        <button className={styles.primaryBtn} onClick={() => dispatch({ type: 'RESTART' })}>
          Start over
        </button>
      </div>
    )
  }

  const primaryStyle = STYLES[primary[0]]
  const secondaryStyle = secondaries[0] ? STYLES[secondaries[0][0]] : null

  return (
    <div className={styles.resultsWrapper}>

      {/* Hero — clicking opens the aesthetic in Explore */}
      <button
        className={styles.resultsHeroLink}
        style={{ background: primaryStyle.gradient }}
        onClick={() => openAesthetic(primaryStyle.id)}
        aria-label={`Explore ${primaryStyle.name}`}
      >
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <span className={styles.heroIcon}>{primaryStyle.icon}</span>
          <h1 className={styles.heroTitle}>Your style</h1>
          <h2 className={styles.heroStyleName}>{getStyleName(primaryStyle, gender)}</h2>
          {isMixed && secondaryStyle && (
            <p className={styles.heroMixed}>with {getStyleName(secondaryStyle, gender)} elements</p>
          )}
          <p className={styles.heroTagline}>{primaryStyle.tagline}</p>
          <span className={styles.heroPinterestHint}>
            Explore this aesthetic →
          </span>
        </div>
      </button>

      <div className={styles.resultsBody}>

        {/* Description */}
        <section className={styles.resultSection}>
          <p className={styles.primaryDesc}>{primaryStyle.description}</p>
        </section>

        {/* Aesthetic blend */}
        <AestheticBlend styleScores={styleScores} gender={gender} />

        {/* Key pieces — each tag opens a Pinterest search for that specific piece + style */}
        <section className={styles.resultSection}>
          <h3 className={styles.sectionTitle}>Pieces to build around</h3>
          <div className={styles.iconsList}>
            {primaryStyle.icons.map((piece) => (
              <a
                key={piece}
                href={getPinterestUrl(primaryStyle, gender, piece)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.pieceTagLink}
              >
                {piece}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M7 17L17 7M7 7h10v10" />
                </svg>
              </a>
            ))}
          </div>
        </section>

        {/* Score breakdown — each row is clickable */}
        <section className={styles.resultSection}>
          <h3 className={styles.sectionTitle}>Your aesthetic breakdown</h3>
          <div className={styles.scoreList}>
            {getTopStyles(styleScores, 5).map(([id, score]) => {
              const s = STYLES[id]
              return (
                <button
                  key={id}
                  className={styles.scoreRowLink}
                  onClick={() => openAesthetic(s.id)}
                >
                  <div className={styles.scoreLabel}>
                    <span>{s.icon}</span>
                    <span>{getStyleName(s, gender)}</span>
                  </div>
                  <ScoreBar score={score} max={maxScore} color={s.color} />
                  <span className={styles.scoreNum}>{score}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.scoreArrow} aria-hidden="true">
                    <path d="M7 17L17 7M7 7h10v10" />
                  </svg>
                </button>
              )
            })}
          </div>
        </section>

        {/* Mix note with clickable style names */}
        {isMixed && secondaryStyle && (
          <section className={styles.mixNote}>
            <p>
              Your taste isn't one-note — you're drawn to both{' '}
              <a href={getPinterestUrl(primaryStyle, gender)} target="_blank" rel="noopener noreferrer" className={styles.mixLink}>
                {getStyleName(primaryStyle, gender)}
              </a>{' '}
              and{' '}
              <a href={getPinterestUrl(secondaryStyle, gender)} target="_blank" rel="noopener noreferrer" className={styles.mixLink}>
                {getStyleName(secondaryStyle, gender)}
              </a>
              . That's actually a strength: the best personal styles are always a blend.
            </p>
          </section>
        )}

        {/* Stats */}
        <section className={styles.statRow}>
          <div className={styles.stat}>
            <span className={styles.statNum}>{likedCount}</span>
            <span className={styles.statLabel}>pieces liked</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>{topStyles.length}</span>
            <span className={styles.statLabel}>aesthetics matched</span>
          </div>
        </section>

        <ShareResults primaryStyle={primaryStyle} gender={gender} />

        <div className={styles.resultActions}>
          {user ? (
            <button
              className={styles.profileBtn}
              onClick={() => dispatch({ type: 'GO_TO_PROFILE' })}
            >
              View my profile
            </button>
          ) : (
            <button
              className={styles.profileBtn}
              onClick={() => dispatch({ type: 'GO_TO_AUTH', returnTo: 'results' })}
            >
              Save results — sign in
            </button>
          )}
          <button
            className={`${styles.primaryBtn} ${styles.fullWidth}`}
            onClick={() => dispatch({ type: 'RESTART' })}
          >
            Start over
          </button>
        </div>
      </div>
    </div>
  )
}
