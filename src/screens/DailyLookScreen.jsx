import { useEffect, useMemo, useRef, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { useCloset } from '../context/ClosetContext'
import { useWishlist } from '../context/WishlistContext'
import { generateOutfit } from '../services/outfitAI'
import { fetchPhotosWithFallback } from '../services/pexels'
import { getWeather, getWeatherEmoji } from '../services/weather'
import WeatherWidget from '../components/WeatherWidget'
import OutfitCalendarScreen from './OutfitCalendarScreen'
import TripPlannerScreen from './TripPlannerScreen'
import ClosetScreen from './ClosetScreen'
import styles from './DailyLookScreen.module.css'

// Normalize a liked quiz/product item to the shape generateOutfit expects
function normalizeLiked(item) {
  return {
    id:          item.id,
    name:        item.name,
    category:    item.categoryId ?? item.parentType ?? item.category ?? 'tops',
    color:       item.color ?? item.colorHex ?? '',
    seasons:     item.seasons ?? [],
    occasions:   [],
    imageUrl:    null,
    thumbnailUrl: null,
    prettifiedUrl: null,
  }
}

const SOURCES = [
  { id: 'closet', label: 'Closet' },
  { id: 'liked',  label: 'Liked'  },
  { id: 'both',   label: 'Both'   },
]

const OCCASIONS = [
  { id: 'casual',  label: 'Casual',    emoji: '☀️' },
  { id: 'work',    label: 'Work',      emoji: '💼' },
  { id: 'date',    label: 'Date Night',emoji: '✨' },
  { id: 'gym',     label: 'Gym',       emoji: '💪' },
  { id: 'errand',  label: 'Errand',    emoji: '🛒' },
]

const CATEGORY_EMOJIS = {
  tops: '👕', bottoms: '👖', outerwear: '🧥',
  dresses: '👗', footwear: '👟', accessories: '👜',
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function OutfitCard({ item }) {
  const storedUrl = item.prettifiedUrl ?? item.imageUrl ?? item.thumbnailUrl
  const [fetchedUrl, setFetchedUrl] = useState(null)

  useEffect(() => {
    if (storedUrl) return
    let cancelled = false
    fetchPhotosWithFallback([
      `${item.name} ${item.color ?? ''} fashion`.trim(),
      `${item.name} clothing`,
    ], 1).then(([url] = []) => {
      if (!cancelled) setFetchedUrl(url ?? null)
    })
    return () => { cancelled = true }
  }, [item.id, storedUrl, item.name, item.color])

  const photoUrl = storedUrl ?? fetchedUrl

  return (
    <div className={styles.outfitItem}>
      <div className={styles.outfitPhoto}>
        {photoUrl
          ? <img src={photoUrl} alt={item.name} className={styles.outfitImg} />
          : <span className={styles.outfitEmoji}>{CATEGORY_EMOJIS[item.category] ?? '👕'}</span>
        }
      </div>
      <p className={styles.outfitItemName}>{item.name}</p>
      <p className={styles.outfitItemCat}>{item.category}</p>
    </div>
  )
}

function TodayTab() {
  const { user }        = useAuth()
  const { state }       = useApp()
  const { closetItems } = useCloset()
  const { liked }       = useWishlist()

  const [source, setSource]           = useState('closet')
  const [occasion, setOccasion]       = useState('casual')
  const [outfit, setOutfit]           = useState(null)
  const [generating, setGenerating]   = useState(false)
  const [genError, setGenError]       = useState(null)
  const [weather, setWeather]         = useState(null)
  const [logSuccess, setLogSuccess]   = useState(false)
  const [logNote, setLogNote]         = useState('')
  const [showLogForm, setShowLogForm] = useState(false)
  const [loggingBusy, setLoggingBusy] = useState(false)

  const itemPool = useMemo(() => {
    const normalizedLiked = liked.map(normalizeLiked)
    if (source === 'closet') return closetItems
    if (source === 'liked')  return normalizedLiked
    const ids = new Set(closetItems.map((i) => i.id))
    return [...closetItems, ...normalizedLiked.filter((i) => !ids.has(i.id))]
  }, [source, closetItems, liked])

  // Refs so runGenerate always reads latest values even from stale closures
  const poolRef    = useRef(itemPool)
  const weatherRef = useRef(null)
  const genderRef  = useRef(state.gender)
  useEffect(() => { poolRef.current   = itemPool     }, [itemPool])
  useEffect(() => { weatherRef.current = weather     }, [weather])
  useEffect(() => { genderRef.current  = state.gender }, [state.gender])

  useEffect(() => {
    getWeather().then((w) => { setWeather(w); weatherRef.current = w }).catch(() => {})
  }, [])

  // Auto-generate once when the pool first reaches 3+ items
  const didAutoGen = useRef(false)
  useEffect(() => {
    if (didAutoGen.current || itemPool.length < 3) return
    didAutoGen.current = true
    runGenerate(occasion, false)
  }, [itemPool.length]) // eslint-disable-line react-hooks/exhaustive-deps

  async function runGenerate(occ, force) {
    const pool = poolRef.current
    if (pool.length < 3) return
    setGenerating(true)
    setGenError(null)

    if (force) {
      const prefix = `stylelab_outfit_${todayStr()}_${occ}_`
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith(prefix))
        .forEach((k) => sessionStorage.removeItem(k))
    }

    try {
      const result = await generateOutfit({
        closetItems: pool,
        weather:    weatherRef.current,
        occasion:   occ,
        dateStr:    todayStr(),
        gender:     genderRef.current,
        occupation: null,
      })
      if (result) {
        setOutfit(result)
      } else {
        setGenError('Couldn\'t build an outfit — try a different source or occasion.')
      }
    } catch {
      setGenError('Generation failed. Check your connection and try again.')
    } finally {
      setGenerating(false)
    }
  }

  function handleOccasionChange(occ) {
    setOccasion(occ)
    setOutfit(null)
    setGenError(null)
    setLogSuccess(false)
    setShowLogForm(false)
    runGenerate(occ, false)
  }

  function handleSourceChange(src) {
    setSource(src)
    setOutfit(null)
    setGenError(null)
    setLogSuccess(false)
    setShowLogForm(false)
    didAutoGen.current = false // allow auto-gen to fire again for new source
  }

  async function handleLog() {
    if (!outfit || !user) return
    setLoggingBusy(true)
    try {
      const logRef  = doc(db, 'users', user.uid, 'prefs', 'outfitLog')
      const snap    = await getDoc(logRef)
      const entries = snap.exists() ? (snap.data().entries ?? []) : []
      const entry   = {
        id:       `log_${Date.now()}`,
        date:     todayStr(),
        itemIds:  outfit.items.map((i) => i.id),
        source,
        occasion,
        notes:    logNote.trim(),
        weather:  weather ?? null,
        loggedAt: new Date().toISOString(),
      }
      await setDoc(logRef, { entries: [entry, ...entries].slice(0, 50) }, { merge: true })
      setLogSuccess(true)
      setShowLogForm(false)
    } catch {
      // non-fatal
    } finally {
      setLoggingBusy(false)
    }
  }

  // Not signed in
  if (!user) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyEmoji}>🌟</p>
        <p className={styles.emptyTitle}>Sign in to get your daily look</p>
        <p className={styles.emptySub}>Your AI stylist needs to know your closet.</p>
      </div>
    )
  }

  // Not enough items in the selected source
  if (itemPool.length < 3) {
    const hint = source === 'closet'
      ? 'Add 3+ items to your Closet tab to unlock daily outfits.'
      : source === 'liked'
      ? 'Like 3+ items in the Discover tab to unlock daily outfits.'
      : 'Add or like at least 3 items total to unlock daily outfits.'
    return (
      <div className={styles.emptyState}>
        <div className={styles.sourceRow}>
          {SOURCES.map((s) => (
            <button
              key={s.id}
              className={`${styles.sourcePill} ${source === s.id ? styles.sourceActive : ''}`}
              onClick={() => handleSourceChange(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className={styles.emptyEmoji}>🪣</p>
        <p className={styles.emptyTitle}>Not enough items</p>
        <p className={styles.emptySub}>{hint}</p>
      </div>
    )
  }

  return (
    <div className={styles.todayWrap}>
      {/* Weather */}
      <div className={styles.weatherRow}>
        <WeatherWidget />
      </div>

      {/* Source selector */}
      <div className={styles.sourceRow}>
        {SOURCES.map((s) => (
          <button
            key={s.id}
            className={`${styles.sourcePill} ${source === s.id ? styles.sourceActive : ''}`}
            onClick={() => handleSourceChange(s.id)}
          >
            {s.label}
            <span className={styles.sourceCount}>
              {s.id === 'closet' ? closetItems.length
               : s.id === 'liked' ? liked.length
               : closetItems.length + liked.length}
            </span>
          </button>
        ))}
      </div>

      {/* Occasion picker */}
      <div className={styles.occasionRow}>
        {OCCASIONS.map((occ) => (
          <button
            key={occ.id}
            className={`${styles.occasionPill} ${occasion === occ.id ? styles.occasionActive : ''}`}
            onClick={() => handleOccasionChange(occ.id)}
          >
            {occ.emoji} {occ.label}
          </button>
        ))}
      </div>

      {/* Outfit display */}
      {generating ? (
        <div className={styles.generating}>
          <div className={styles.loadingDots}><span /><span /><span /></div>
          <p className={styles.generatingText}>Styling your outfit…</p>
        </div>
      ) : outfit ? (
        <>
          <div className={styles.outfitGrid}>
            {outfit.items.map((item) => (
              <OutfitCard key={item.id} item={item} />
            ))}
          </div>

          {outfit.reasoning && (
            <div className={styles.reasoningBox}>
              <p className={styles.reasoningText}>{outfit.reasoning}</p>
              {outfit.weatherNote && (
                <p className={styles.weatherNote}>
                  {weather ? getWeatherEmoji(weather.condition) : '🌤️'} {outfit.weatherNote}
                </p>
              )}
            </div>
          )}

          <div className={styles.outfitActions}>
            <button
              className={styles.regenBtn}
              onClick={() => runGenerate(occasion, true)}
              disabled={generating}
            >
              ↺ Regenerate
            </button>
            {!logSuccess ? (
              <button
                className={styles.logBtn}
                onClick={() => setShowLogForm(true)}
              >
                📔 Log this outfit
              </button>
            ) : (
              <div className={styles.logSuccess}>Outfit logged ✓</div>
            )}
          </div>

          {showLogForm && (
            <div className={styles.logForm}>
              <textarea
                className={styles.logNote}
                placeholder="Add a note (optional) — how did it feel?"
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                rows={2}
              />
              <div className={styles.logFormBtns}>
                <button className={styles.logCancelBtn} onClick={() => setShowLogForm(false)}>
                  Cancel
                </button>
                <button className={styles.logSaveBtn} onClick={handleLog} disabled={loggingBusy}>
                  {loggingBusy ? 'Saving…' : 'Save Entry'}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyState}>
          <p className={styles.emptyEmoji}>👗</p>
          <p className={styles.emptyTitle}>
            {genError ? 'Generation failed' : 'No outfit generated yet'}
          </p>
          {genError && <p className={styles.emptySub}>{genError}</p>}
          <button className={styles.generateBtn} onClick={() => runGenerate(occasion, false)}>
            Generate Outfit
          </button>
        </div>
      )}
    </div>
  )
}

// ── Outfit Board Card ────────────────────────────────────────────────────────

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
              style={{ background: item.gradient ?? 'rgba(255,255,255,0.08)' }}
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

// ── Outfit Creator Sheet ──────────────────────────────────────────────────────

function OutfitCreatorSheet({ closetItems, liked, initial, onSave, onClose }) {
  const [name, setName]             = useState(initial?.name ?? '')
  const [source, setSource]         = useState('closet')
  const [selectedIds, setSelectedIds] = useState(new Set(initial?.items?.map((i) => i.id) ?? []))

  const items = source === 'closet' ? closetItems : liked

  function toggle(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSave() {
    const pool = {}
    ;[...closetItems, ...liked].forEach((i) => { pool[i.id] = i })
    const selectedItems = [...selectedIds].map((id) => pool[id]).filter(Boolean)
    onSave({
      id:        initial?.id ?? `board-${Date.now()}`,
      name:      name.trim() || 'My Outfit',
      aesthetic: '',
      items:     selectedItems,
      createdAt: initial?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    })
  }

  const canSave = name.trim().length > 0 && selectedIds.size > 0

  return (
    <div className={styles.creatorSheet}>
      <div className={styles.creatorHeader}>
        <h2 className={styles.creatorTitle}>{initial ? 'Edit Outfit' : 'Create Outfit'}</h2>
        <button className={styles.creatorClose} onClick={onClose}>✕</button>
      </div>

      <div className={styles.creatorBody}>
        <input
          className={styles.creatorNameInput}
          placeholder="Outfit name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className={styles.creatorSourcePills}>
          <button
            className={`${styles.creatorSourceBtn} ${source === 'closet' ? styles.creatorSourceActive : ''}`}
            onClick={() => setSource('closet')}
          >
            My Closet ({closetItems.length})
          </button>
          <button
            className={`${styles.creatorSourceBtn} ${source === 'liked' ? styles.creatorSourceActive : ''}`}
            onClick={() => setSource('liked')}
          >
            Liked ({liked.length})
          </button>
        </div>

        {items.length === 0 ? (
          <div className={styles.creatorEmptyItems}>
            <p>No items in {source === 'closet' ? 'your closet' : 'liked'} yet.</p>
          </div>
        ) : (
          <div className={styles.creatorGrid}>
            {items.map((item) => {
              const url      = item.prettifiedUrl ?? item.imageUrl ?? item.thumbnailUrl
              const selected = selectedIds.has(item.id)
              return (
                <button
                  key={item.id}
                  className={`${styles.creatorItem} ${selected ? styles.creatorItemSelected : ''}`}
                  onClick={() => toggle(item.id)}
                >
                  <div
                    className={styles.creatorItemPhoto}
                    style={{ background: item.gradient ?? 'rgba(255,255,255,0.06)' }}
                  >
                    {url
                      ? <img src={url} alt={item.name} className={styles.creatorItemImg} />
                      : <span className={styles.creatorItemEmoji}>{CATEGORY_EMOJIS[item.category] ?? '👕'}</span>
                    }
                    {selected && <div className={styles.creatorCheckmark}>✓</div>}
                  </div>
                  <p className={styles.creatorItemName}>{item.name}</p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className={styles.creatorFooter}>
        {selectedIds.size > 0 && (
          <p className={styles.creatorCount}>
            {selectedIds.size} piece{selectedIds.size !== 1 ? 's' : ''} selected
          </p>
        )}
        <button className={styles.creatorSave} onClick={handleSave} disabled={!canSave}>
          {initial ? 'Save Changes' : 'Save Outfit'}
        </button>
      </div>
    </div>
  )
}

// ── My Outfits Tab ────────────────────────────────────────────────────────────

function MyOutfitsTab() {
  const { user }        = useAuth()
  const { closetItems } = useCloset()
  const { liked, outfitBoards, saveOutfitBoard, deleteOutfitBoard } = useWishlist()
  const [logEntries, setLogEntries]   = useState(null)
  const [showCreator, setShowCreator] = useState(false)
  const [editingBoard, setEditingBoard] = useState(null)

  useEffect(() => {
    if (!user) return
    getDoc(doc(db, 'users', user.uid, 'prefs', 'outfitLog'))
      .then((snap) => setLogEntries(snap.exists() ? (snap.data().entries ?? []) : []))
      .catch(() => setLogEntries([]))
  }, [user])

  if (!user) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyEmoji}>👗</p>
        <p className={styles.emptyTitle}>Sign in to manage your outfits</p>
      </div>
    )
  }

  const hasBoards = outfitBoards.length > 0
  const hasLog    = logEntries && logEntries.length > 0
  const itemMap   = Object.fromEntries(closetItems.map((i) => [i.id, i]))

  return (
    <div className={styles.myOutfitsTab}>

      {/* Saved outfits */}
      {hasBoards && (
        <section className={styles.outfitsSection}>
          <h3 className={styles.outfitsSectionTitle}>Saved Outfits</h3>
          <div className={styles.boardsList}>
            {outfitBoards.map((board) => (
              <OutfitBoardCard
                key={board.id}
                board={board}
                onEdit={() => { setEditingBoard(board); setShowCreator(true) }}
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
                        {getWeatherEmoji(entry.weather.condition)} {entry.weather.temp}°C
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
          <p className={styles.emptyEmoji}>👗</p>
          <p className={styles.emptyTitle}>No outfits yet</p>
          <p className={styles.emptySub}>Tap + to create your first outfit from your closet or liked items.</p>
        </div>
      )}

      {/* Loading state */}
      {!hasBoards && logEntries === null && (
        <div className={styles.emptyState}>
          <div className={styles.loadingDots}><span /><span /><span /></div>
        </div>
      )}

      {/* FAB */}
      <button
        className={styles.createFab}
        onClick={() => { setEditingBoard(null); setShowCreator(true) }}
        aria-label="Create outfit"
      >
        +
      </button>

      {/* Creator sheet */}
      {showCreator && (
        <OutfitCreatorSheet
          closetItems={closetItems}
          liked={liked}
          initial={editingBoard}
          onSave={(board) => { saveOutfitBoard(board); setShowCreator(false); setEditingBoard(null) }}
          onClose={() => { setShowCreator(false); setEditingBoard(null) }}
        />
      )}
    </div>
  )
}

const TABS = [
  { id: 'closet',   label: 'My Closet'       },
  { id: 'liked',    label: 'Liked'           },
  { id: 'today',    label: "Today's Outfit"  },
  { id: 'outfits',  label: 'My Outfits'      },
  { id: 'calendar', label: 'Calendar'        },
  { id: 'trip',     label: 'Trip'            },
]

export default function DailyLookScreen() {
  const [activeTab, setActiveTab] = useState('today')

  return (
    <div className={styles.screen}>
      <div className={styles.subTabBar}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${styles.subTab} ${activeTab === t.id ? styles.subTabActive : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'closet'   && <ClosetScreen singleTab="closet" />}
      {activeTab === 'liked'    && <ClosetScreen singleTab="liked"  />}
      {activeTab === 'today'    && <TodayTab />}
      {activeTab === 'outfits'  && <MyOutfitsTab />}
      {activeTab === 'calendar' && <OutfitCalendarScreen />}
      {activeTab === 'trip'     && <TripPlannerScreen />}
    </div>
  )
}
