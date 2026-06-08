import { useEffect, useMemo, useRef, useState } from 'react'
import { collection, doc, getDoc, getDocs, orderBy, query, setDoc } from 'firebase/firestore'
import { deleteUser } from 'firebase/auth'
import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { useApp, useTheme, useTempUnit, useDefaultOccasion, usePreferredSeasons, useShowQuizTab, useClosetSort } from '../context/AppContext'
import { useCloset } from '../context/ClosetContext'
import { STYLES, getPinterestUrl, getStyleName } from '../data/styles'
import FeedbackSheet from '../components/FeedbackSheet'
import CrashReportSheet from '../components/CrashReportSheet'
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


const GENDER_OPTIONS = [
  { id: 'men',   label: 'Men' },
  { id: 'women', label: 'Women' },
  { id: 'both',  label: 'Both' },
]

function GenderSelector() {
  const { state, dispatch } = useApp()
  return (
    <section>
      <h3 className={styles.sectionTitle}>Style for</h3>
      <div className={styles.genderRow}>
        {GENDER_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            className={`${styles.genderPill} ${state.gender === opt.id ? styles.genderPillActive : ''}`}
            onClick={() => dispatch({ type: 'SET_GENDER', gender: opt.id })}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function StyleEvolutionChart({ quizzes, gender }) {
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

function ScoutSettings() {
  const [autoSave, setAutoSave] = useState(
    () => localStorage.getItem('stylelab_scout_autosave') === 'true'
  )
  const [sizeSystem, setSizeSystemState] = useState(
    () => localStorage.getItem('stylelab_size_system') || 'us'
  )

  function toggleAutoSave() {
    const next = !autoSave
    setAutoSave(next)
    localStorage.setItem('stylelab_scout_autosave', String(next))
  }

  function pickSize(val) {
    setSizeSystemState(val)
    localStorage.setItem('stylelab_size_system', val)
  }

  return (
    <section>
      <h3 className={styles.sectionTitle}>Shop Scout</h3>
      <div className={styles.settingsToggleRow}>
        <div>
          <p className={styles.settingsToggleLabel}>Auto-save results</p>
          <p className={styles.settingsToggleSub}>Save Scout picks to My List automatically</p>
        </div>
        <button
          className={`${styles.toggle} ${autoSave ? styles.toggleOn : ''}`}
          onClick={toggleAutoSave}
          aria-label={autoSave ? 'Disable auto-save' : 'Enable auto-save'}
        >
          <span className={styles.toggleThumb} />
        </button>
      </div>
      <div style={{ height: 12 }} />
      <div className={styles.settingsToggleRow}>
        <div>
          <p className={styles.settingsToggleLabel}>Sizing system</p>
          <p className={styles.settingsToggleSub}>US or EU sizes when scouting</p>
        </div>
        <div className={styles.sizeSystemPicker}>
          <button
            className={`${styles.sizeSystemOption} ${sizeSystem === 'us' ? styles.sizeSystemOptionActive : ''}`}
            onClick={() => pickSize('us')}
          >
            US
          </button>
          <button
            className={`${styles.sizeSystemOption} ${sizeSystem === 'eu' ? styles.sizeSystemOptionActive : ''}`}
            onClick={() => pickSize('eu')}
          >
            EU
          </button>
        </div>
      </div>
    </section>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <section>
      <h3 className={styles.sectionTitle}>Appearance</h3>
      <div className={styles.themeRow}>
        <button
          className={`${styles.themePill} ${theme === 'dark' ? styles.themePillActive : ''}`}
          onClick={() => setTheme('dark')}
        >
          🌑 Dark
        </button>
        <button
          className={`${styles.themePill} ${theme === 'light' ? styles.themePillActive : ''}`}
          onClick={() => setTheme('light')}
        >
          ☀️ Light
        </button>
      </div>
    </section>
  )
}

const DAILY_OCCASIONS = [
  { id: 'casual', label: 'Casual' },
  { id: 'work',   label: 'Work'   },
  { id: 'date',   label: 'Date'   },
  { id: 'gym',    label: 'Gym'    },
  { id: 'errand', label: 'Errand' },
]

const ALL_SEASONS = ['spring', 'summer', 'fall', 'winter']

const SORT_OPTIONS = [
  { id: 'date',      label: 'Date added' },
  { id: 'category',  label: 'Category'   },
  { id: 'favorites', label: 'Favorites'  },
]

function DailySettings() {
  const { unit, setUnit }         = useTempUnit()
  const { occasion, setOccasion } = useDefaultOccasion()
  return (
    <section>
      <h3 className={styles.sectionTitle}>Daily</h3>
      <div className={styles.settingsToggleRow}>
        <div>
          <p className={styles.settingsToggleLabel}>Temperature</p>
          <p className={styles.settingsToggleSub}>Unit for weather display</p>
        </div>
        <div className={styles.sizeSystemPicker}>
          <button
            className={`${styles.sizeSystemOption} ${unit === 'c' ? styles.sizeSystemOptionActive : ''}`}
            onClick={() => setUnit('c')}
          >°C</button>
          <button
            className={`${styles.sizeSystemOption} ${unit === 'f' ? styles.sizeSystemOptionActive : ''}`}
            onClick={() => setUnit('f')}
          >°F</button>
        </div>
      </div>
      <div style={{ height: 12 }} />
      <p className={styles.settingsToggleLabel}>Default occasion</p>
      <p className={styles.settingsToggleSub} style={{ marginBottom: 8 }}>Pre-selected when generating your daily outfit</p>
      <div className={styles.occasionRow}>
        {DAILY_OCCASIONS.map((occ) => (
          <button
            key={occ.id}
            className={`${styles.occasionPill} ${occasion === occ.id ? styles.occasionPillActive : ''}`}
            onClick={() => setOccasion(occ.id)}
          >{occ.label}</button>
        ))}
      </div>
    </section>
  )
}

function PreferredSeasonsSettings() {
  const { preferredSeasons, toggleSeason } = usePreferredSeasons()
  return (
    <section>
      <h3 className={styles.sectionTitle}>Preferred seasons</h3>
      <p className={styles.settingsToggleSub} style={{ marginBottom: 10 }}>
        Filters outfit suggestions and content
      </p>
      <div className={styles.seasonRow}>
        {ALL_SEASONS.map((s) => (
          <button
            key={s}
            className={`${styles.seasonPill} ${preferredSeasons.includes(s) ? styles.seasonPillActive : ''}`}
            onClick={() => toggleSeason(s)}
          >
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      {preferredSeasons.length === 0 && (
        <p className={styles.settingsToggleSub} style={{ marginTop: 8 }}>All seasons (no filter)</p>
      )}
    </section>
  )
}

function AppBehaviorSettings() {
  const { showQuizTab, setShowQuizTab } = useShowQuizTab()
  const { closetSort, setClosetSort }   = useClosetSort()
  const [cleared, setCleared]           = useState(false)

  function handleClearCache() {
    sessionStorage.clear()
    setCleared(true)
    setTimeout(() => setCleared(false), 2000)
  }

  return (
    <section>
      <h3 className={styles.sectionTitle}>App</h3>
      <div className={styles.settingsToggleRow}>
        <div>
          <p className={styles.settingsToggleLabel}>Show Swipe tab</p>
          <p className={styles.settingsToggleSub}>Discover button in the bottom bar</p>
        </div>
        <button
          className={`${styles.toggle} ${showQuizTab ? styles.toggleOn : ''}`}
          onClick={() => setShowQuizTab(!showQuizTab)}
          aria-label={showQuizTab ? 'Hide Swipe tab' : 'Show Swipe tab'}
        >
          <span className={styles.toggleThumb} />
        </button>
      </div>
      <div style={{ height: 14 }} />
      <p className={styles.settingsToggleLabel}>Closet sort order</p>
      <p className={styles.settingsToggleSub} style={{ marginBottom: 8 }}>Default order in My Closet</p>
      <div className={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            className={`${styles.sortPill} ${closetSort === opt.id ? styles.sortPillActive : ''}`}
            onClick={() => setClosetSort(opt.id)}
          >{opt.label}</button>
        ))}
      </div>
      <div style={{ height: 14 }} />
      <div className={styles.settingsToggleRow}>
        <div>
          <p className={styles.settingsToggleLabel}>Clear cache</p>
          <p className={styles.settingsToggleSub}>Resets outfit and weather cache</p>
        </div>
        <button className={styles.permBtn} onClick={handleClearCache}>
          {cleared ? '✓ Done' : 'Clear'}
        </button>
      </div>
    </section>
  )
}

function NotificationSettings() {
  const supported = 'Notification' in window
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unavailable')
  const [reminderTime, setReminderTime] = useState(
    () => localStorage.getItem('stylelab_reminder_time') ?? '08:00'
  )

  async function requestPermission() {
    const result = await Notification.requestPermission()
    setPermission(result)
  }

  function handleTimeChange(t) {
    setReminderTime(t)
    localStorage.setItem('stylelab_reminder_time', t)
  }

  return (
    <section>
      <h3 className={styles.sectionTitle}>Daily reminder</h3>
      {!supported && (
        <p className={styles.settingsToggleSub}>Not supported in this browser</p>
      )}
      {supported && permission === 'default' && (
        <div className={styles.settingsToggleRow}>
          <p className={styles.settingsToggleSub}>Morning nudge to plan your outfit</p>
          <button className={styles.permBtn} onClick={requestPermission}>Enable</button>
        </div>
      )}
      {supported && permission === 'granted' && (
        <div className={styles.settingsToggleRow}>
          <div>
            <p className={styles.settingsToggleLabel}>Reminder time</p>
            <p className={styles.settingsToggleSub}>Daily outfit nudge</p>
          </div>
          <input
            type="time"
            className={styles.timeInput}
            value={reminderTime}
            onChange={(e) => handleTimeChange(e.target.value)}
          />
        </div>
      )}
      {supported && permission === 'denied' && (
        <p className={styles.settingsToggleSub}>
          Blocked — enable in your browser settings to receive reminders
        </p>
      )}
    </section>
  )
}

function ShoppingEmailSettings() {
  const { user } = useAuth()
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => { if (snap.exists()) setEmail(snap.data().shoppingEmail ?? '') })
      .finally(() => setLoading(false))
  }, [user])

  if (!user) return null

  async function handleSave() {
    setSaving(true)
    try {
      await setDoc(doc(db, 'users', user.uid), { shoppingEmail: email.trim() }, { merge: true })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <h3 className={styles.sectionTitle}>Shopping digest</h3>
      <p className={styles.settingsToggleSub} style={{ marginBottom: 10 }}>
        Email for curated shopping picks
      </p>
      {loading ? (
        <p className={styles.settingsToggleSub}>Loading…</p>
      ) : (
        <div className={styles.emailRow}>
          <input
            type="email"
            className={styles.emailInput}
            placeholder="your@email.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setSaved(false) }}
          />
          <button className={styles.emailSaveBtn} onClick={handleSave} disabled={saving}>
            {saved ? '✓' : saving ? '…' : 'Save'}
          </button>
        </div>
      )}
    </section>
  )
}

function LocaleSettings() {
  return (
    <section>
      <h3 className={styles.sectionTitle}>Language</h3>
      <div className={styles.localeRow}>
        <span className={styles.localePill}>🇬🇧 English</span>
        <span className={styles.settingsToggleSub}>More languages coming soon</span>
      </div>
    </section>
  )
}

function DataPrivacySettings({ user, onLogout }) {
  const { closetItems }             = useCloset()
  const { user: authUser }          = useAuth()
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting]     = useState(false)

  function exportCloset() {
    const data = JSON.stringify(
      { closet: closetItems, exportedAt: new Date().toISOString() },
      null, 2
    )
    const blob = new Blob([data], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `stylelab-closet-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDeleteAccount() {
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    setDeleting(true)
    try {
      await deleteUser(authUser)
      localStorage.removeItem('stylelab_saved_aesthetics')
      localStorage.removeItem('stylelab_shoplist')
      if (onLogout) onLogout()
    } catch {
      setDeleting(false)
      setDeleteConfirm(false)
    }
  }

  return (
    <section>
      <h3 className={styles.sectionTitle}>Data &amp; Privacy</h3>
      <div className={styles.privacyBtns}>
        <button className={styles.exportBtn} onClick={exportCloset}>
          ↓ Export closet data
        </button>
        {user && (
          <button
            className={`${styles.deleteBtn} ${deleteConfirm ? styles.deleteBtnConfirm : ''}`}
            onClick={handleDeleteAccount}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : deleteConfirm ? 'Tap again to confirm deletion' : 'Delete account'}
          </button>
        )}
      </div>
    </section>
  )
}

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )
}

function SettingsSheet({ user, onClose, onLogout }) {
  return (
    <>
      <div className={styles.settingsBackdrop} onClick={onClose} />
      <div className={styles.settingsSheet}>
        <div className={styles.settingsHandle} />
        <h2 className={styles.settingsSheetTitle}>Settings</h2>
        <div className={styles.settingsSheetBody}>
          <GenderSelector />
          <div className={styles.settingsDivider} />
          <ThemeToggle />
          <div className={styles.settingsDivider} />
          <DailySettings />
          <div className={styles.settingsDivider} />
          <PreferredSeasonsSettings />
          <div className={styles.settingsDivider} />
          <AppBehaviorSettings />
          <div className={styles.settingsDivider} />
          <NotificationSettings />
          <div className={styles.settingsDivider} />
          <ScoutSettings />
          {user && (
            <>
              <div style={{ height: 4 }} />
              <ShoppingEmailSettings />
            </>
          )}
          <div className={styles.settingsDivider} />
          <LocaleSettings />
          <div className={styles.settingsDivider} />
          <DataPrivacySettings user={user} onLogout={onLogout} />
          {user && onLogout && (
            <>
              <div className={styles.settingsDivider} />
              <button className={styles.settingsSignOut} onClick={onLogout}>
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default function ProfileScreen({ onBack, scrollToQuiz, onScrollComplete }) {
  const { user, logout }  = useAuth()
  const { state, dispatch } = useApp()
  const gender = state.gender
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
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
        <section ref={quizSectionRef} className={styles.section}>
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
