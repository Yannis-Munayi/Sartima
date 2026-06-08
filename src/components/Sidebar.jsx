import { useAuth } from '../context/AuthContext'
import { useCloset } from '../context/ClosetContext'
import { useShowQuizTab } from '../context/AppContext'
import styles from './Sidebar.module.css'

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}

function ExploreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  )
}

function DiscoverIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  )
}

function OutfitsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4" r="1.5" />
      <path d="M12 5.5V8.5M12 8.5L3 17H21L12 8.5" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

export default function Sidebar({ activeTab, onTabChange }) {
  const { user }             = useAuth()
  const { totalClosetCount } = useCloset()
  const { showQuizTab }      = useShowQuizTab()

  const navItems = [
    { id: 'home',    label: 'Home',       icon: <HomeIcon />    },
    { id: 'explore', label: 'Aesthetics', icon: <ExploreIcon /> },
    ...(showQuizTab ? [{ id: 'quiz', label: 'Discover', icon: <DiscoverIcon /> }] : []),
    {
      id: 'daily', label: 'Outfits', icon: <OutfitsIcon />,
      badge: totalClosetCount > 0 ? (totalClosetCount > 9 ? '9+' : totalClosetCount) : null,
    },
    { id: 'profile', label: 'Profile', icon: <ProfileIcon /> },
  ]

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoWrap}>
        <span className={styles.logo}>
          Style<span className={styles.logoAccent}>Lab</span>
        </span>
      </div>

      <nav className={styles.nav}>
        {navItems.map((item) => {
          const isActive =
            activeTab === item.id ||
            (item.id === 'explore' && activeTab.startsWith('aesthetic:')) ||
            (item.id === 'profile' && activeTab.startsWith('profile:'))
          return (
            <button
              key={item.id}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              onClick={() => onTabChange(item.id)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
              {item.badge && (
                <span className={styles.navBadge}>{item.badge}</span>
              )}
            </button>
          )
        })}
      </nav>

      <div className={styles.sidebarBottom}>
        <button
          className={`${styles.userChip} ${activeTab === 'profile' ? styles.userChipActive : ''}`}
          onClick={() => onTabChange('profile')}
        >
          <div className={styles.userAvatar}>
            {(user?.displayName ?? user?.email ?? '?')[0].toUpperCase()}
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>
              {user ? (user.displayName?.split(' ')[0] ?? 'Profile') : 'Guest'}
            </span>
            {user?.email && (
              <span className={styles.userEmail}>{user.email}</span>
            )}
          </div>
        </button>
      </div>
    </aside>
  )
}
