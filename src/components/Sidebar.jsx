import { useAuth } from '../context/AuthContext'
import { useCloset } from '../context/ClosetContext'
import { useShowQuizTab } from '../context/AppContext'
import styles from './Sidebar.module.css'

export default function Sidebar({ activeTab, onTabChange }) {
  const { user }             = useAuth()
  const { totalClosetCount } = useCloset()
  const { showQuizTab }      = useShowQuizTab()

  const navItems = [
    { id: 'home',    label: 'Home'       },
    { id: 'explore', label: 'Aesthetics' },
    { id: 'brands',  label: 'Brands'     },
    { id: 'search',  label: 'Search'     },
    ...(showQuizTab ? [{ id: 'quiz', label: 'Discover' }] : []),
    {
      id: 'daily', label: 'Outfits',
      badge: totalClosetCount > 0 ? (totalClosetCount > 9 ? '9+' : totalClosetCount) : null,
    },
    { id: 'profile', label: 'Profile' },
  ]

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoWrap}>
        <span className={styles.logo}>
          Sar<span className={styles.logoAccent}>tima</span>
        </span>
      </div>
      <div className={styles.navDivider} />

      <nav className={styles.nav}>
        {navItems.map((item) => {
          const isActive =
            activeTab === item.id ||
            (item.id === 'explore' && activeTab.startsWith('aesthetic:')) ||
            (item.id === 'brands'  && activeTab.startsWith('brand:')) ||
            (item.id === 'profile' && activeTab.startsWith('profile:'))
          return (
            <button
              key={item.id}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              onClick={() => onTabChange(item.id)}
            >
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
