import { useEffect, useMemo, useRef, useState } from 'react'
import { CLOTHING_ITEMS } from '../../data/categories'
import { AESTHETIC_QUIZ_ITEMS } from '../../data/aestheticItems'
import { fetchPhotosWithFallback } from '../../services/pexels'
import { useWishlist } from '../../context/WishlistContext'
import styles from '../../screens/HomeScreen.module.css'

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

export default function FreshLooksSection({ gender, navigate }) {
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
