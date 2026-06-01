import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCloset } from '../context/ClosetContext'
import { useWishlist } from '../context/WishlistContext'
import WardrobeUpload from '../components/WardrobeUpload'
import CatalogSearchSheet from '../components/CatalogSearchSheet'
import ClosetItemSheet from '../components/ClosetItemSheet'
import WardrobeScreen from './WardrobeScreen'
import OutfitBoardScreen from './OutfitBoardScreen'
import styles from './ClosetScreen.module.css'

const CATEGORY_FILTERS = [
  { id: 'all',         label: 'All',         emoji: '✦' },
  { id: 'tops',        label: 'Tops',        emoji: '👕' },
  { id: 'bottoms',     label: 'Bottoms',     emoji: '👖' },
  { id: 'outerwear',   label: 'Outerwear',   emoji: '🧥' },
  { id: 'dresses',     label: 'Dresses',     emoji: '👗' },
  { id: 'footwear',    label: 'Footwear',    emoji: '👟' },
  { id: 'accessories', label: 'Accessories', emoji: '👜' },
]

const TABS = [
  { id: 'closet',  label: 'My Closet'  },
  { id: 'outfits', label: 'Outfits'    },
  { id: 'liked',   label: 'Liked'      },
]

function ClosetItemCard({ item, onTap }) {
  const hasPhoto = item.prettifiedUrl || item.imageUrl || item.thumbnailUrl
  const photoUrl = item.prettifiedUrl ?? item.imageUrl ?? item.thumbnailUrl

  return (
    <button className={styles.itemCard} onClick={() => onTap(item)}>
      <div className={styles.itemPhoto}>
        {hasPhoto ? (
          <img src={photoUrl} alt={item.name} className={styles.itemImg} />
        ) : (
          <div className={styles.itemPlaceholder}>
            {item.category === 'tops'        ? '👕'
             : item.category === 'bottoms'   ? '👖'
             : item.category === 'outerwear' ? '🧥'
             : item.category === 'dresses'   ? '👗'
             : item.category === 'footwear'  ? '👟'
             : '👜'}
          </div>
        )}
        {item.prettifiedUrl && (
          <span className={styles.prettifiedBadge} title="Prettified">✦</span>
        )}
        {item.favorite && (
          <span className={styles.favBadge}>♥</span>
        )}
      </div>
      <p className={styles.itemName}>{item.name}</p>
      {item.brand && <p className={styles.itemBrand}>{item.brand}</p>}
    </button>
  )
}

function MyClosetTab() {
  const { user }                   = useAuth()
  const { closetItems, closetLoading, closetByCategory, addToCloset } = useCloset()
  const [activeFilter, setFilter]  = useState('all')
  const [showUpload, setShowUpload]       = useState(false)
  const [showSearch, setShowSearch]       = useState(false)
  const [showAddSheet, setShowAddSheet]   = useState(false)
  const [selectedItem, setSelectedItem]   = useState(null)

  const displayed = activeFilter === 'all'
    ? closetItems
    : (closetByCategory[activeFilter] ?? [])

  async function handleSave(item) {
    await addToCloset(item)
  }

  if (closetLoading) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.loadingDots}>
          <span /><span /><span />
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Category filter chips */}
      <div className={styles.filterRow}>
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.id}
            className={`${styles.filterChip} ${activeFilter === f.id ? styles.filterChipActive : ''}`}
            onClick={() => setFilter(f.id)}
          >
            <span className={styles.filterEmoji}>{f.emoji}</span> {f.label}
            {f.id !== 'all' && (closetByCategory[f.id]?.length ?? 0) > 0 && (
              <span className={styles.filterCount}>
                {closetByCategory[f.id].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Item grid */}
      {displayed.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyEmoji}>🪣</p>
          <p className={styles.emptyTitle}>
            {activeFilter === 'all' ? 'Your closet is empty' : `No ${activeFilter} yet`}
          </p>
          <p className={styles.emptySub}>
            {activeFilter === 'all'
              ? 'Tap + to add your first piece'
              : 'Switch to All or add pieces in this category'}
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {displayed.map((item) => (
            <ClosetItemCard key={item.id} item={item} onTap={setSelectedItem} />
          ))}
        </div>
      )}

      {/* Add method sheet */}
      {showAddSheet && (
        <div className={styles.addSheetOverlay} onClick={() => setShowAddSheet(false)}>
          <div className={styles.addSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.addSheetHandle} />
            <h3 className={styles.addSheetTitle}>Add to Closet</h3>
            <p className={styles.addSheetSub}>How would you like to add an item?</p>
            <div className={styles.addSheetOptions}>
              <button className={styles.addOption} onClick={() => { setShowAddSheet(false); setShowUpload(true) }}>
                <span className={styles.addOptionIcon}>📸</span>
                <span className={styles.addOptionLabel}>Upload Photo</span>
                <span className={styles.addOptionSub}>Single piece or AI outfit scan</span>
              </button>
              <button className={styles.addOption} onClick={() => { setShowAddSheet(false); setShowSearch(true) }}>
                <span className={styles.addOptionIcon}>🔍</span>
                <span className={styles.addOptionLabel}>Search Catalog</span>
                <span className={styles.addOptionSub}>Find and add items by name or brand</span>
              </button>
            </div>
            <button className={styles.addSheetCancel} onClick={() => setShowAddSheet(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Upload modal */}
      {showUpload && user && (
        <WardrobeUpload
          uid={user.uid}
          onSave={handleSave}
          onClose={() => setShowUpload(false)}
        />
      )}

      {/* Catalog search sheet */}
      {showSearch && (
        <CatalogSearchSheet
          onAdd={handleSave}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Item detail / action sheet */}
      {selectedItem && (
        <ClosetItemSheet
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdate={() => setSelectedItem(null)}
        />
      )}

      {/* FAB */}
      <button className={styles.fab} onClick={() => setShowAddSheet(true)} aria-label="Add item">
        +
      </button>
    </>
  )
}

export default function ClosetScreen() {
  const [activeTab, setActiveTab] = useState('closet')
  const { closetItems }          = useCloset()
  const { liked, wishlist }      = useWishlist()

  const counts = {
    closet:  closetItems.length,
    outfits: 0,
    liked:   liked.length + wishlist.length,
  }

  return (
    <div className={styles.screen}>
      {/* Tab bar */}
      <div className={styles.subTabBar}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${styles.subTab} ${activeTab === t.id ? styles.subTabActive : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
            {counts[t.id] > 0 && (
              <span className={`${styles.subCount} ${activeTab === t.id ? styles.subCountActive : ''}`}>
                {counts[t.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ display: activeTab === 'closet'  ? 'block' : 'none' }}><MyClosetTab /></div>
      <div style={{ display: activeTab === 'outfits' ? 'contents' : 'none' }}><OutfitBoardScreen /></div>
      <div style={{ display: activeTab === 'liked'   ? 'contents' : 'none' }}><WardrobeScreen /></div>
    </div>
  )
}
