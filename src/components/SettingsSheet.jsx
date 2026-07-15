import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions, getAnalyticsConsent, setAnalyticsConsent, trackEvent } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { useApp, useTheme, useTempUnit, useDefaultOccasion, usePreferredSeasons, useShowQuizTab, useClosetSort, useAdaptiveTheme } from '../context/AppContext'
import { useInterests } from '../context/InterestContext'
import { AESTHETIC_FLAVORS, resolveAestheticFlavor } from '../data/aestheticThemes'
import { STYLES } from '../data/styles'
import LegalModal from './LegalModal'
import { PRIVACY_POLICY, TERMS_OF_SERVICE } from '../data/legalContent'
import { downloadAllUserData } from '../services/dataExport'
import { isIOSStandaloneRequired } from '../services/iosDetect'
import { loadNotificationPrefs, saveNotificationToken, saveReminderTime } from '../services/notificationPrefs'
import styles from '../screens/ProfileScreen.module.css'

const callDeleteAccount = httpsCallable(functions, 'deleteAccount')

export function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )
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

function ScoutSettings() {
  const [autoSave, setAutoSave] = useState(
    () => localStorage.getItem('sartima_scout_autosave') === 'true'
  )
  const [sizeSystem, setSizeSystemState] = useState(
    () => localStorage.getItem('sartima_size_system') || 'us'
  )
  const [resultCount, setResultCount] = useState(
    () => Math.min(100, Math.max(5, parseInt(localStorage.getItem('sartima_scout_result_count') ?? '10', 10) || 10))
  )

  function toggleAutoSave() {
    const next = !autoSave
    setAutoSave(next)
    localStorage.setItem('sartima_scout_autosave', String(next))
  }

  function pickSize(val) {
    setSizeSystemState(val)
    localStorage.setItem('sartima_size_system', val)
  }

  function changeCount(delta) {
    setResultCount((prev) => {
      const next = Math.min(100, Math.max(5, prev + delta))
      localStorage.setItem('sartima_scout_result_count', String(next))
      return next
    })
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
          <p className={styles.settingsToggleLabel}>Results per piece</p>
          <p className={styles.settingsToggleSub}>Products shown per category (5 – 100)</p>
        </div>
        <div className={styles.scoutCountStepper}>
          <button
            className={styles.scoutCountBtn}
            onClick={() => changeCount(-5)}
            disabled={resultCount <= 5}
            aria-label="Decrease"
          >−</button>
          <span className={styles.scoutCountValue}>{resultCount}</span>
          <button
            className={styles.scoutCountBtn}
            onClick={() => changeCount(5)}
            disabled={resultCount >= 100}
            aria-label="Increase"
          >+</button>
        </div>
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
  const { state }           = useApp()
  const { interests }       = useInterests()
  const { adaptiveTheme, setAdaptiveTheme } = useAdaptiveTheme()

  const resolved   = resolveAestheticFlavor(state.styleScores, interests?.styleAffinities)
  const flavorSub  = adaptiveTheme && resolved
    ? `${AESTHETIC_FLAVORS[resolved.flavorId]?.label ?? ''} — themed to ${STYLES[resolved.styleId]?.name ?? 'your top aesthetic'}`
    : 'Fonts & accent colors follow your top aesthetic'

  function toggleAdaptive() {
    const next = !adaptiveTheme
    setAdaptiveTheme(next)
    trackEvent('adaptive_theme_toggled', { enabled: next })
  }

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
      <div style={{ height: 12 }} />
      <div className={styles.settingsToggleRow}>
        <div>
          <p className={styles.settingsToggleLabel}>Adaptive theme</p>
          <p className={styles.settingsToggleSub}>{flavorSub}</p>
        </div>
        <button
          className={`${styles.toggle} ${adaptiveTheme ? styles.toggleOn : ''}`}
          onClick={toggleAdaptive}
          aria-label={adaptiveTheme ? 'Disable adaptive theme' : 'Enable adaptive theme'}
        >
          <span className={styles.toggleThumb} />
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
  { id: 'stale',     label: 'Least worn' },
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
  const { user } = useAuth()
  const supported = 'Notification' in window && 'serviceWorker' in navigator
  const needsHomeScreen = supported && isIOSStandaloneRequired()

  const [permission, setPermission] = useState(supported ? Notification.permission : 'unavailable')
  const [reminderTime, setReminderTime] = useState('08:00')
  const [enabling, setEnabling] = useState(false)

  useEffect(() => {
    if (!user) return
    loadNotificationPrefs(user.uid).then((prefs) => {
      if (prefs?.reminderTime) setReminderTime(prefs.reminderTime)
    })
  }, [user])

  async function handleEnable() {
    if (!user || enabling) return
    setEnabling(true)
    const { requestNotificationToken } = await import('../services/notifications')
    const token = await requestNotificationToken()
    setEnabling(false)
    setPermission(supported ? Notification.permission : 'unavailable')
    if (!token) return
    await saveNotificationToken(user.uid, token, reminderTime)
    trackEvent('notification_permission_granted')
  }

  function handleTimeChange(t) {
    setReminderTime(t)
    if (user) saveReminderTime(user.uid, t)
  }

  if (!user) return null

  return (
    <section>
      <h3 className={styles.sectionTitle}>Daily reminder</h3>
      {!supported && (
        <p className={styles.settingsToggleSub}>Not supported in this browser</p>
      )}
      {supported && needsHomeScreen && (
        <p className={styles.settingsToggleSub}>
          Add Sartima to your Home Screen first — iOS only delivers reminders to installed apps.
        </p>
      )}
      {supported && !needsHomeScreen && permission === 'default' && (
        <div className={styles.settingsToggleRow}>
          <p className={styles.settingsToggleSub}>Morning nudge to plan your outfit</p>
          <button className={styles.permBtn} onClick={handleEnable} disabled={enabling}>
            {enabling ? 'Enabling…' : 'Enable'}
          </button>
        </div>
      )}
      {supported && !needsHomeScreen && permission === 'granted' && (
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
  const { user: authUser, logout }  = useAuth()
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [exporting, setExporting]   = useState(false)
  const [legalDoc, setLegalDoc]     = useState(null) // 'terms' | 'privacy' | null
  const [analyticsOn, setAnalyticsOn] = useState(() => getAnalyticsConsent() === 'granted')

  async function exportAllData() {
    if (!authUser) return
    setExporting(true)
    try {
      await downloadAllUserData(authUser.uid)
    } finally {
      setExporting(false)
    }
  }

  async function handleDeleteAccount() {
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    setDeleting(true)
    try {
      await callDeleteAccount()
      await logout()
      if (onLogout) onLogout()
    } catch {
      setDeleting(false)
      setDeleteConfirm(false)
    }
  }

  function toggleAnalytics() {
    const next = !analyticsOn
    setAnalyticsOn(next)
    setAnalyticsConsent(next)
  }

  return (
    <section>
      <h3 className={styles.sectionTitle}>Data &amp; Privacy</h3>

      <div className={styles.settingsToggleRow}>
        <div>
          <p className={styles.settingsToggleLabel}>Analytics</p>
          <p className={styles.settingsToggleSub}>Helps us understand app usage. Takes effect on your next visit.</p>
        </div>
        <button
          className={`${styles.toggle} ${analyticsOn ? styles.toggleOn : ''}`}
          onClick={toggleAnalytics}
          aria-label={analyticsOn ? 'Turn off analytics' : 'Turn on analytics'}
        >
          <span className={styles.toggleThumb} />
        </button>
      </div>
      <div style={{ height: 14 }} />

      <div className={styles.privacyBtns}>
        <button className={styles.exportBtn} onClick={() => setLegalDoc('privacy')}>
          Privacy Policy
        </button>
        <button className={styles.exportBtn} onClick={() => setLegalDoc('terms')}>
          Terms of Service
        </button>
        <button className={styles.exportBtn} onClick={exportAllData} disabled={exporting}>
          {exporting ? 'Preparing…' : '↓ Export all my data'}
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

      <LegalModal
        doc={legalDoc === 'terms' ? TERMS_OF_SERVICE : legalDoc === 'privacy' ? PRIVACY_POLICY : null}
        onClose={() => setLegalDoc(null)}
      />
    </section>
  )
}

export default function SettingsSheet({ user, onClose, onLogout }) {
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
