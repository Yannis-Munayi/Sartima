import { useRef } from 'react'
import LockedOverlay from '../components/LockedOverlay'
import { useAvatar } from '../hooks/useAvatar'
import { useAuth } from '../context/AuthContext'
import { useCloset } from '../context/ClosetContext'
import { useWishlist } from '../context/WishlistContext'
import { useOutfitLog } from '../hooks/useOutfitLog'
import { getWeatherEmoji } from '../services/weather'
import styles from './DailyLookScreen.module.css'
import Icon from '../components/Icon'

const CATEGORY_EMOJIS = {
  tops: '👕', bottoms: '👖', outerwear: '🧥',
  dresses: '👗', footwear: '👟', accessories: '👜',
}

function formatTemp(tempC) {
  const unit = localStorage.getItem('sartima_temp_unit') ?? 'c'
  if (unit === 'f') return `${Math.round(tempC * 9 / 5 + 32)}°F`
  return `${tempC}°C`
}

// ── Outfit board card (used in My Outfits saved looks) ────────────────────────

function OutfitBoardCard({ board, onEdit, onDelete }) {
  return (
    <div className={styles.outfitBoardCard}>
      <div className={styles.boardInfo}>
        <p className={styles.boardName}>{board.name}</p>
        <p className={styles.boardMeta}>{board.items.length} piece{board.items.length !== 1 ? 's' : ''}</p>
      </div>
      <div className={styles.boardPhotoStrip}>
        {board.items.slice(0, 4).map((item) => {
          const url = item.prettifiedUrl ?? item.imageUrl ?? item.thumbnailUrl
          return (
            <div
              key={item.id}
              className={styles.boardThumb}
              style={{ background: item.gradient ?? 'var(--surface-hover)' }}
            >
              {url && <img src={url} alt={item.name} className={styles.boardThumbImg} />}
            </div>
          )
        })}
      </div>
      <div className={styles.boardActions}>
        <button className={styles.boardEditBtn} onClick={onEdit}>Edit</button>
        <button className={styles.boardDeleteBtn} onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}

export default function MyOutfitsTab() {
  const { user }    = useAuth()
  const { outfitBoards, deleteOutfitBoard } = useWishlist()
  const { logEntries }  = useOutfitLog(user)
  const { closetItems } = useCloset()
  const itemMap = Object.fromEntries(closetItems.map((i) => [i.id, i]))
  const { avatarUrl, displayUrl, uploadAvatar, deleteAvatar, uploading, prettifying } = useAvatar()
  const avatarFileRef = useRef(null)

  async function handleAvatarFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    await uploadAvatar(file)
  }

  if (!user) {
    return (
      <div className={styles.myOutfitsTab}>
        <LockedOverlay message="Sign in to save and manage your outfits">
          <div className={styles.boardsList} style={{ padding: 'var(--space-2) 0', filter: 'blur(4px)', pointerEvents: 'none' }}>
            {[{ name: 'Weekend Casual', count: 4 }, { name: 'Office Ready', count: 3 }].map((b) => (
              <div key={b.name} className={styles.outfitBoardCard}>
                <div className={styles.boardInfo}>
                  <p className={styles.boardName}>{b.name}</p>
                  <p className={styles.boardMeta}>{b.count} pieces</p>
                </div>
              </div>
            ))}
          </div>
        </LockedOverlay>
      </div>
    )
  }

  const hasBoards = outfitBoards.length > 0
  const hasLog    = logEntries && logEntries.length > 0

  return (
    <div className={styles.myOutfitsTab}>

      {/* Hidden file input */}
      <input
        ref={avatarFileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleAvatarFile}
      />

      {/* Avatar card */}
      <div className={styles.avatarCard}>
        <div className={styles.avatarCardThumbWrap} onClick={() => avatarFileRef.current?.click()}>
          {displayUrl ? (
            <img src={displayUrl} alt="Your try-on photo" className={styles.avatarCardThumb} />
          ) : (
            <span className={styles.avatarCardEmoji}><Icon name="user" size={24} /></span>
          )}
          {(uploading || prettifying) && (
            <div className={styles.avatarCardOverlay}>
              {prettifying ? 'Removing bg…' : 'Uploading…'}
            </div>
          )}
        </div>
        <div className={styles.avatarCardInfo}>
          <p className={styles.avatarCardTitle}>Try-On Photo</p>
          <p className={styles.avatarCardSub}>
            {displayUrl
              ? 'Used for virtual try-on. Tap "Try On" on any item in My Closet or Liked.'
              : 'Upload a full-body photo to try on clothes virtually.'}
          </p>
          <div className={styles.avatarCardBtns}>
            <button
              className={styles.avatarCardUpload}
              onClick={() => avatarFileRef.current?.click()}
              disabled={uploading || prettifying}
            >
              {displayUrl ? 'Change' : '+ Upload'}
            </button>
            {displayUrl && (
              <button
                className={styles.avatarCardDelete}
                onClick={deleteAvatar}
                disabled={uploading || prettifying}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Saved outfit boards */}
      {hasBoards && (
        <section className={styles.outfitsSection}>
          <h3 className={styles.outfitsSectionTitle}>Saved Outfits</h3>
          <div className={styles.boardsList}>
            {outfitBoards.map((board) => (
              <OutfitBoardCard
                key={board.id}
                board={board}
                onEdit={() => {}}
                onDelete={() => deleteOutfitBoard(board.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Outfit log */}
      {hasLog && (
        <section className={styles.outfitsSection}>
          <h3 className={styles.outfitsSectionTitle}>Outfit Log</h3>
          <div className={styles.logList}>
            {logEntries.map((entry) => {
              const items = (entry.itemIds ?? []).map((id) => itemMap[id]).filter(Boolean)
              return (
                <div key={entry.id} className={styles.logEntry}>
                  <div className={styles.logEntryHeader}>
                    <span className={styles.logDate}>{entry.date}</span>
                    <span className={styles.logOccasion}>{entry.occasion}</span>
                    {entry.weather && (
                      <span className={styles.logWeather}>
                        {getWeatherEmoji(entry.weather.condition)} {formatTemp(entry.weather.temp)}
                      </span>
                    )}
                  </div>
                  <div className={styles.logItemRow}>
                    {items.slice(0, 4).map((item) => {
                      const photoUrl = item.prettifiedUrl ?? item.imageUrl ?? item.thumbnailUrl
                      return (
                        <div key={item.id} className={styles.logItemThumb}>
                          {photoUrl
                            ? <img src={photoUrl} alt={item.name} className={styles.logThumbImg} />
                            : <span>{CATEGORY_EMOJIS[item.category] ?? '👕'}</span>
                          }
                        </div>
                      )
                    })}
                    {items.length === 0 && (
                      <p className={styles.logItemsMissing}>Items no longer in closet</p>
                    )}
                  </div>
                  {entry.notes && <p className={styles.logNoteText}>"{entry.notes}"</p>}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!hasBoards && !hasLog && logEntries !== null && (
        <div className={styles.emptyState}>
          <p className={styles.emptyEmoji}><Icon name="hanger" size={24} /></p>
          <p className={styles.emptyTitle}>No outfits yet</p>
          <p className={styles.emptySub}>
            Try on items from your closet — tap "Try On" on any piece to get started.
          </p>
        </div>
      )}

      {/* Loading */}
      {!hasBoards && logEntries === null && (
        <div className={styles.emptyState}>
          <div className={styles.loadingDots}><span /><span /><span /></div>
        </div>
      )}
    </div>
  )
}
