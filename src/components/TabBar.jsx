import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCloset } from '../context/ClosetContext'
import styles from './TabBar.module.css'

/* ── Icons ── */
function HomeIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}

function ClosetIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1.5" />
      <path d="M12 6.5L3 16h18L12 6.5z" />
    </svg>
  )
}

function ExploreIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  )
}

function DiscoverIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.2}>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  )
}

function DailyIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      <circle cx="12" cy="12" r="5" />
    </svg>
  )
}

function ProfileIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

/* ── TabBar ── */
export default function TabBar({ activeTab, setActiveTab }) {
  const { user }             = useAuth()
  const { totalClosetCount } = useCloset()

  const [bounceTab, setBounceTab] = useState(null)
  const prevTabRef = useRef(activeTab)

  useEffect(() => {
    if (prevTabRef.current === activeTab) return
    setBounceTab(activeTab)
    prevTabRef.current = activeTab
    const t = setTimeout(() => setBounceTab(null), 320)
    return () => clearTimeout(t)
  }, [activeTab])

  return (
    <nav className={styles.tabBar}>
      <div className={styles.tabScroll}>

        {/* Home */}
        <button
          className={`${styles.tab} ${activeTab === 'home' ? styles.active : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <span className={bounceTab === 'home' ? styles.iconBounce : ''}>
            <HomeIcon active={activeTab === 'home'} />
          </span>
          <span>Home</span>
        </button>

        {/* Closet */}
        <button
          className={`${styles.tab} ${activeTab === 'closet' ? styles.active : ''}`}
          onClick={() => setActiveTab('closet')}
        >
          <div className={`${styles.iconWrap} ${bounceTab === 'closet' ? styles.iconBounce : ''}`}>
            <ClosetIcon active={activeTab === 'closet'} />
            {totalClosetCount > 0 && (
              <span className={styles.badge}>
                {totalClosetCount > 9 ? '9+' : totalClosetCount}
              </span>
            )}
          </div>
          <span>Closet</span>
        </button>

        {/* Explore */}
        <button
          className={`${styles.tab} ${activeTab === 'explore' ? styles.active : ''}`}
          onClick={() => setActiveTab('explore')}
        >
          <span className={bounceTab === 'explore' ? styles.iconBounce : ''}>
            <ExploreIcon active={activeTab === 'explore'} />
          </span>
          <span>Explore</span>
        </button>

        {/* ── Center Discover button ── */}
        <div className={styles.discoverWrap}>
          <button
            className={`${styles.discoverBtn} ${activeTab === 'quiz' ? styles.discoverActive : ''} ${bounceTab === 'quiz' ? styles.iconBounce : ''}`}
            onClick={() => setActiveTab('quiz')}
          >
            <DiscoverIcon />
          </button>
          <span className={`${styles.discoverLabel} ${activeTab === 'quiz' ? styles.discoverLabelActive : ''}`}>
            Discover
          </span>
        </div>

        {/* Daily Look */}
        <button
          className={`${styles.tab} ${activeTab === 'daily' ? styles.active : ''}`}
          onClick={() => setActiveTab('daily')}
        >
          <span className={bounceTab === 'daily' ? styles.iconBounce : ''}>
            <DailyIcon active={activeTab === 'daily'} />
          </span>
          <span>Daily</span>
        </button>

        {/* Profile */}
        <button
          className={`${styles.tab} ${activeTab === 'profile' ? styles.active : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          {user ? (
            <div className={`${styles.avatar} ${activeTab === 'profile' ? styles.avatarActive : ''} ${bounceTab === 'profile' ? styles.iconBounce : ''}`}>
              {(user.displayName ?? user.email ?? '?')[0].toUpperCase()}
            </div>
          ) : (
            <span className={bounceTab === 'profile' ? styles.iconBounce : ''}>
              <ProfileIcon active={activeTab === 'profile'} />
            </span>
          )}
          <span>{user ? (user.displayName?.split(' ')[0] ?? 'Profile') : 'Profile'}</span>
        </button>

      </div>
    </nav>
  )
}
