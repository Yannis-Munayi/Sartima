import { forwardRef, useState } from 'react'
import { STYLES, getPinterestUrl, getStyleName } from '../data/styles'
import styles from './ProfileScreen.module.css'

function timeAgo(ts) {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const QuizHistorySection = forwardRef(function QuizHistorySection({ quizzes, loading, gender }, ref) {
  const [expanded, setExpanded] = useState(null)

  return (
    <section ref={ref} className={styles.section}>
      <h3 className={styles.sectionTitle}>
        Quiz history
        <span className={styles.quizCount}>{quizzes.length} {quizzes.length === 1 ? 'quiz' : 'quizzes'}</span>
      </h3>

      {loading && <p className={styles.empty}>Loading…</p>}
      {!loading && quizzes.length === 0 && (
        <p className={styles.empty}>No quizzes yet — take one to see your results here.</p>
      )}

      <div className={styles.quizList}>
        {quizzes.map((quiz) => {
          const top = Object.entries(quiz.styleScores ?? {})
            .sort(([, a], [, b]) => b - a)
            .filter(([, s]) => s > 0)
            .slice(0, 3)
          const primary = top[0]
          const primaryStyle = primary ? STYLES[primary[0]] : null
          const isOpen = expanded === quiz.id

          return (
            <div key={quiz.id} className={styles.quizCard}>
              <button
                className={styles.quizCardHeader}
                onClick={() => setExpanded(isOpen ? null : quiz.id)}
              >
                <div className={styles.quizCardLeft}>
                  {primaryStyle && (
                    <div
                      className={styles.quizSwatch}
                      style={{ background: primaryStyle.gradient }}
                    />
                  )}
                  <div>
                    <p className={styles.quizPrimary}>
                      {primaryStyle ? getStyleName(primaryStyle, gender) : 'Unknown'}
                    </p>
                    <p className={styles.quizMeta}>
                      {timeAgo(quiz.timestamp)} · {quiz.likedItems?.length ?? 0} liked
                    </p>
                  </div>
                </div>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {isOpen && (
                <div className={styles.quizCardBody}>
                  <div className={styles.quizTopStyles}>
                    {top.map(([id, score], i) => {
                      const s = STYLES[id]
                      if (!s) return null
                      const maxScore = top[0][1]
                      const pct = Math.round((score / maxScore) * 100)
                      return (
                        <div key={id} className={styles.quizStyleRow}>
                          <span className={styles.quizStyleName}>
                            {s.icon} {getStyleName(s, gender)}
                          </span>
                          <div className={styles.quizBarTrack}>
                            <div
                              className={styles.quizBarFill}
                              style={{ width: `${pct}%`, background: s.gradient }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {quiz.likedItems?.length > 0 && (
                    <div className={styles.likedItems}>
                      <p className={styles.likedLabel}>Liked items</p>
                      <div className={styles.likedChips}>
                        {quiz.likedItems.map((item) => (
                          <span key={item.id} className={styles.likedChip}>
                            {item.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {primaryStyle && (
                    <a
                      href={getPinterestUrl(primaryStyle, gender)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.exploreBtn}
                      style={{ background: primaryStyle.gradient }}
                    >
                      Explore {getStyleName(primaryStyle, gender)} on Pinterest →
                    </a>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
})

export default QuizHistorySection
