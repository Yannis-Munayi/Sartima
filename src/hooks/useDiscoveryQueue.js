import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PRODUCTS, PRODUCTS_BY_ID } from '../data/products'
import { useInterests } from '../context/InterestContext'
import { useCloset } from '../context/ClosetContext'
import { useClosetGaps } from './useClosetGaps'
import { trackEvent } from '../services/firebase'
import { shuffle } from '../services/shuffle'
import {
  applySignals, createSession, getTasteModel, loadTasteProfile, tasteCloset,
} from '../services/tasteProfile'

const BUFFER_SIZE      = 30
const REFILL_THRESHOLD = 8
const QUIZ_SIZE        = 40
const QUIZ_STORAGE_KEY = 'sartima_quiz_progress'

function saveQuizProgress(queue, index, scores, likedItems) {
  try {
    sessionStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify({
      queueIds:  queue.map((p) => p.id),
      index,
      scores,
      likedIds:  likedItems.map((p) => p.id),
    }))
  } catch {}
}

function loadQuizProgress() {
  try {
    const raw = sessionStorage.getItem(QUIZ_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function clearQuizProgress() {
  try { sessionStorage.removeItem(QUIZ_STORAGE_KEY) } catch {}
}

function genderFilter(gender) {
  return (p) =>
    p.gender === 'unisex' ||
    p.gender === gender ||
    gender === 'both'
}

// Onboarding hands off answers straight through React state rather than the
// persisted interests doc — `InterestContext` loads that doc once, the moment
// it does the write may not have landed yet, so a brand-new account would
// silently miss this warm start if it depended on the Firestore round-trip.
// Same signals onboarding persists, so the local and stored profiles agree.
function warmStartSignals(warmStart) {
  if (!warmStart) return []
  const ts = Date.now()
  return [
    ...Object.keys(warmStart.styleAffinities ?? {}).map((aestheticId) => ({ type: 'aestheticPin', ts, aestheticId })),
    ...Object.keys(warmStart.brandAffinities ?? {}).map((brandName) => ({ type: 'brandFavorite', ts, brandName })),
  ]
}

function isCold(taste) {
  return taste.evidence === 0 && !taste.quiz && Object.keys(taste.aes).length === 0
}

// One batch of { product, slot }. Leaves out what this visit already queued
// or swiped, what the user acted on in earlier visits (the profile's recent
// touches), and the other gender's catalog. With no signal at all yet there's
// nothing to rank on, so a cold start is a plain shuffle.
function buildBatch({ taste, session, closet, gender, count, excluded }) {
  const allowed = genderFilter(gender)
  const exclude = {
    has: (id) => excluded.has(id) || Object.hasOwn(taste.touches, id) || !allowed(PRODUCTS_BY_ID[id]),
  }

  if (isCold(taste)) {
    const pool = PRODUCTS.filter((p) => !exclude.has(p.id))
    return shuffle(pool).slice(0, count).map((product) => ({ product, slot: 'cold' }))
  }

  // The model ranks normalised copies of the products; hand back the originals
  return getTasteModel()
    .rankFeed({ profile: taste, session, closet, exclude, count })
    .map(({ product, slot }) => ({ product: PRODUCTS_BY_ID[product.id], slot }))
}

export function useDiscoveryQueue(gender = 'both', quizMode = false, warmStart = null) {
  const { interests }    = useInterests() ?? {}
  const { closetItems }  = useCloset()
  const closetGaps       = useClosetGaps()
  const [queue,          setQueue]          = useState([])
  const [currentIndex,   setIndex]          = useState(0)
  const [styleScores,    setScores]         = useState({})
  const [quizLikedItems, setQuizLikedItems] = useState([])
  const [seeded,         setSeeded]         = useState(false)
  // Local copy of the persisted taste profile plus this visit's swipes. The
  // stored profile is updated separately, by interestTracker replaying the
  // same signals (DiscoveryScreen records them).
  const tasteRef         = useRef(null)
  const sessionRef       = useRef(null)
  // Product ids queued or swiped this visit, and the feed slot each was served in
  const excludedRef      = useRef(new Set())
  const slotsRef         = useRef(new Map())
  // Quiz result tally — liked items' styleWeights on top of the persisted
  // aesthetic tally and any onboarding warm start. Results turns it into %.
  const tallyRef         = useRef({})
  const quizModeRef      = useRef(quizMode)
  const genderRef        = useRef(gender)
  const interestsSeeded  = useRef(false)
  // Monotonic per-session swipe counter — feeds like-rate-by-position
  // analytics (currentIndex resets on refill so it can't serve as position)
  const swipeCountRef    = useRef(0)
  useEffect(() => { quizModeRef.current = quizMode }, [quizMode])
  useEffect(() => { genderRef.current = gender }, [gender])

  // Closet gaps only mean something once there's a closet — for an empty one
  // every category is "missing". Categories the user said they lack at
  // onboarding count either way.
  const closet = useMemo(() => {
    const missing = Object.keys(warmStart?.parentTypeAffinities ?? {}).map((category) => ({ category, deficit: 1 }))
    return tasteCloset(closetItems, closetItems.length > 0 ? [...closetGaps, ...missing] : missing)
  }, [closetItems, closetGaps, warmStart])
  const closetRef = useRef(closet)
  useEffect(() => { closetRef.current = closet }, [closet])

  const currentProduct  = queue[currentIndex] ?? null
  const remaining       = queue.length - currentIndex
  const isQuizFinished  = quizMode && queue.length > 0 && currentIndex >= queue.length

  const rank = useCallback((count, forGender) => {
    const batch = buildBatch({
      taste:    tasteRef.current,
      session:  sessionRef.current,
      closet:   closetRef.current,
      gender:   forGender,
      count,
      excluded: excludedRef.current,
    })
    for (const { product, slot } of batch) {
      excludedRef.current.add(product.id)
      slotsRef.current.set(product.id, slot)
    }
    return batch.map(({ product }) => product)
  }, [])

  // Seed queue on mount / gender change / mode change
  useEffect(() => {
    interestsSeeded.current = !!interests
    tasteRef.current    = loadTasteProfile(interests)
    sessionRef.current  = createSession()
    excludedRef.current = new Set()
    slotsRef.current    = new Map()
    tallyRef.current    = { ...interests?.styleAffinities }

    if (quizMode) {
      const saved = loadQuizProgress()
      if (saved) {
        const restoredQueue   = saved.queueIds.map((id) => PRODUCTS_BY_ID[id]).filter(Boolean)
        const restoredLiked   = saved.likedIds.map((id) => PRODUCTS_BY_ID[id]).filter(Boolean)
        // Replay the restored likes so the session picks up where it left off
        // (the model counts one like per item per day, so likes the stored
        // profile already has aren't doubled)
        const ts = Date.now()
        applySignals(tasteRef.current, restoredLiked.map((p) => ({ type: 'like', ts, productId: p.id })), sessionRef.current)
        for (const product of restoredLiked) {
          for (const [style, weight] of Object.entries(product.styleWeights ?? {})) {
            tallyRef.current[style] = (tallyRef.current[style] ?? 0) + weight
          }
        }
        for (const product of restoredQueue) excludedRef.current.add(product.id)
        setQueue(restoredQueue)
        setIndex(saved.index)
        setScores(saved.scores)
        setQuizLikedItems(restoredLiked)
        return
      }
    }

    // Fresh-signup hand-off (see warmStartSignals) — only reached when there's
    // no saved quiz progress to resume, i.e. this is genuinely a new queue.
    applySignals(tasteRef.current, warmStartSignals(warmStart))
    Object.assign(tallyRef.current, warmStart?.styleAffinities)

    setQueue(rank(quizMode ? QUIZ_SIZE : BUFFER_SIZE, gender))
    setIndex(0)
    setScores({})
    setQuizLikedItems([])
    setSeeded(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender, quizMode])

  // When interests load after mount (async Firestore fetch), apply warm-start
  // once — but only if the user hasn't swiped yet
  useEffect(() => {
    if (!interests || interestsSeeded.current) return
    interestsSeeded.current = true
    if (currentIndex > 0) return  // user already started; don't disrupt
    tasteRef.current = loadTasteProfile(interests)
    applySignals(tasteRef.current, warmStartSignals(warmStart))
    Object.assign(tallyRef.current, interests.styleAffinities)
    // Rebuild the queue with the now-warm profile
    excludedRef.current = new Set()
    slotsRef.current    = new Map()
    setQueue(rank(quizModeRef.current ? QUIZ_SIZE : BUFFER_SIZE, genderRef.current))
    setIndex(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interests])

  // Refill when buffer runs low — infinite mode only
  useEffect(() => {
    if (quizMode) return
    if (queue.length === 0) return
    if (remaining > REFILL_THRESHOLD) return

    const more = rank(BUFFER_SIZE - remaining, gender)
    if (more.length === 0) return

    setQueue((prev) => {
      const tail = prev.slice(currentIndex)
      return [...tail, ...more]
    })
    setIndex(0)
  }, [remaining, currentIndex, gender, queue.length, quizMode, rank])

  // Persist quiz progress after every swipe
  useEffect(() => {
    if (!quizMode || queue.length === 0 || isQuizFinished) return
    saveQuizProgress(queue, currentIndex, styleScores, quizLikedItems)
  }, [currentIndex, quizMode, queue, styleScores, quizLikedItems, isQuizFinished])

  // Clear saved progress when quiz finishes or mode turns off
  useEffect(() => {
    if (isQuizFinished || !quizMode) clearQuizProgress()
  }, [isQuizFinished, quizMode])

  const slotOf = useCallback((productId) => slotsRef.current.get(productId), [])

  const recordSwipe = useCallback((action, product) => {
    const slot = slotsRef.current.get(product.id)
    applySignals(tasteRef.current, [{ type: action, ts: Date.now(), productId: product.id, slot }], sessionRef.current)
    excludedRef.current.add(product.id)
    swipeCountRef.current += 1
    trackEvent('feed_swipe', {
      action,
      product_id:   product.id,
      brand:        product.brand,
      product_type: product.type,
      position:     swipeCountRef.current,
      mode:         quizModeRef.current ? 'quiz' : 'discover',
      slot,
    })
    setIndex((i) => i + 1)
  }, [])

  const onLike = useCallback((product) => {
    const tally = tallyRef.current
    for (const [style, weight] of Object.entries(product.styleWeights ?? {})) {
      tally[style] = (tally[style] ?? 0) + weight
    }
    setScores({ ...tally })
    if (quizModeRef.current) {
      setQuizLikedItems((prev) => [...prev, product])
    }
    recordSwipe('like', product)
  }, [recordSwipe])

  const onSkip = useCallback((product) => {
    recordSwipe('skip', product)
  }, [recordSwipe])

  const onPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1))
  }, [])

  // Start over from the stored profile with a fresh visit
  const reset = useCallback(() => {
    tasteRef.current    = loadTasteProfile(interests)
    sessionRef.current  = createSession()
    excludedRef.current = new Set()
    slotsRef.current    = new Map()
    tallyRef.current    = {}
    setQueue(rank(quizModeRef.current ? QUIZ_SIZE : BUFFER_SIZE, gender))
    setIndex(0)
    setScores({})
    setQuizLikedItems([])
  }, [gender, interests, rank])

  return {
    currentProduct,
    remaining,
    onLike,
    onSkip,
    onPrev,
    slotOf,
    styleScores,
    reset,
    seeded,
    isQuizFinished,
    quizProgress: quizMode ? { current: Math.min(currentIndex, queue.length), total: queue.length } : null,
    quizQueue:    queue,
    quizLikedItems,
  }
}
