import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCloset } from '../context/ClosetContext'
import { useShowQuizTab } from '../context/AppContext'
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

function OutfitsIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4" r="1.5" />
      <path d="M12 5.5V8.5M12 8.5L3 17H21L12 8.5" />
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
  const { user }               = useAuth()
  const { totalClosetCount }   = useCloset()
  const { showQuizTab }        = useShowQuizTab()

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

        {/* Explore */}
        <button
          className={`${styles.tab} ${activeTab === 'explore' ? styles.active : ''}`}
          onClick={() => setActiveTab('explore')}
        >
          <span className={bounceTab === 'explore' ? styles.iconBounce : ''}>
            <ExploreIcon active={activeTab === 'explore'} />
          </span>
          <span>Aesthetics</span>
        </button>

        {/* ── Center Discover button ── */}
        {showQuizTab && (
          <div className={styles.discoverWrap}>
            <button
              className={`${styles.discoverBtn} ${activeTab === 'quiz' ? styles.discoverActive : ''} ${bounceTab === 'quiz' ? styles.iconBounce : ''}`}
              onClick={() => setActiveTab('quiz')}
            >
              <DiscoverIcon />
            </button>
            <span className={`${styles.discoverLabel} ${activeTab === 'quiz' ? styles.discoverLabelActive : ''}`}>
              Swipe
            </span>
          </div>
        )}

        {/* Outfits (combined Closet + Daily) */}
        <button
          className={`${styles.tab} ${activeTab === 'daily' ? styles.active : ''}`}
          onClick={() => setActiveTab('daily')}
        >
          <div className={`${styles.iconWrap} ${bounceTab === 'daily' ? styles.iconBounce : ''}`}>
            <OutfitsIcon active={activeTab === 'daily'} />
            {totalClosetCount > 0 && (
              <span className={styles.badge}>
                {totalClosetCount > 9 ? '9+' : totalClosetCount}
              </span>
            )}
          </div>
          <span>Outfits</span>
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
