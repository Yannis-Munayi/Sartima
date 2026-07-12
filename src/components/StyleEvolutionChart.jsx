import { useMemo } from 'react'
import { STYLES, getStyleName } from '../data/styles'
import styles from '../screens/ProfileScreen.module.css'

export default function StyleEvolutionChart({ quizzes, gender }) {
  // Show up to last 6 sessions, oldest → newest
  const sessions = useMemo(() => [...quizzes].reverse().slice(-6), [quizzes])

  if (sessions.length < 2) return null

  const sessionData = sessions.map((quiz) => {
    const top = Object.entries(quiz.styleScores ?? {})
      .sort(([, a], [, b]) => b - a)
      .filter(([, s]) => s > 0)
    const primary = top[0]
    const style = primary ? STYLES[primary[0]] : null
    return { quiz, style }
  })

  const first = sessionData[0]?.style
  const last  = sessionData[sessionData.length - 1]?.style
  const shifted = first && last && first.id !== last.id

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Style evolution</h3>
      {shifted ? (
        <p className={styles.evolutionInsight}>
          You've shifted from{' '}
          <strong style={{ color: first.color }}>{getStyleName(first, gender)}</strong>
          {' '}→{' '}
          <strong style={{ color: last.color }}>{getStyleName(last, gender)}</strong>
        </p>
      ) : (
        <p className={styles.evolutionInsight}>
          Consistently <strong style={{ color: last?.color }}>{last ? getStyleName(last, gender) : '—'}</strong>
        </p>
      )}
      <div className={styles.evolutionRow}>
        {sessionData.map((d, i) => (
          <div key={d.quiz.id} className={styles.evolutionItem}>
            <div
              className={styles.evolutionDot}
              style={{ background: d.style?.gradient ?? 'rgba(255,255,255,0.1)' }}
            >
              <span>{d.style?.icon ?? '?'}</span>
            </div>
            {i < sessionData.length - 1 && (
              <div
                className={styles.evolutionArrow}
                style={{ color: d.style?.color ?? 'rgba(255,255,255,0.2)' }}
              >→</div>
            )}
          </div>
        ))}
      </div>
      <div className={styles.evolutionLabels}>
        {sessionData.map((d, i) => (
          <div key={d.quiz.id} className={styles.evolutionLabelCell}>
            <p className={styles.evolutionLabel}>
              {d.style ? getStyleName(d.style, gender) : '—'}
            </p>
            <p className={styles.evolutionSub}>#{i + 1}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
