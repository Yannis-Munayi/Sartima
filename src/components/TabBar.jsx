import { useAuth } from '../context/AuthContext'
import { useCloset } from '../context/ClosetContext'
import { useShowQuizTab } from '../context/AppContext'
import styles from './TabBar.module.css'

/* ── Thin-stroke icons ── */
function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}

function ExploreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  )
}

function BrandsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function DiscoverIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  )
}

function OutfitsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4" r="1.5" />
      <path d="M12 5.5V8.5M12 8.5L3 17H21L12 8.5" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

/* ── TabBar ── */
export default function TabBar({ activeTab, setActiveTab }) {
  const { user }             = useAuth()
  const { totalClosetCount } = useCloset()
  const { showQuizTab }      = useShowQuizTab()

  return (
    <nav className={styles.tabBar}>
      <div className={styles.tabScroll}>

        <button
          className={`${styles.tab} ${activeTab === 'home' ? styles.active : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <HomeIcon />
          <span>Home</span>
        </button>

        <button
          className={`${styles.tab} ${activeTab === 'explore' ? styles.active : ''}`}
          onClick={() => setActiveTab('explore')}
        >
          <ExploreIcon />
          <span>Aesthetics</span>
        </button>

        <button
          className={`${styles.tab} ${activeTab === 'brands' || activeTab.startsWith('brand:') ? styles.active : ''}`}
          onClick={() => setActiveTab('brands')}
        >
          <BrandsIcon />
          <span>Brands</span>
        </button>

        {showQuizTab && (
          <div className={styles.discoverWrap}>
            <button
              className={`${styles.discoverBtn} ${activeTab === 'quiz' ? styles.discoverActive : ''}`}
              onClick={() => setActiveTab('quiz')}
            >
              <DiscoverIcon />
            </button>
            <span className={`${styles.discoverLabel} ${activeTab === 'quiz' ? styles.discoverLabelActive : ''}`}>
              Swipe
            </span>
          </div>
        )}

        <button
          className={`${styles.tab} ${activeTab === 'daily' ? styles.active : ''}`}
          onClick={() => setActiveTab('daily')}
        >
          <div className={styles.iconWrap}>
            <OutfitsIcon />
            {totalClosetCount > 0 && (
              <span className={styles.badge}>
                {totalClosetCount > 9 ? '9+' : totalClosetCount}
              </span>
            )}
          </div>
          <span>Outfits</span>
        </button>

        <button
          className={`${styles.tab} ${activeTab === 'profile' ? styles.active : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          {user ? (
            <div className={`${styles.avatar} ${activeTab === 'profile' ? styles.avatarActive : ''}`}>
              {(user.displayName ?? user.email ?? '?')[0].toUpperCase()}
            </div>
          ) : (
            <ProfileIcon />
          )}
          <span>{user ? (user.displayName?.split(' ')[0] ?? 'Profile') : 'Profile'}</span>
        </button>

      </div>
    </nav>
  )
}
