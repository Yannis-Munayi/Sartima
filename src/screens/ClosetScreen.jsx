import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import LockedOverlay from '../components/LockedOverlay'
import { useCloset } from '../context/ClosetContext'
import { useWishlist } from '../context/WishlistContext'
import WardrobeUpload from '../components/WardrobeUpload'
import CatalogSearchSheet from '../components/CatalogSearchSheet'
import ClosetItemSheet from '../components/ClosetItemSheet'
import WardrobeScreen from './WardrobeScreen'
import OutfitBoardScreen from './OutfitBoardScreen'
import { CARE_SYMBOLS, WASH_FREQUENCIES } from '../data/careSymbols'
import styles from './ClosetScreen.module.css'

const CATEGORY_EMOJI = {
  tops: '👕', bottoms: '👖', outerwear: '🧥',
  dresses: '👗', footwear: '👟', accessories: '👜',
}

const FORMALITY_MAP = [
  { key: 'formal',   label: 'Formal',       color: '#c9a96e' },
  { key: 'work',     label: 'Smart Casual', color: '#7eb8d4' },
  { key: 'date',     label: 'Semi-formal',  color: '#b87eb8' },
  { key: 'gym',      label: 'Athletic',     color: '#7ed4a0' },
  { key: 'outdoor',  label: 'Outdoors',     color: '#7ed4a0' },
  { key: 'casual',   label: 'Casual',       color: '#d4a07e' },
  { key: 'errand',   label: 'Casual',       color: '#d4a07e' },
]

function inferFormality(item) {
  for (const { key, label, color } of FORMALITY_MAP) {
    if (item.occasions?.includes(key)) return { label, color }
  }
  return null
}

function getDaysSince(isoStr) {
  if (!isoStr) return null
  return Math.floor((Date.now() - new Date(isoStr).getTime()) / 86400000)
}

function washStatusText(item) {
  const freq = WASH_FREQUENCIES.find((f) => f.id === item.washFrequency)
  const days = getDaysSince(item.lastWashedAt)
  if (!item.lastWashedAt) return null
  if (!freq || freq.thresholdDays === null) return `Washed ${days}d ago`
  if (days >= freq.thresholdDays) return { text: 'Due for wash', warn: true }
  return { text: days === 0 ? 'Washed today' : `Washed ${days}d ago`, warn: false }
}

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

function ClosetItemCard({ item, isFlipped, onFlip, onEdit, editMode, onRemove }) {
  const photoUrl   = item.prettifiedUrl ?? item.imageUrl ?? item.thumbnailUrl
  const formality  = inferFormality(item)
  const washStatus = washStatusText(item)
  const freqLabel  = WASH_FREQUENCIES.find((f) => f.id === item.washFrequency)?.label
  const symbols    = (item.careSymbols ?? [])
    .map((id) => CARE_SYMBOLS.find((s) => s.id === id))
    .filter(Boolean)
    .slice(0, 6)

  return (
    <div className={`${styles.flipOuter} ${editMode ? styles.itemCardEdit : ''}`}>
      {/* Delete badge (edit mode) */}
      {editMode && (
        <button className={styles.removeBtn} onClick={() => onRemove(item.id)} aria-label={`Remove ${item.name}`}>
          ✕
        </button>
      )}

      <div className={`${styles.flipInner} ${isFlipped ? styles.flipped : ''}`}>

        {/* ── FRONT ── */}
        <div className={styles.cardFront} onClick={() => !editMode && onFlip()}>
          <div className={styles.itemPhoto}>
            {photoUrl ? (
              <img src={photoUrl} alt={item.name} className={styles.itemImg} />
            ) : (
              <div className={styles.itemPlaceholder}>{CATEGORY_EMOJI[item.category] ?? '👕'}</div>
            )}
            {item.prettifiedUrl && <span className={styles.prettifiedBadge} title="Prettified">✦</span>}
            {item.favorite      && <span className={styles.favBadge}>♥</span>}
          </div>
          <p className={styles.itemName}>{item.name}</p>
          {item.brand && <p className={styles.itemBrand}>{item.brand}</p>}
        </div>

        {/* ── BACK ── */}
        <div className={styles.cardBack}>
          {/* Header */}
          <div className={styles.backHeader}>
            <span className={styles.backName}>{item.name}</span>
            <button className={styles.flipBackBtn} onClick={onFlip} aria-label="Flip back">↩</button>
          </div>

          <div className={styles.backBody}>
            {/* Material + formality */}
            <div className={styles.backRow}>
              {item.material && (
                <span className={styles.backPill}>{item.material}</span>
              )}
              {formality && (
                <span className={styles.backPill} style={{ color: formality.color, borderColor: formality.color, background: `${formality.color}18` }}>
                  {formality.label}
                </span>
              )}
              {!item.material && !formality && (
                <span className={styles.backMuted}>No details yet — tap Edit</span>
              )}
            </div>

            {/* Seasons */}
            {item.seasons?.length > 0 && (
              <div className={styles.backRow}>
                {item.seasons.map((s) => (
                  <span key={s} className={styles.backPillSm}>{s}</span>
                ))}
              </div>
            )}

            {/* Care symbols */}
            {symbols.length > 0 && (
              <div className={styles.backSection}>
                <p className={styles.backSectionLabel}>Care label</p>
                <div className={styles.backRow}>
                  {symbols.map((s) => (
                    <span key={s.id} className={styles.symbolChip} title={s.label}>{s.abbreviation}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Storage + wash frequency */}
            {(item.storageMethod || freqLabel) && (
              <div className={styles.backInfoRow}>
                {item.storageMethod && (
                  <span className={styles.backInfoItem}>
                    {item.storageMethod === 'hang' ? '🪝' : '📦'} {item.storageMethod === 'hang-or-fold' ? 'Hang or fold' : item.storageMethod === 'hang' ? 'Hang' : 'Fold'}
                  </span>
                )}
                {freqLabel && (
                  <span className={styles.backInfoItem}>♻ {freqLabel}</span>
                )}
              </div>
            )}

            {/* Last washed */}
            {washStatus && (
              <p className={`${styles.backWashStatus} ${washStatus.warn ? styles.backWashWarn : ''}`}>
                {washStatus.warn ? '⚠ ' : '✓ '}{washStatus.text}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className={styles.backActions}>
            <button className={styles.backEditBtn} onClick={onEdit}>✎ Edit</button>
            <button className={styles.backRemoveBtn} onClick={() => onRemove(item.id)}>Remove</button>
          </div>
        </div>

      </div>
    </div>
  )
}

function MyClosetTab() {
  const { user }                   = useAuth()
  const { closetItems, closetLoading, closetError, retryLoadCloset, closetByCategory, addToCloset, removeFromCloset } = useCloset()
  const [activeFilter, setFilter]  = useState('all')
  const [showUpload, setShowUpload]       = useState(false)
  const [showSearch, setShowSearch]       = useState(false)
  const [showAddSheet, setShowAddSheet]   = useState(false)
  const [selectedItem, setSelectedItem]   = useState(null)
  const [editMode, setEditMode]           = useState(false)
  const [flippedId, setFlippedId]         = useState(null)

  function handleFlip(id) {
    setFlippedId((prev) => (prev === id ? null : id))
  }

  const displayed = activeFilter === 'all'
    ? closetItems
    : (closetByCategory[activeFilter] ?? [])

  async function handleSave(item) {
    await addToCloset(item)
  }

  if (!user) {
    const ghostItems = [
      { id: 'g1', emoji: '👕', bg: 'linear-gradient(135deg,#2d3a4a,#1a2634)', name: 'White Oxford Shirt' },
      { id: 'g2', emoji: '👖', bg: 'linear-gradient(135deg,#1a2a1a,#2a3a2a)', name: 'Slim Chinos' },
      { id: 'g3', emoji: '🧥', bg: 'linear-gradient(135deg,#2a1a1a,#3a2a1a)', name: 'Wool Overcoat' },
      { id: 'g4', emoji: '👟', bg: 'linear-gradient(135deg,#1a1a2a,#2a2a3a)', name: 'Leather Sneakers' },
      { id: 'g5', emoji: '👗', bg: 'linear-gradient(135deg,#2a1a3a,#1a1a2a)', name: 'Midi Dress' },
      { id: 'g6', emoji: '👜', bg: 'linear-gradient(135deg,#3a2a1a,#2a1a1a)', name: 'Tote Bag' },
    ]
    return (
      <LockedOverlay message="Sign in to build your digital closet">
        <div className={styles.grid} style={{ padding: '16px 0' }}>
          {ghostItems.map((item) => (
            <div key={item.id} className={styles.itemCard}>
              <div className={styles.itemPhoto} style={{ background: item.bg }}>
                <div className={styles.itemPlaceholder}>{item.emoji}</div>
              </div>
              <p className={styles.itemName}>{item.name}</p>
            </div>
          ))}
        </div>
      </LockedOverlay>
    )
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

  if (closetError) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyEmoji}>⚠️</p>
        <p className={styles.emptyTitle}>Couldn't load your closet</p>
        <p className={styles.emptySub}>Check your connection and try again</p>
        <button className={styles.fab} style={{ position: 'static', marginTop: '1rem' }} onClick={retryLoadCloset}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Category filter chips + Edit toggle */}
      <div className={styles.filterRowWrap}>
        <div className={styles.filterRow}>
          {CATEGORY_FILTERS.map((f) => (
            <button
              key={f.id}
              className={`${styles.filterChip} ${activeFilter === f.id ? styles.filterChipActive : ''}`}
              onClick={() => { setFilter(f.id); setEditMode(false); setFlippedId(null) }}
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
        {displayed.length > 0 && (
          <button
            className={`${styles.editToggle} ${editMode ? styles.editToggleActive : ''}`}
            onClick={() => { setEditMode((v) => !v); setFlippedId(null) }}
          >
            {editMode ? 'Done' : 'Edit'}
          </button>
        )}
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
            <ClosetItemCard
              key={item.id}
              item={item}
              isFlipped={flippedId === item.id}
              onFlip={() => handleFlip(item.id)}
              onEdit={() => { setFlippedId(null); setSelectedItem(item) }}
              editMode={editMode}
              onRemove={(id) => { setFlippedId(null); removeFromCloset(id) }}
            />
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

export default function ClosetScreen({ singleTab } = {}) {
  const [activeTab, setActiveTab] = useState('closet')
  const { closetItems }          = useCloset()
  const { liked, wishlist }      = useWishlist()

  // Embedded mode: render just the requested tab content, no screen wrapper or sub-nav
  if (singleTab === 'closet') return <MyClosetTab />
  if (singleTab === 'liked')  return <WardrobeScreen />

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
