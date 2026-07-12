import { useEffect, useRef, useState } from 'react'
import { useSubscription } from '../context/SubscriptionContext'
import { openBillingPortal } from '../services/subscriptionService'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { STYLES, getPinterestUrl, getStyleName } from '../data/styles'
import FeedbackSheet from '../components/FeedbackSheet'
import CrashReportSheet from '../components/CrashReportSheet'
import SettingsSheet, { GearIcon } from '../components/SettingsSheet'
import StyleEvolutionChart from '../components/StyleEvolutionChart'
import QuizHistorySection from './QuizHistorySection'
import styles from './ProfileScreen.module.css'

export default function ProfileScreen({ onBack, scrollToQuiz, onScrollComplete }) {
  const { user, logout }  = useAuth()
  const { state, dispatch } = useApp()
  const { tier, isPro, usage, openPaywall } = useSubscription()
  const gender = state.gender
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showCrashReport, setShowCrashReport] = useState(false)
  const quizSectionRef = useRef(null)

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const q = query(
          collection(db, 'users', user.uid, 'quizzes'),
          orderBy('timestamp', 'desc')
        )
        const snap = await getDocs(q)
        setQuizzes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (e) {
        console.error('Failed to load quizzes', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  useEffect(() => {
    if (!scrollToQuiz) return
    const t = setTimeout(() => {
      quizSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      onScrollComplete?.()
    }, 120)
    return () => clearTimeout(t)
  }, [scrollToQuiz])

  // Aggregate top aesthetics across all quizzes
  const aggregated = {}
  for (const quiz of quizzes) {
    for (const [id, score] of Object.entries(quiz.styleScores ?? {})) {
      aggregated[id] = (aggregated[id] ?? 0) + score
    }
  }
  const topOverall = Object.entries(aggregated)
    .sort(([, a], [, b]) => b - a)
    .filter(([, s]) => s > 0)
    .slice(0, 5)

  async function handleLogout() {
    await logout()
    // onBack resets the active tab (tab-bar usage); otherwise go to welcome screen
    if (onBack) {
      onBack()
    } else {
      dispatch({ type: 'GO_TO_WELCOME' })
    }
  }

  // Guard: no user — show locked preview
  if (!user) {
    const previewStyles = ['oldmoney', 'streetwear', 'darkacademia', 'minimalist', 'preppy']
      .map((id) => STYLES[id]).filter(Boolean)
    const previewQuizzes = [
      { label: 'Old Money', meta: '2d ago · 18 liked', gradient: STYLES['oldmoney']?.gradient },
      { label: 'Dark Academia', meta: '1wk ago · 12 liked', gradient: STYLES['darkacademia']?.gradient },
    ]
    return (
      <div className={styles.screen}>
        <div className={styles.header}>
          {onBack && (
            <button className={styles.backBtn} onClick={onBack}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <p className={styles.userName} style={{ flex: 1 }}>Profile</p>
          <button className={styles.gearBtn} onClick={() => setShowSettings(true)} aria-label="Settings">
            <GearIcon />
          </button>
        </div>

        <div className={styles.body}>
          {/* Blurred aesthetics preview */}
          <div className={styles.lockedSection}>
            <h3 className={styles.sectionTitle}>Your top aesthetics</h3>
            <div className={styles.lockedContent}>
              <div className={styles.aestheticList} style={{ filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none' }}>
                {previewStyles.map((s, i) => (
                  <div key={s.id} className={styles.aestheticChip} style={{ background: s.gradient }}>
                    <span className={styles.aestheticRank}>#{i + 1}</span>
                    <span>{s.icon} {s.name}</span>
                  </div>
                ))}
              </div>
              <div className={styles.lockedOverlay}>
                <span className={styles.lockIcon}>🔒</span>
                <p className={styles.lockLabel}>Take the quiz to reveal your aesthetics</p>
              </div>
            </div>
          </div>

          {/* Blurred quiz history preview */}
          <div className={styles.lockedSection}>
            <h3 className={styles.sectionTitle}>Quiz history</h3>
            <div className={styles.lockedContent}>
              <div className={styles.quizList} style={{ filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none' }}>
                {previewQuizzes.map((q, i) => (
                  <div key={i} className={styles.quizCard}>
                    <div className={styles.quizCardHeader} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
                      <div className={styles.quizSwatch} style={{ background: q.gradient }} />
                      <div>
                        <p className={styles.quizPrimary}>{q.label}</p>
                        <p className={styles.quizMeta}>{q.meta}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.lockedOverlay}>
                <span className={styles.lockIcon}>🔒</span>
                <p className={styles.lockLabel}>Sign in to save your quiz history</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className={styles.signInCTA}>
            <p className={styles.signInHeading}>Your style profile lives here</p>
            <p className={styles.signInSub}>Sign in to unlock your aesthetic breakdown, track quiz history, and sync your closet across devices.</p>
            <button className={styles.signInBtn} onClick={() => dispatch({ type: 'GO_TO_AUTH' })}>
              Sign in / Create account
            </button>
          </div>

          <div className={styles.supportSection}>
            <p className={styles.supportHeading}>Help &amp; Feedback</p>
            <div className={styles.supportRow}>
              <button className={styles.supportBtn} onClick={() => setShowFeedback(true)}>
                <span className={styles.supportIcon}>💬</span>
                Send Feedback
              </button>
              <button className={styles.supportBtn} onClick={() => setShowCrashReport(true)}>
                <span className={styles.supportIcon}>🐛</span>
                Report a Problem
              </button>
            </div>
          </div>
        </div>

        {showSettings && (
          <SettingsSheet user={null} onClose={() => setShowSettings(false)} onLogout={null} />
        )}
        {showFeedback && (
          <FeedbackSheet user={null} onClose={() => setShowFeedback(false)} />
        )}
        {showCrashReport && (
          <CrashReportSheet
            user={null}
            appState={{ screen: state.screen, uid: null, email: null }}
            onClose={() => setShowCrashReport(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => dispatch({ type: 'GO_TO_WELCOME' })}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className={styles.headerInfo}>
          <div className={styles.avatar}>{(user?.displayName ?? user?.email ?? '?')[0].toUpperCase()}</div>
          <div>
            <p className={styles.userName}>{user?.displayName ?? 'User'}</p>
            <p className={styles.userEmail}>{user?.email}</p>
          </div>
        </div>
        <button className={styles.gearBtn} onClick={() => setShowSettings(true)} aria-label="Settings">
          <GearIcon />
        </button>
      </div>

      <div className={styles.body}>

        {/* Subscription */}
        <section className={styles.section}>
          {isPro ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--accent)' }}>Sartima Pro</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  {usage.tryOns != null ? `${usage.tryOns ?? 0} / 30 try-ons used this month` : 'Active'}
                </p>
              </div>
              <button
                onClick={() => openBillingPortal()}
                style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '7px 12px', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.5px' }}
              >
                Manage billing
              </button>
            </div>
          ) : (
            <button
              onClick={() => openPaywall('upgrade')}
              style={{ width: '100%', padding: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--accent)' }}>Upgrade to Pro</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Unlimited outfits, try-on, trip packer &amp; more</p>
              </div>
              <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>›</span>
            </button>
          )}
        </section>

        {/* Overall top aesthetics */}
        {topOverall.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Your top aesthetics</h3>
            <div className={styles.aestheticList}>
              {topOverall.map(([id], i) => {
                const s = STYLES[id]
                if (!s) return null
                return (
                  <a
                    key={id}
                    href={getPinterestUrl(s, gender)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.aestheticChip}
                    style={{ background: s.gradient }}
                  >
                    <span className={styles.aestheticRank}>#{i + 1}</span>
                    <span>{s.icon} {getStyleName(s, gender)}</span>
                  </a>
                )
              })}
            </div>
          </section>
        )}

        {/* Style Evolution */}
        {quizzes.length >= 2 && (
          <StyleEvolutionChart quizzes={quizzes} gender={gender} />
        )}

        {/* Quiz history */}
        <QuizHistorySection ref={quizSectionRef} quizzes={quizzes} loading={loading} gender={gender} />

        <button className={styles.retakeBtn} onClick={() => { dispatch({ type: 'GO_TO_QUIZ' }); if (onBack) onBack() }}>
          Take quiz again
        </button>

        <div className={styles.supportSection}>
          <p className={styles.supportHeading}>Help &amp; Feedback</p>
          <div className={styles.supportRow}>
            <button className={styles.supportBtn} onClick={() => setShowFeedback(true)}>
              <span className={styles.supportIcon}>💬</span>
              Send Feedback
            </button>
            <button className={styles.supportBtn} onClick={() => setShowCrashReport(true)}>
              <span className={styles.supportIcon}>🐛</span>
              Report a Problem
            </button>
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsSheet
          user={user}
          onClose={() => setShowSettings(false)}
          onLogout={handleLogout}
        />
      )}
      {showFeedback && (
        <FeedbackSheet user={user} onClose={() => setShowFeedback(false)} />
      )}
      {showCrashReport && (
        <CrashReportSheet
          user={user}
          appState={{ screen: state.screen, uid: user?.uid ?? null, email: user?.email ?? null }}
          onClose={() => setShowCrashReport(false)}
        />
      )}
    </div>
  )
}
