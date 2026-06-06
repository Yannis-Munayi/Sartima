import { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCloset } from '../context/ClosetContext'
import { useWishlist } from '../context/WishlistContext'
import { useAvatar } from '../hooks/useAvatar'
import styles from './OutfitBoardScreen.module.css'

const CATEGORIES = [
  { id: 'tops',        label: 'Tops',        emoji: '👕' },
  { id: 'bottoms',     label: 'Bottoms',     emoji: '👖' },
  { id: 'outerwear',   label: 'Outerwear',   emoji: '🧥' },
  { id: 'dresses',     label: 'Dresses',     emoji: '👗' },
  { id: 'footwear',    label: 'Footwear',    emoji: '👟' },
  { id: 'accessories', label: 'Accessories', emoji: '👜' },
]

// Overlay positions per category (% of avatar container)
const OVERLAY_STYLE = {
  tops:        { top: '14%',  left: '8%',  width: '84%', maxHeight: '38%' },
  outerwear:   { top: '8%',   left: '4%',  width: '92%', maxHeight: '46%', zIndex: 3 },
  dresses:     { top: '12%',  left: '10%', width: '80%', maxHeight: '70%' },
  bottoms:     { top: '48%',  left: '12%', width: '76%', maxHeight: '38%' },
  footwear:    { bottom: '3%',left: '18%', width: '64%', maxHeight: '18%' },
  accessories: { top: '4%',   right: '4%', width: '26%', maxHeight: '24%', zIndex: 4 },
}

function ItemCard({ item, selected, onClick }) {
  const photo = item.prettifiedUrl ?? item.imageUrl ?? item.thumbnailUrl

  return (
    <button
      className={`${styles.itemCard} ${selected ? styles.itemCardSelected : ''}`}
      onClick={onClick}
    >
      <div className={styles.itemPhoto}>
        {photo ? (
          <img src={photo} alt={item.name} className={styles.itemImg} />
        ) : (
          <span className={styles.itemEmoji}>
            {CATEGORIES.find((c) => c.id === item.category)?.emoji ?? '👕'}
          </span>
        )}
      </div>
      {selected && <div className={styles.itemCheck}>✓</div>}
      <p className={styles.itemLabel}>{item.name}</p>
    </button>
  )
}

function AvatarHero({ avatarUrl, selectedItems, onUploadClick, uploading }) {
  const hasItems = selectedItems.length > 0
  const prettified = selectedItems.filter((i) => i.prettifiedUrl)
  const nonPrettified = selectedItems.filter((i) => !i.prettifiedUrl)

  return (
    <div className={styles.avatarHero}>
      {avatarUrl ? (
        <img src={avatarUrl} alt="Your avatar" className={styles.avatarPhoto} />
      ) : (
        <div className={styles.avatarPlaceholder}>
          <div className={styles.avatarSilhouette}>
            <svg viewBox="0 0 100 180" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="50" cy="32" rx="22" ry="24" fill="rgba(255,255,255,0.1)" />
              <path d="M14 180 C14 120 86 120 86 180" fill="rgba(255,255,255,0.1)" />
            </svg>
          </div>
          <p className={styles.avatarHint}>Upload your photo to try on outfits</p>
          <button className={styles.uploadAvatarBtn} onClick={onUploadClick} disabled={uploading}>
            {uploading ? 'Uploading...' : '+ Add Your Photo'}
          </button>
        </div>
      )}

      {/* Prettified item overlays */}
      {prettified.map((item) => (
        <div
          key={item.id}
          className={styles.itemOverlay}
          style={OVERLAY_STYLE[item.category] ?? OVERLAY_STYLE.tops}
        >
          <img
            src={item.prettifiedUrl}
            alt={item.name}
            className={styles.overlayImg}
          />
        </div>
      ))}

      {/* Non-prettified items shown as a row at the bottom of the hero */}
      {nonPrettified.length > 0 && (
        <div className={styles.nonPrettifiedRow}>
          {nonPrettified.map((item) => {
            const photo = item.imageUrl ?? item.thumbnailUrl
            return (
              <div key={item.id} className={styles.npThumb}>
                {photo && <img src={photo} alt={item.name} className={styles.npThumbImg} />}
                <span className={styles.npCat}>
                  {CATEGORIES.find((c) => c.id === item.category)?.emoji}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Change photo button (top-right, shown when avatar exists) */}
      {avatarUrl && (
        <button
          className={styles.changeAvatarBtn}
          onClick={onUploadClick}
          disabled={uploading}
          title="Change photo"
        >
          {uploading ? '...' : '✎'}
        </button>
      )}

      {/* Empty hero prompt when avatar exists but no items selected */}
      {avatarUrl && !hasItems && (
        <div className={styles.heroPrompt}>
          <p>Select pieces below to build your outfit</p>
        </div>
      )}
    </div>
  )
}

function SaveSheet({ onSave, onCancel, defaultName }) {
  const [name, setName] = useState(defaultName ?? '')
  const inputRef = useRef(null)

  return (
    <div className={styles.sheetOverlay} onClick={onCancel}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHandle} />
        <h3 className={styles.sheetTitle}>Save Outfit</h3>
        <input
          ref={inputRef}
          className={styles.sheetInput}
          placeholder="Outfit name (e.g. Sunday Brunch)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoFocus
        />
        <div className={styles.sheetActions}>
          <button className={styles.sheetCancel} onClick={onCancel}>Cancel</button>
          <button
            className={styles.sheetSave}
            onClick={() => name.trim() && onSave(name.trim())}
            disabled={!name.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function BoardCard({ board, onOpen, onDelete }) {
  const thumbs = board.items.slice(0, 4)

  return (
    <div className={styles.boardCard} onClick={() => onOpen(board)}>
      <div className={styles.boardThumbs}>
        {thumbs.map((item) => {
          const photo = item.prettifiedUrl ?? item.imageUrl ?? item.thumbnailUrl
          return (
            <div key={item.id} className={styles.boardThumb}>
              {photo
                ? <img src={photo} alt={item.name} className={styles.boardThumbImg} />
                : <span>{CATEGORIES.find((c) => c.id === item.category)?.emoji ?? '👕'}</span>
              }
            </div>
          )
        })}
        {board.items.length > 4 && (
          <div className={styles.boardThumb} style={{ background: 'rgba(255,255,255,0.06)' }}>
            <span className={styles.boardMore}>+{board.items.length - 4}</span>
          </div>
        )}
      </div>
      <div className={styles.boardInfo}>
        <p className={styles.boardName}>{board.name}</p>
        <p className={styles.boardMeta}>{board.items.length} piece{board.items.length !== 1 ? 's' : ''}</p>
      </div>
      <button
        className={styles.boardDelete}
        onClick={(e) => { e.stopPropagation(); onDelete(board.id) }}
        aria-label="Delete"
      >
        ✕
      </button>
    </div>
  )
}

const GHOST_BOARDS = [
  { name: 'Weekend Casual', items: [{ id: 'g1', category: 'tops' }, { id: 'g2', category: 'bottoms' }, { id: 'g3', category: 'footwear' }] },
  { name: 'Office Ready',   items: [{ id: 'g4', category: 'outerwear' }, { id: 'g5', category: 'tops' }, { id: 'g6', category: 'bottoms' }] },
]

export default function OutfitBoardScreen() {
  const { user }    = useAuth()
  const { closetItems } = useCloset()
  const { outfitBoards, saveOutfitBoard, deleteOutfitBoard, liked, wishlist } = useWishlist()
  const { avatarUrl, uploadAvatar, uploading } = useAvatar()

  const [activeCategory, setActiveCategory] = useState('tops')
  const [selectedItems, setSelectedItems] = useState({}) // { [category]: item }
  const [showSaveSheet, setShowSaveSheet] = useState(false)
  const [viewMode, setViewMode] = useState('studio') // 'studio' | 'boards'
  const [loadingBoard, setLoadingBoard] = useState(null)

  const fileInputRef = useRef(null)

  // Item pool: closet items first (they have prettifiedUrl), then liked/wishlist
  const pool = [
    ...closetItems,
    ...liked.filter((l) => !closetItems.some((c) => c.id === l.id)),
    ...wishlist.filter((w) => !closetItems.some((c) => c.id === w.id) && !liked.some((l) => l.id === w.id)),
  ]

  const itemsByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = pool.filter((item) => item.category === cat.id)
    return acc
  }, {})

  const selectedList = Object.values(selectedItems).filter(Boolean)

  function toggleItem(item) {
    setSelectedItems((prev) => {
      const current = prev[item.category]
      if (current?.id === item.id) {
        const next = { ...prev }
        delete next[item.category]
        return next
      }
      return { ...prev, [item.category]: item }
    })
  }

  function clearOutfit() {
    setSelectedItems({})
  }

  function handleSaveOutfit(name) {
    if (selectedList.length === 0) return
    const board = {
      id: `board-${Date.now()}`,
      name,
      aesthetic: '',
      items: selectedList,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    saveOutfitBoard(board)
    setShowSaveSheet(false)
  }

  function handleOpenBoard(board) {
    const map = {}
    board.items.forEach((item) => { map[item.category] = item })
    setSelectedItems(map)
    setViewMode('studio')
    setActiveCategory(board.items[0]?.category ?? 'tops')
  }

  async function handleAvatarFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadAvatar(file)
    e.target.value = ''
  }

  if (!user) {
    return (
      <div className={styles.screen}>
        <div className={styles.lockedBanner}>
          <div className={styles.ghostHero}>
            <div className={styles.avatarPlaceholder}>
              <div className={styles.avatarSilhouette}>
                <svg viewBox="0 0 100 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <ellipse cx="50" cy="32" rx="22" ry="24" fill="rgba(255,255,255,0.08)" />
                  <path d="M14 180 C14 120 86 120 86 180" fill="rgba(255,255,255,0.08)" />
                </svg>
              </div>
            </div>
            <div className={styles.lockedOverlay}>
              <span className={styles.lockIcon}>🔒</span>
              <p className={styles.lockLabel}>Sign in to try on outfits</p>
            </div>
          </div>

          <div className={styles.ghostBoards}>
            {GHOST_BOARDS.map((b) => (
              <div key={b.name} className={`${styles.boardCard} ${styles.boardCardGhost}`}>
                <div className={styles.boardThumbs}>
                  {b.items.map((item) => (
                    <div key={item.id} className={styles.boardThumb} style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <span>{CATEGORIES.find((c) => c.id === item.category)?.emoji}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.boardInfo}>
                  <p className={styles.boardName}>{b.name}</p>
                  <p className={styles.boardMeta}>{b.items.length} pieces</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      {/* Hidden file input for avatar */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleAvatarFile}
      />

      {/* Mode toggle */}
      <div className={styles.modeToggle}>
        <button
          className={`${styles.modeBtn} ${viewMode === 'studio' ? styles.modeBtnActive : ''}`}
          onClick={() => setViewMode('studio')}
        >
          Try On
        </button>
        <button
          className={`${styles.modeBtn} ${viewMode === 'boards' ? styles.modeBtnActive : ''}`}
          onClick={() => setViewMode('boards')}
        >
          Saved Looks {outfitBoards.length > 0 && <span className={styles.modeBadge}>{outfitBoards.length}</span>}
        </button>
      </div>

      {viewMode === 'studio' && (
        <>
          {/* Avatar hero */}
          <AvatarHero
            avatarUrl={avatarUrl}
            selectedItems={selectedList}
            onUploadClick={() => fileInputRef.current?.click()}
            uploading={uploading}
          />

          {/* Category tabs */}
          <div className={styles.catTabsWrap}>
            <div className={styles.catTabs}>
              {CATEGORIES.map((cat) => {
                const count = itemsByCategory[cat.id]?.length ?? 0
                const picked = !!selectedItems[cat.id]
                return (
                  <button
                    key={cat.id}
                    className={`${styles.catTab} ${activeCategory === cat.id ? styles.catTabActive : ''} ${picked ? styles.catTabPicked : ''}`}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    <span className={styles.catEmoji}>{cat.emoji}</span>
                    <span className={styles.catLabel}>{cat.label}</span>
                    {picked && <span className={styles.catDot} />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Item picker */}
          <div className={styles.pickerSection}>
            {itemsByCategory[activeCategory]?.length === 0 ? (
              <div className={styles.emptyPicker}>
                <p className={styles.emptyPickerText}>
                  No {CATEGORIES.find((c) => c.id === activeCategory)?.label.toLowerCase()} in your closet yet.
                </p>
                <p className={styles.emptyPickerSub}>Add items to your closet or like some pieces first.</p>
              </div>
            ) : (
              <div className={styles.itemRow}>
                {itemsByCategory[activeCategory].map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    selected={selectedItems[activeCategory]?.id === item.id}
                    onClick={() => toggleItem(item)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className={styles.actionBar}>
            {selectedList.length > 0 && (
              <button className={styles.clearBtn} onClick={clearOutfit}>
                Clear
              </button>
            )}
            <button
              className={styles.saveOutfitBtn}
              onClick={() => setShowSaveSheet(true)}
              disabled={selectedList.length === 0}
            >
              Save Outfit ({selectedList.length})
            </button>
          </div>
        </>
      )}

      {viewMode === 'boards' && (
        <div className={styles.boardsView}>
          {outfitBoards.length === 0 ? (
            <div className={styles.emptyBoards}>
              <p className={styles.emptyBoardsEmoji}>🗂️</p>
              <p className={styles.emptyBoardsTitle}>No saved looks yet</p>
              <p className={styles.emptyBoardsSub}>Build an outfit in Try On and save it here.</p>
              <button className={styles.goStudioBtn} onClick={() => setViewMode('studio')}>
                Start Building
              </button>
            </div>
          ) : (
            <>
              <p className={styles.boardsHint}>Tap a look to load it back into Try On.</p>
              <div className={styles.boardsGrid}>
                {outfitBoards.map((board) => (
                  <BoardCard
                    key={board.id}
                    board={board}
                    onOpen={handleOpenBoard}
                    onDelete={deleteOutfitBoard}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {showSaveSheet && (
        <SaveSheet
          onSave={handleSaveOutfit}
          onCancel={() => setShowSaveSheet(false)}
          defaultName={selectedList.map((i) => i.name.split(' ')[0]).join(' + ')}
        />
      )}
    </div>
  )
}
