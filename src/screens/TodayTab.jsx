import { useEffect, useMemo, useRef, useState } from 'react'
import { useSubscription } from '../context/SubscriptionContext'
import LockedOverlay from '../components/LockedOverlay'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { useCloset } from '../context/ClosetContext'
import { useWishlist } from '../context/WishlistContext'
import { generateOutfit } from '../services/outfitAI'
import { recordWear } from '../services/wearTracking'
import { recordGapSignal } from '../services/gapSignals'
import { trackEvent } from '../services/firebase'
import { fetchPhotosWithFallback } from '../services/stockPhotos'
import { getWeather, getWeatherEmoji } from '../services/weather'
import WeatherWidget from '../components/WeatherWidget'
import styles from './DailyLookScreen.module.css'
import Icon from '../components/Icon'

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

const MAX_LOG_ENTRIES = 200

const SOURCES = [
  { id: 'closet', label: 'Closet' },
  { id: 'liked',  label: 'Liked'  },
  { id: 'both',   label: 'Both'   },
]

const OCCASIONS = [
  { id: 'casual',  label: 'Casual',     emoji: '☀️',  desc: 'Everyday comfort',    pro: false },
  { id: 'work',    label: 'Work',       emoji: '💼',  desc: 'Office or meetings',  pro: false },
  { id: 'date',    label: 'Date Night', emoji: '✨',  desc: 'Evening out',         pro: false },
  { id: 'gym',     label: 'Gym',        emoji: '💪',  desc: 'Workout ready',       pro: false },
  { id: 'errand',  label: 'Errands',    emoji: '🛒',  desc: 'Quick & practical',   pro: false },
  { id: 'school',  label: 'School',     emoji: '🎒',  desc: 'Campus ready',         pro: false },
  { id: 'formal',  label: 'Formal',     emoji: '🎩',  desc: 'Events & galas',      pro: true  },
  { id: 'brunch',  label: 'Brunch',     emoji: '🥂',  desc: 'Weekend social',      pro: true  },
  { id: 'party',   label: 'Party',      emoji: '🎉',  desc: 'Night out',           pro: true  },
  { id: 'beach',   label: 'Beach Day',  emoji: '🏖️', desc: 'Sun & sand vibes',    pro: true  },
  { id: 'travel',  label: 'Travel',     emoji: '✈️',  desc: 'On the move',         pro: true  },
  { id: 'outdoor', label: 'Outdoor',    emoji: '🌿',  desc: 'Nature & adventure',  pro: true  },
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

export default function TodayTab() {
  const { user }              = useAuth()
  const { state }             = useApp()
  const { closetItems, updateClosetItem } = useCloset()
  const { liked }             = useWishlist()
  const { isAtLimit, openPaywall, isPro } = useSubscription()

  const [source, setSource]                 = useState('closet')
  const [occasion, setOccasion]             = useState(null)
  const [occasionPicked, setOccasionPicked] = useState(false)
  const [outfit, setOutfit]                 = useState(null)
  const [generating, setGenerating]         = useState(false)
  const [genError, setGenError]             = useState(null)
  const [weather, setWeather]               = useState(null)
  const [logSuccess, setLogSuccess]         = useState(false)
  const [logNote, setLogNote]               = useState('')
  const [showLogForm, setShowLogForm]       = useState(false)
  const [loggingBusy, setLoggingBusy]       = useState(false)
  const [sharing, setSharing]               = useState(false)

  const itemPool = useMemo(() => {
    const normalizedLiked = liked.map(normalizeLiked)
    if (source === 'closet') return closetItems
    if (source === 'liked')  return normalizedLiked
    const ids = new Set(closetItems.map((i) => i.id))
    return [...closetItems, ...normalizedLiked.filter((i) => !ids.has(i.id))]
  }, [source, closetItems, liked])

  const poolRef    = useRef(itemPool)
  const weatherRef = useRef(null)
  const genderRef  = useRef(state.gender)
  useEffect(() => { poolRef.current    = itemPool     }, [itemPool])
  useEffect(() => { weatherRef.current = weather      }, [weather])
  useEffect(() => { genderRef.current  = state.gender }, [state.gender])

  useEffect(() => {
    getWeather().then((w) => { setWeather(w); weatherRef.current = w }).catch(() => {})
  }, [])

  async function runGenerate(occ, force) {
    if (isAtLimit('outfitGenerations')) { openPaywall('outfitGenerations'); return }
    const pool = poolRef.current
    if (pool.length < 3) return
    setGenerating(true)
    setGenError(null)

    if (force) {
      const prefix = `sartima_outfit_${todayStr()}_${occ}_`
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith(prefix))
        .forEach((k) => sessionStorage.removeItem(k))
    }

    try {
      const result = await generateOutfit({
        closetItems: pool,
        weather:     weatherRef.current,
        occasion:    occ,
        dateStr:     todayStr(),
        gender:      genderRef.current,
        occupation:  null,
      })
      if (result) {
        setOutfit(result)
        if (result.missingCategory && user) recordGapSignal(user.uid, result.missingCategory)
      } else {
        setGenError('Couldn\'t build an outfit — try a different source or occasion.')
      }
    } catch {
      setGenError('Generation failed. Check your connection and try again.')
    } finally {
      setGenerating(false)
    }
  }

  function handleOccasionPick(occ) {
    const found = OCCASIONS.find((o) => o.id === occ)
    if (found?.pro && !isPro) { openPaywall('outfitGenerations'); return }
    setOccasion(occ)
  }

  function handleGenerate() {
    if (!occasion) return
    setOccasionPicked(true)
    runGenerate(occasion, false)
  }

  function handleOccasionSwitch(occ) {
    const found = OCCASIONS.find((o) => o.id === occ)
    if (found?.pro && !isPro) { openPaywall('outfitGenerations'); return }
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
      await setDoc(logRef, { entries: [entry, ...entries].slice(0, MAX_LOG_ENTRIES) }, { merge: true })
      recordWear(closetItems, entry.itemIds, updateClosetItem, entry.date)
      trackEvent('outfit_logged', { occasion, source, itemCount: entry.itemIds.length })
      setLogSuccess(true)
      setShowLogForm(false)
    } catch {
      // non-fatal
    } finally {
      setLoggingBusy(false)
    }
  }

  async function handleShare() {
    if (!outfit || sharing) return
    setSharing(true)
    try {
      const { generateOutfitShareCard, shareCardBlob } = await import('../services/shareCard')
      const blob = await generateOutfitShareCard({
        items:       outfit.items,
        reasoning:   outfit.reasoning,
        occasionTag: outfit.occasionTag ?? occasion,
      })
      await shareCardBlob(blob, {
        title:    "My outfit from Sartima",
        text:     `Today's look, styled by Sartima ✦`,
        fileName: `sartima-outfit-${todayStr()}.png`,
      })
    } catch {
      // non-fatal — sharing is best-effort
    } finally {
      setSharing(false)
    }
  }

  // Not signed in
  if (!user) {
    const ghostItems = [
      { id: 'g1', emoji: '👕', name: 'White Oxford', category: 'tops',    bg: 'linear-gradient(135deg,#2d3a4a,#1a2634)' },
      { id: 'g2', emoji: '👖', name: 'Slim Chinos',  category: 'bottoms', bg: 'linear-gradient(135deg,#1a2a1a,#2a3a2a)' },
      { id: 'g3', emoji: '👟', name: 'Leather Sneakers', category: 'footwear', bg: 'linear-gradient(135deg,#1a1a2a,#2a2a3a)' },
    ]
    return (
      <div className={styles.todayWrap}>
        <LockedOverlay message="Sign in to get AI-powered daily outfit suggestions">
          <div className={styles.outfitGrid}>
            {ghostItems.map((item) => (
              <div key={item.id} className={styles.outfitItem}>
                <div className={styles.outfitPhoto} style={{ background: item.bg }}>
                  <span className={styles.outfitEmoji}>{item.emoji}</span>
                </div>
                <p className={styles.outfitItemName}>{item.name}</p>
                <p className={styles.outfitItemCat}>{item.category}</p>
              </div>
            ))}
          </div>
          <div className={styles.reasoningBox} style={{ marginTop: 'var(--space-3)' }}>
            <p className={styles.reasoningText}>A clean, versatile outfit perfect for a casual day out. The white oxford pairs seamlessly with slim chinos for a put-together look.</p>
          </div>
        </LockedOverlay>
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
        <p className={styles.emptyEmoji}><Icon name="hanger" size={24} /></p>
        <p className={styles.emptyTitle}>Not enough items</p>
        <p className={styles.emptySub}>{hint}</p>
      </div>
    )
  }

  const sourceSelector = (
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
  )

  // Pre-generation: occasion picker
  if (!occasionPicked) {
    return (
      <div className={styles.todayWrap}>
        <div className={styles.weatherRow}><WeatherWidget /></div>
        {sourceSelector}
        <div className={styles.occasionPickerWrap}>
          <p className={styles.occasionPickerTitle}>What's the occasion?</p>
          <div className={styles.occasionGrid}>
            {OCCASIONS.map((occ) => {
              const isLocked = occ.pro && !isPro
              return (
                <button
                  key={occ.id}
                  className={[
                    styles.occasionCard,
                    occasion === occ.id ? styles.occasionCardActive : '',
                    isLocked ? styles.occasionCardLocked : '',
                  ].join(' ')}
                  onClick={() => handleOccasionPick(occ.id)}
                >
                  {isLocked && <span className={styles.proLockBadge}>Pro</span>}
                  <span className={styles.occasionCardLabel}>{occ.label}</span>
                  <span className={styles.occasionCardDesc}>{occ.desc}</span>
                </button>
              )
            })}
          </div>
          <button
            className={styles.occasionGenerateBtn}
            onClick={handleGenerate}
            disabled={!occasion}
          >
            {occasion
              ? `Generate ${OCCASIONS.find((o) => o.id === occasion)?.label} Outfit`
              : 'Select an Occasion'}
          </button>
        </div>
      </div>
    )
  }

  // Post-generation: outfit view with compact occasion pills for switching
  return (
    <div className={styles.todayWrap}>
      <div className={styles.weatherRow}><WeatherWidget /></div>
      {sourceSelector}

      <div className={styles.occasionRow}>
        {OCCASIONS.map((occ) => {
          const isLocked = occ.pro && !isPro
          return (
            <button
              key={occ.id}
              className={[
                styles.occasionPill,
                occasion === occ.id ? styles.occasionActive : '',
                isLocked ? styles.occasionPillLocked : '',
              ].join(' ')}
              onClick={() => handleOccasionSwitch(occ.id)}
            >
              {occ.label}
            </button>
          )
        })}
      </div>

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

          {outfit.missingCategory && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 'var(--space-2) 0 0', lineHeight: 'var(--leading-normal)' }}>
              You're light on {outfit.missingCategory} — that's the closest outfit I could build from your closet.
            </p>
          )}

          <div className={styles.outfitActions}>
            <button
              className={styles.regenBtn}
              onClick={() => runGenerate(occasion, true)}
              disabled={generating}
            >
              ↺ Regenerate
            </button>
            <button
              className={styles.regenBtn}
              onClick={handleShare}
              disabled={sharing}
            >
              {sharing ? '…' : '↗ Share'}
            </button>
            {!logSuccess ? (
              <button
                className={styles.logBtn}
                onClick={() => setShowLogForm(true)}
              >
                Log this outfit
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
          <p className={styles.emptyEmoji}><Icon name="hanger" size={24} /></p>
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
