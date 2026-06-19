import { useEffect, useMemo, useRef, useState } from 'react'
import { STYLES, getStyleName } from '../data/styles'
import { CLOTHING_ITEMS } from '../data/categories'
import { AESTHETIC_QUIZ_ITEMS } from '../data/aestheticItems'
import { fetchPhotosWithFallback } from '../services/pexels'
import { useApp, SCREENS } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useExplore } from '../context/ExploreContext'
import { useNavigation } from '../context/NavigationContext'
import { useWishlist } from '../context/WishlistContext'
import { useCloset } from '../context/ClosetContext'
import { generateOutfit } from '../services/outfitAI'
import { getWeather, getWeatherEmoji } from '../services/weather'
import AuthWidget from '../components/AuthWidget'
import styles from './HomeScreen.module.css'

// ── Static data ───────────────────────────────────────────────────────────────

const HERO_SLIDE_IDS = ['oldmoney', 'darkacademia', 'streetwear', 'gorpcore', 'minimalist']

const SEASON_PICKS = {
  winter: ['oldmoney', 'darkacademia', 'preppy', 'military', 'knitwearaesthetic', 'gorpcore'],
  spring: ['lightacademia', 'cottagecore', 'indie', 'minimalist', 'softboy', 'preppy'],
  summer: ['athleisure', 'streetwear', 'hiphop', 'techwear', 'normcore', 'vintage'],
  fall:   ['darkacademia', 'gorpcore', 'workwear', 'grunge', 'vintage', 'military'],
}

const TRENDING = ['preppy', 'y2k', 'techwear', 'indie', 'hiphop', 'skater', 'grunge', 'athleisure', 'edgy', 'scandi']

const SEASON_META = {
  winter: { icon: '❄️', label: 'Winter Picks',  sub: 'Layers, texture, warmth' },
  spring: { icon: '🌸', label: 'Spring Picks',  sub: 'Light layers, fresh palettes' },
  summer: { icon: '☀️', label: 'Summer Picks',  sub: 'Breathable, bold, bright' },
  fall:   { icon: '🍂', label: 'Fall Picks',    sub: 'Earth tones, rich textures' },
}

// Full clothing item pool for Fresh Looks — built once at module load
const ALL_FRESH_ITEMS = (() => {
  const all = []
  for (const [catId, items] of Object.entries(CLOTHING_ITEMS)) {
    for (const item of items) all.push({ ...item, categoryId: catId })
  }
  for (const item of AESTHETIC_QUIZ_ITEMS) {
    all.push({ ...item, categoryId: item._category })
  }
  const seen = new Set()
  return all.filter((item) => {
    const key = item.name.toLowerCase().trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
})()

function getSeason() {
  const m = new Date().getMonth()
  if (m <= 1 || m === 11) return 'winter'
  if (m <= 4) return 'spring'
  if (m <= 7) return 'summer'
  return 'fall'
}

// Deterministic daily shuffle — same 10 items all day, changes at midnight
function getDailyItems(pool, count = 10) {
  const dateStr = new Date().toDateString()
  let h = 0
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0
  const arr = [...pool]
  let r = h
  for (let i = arr.length - 1; i > 0; i--) {
    r = (r * 1664525 + 1013904223) >>> 0
    const j = r % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, count)
}

// ── Hero carousel ─────────────────────────────────────────────────────────────

function HeroCarousel({ navigate, gender }) {
  const [photos, setPhotos]       = useState(new Array(HERO_SLIDE_IDS.length).fill(null))
  const [activeIdx, setActiveIdx] = useState(0)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [arrowsVisible, setArrowsVisible] = useState(true)
  const timerRef      = useRef(null)
  const arrowTimerRef = useRef(null)
  const touchStartX   = useRef(null)

  function resetArrowTimer() {
    setArrowsVisible(true)
    clearTimeout(arrowTimerRef.current)
    arrowTimerRef.current = setTimeout(() => setArrowsVisible(false), 3000)
  }

  useEffect(() => {
    setPhotos(new Array(HERO_SLIDE_IDS.length).fill(null))
    const hint = gender === 'women' ? 'women' : gender === 'men' ? 'men' : ''
    HERO_SLIDE_IDS.forEach((id, i) => {
      const s = STYLES[id]
      if (!s) return
      const name = getStyleName(s, gender)
      fetchPhotosWithFallback([
        ...(s.outfitQuery ? [s.outfitQuery] : []),
        `${name} ${hint} fashion aesthetic`.trim(),
        `${name} ${hint} outfit`.trim(),
        `${name} fashion`,
      ], 1).then(([url] = []) => {
        setPhotos((prev) => { const next = [...prev]; next[i] = url ?? null; return next })
        if (i === 0) setImgLoaded(false)
      })
    })
  }, [gender])

  function startTimer() {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setActiveIdx((i) => (i + 1) % HERO_SLIDE_IDS.length)
      setImgLoaded(false)
    }, 5000)
  }

  useEffect(() => {
    startTimer()
    resetArrowTimer()
    return () => {
      clearInterval(timerRef.current)
      clearTimeout(arrowTimerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function goTo(i) {
    setActiveIdx(i)
    setImgLoaded(false)
    startTimer()
    resetArrowTimer()
  }

  function onHeroTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    resetArrowTimer()
  }

  function onHeroTouchEnd(e) {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(delta) > 50) {
      const newIdx = delta < 0
        ? (activeIdx + 1) % HERO_SLIDE_IDS.length
        : (activeIdx - 1 + HERO_SLIDE_IDS.length) % HERO_SLIDE_IDS.length
      goTo(newIdx)
    }
  }

  const slideId = HERO_SLIDE_IDS[activeIdx]
  const style   = STYLES[slideId]
  const photo   = photos[activeIdx]

  return (
    <div className={styles.hero} onTouchStart={onHeroTouchStart} onTouchEnd={onHeroTouchEnd}>
      <div className={styles.heroBg} style={{ background: style?.gradient ?? '#1a1a1a' }}>
        {photo && (
          <img
            key={photo}
            src={photo}
            alt={style?.name}
            className={styles.heroImg}
            style={{ opacity: imgLoaded ? 1 : 0 }}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgLoaded(true)}
          />
        )}
      </div>
      <div className={styles.heroOverlay} />

      <div className={styles.heroTopBar}>
        <span className={styles.heroWordmark}>Sartima</span>
        <AuthWidget />
      </div>

      <div className={styles.heroContent}>
        <p className={styles.heroEyebrow}>Featured Aesthetic</p>
        <h2 className={styles.heroName}>{getStyleName(style, gender)}</h2>
        <p className={styles.heroTagline}>{style?.tagline}</p>
        <button
          className={styles.heroBtn}
          onClick={() => navigate(`aesthetic:${slideId}`)}
        >
          Explore look →
        </button>
      </div>

      <div className={styles.heroDots}>
        {HERO_SLIDE_IDS.map((_, i) => (
          <button
            key={i}
            className={`${styles.heroDot} ${i === activeIdx ? styles.heroDotActive : ''}`}
            onClick={() => goTo(i)}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>

      <button
        className={`${styles.heroArrow} ${styles.heroArrowLeft} ${arrowsVisible ? '' : styles.heroArrowHidden}`}
        onClick={() => goTo((activeIdx - 1 + HERO_SLIDE_IDS.length) % HERO_SLIDE_IDS.length)}
        aria-label="Previous slide"
      >
        ‹
      </button>
      <button
        className={`${styles.heroArrow} ${styles.heroArrowRight} ${arrowsVisible ? '' : styles.heroArrowHidden}`}
        onClick={() => goTo((activeIdx + 1) % HERO_SLIDE_IDS.length)}
        aria-label="Next slide"
      >
        ›
      </button>
    </div>
  )
}

// ── Fresh Looks Today ─────────────────────────────────────────────────────────

function FreshLookCard({ item, gender }) {
  const { liked, addToLiked } = useWishlist()
  const [photo, setPhoto]     = useState(null)
  const [loaded, setLoaded]   = useState(false)
  const cardRef = useRef(null)
  const fetched = useRef(false)

  const isLiked = liked.some((i) => i.id === item.id)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fetched.current) {
        fetched.current = true
        const hint = gender === 'women' ? 'women' : gender === 'men' ? 'men' : ''
        fetchPhotosWithFallback([
          `${item.name} ${hint} fashion outfit`.trim(),
          `${item.name} ${hint} outfit`.trim(),
          `${item.name} fashion`,
        ], 1).then(([url] = []) => setPhoto(url ?? null))
        obs.disconnect()
      }
    }, { rootMargin: '80px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [item.id, gender])

  function handleLike(e) {
    e.stopPropagation()
    if (isLiked) return
    addToLiked({
      id: item.id, type: 'item',
      name: item.name, emoji: item.emoji, gradient: item.gradient,
      categoryId: item.categoryId, seasons: item.seasons || [],
      description: item.description, styleWeights: item.styleWeights ?? {},
    })
  }

  return (
    <div ref={cardRef} className={styles.freshCard}>
      <div className={styles.freshCardBg} style={{ background: item.gradient }}>
        {photo && (
          <img
            src={photo}
            alt={item.name}
            className={styles.freshCardImg}
            style={{ opacity: loaded ? 1 : 0 }}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        )}
        <div className={styles.freshCardOverlay} />
      </div>
      <button
        className={`${styles.freshLikeBtn} ${isLiked ? styles.freshLikeBtnActive : ''}`}
        onClick={handleLike}
        aria-label={isLiked ? 'Liked' : 'Like'}
      >
        <svg width="13" height="13" viewBox="0 0 24 24"
          fill={isLiked ? 'currentColor' : 'none'}
          stroke="currentColor" strokeWidth="2.2">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
      </button>
      <div className={styles.freshCardFooter}>
        <span className={styles.freshCardName}>{item.name}</span>
      </div>
    </div>
  )
}

function FreshLooksSection({ gender, navigate }) {
  const items = useMemo(() => getDailyItems(ALL_FRESH_ITEMS, 10), [])

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon}>✨</span>
        <div>
          <h2 className={styles.sectionTitle}>Fresh Looks Today</h2>
          <p className={styles.sectionSub}>Refreshes daily · tap ♥ to like</p>
        </div>
      </div>
      <div className={`${styles.hScroll} ${styles.hScrollFade}`}>
        {items.map((item) => (
          <FreshLookCard key={item.id} item={item} gender={gender} />
        ))}
      </div>
      <button className={styles.freshDiscoverBtn} onClick={() => navigate('quiz')}>
        Swipe more looks →
      </button>
    </section>
  )
}

// ── Live Aesthetic Profile ────────────────────────────────────────────────────

function AestheticProfile({ navigate, gender }) {
  const { state, dispatch } = useApp()

  const topStyles = useMemo(() => {
    const total = Object.values(state.styleScores).reduce((a, b) => a + b, 0)
    if (total === 0) return []
    return Object.entries(state.styleScores)
      .filter(([, s]) => s > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id, score]) => ({ id, score, pct: Math.round((score / total) * 100) }))
  }, [state.styleScores])

  const swipedCount = Object.keys(state.responses).length

  if (topStyles.length === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon}>✦</span>
          <div>
            <h2 className={styles.sectionTitle}>Your Aesthetic Profile</h2>
            <p className={styles.sectionSub}>Rate looks to reveal your style breakdown</p>
          </div>
        </div>
        <div className={styles.aestheticBarsEmpty}>
          <div className={styles.aestheticBarGhost} />
          <div className={styles.aestheticBarGhost} style={{ width: '70%' }} />
          <div className={styles.aestheticBarGhost} style={{ width: '45%' }} />
        </div>
        <button className={styles.quizCTABtn} onClick={() => { dispatch({ type: 'GO_TO_QUIZ' }); navigate('quiz') }}>
          Take the style quiz to unlock your profile →
        </button>
      </section>
    )
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon}>✦</span>
        <div>
          <h2 className={styles.sectionTitle}>Your Aesthetic Profile</h2>
          <p className={styles.sectionSub}>{swipedCount} looks rated · updates live as you swipe</p>
        </div>
      </div>
      <div className={styles.aestheticBars}>
        {topStyles.map(({ id, pct }) => {
          const s = STYLES[id]
          if (!s) return null
          return (
            <button
              key={id}
              className={styles.aestheticBar}
              onClick={() => navigate(`aesthetic:${id}`)}
            >
              <div className={styles.aestheticBarLabel}>
                <span className={styles.aestheticBarName}>{getStyleName(s, gender)}</span>
                <span className={styles.aestheticBarPct}>{pct}%</span>
              </div>
              <div className={styles.aestheticBarTrack}>
                <div
                  className={styles.aestheticBarFill}
                  style={{ width: `${pct}%`, background: s.gradient ?? 'linear-gradient(135deg, var(--accent), var(--accent-secondary))' }}
                />
              </div>
            </button>
          )
        })}
      </div>
      <button
        className={styles.viewResultsBtn}
        onClick={() => navigate('profile:quiz-history')}
      >
        Full breakdown →
      </button>
    </section>
  )
}

// ── Aesthetic mini-card (horizontal scroll) ───────────────────────────────────

function AestheticMiniCard({ aestheticId, navigate, gender }) {
  const [photo, setPhoto]   = useState(null)
  const [loaded, setLoaded] = useState(false)
  const cardRef  = useRef(null)
  const fetched  = useRef(false)
  const style    = STYLES[aestheticId]

  useEffect(() => {
    fetched.current = false
    setPhoto(null)
    setLoaded(false)
  }, [gender])

  useEffect(() => {
    const el = cardRef.current
    if (!el || !style) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fetched.current) {
        fetched.current = true
        const name = getStyleName(style, gender)
        const hint = gender === 'women' ? 'women' : gender === 'men' ? 'men' : ''
        fetchPhotosWithFallback([
          ...(style.outfitQuery ? [style.outfitQuery] : []),
          `${name} ${hint} outfit aesthetic`.trim(),
          `${name} ${hint} fashion`.trim(),
          `${name} fashion`,
          `${name} outfit`,
        ], 1).then(([url] = []) => setPhoto(url ?? null))
        obs.disconnect()
      }
    }, { rootMargin: '100px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [aestheticId, style, gender])

  if (!style) return null

  return (
    <button
      ref={cardRef}
      className={styles.miniCard}
      onClick={() => navigate(`aesthetic:${aestheticId}`)}
    >
      <div className={styles.miniCardBg} style={{ background: style.gradient }}>
        {photo && (
          <img
            src={photo}
            alt={style.name}
            className={styles.miniCardImg}
            style={{ opacity: loaded ? 1 : 0 }}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        )}
      </div>
      <div className={styles.miniCardOverlay} />
      <span className={styles.miniCardName}>{getStyleName(style, gender).split(' / ')[0]}</span>
    </button>
  )
}

function HorizontalScroll({ ids, navigate, gender }) {
  return (
    <div className={styles.hScroll}>
      {ids.filter((id) => STYLES[id]).map((id) => (
        <AestheticMiniCard key={`${id}-${gender}`} aestheticId={id} navigate={navigate} gender={gender} />
      ))}
    </div>
  )
}

function AestheticGrid({ ids, navigate, gender }) {
  return (
    <div className={styles.aestheticGrid}>
      {ids.filter((id) => STYLES[id]).map((id) => (
        <AestheticMiniCard key={`${id}-${gender}`} aestheticId={id} navigate={navigate} gender={gender} />
      ))}
    </div>
  )
}

// ── Wardrobe Builder CTA ──────────────────────────────────────────────────────

function WardrobeBuilderCTA({ navigate }) {
  return (
    <section className={styles.section}>
      <button
        className={styles.wardrobeCTA}
        onClick={() => navigate('wardrobe-builder')}
      >
        <div className={styles.wardrobeCTAIcon}>👗</div>
        <div className={styles.wardrobeCTAText}>
          <p className={styles.wardrobeCTATitle}>Shop Scout</p>
          <p className={styles.wardrobeCTASub}>
            Pick pieces, set your budget → find the best brands to shop
          </p>
        </div>
        <span className={styles.wardrobeCTAArrow}>→</span>
      </button>
    </section>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

function GuideLauncher({ onStart }) {
  return (
    <section className={styles.section}>
      <button className={styles.guideLaunchBtn} onClick={onStart}>
        <div className={styles.guideLaunchInner}>
          <span className={styles.guideLaunchIcon}>✦</span>
          <div>
            <span className={styles.guideLaunchTitle}>Take the app tour</span>
            <span className={styles.guideLaunchSub}>11-step walkthrough of every feature</span>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, opacity: 0.4 }}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </section>
  )
}

// ── Daily Outfit Preview ─────────────────────────────────────────────────────

const CATEGORY_EMOJIS_HOME = {
  tops: '👕', bottoms: '👖', outerwear: '🧥',
  dresses: '👗', footwear: '👟', accessories: '👜',
}

function DailyOutfitPreview({ navigate, gender }) {
  const { user }        = useAuth()
  const { closetItems } = useCloset()
  const [outfit, setOutfit]   = useState(null)
  const [weather, setWeather] = useState(null)
  const [done, setDone]       = useState(false)

  useEffect(() => {
    getWeather().then(setWeather).catch(() => {})
  }, [])

  useEffect(() => {
    if (!user || closetItems.length < 3 || done) return
    setDone(true)
    const dateStr = new Date().toISOString().slice(0, 10)
    generateOutfit({ closetItems, weather, occasion: 'casual', dateStr, gender, occupation: null })
      .then(setOutfit)
      .catch(() => {})
  }, [user, closetItems.length, done, gender, weather])

  if (!user || closetItems.length < 3) {
    return (
      <div className={styles.closetCta} onClick={() => navigate('daily')}>
        <span className={styles.closetCtaIcon}>🪣</span>
        <div>
          <p className={styles.closetCtaTitle}>Build your digital closet</p>
          <p className={styles.closetCtaSub}>Add 3+ items to unlock daily AI outfits</p>
        </div>
        <span className={styles.closetCtaArrow}>→</span>
      </div>
    )
  }

  if (!outfit) return null

  return (
    <div className={styles.dailyPreview}>
      <div className={styles.dailyPreviewHeader}>
        <div>
          <h3 className={styles.dailyPreviewTitle}>Today's Look</h3>
          {weather && (
            <span className={styles.dailyWeather}>
              {getWeatherEmoji(weather.condition)} {weather.temp}°C · {weather.city}
            </span>
          )}
        </div>
        <button
          className={styles.dailySeeAll}
          onClick={() => navigate('daily')}
        >
          See full look →
        </button>
      </div>
      <div className={styles.dailyItems}>
        {outfit.items.slice(0, 3).map((item) => {
          const photoUrl = item.prettifiedUrl ?? item.imageUrl ?? item.thumbnailUrl
          return (
            <div key={item.id} className={styles.dailyItem}>
              {photoUrl
                ? <img src={photoUrl} alt={item.name} className={styles.dailyItemImg} />
                : <span className={styles.dailyItemEmoji}>{CATEGORY_EMOJIS_HOME[item.category] ?? '👕'}</span>
              }
            </div>
          )
        })}
      </div>
      {outfit.reasoning && (
        <p className={styles.dailyReasoning}>{outfit.reasoning}</p>
      )}
    </div>
  )
}

export default function HomeScreen({ startGuide }) {
  const navigate            = useNavigation()
  const { savedAesthetics } = useExplore()
  const { state }           = useApp()
  const gender              = state.gender
  const season              = getSeason()
  const meta                = SEASON_META[season]
  const [trendingKey, setTrendingKey] = useState(0)
  const isNewUser = !Object.values(state.styleScores).some(s => s > 0)

  const trendingIds = useMemo(() => {
    if (trendingKey === 0) return TRENDING
    const arr = [...TRENDING]
    let seed = trendingKey * 1664525 + 1013904223
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      const j = seed % (i + 1)
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [trendingKey])

  return (
    <div className={styles.screen}>
      {/* Hero */}
      <HeroCarousel navigate={navigate} gender={gender} />

      <div className={styles.body}>
        {/* Daily AI outfit preview + closet CTA */}
        <DailyOutfitPreview navigate={navigate} gender={gender} />

        {/* Guide tour — show at top for new users */}
        {startGuide && isNewUser && <GuideLauncher onStart={startGuide} />}

        {/* Fresh Looks Today — daily rotating content, main daily pull */}
        <FreshLooksSection gender={gender} navigate={navigate} />

        {/* Wardrobe Builder CTA */}
        <WardrobeBuilderCTA navigate={navigate} />

        {/* Live Aesthetic Profile — only appears once user has swiped */}
        <AestheticProfile navigate={navigate} gender={gender} />

        {/* Saved aesthetics */}
        {savedAesthetics.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionIcon}>📌</span>
              <div>
                <h2 className={styles.sectionTitle}>Your Saved Aesthetics</h2>
                <p className={styles.sectionSub}>{savedAesthetics.length} pinned from Explore</p>
              </div>
            </div>
            <HorizontalScroll ids={savedAesthetics} navigate={navigate} gender={gender} />
          </section>
        )}

        {/* Season picks — only shown before user has personalised saves */}
        {savedAesthetics.length === 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionIcon}>{meta.icon}</span>
              <div>
                <h2 className={styles.sectionTitle}>{meta.label}</h2>
                <p className={styles.sectionSub}>{meta.sub}</p>
              </div>
            </div>
            <HorizontalScroll ids={SEASON_PICKS[season]} navigate={navigate} gender={gender} />
          </section>
        )}

        {/* Trending — 2-column grid instead of another carousel */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>🔥</span>
            <div style={{ flex: 1 }}>
              <h2 className={styles.sectionTitle}>Trending Now</h2>
              <p className={styles.sectionSub}>Styles gaining momentum</p>
            </div>
            <button
              className={styles.refreshBtn}
              onClick={() => setTrendingKey((k) => k + 1)}
              aria-label="Shuffle trending"
            >
              ↻
            </button>
          </div>
          <AestheticGrid ids={trendingIds.slice(0, 6)} navigate={navigate} gender={gender} />
        </section>

        {/* Guide tour — bottom position for returning users */}
        {startGuide && !isNewUser && <GuideLauncher onStart={startGuide} />}

        <button className={styles.exploreAllBtn} onClick={() => navigate('explore')}>
          Browse all {Object.keys(STYLES).length} aesthetics →
        </button>
      </div>
    </div>
  )
}
