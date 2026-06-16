import { useEffect, useState } from 'react'
import { useWishlist } from '../context/WishlistContext'
import WardrobeScreen from './WardrobeScreen'
import WishlistScreen from './WishlistScreen'
import OutfitBoardScreen from './OutfitBoardScreen'
import styles from './MyStyleScreen.module.css'

const TABS = [
  { id: 'liked',    label: 'Liked'       },
  { id: 'wardrobe', label: 'My Wardrobe' },
  { id: 'boards',   label: 'Boards'      },
]

export default function MyStyleScreen({ forceSubTab = null }) {
  const [active, setActive] = useState('liked')

  useEffect(() => {
    if (forceSubTab != null) setActive(forceSubTab)
  }, [forceSubTab])

  const { liked, wishlist } = useWishlist()

  const counts = {
    liked:    liked.length,
    wardrobe: wishlist.length,
    boards:   0,
  }

  return (
    <div className={styles.screen}>
      {/* Sub-tab bar */}
      <div className={styles.subTabBar}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${styles.subTab} ${active === t.id ? styles.subTabActive : ''}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
            {counts[t.id] > 0 && (
              <span className={`${styles.subCount} ${active === t.id ? styles.subCountActive : ''}`}>
                {counts[t.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content — render all, hide inactive so state is preserved */}
      <div style={{ display: active === 'liked'    ? 'contents' : 'none' }}><WardrobeScreen /></div>
      <div style={{ display: active === 'wardrobe' ? 'contents' : 'none' }}><WishlistScreen /></div>
      <div style={{ display: active === 'boards'   ? 'contents' : 'none' }}><OutfitBoardScreen /></div>
    </div>
  )
}
