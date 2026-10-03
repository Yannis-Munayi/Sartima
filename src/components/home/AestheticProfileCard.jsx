import { useMemo } from 'react'
import { STYLES, getStyleName } from '../../data/styles'
import { useApp } from '../../context/AppContext'
import styles from '../../screens/HomeScreen.module.css'

export default function AestheticProfileCard({ navigate, gender }) {
  const { state } = useApp()

  const topStyles = useMemo(() => {
    const total = Object.values(state.styleScores).reduce((a, b) => a + b, 0)
    if (total === 0) return []
    return Object.entries(state.styleScores)
      .filter(([, s]) => s > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id, score]) => ({ id, score, pct: Math.round((score / total) * 100) }))
  }, [state.styleScores])

  const swipedCount = Object.keys(state.responses).length

  if (topStyles.length === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Your Aesthetic Profile</h2>
            <p className={styles.sectionSub}>Rate looks to reveal your style breakdown</p>
          </div>
        </div>
        <div className={styles.aestheticBarsEmpty}>
          <div className={styles.aestheticBarGhost} />
          <div className={styles.aestheticBarGhost} style={{ width: '70%' }} />
          <div className={styles.aestheticBarGhost} style={{ width: '45%' }} />
        </div>
        <button className={styles.quizCTABtn} onClick={() => navigate('quiz:start')}>
          Take the style quiz to unlock your profile →
        </button>
      </section>
    )
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Your Aesthetic Profile</h2>
          <p className={styles.sectionSub}>{swipedCount} looks rated · updates live as you swipe</p>
        </div>
      </div>
      <div className={styles.aestheticBars}>
        {topStyles.map(({ id, pct }) => {
          const s = STYLES[id]
          if (!s) return null
          return (
            <button
              key={id}
              className={styles.aestheticBar}
              onClick={() => navigate(`aesthetic:${id}`)}
            >
              <div className={styles.aestheticBarLabel}>
                <span className={styles.aestheticBarName}>{getStyleName(s, gender)}</span>
                <span className={styles.aestheticBarPct}>{pct}%</span>
              </div>
              <div className={styles.aestheticBarTrack}>
                <div
                  className={styles.aestheticBarFill}
                  style={{ width: `${pct}%`, background: s.gradient ?? 'linear-gradient(135deg, var(--accent), var(--accent-secondary))' }}
                />
              </div>
            </button>
          )
        })}
      </div>
      <button
        className={styles.viewResultsBtn}
        onClick={() => navigate('profile:quiz-history')}
      >
        Full breakdown →
      </button>
    </section>
  )
}
