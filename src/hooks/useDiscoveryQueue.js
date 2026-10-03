import { useCallback, useEffect, useRef, useState } from 'react'
import { PRODUCTS, PRODUCTS_BY_ID } from '../data/products'
import { useInterests } from '../context/InterestContext'
import { trackEvent } from '../services/firebase'
import { shuffle } from '../services/shuffle'

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

// Scoring weights. Each affinity map is normalised to 0..1 against its own
// max before weighting, so the numbers below express relative importance
// directly. The 51-aesthetic tally is the dominant signal by design: the feed
// should lead with the user's top aesthetic, then their favourite categories.
const WEIGHTS = {
  aesthetic:      30,  // persistent 51-aesthetic tally × product styleWeights
  topAesthetic:   12,  // extra push when a product carries the user's #1 aesthetic
  type:           15,  // "keeps liking loafers" → more loafers
  parentType:      6,  // "keeps liking footwear" → more footwear
  brand:           8,
  color:           4,
  companionBonus:  5,
}

// Product styleWeights range 1–5; used to scale them into 0..1
const MAX_PRODUCT_STYLE_WEIGHT = 5

function createEmptyProfile() {
  return {
    brandAffinities:      {},
    typeAffinities:       {},
    colorAffinities:      {},
    parentTypeAffinities: {},
    styleAffinities:      {},
    recentLikes:          [],
    seenIds:              new Set(),
  }
}

// Merge persisted Firestore interests into a fresh profile as the starting baseline.
// Session swipes accumulate on top of this warm start.
function seedProfileFromInterests(profile, interests) {
  if (!interests) return
  const { brandAffinities, typeAffinities, parentTypeAffinities, colorAffinities, styleAffinities, recentLikes } = interests
  if (brandAffinities)      Object.assign(profile.brandAffinities,      brandAffinities)
  if (typeAffinities)       Object.assign(profile.typeAffinities,       typeAffinities)
  if (parentTypeAffinities) Object.assign(profile.parentTypeAffinities, parentTypeAffinities)
  if (colorAffinities)      Object.assign(profile.colorAffinities,      colorAffinities)
  if (styleAffinities)      Object.assign(profile.styleAffinities,      styleAffinities)
  if (recentLikes?.length) profile.recentLikes = [...recentLikes].slice(0, 10)
}

// Onboarding hands off answers straight through React state rather than the
// persisted interests doc — `InterestContext` loads that doc once, the moment
// it does the write may not have landed yet, so a brand-new account would
// silently miss this warm start if it depended on the Firestore round-trip.
function applyWarmStart(profile, warmStart) {
  if (!warmStart) return
  const { styleAffinities, brandAffinities, parentTypeAffinities } = warmStart
  if (styleAffinities)      Object.assign(profile.styleAffinities,      styleAffinities)
  if (brandAffinities)      Object.assign(profile.brandAffinities,      brandAffinities)
  if (parentTypeAffinities) Object.assign(profile.parentTypeAffinities, parentTypeAffinities)
}

function genderFilter(gender) {
  return (p) =>
    p.gender === 'unisex' ||
    p.gender === gender ||
    gender === 'both'
}

// Returns a lookup that maps a key to its share of the map's max value
// (0..1). Normalising per-map keeps the all-time aesthetic tally from
// swamping fresh session signals and makes WEIGHTS directly comparable.
function makeNormalizer(map) {
  let max = 0
  for (const v of Object.values(map)) if (v > max) max = v
  if (max <= 0) return () => 0
  return (key) => (map[key] ?? 0) / max
}

function topKey(map) {
  let best = null
  let bestVal = 0
  for (const [key, val] of Object.entries(map)) {
    if (val > bestVal) { best = key; bestVal = val }
  }
  return best
}

// Precomputed once per batch so scoring stays O(products)
function buildRanking(profile) {
  return {
    style:        makeNormalizer(profile.styleAffinities),
    type:         makeNormalizer(profile.typeAffinities),
    parentType:   makeNormalizer(profile.parentTypeAffinities),
    brand:        makeNormalizer(profile.brandAffinities),
    color:        makeNormalizer(profile.colorAffinities),
    topAesthetic: topKey(profile.styleAffinities),
  }
}

function scoreProduct(product, profile, ranking) {
  let score = 0

  // Dominant term: how strongly this product expresses the aesthetics the
  // user has accumulated points in — plus an extra push for their #1.
  for (const [style, weight] of Object.entries(product.styleWeights ?? {})) {
    const productStrength = weight / MAX_PRODUCT_STYLE_WEIGHT
    score += ranking.style(style) * productStrength * WEIGHTS.aesthetic
    if (style === ranking.topAesthetic) {
      score += productStrength * WEIGHTS.topAesthetic
    }
  }

  // Category persistence: keep serving the garment types the user keeps liking
  score += ranking.type(product.type)             * WEIGHTS.type
  score += ranking.parentType(product.parentType) * WEIGHTS.parentType
  score += ranking.brand(product.brand)           * WEIGHTS.brand
  score += ranking.color(product.color)           * WEIGHTS.color

  for (const likedId of profile.recentLikes.slice(0, 5)) {
    const liked = PRODUCTS_BY_ID[likedId]
    if (!liked) continue
    if (liked.outfitCompanions?.includes(product.type)) {
      score += WEIGHTS.companionBonus
    }
    if (liked.outfitCompanions?.includes(product.id)) {
      score += WEIGHTS.companionBonus * 1.5
    }
  }

  score += Math.random() * 0.5
  return score
}

function injectDiversity(scoredCandidates, batchSize) {
  const result     = []
  const brandCount = {}
  const typeCount  = {}

  for (const candidate of scoredCandidates) {
    if (result.length >= batchSize) break
    const { brand, type } = candidate.product
    if ((brandCount[brand] ?? 0) >= 3) continue
    if ((typeCount[type]   ?? 0) >= 4) continue
    brandCount[brand] = (brandCount[brand] ?? 0) + 1
    typeCount[type]   = (typeCount[type]   ?? 0) + 1
    result.push(candidate)
  }

  // Back-fill if diversity caps left us short
  if (result.length < batchSize) {
    for (const candidate of scoredCandidates) {
      if (result.length >= batchSize) break
      if (!result.includes(candidate)) result.push(candidate)
    }
  }

  return result
}

function buildBatch(profile, batchSize, gender) {
  const unseen = PRODUCTS.filter(
    (p) => !profile.seenIds.has(p.id) && genderFilter(gender)(p)
  )

  if (unseen.length === 0) return []

  // Cold start: no likes AND no aesthetic tally yet → random shuffle.
  // (A quiz-completed user has a tally even before their first swipe.)
  if (profile.recentLikes.length === 0 && Object.keys(profile.styleAffinities).length === 0) {
    return shuffle(unseen).slice(0, batchSize)
  }

  const ranking = buildRanking(profile)
  const scored = unseen.map((p) => ({ product: p, score: scoreProduct(p, profile, ranking) }))
  scored.sort((a, b) => b.score - a.score)

  const diverse = injectDiversity(scored, batchSize)
  return diverse.map(({ product }) => product)
}

export function useDiscoveryQueue(gender = 'both', quizMode = false, warmStart = null) {
  const { interests }    = useInterests() ?? {}
  const [queue,          setQueue]          = useState([])
  const [currentIndex,   setIndex]          = useState(0)
  const [styleScores,    setScores]         = useState({})
  const [quizLikedItems, setQuizLikedItems] = useState([])
  const [seeded,         setSeeded]         = useState(false)
  const profileRef       = useRef(createEmptyProfile())
  const quizModeRef      = useRef(quizMode)
  const genderRef        = useRef(gender)
  const interestsSeeded  = useRef(false)
  // Monotonic per-session swipe counter — feeds like-rate-by-position
  // analytics (currentIndex resets on refill so it can't serve as position)
  const swipeCountRef    = useRef(0)
  useEffect(() => { quizModeRef.current = quizMode }, [quizMode])
  useEffect(() => { genderRef.current = gender }, [gender])

  const currentProduct  = queue[currentIndex] ?? null
  const remaining       = queue.length - currentIndex
  const isQuizFinished  = quizMode && queue.length > 0 && currentIndex >= queue.length

  // Seed queue on mount / gender change / mode change
  useEffect(() => {
    interestsSeeded.current = false
    profileRef.current = createEmptyProfile()
    // Apply persisted interests as warm-start baseline (may still be null on first render)
    seedProfileFromInterests(profileRef.current, interests)
    if (interests) interestsSeeded.current = true

    if (quizMode) {
      const saved = loadQuizProgress()
      if (saved) {
        const restoredQueue   = saved.queueIds.map((id) => PRODUCTS_BY_ID[id]).filter(Boolean)
        const restoredLiked   = saved.likedIds.map((id) => PRODUCTS_BY_ID[id]).filter(Boolean)
        // Rebuild profile affinities from liked items (session layer on top of persisted)
        for (const product of restoredLiked) {
          const p = profileRef.current
          p.brandAffinities[product.brand]           = (p.brandAffinities[product.brand]           ?? 0) + 2
          p.typeAffinities[product.type]             = (p.typeAffinities[product.type]             ?? 0) + 3
          p.colorAffinities[product.color]           = (p.colorAffinities[product.color]           ?? 0) + 1
          p.parentTypeAffinities[product.parentType] = (p.parentTypeAffinities[product.parentType] ?? 0) + 1
          for (const [style, weight] of Object.entries(product.styleWeights ?? {})) {
            p.styleAffinities[style] = (p.styleAffinities[style] ?? 0) + weight
          }
          p.recentLikes = [product.id, ...p.recentLikes].slice(0, 10)
          p.seenIds.add(product.id)
        }
        setQueue(restoredQueue)
        setIndex(saved.index)
        setScores(saved.scores)
        setQuizLikedItems(restoredLiked)
        return
      }
    }

    // Fresh-signup hand-off (see applyWarmStart) — only reached when there's
    // no saved quiz progress to resume, i.e. this is genuinely a new queue.
    applyWarmStart(profileRef.current, warmStart)

    const initial = buildBatch(profileRef.current, quizMode ? QUIZ_SIZE : BUFFER_SIZE, gender)
    setQueue(initial)
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
    seedProfileFromInterests(profileRef.current, interests)
    // Rebuild the queue with the now-warm profile
    const initial = buildBatch(profileRef.current, quizModeRef.current ? QUIZ_SIZE : BUFFER_SIZE, genderRef.current)
    setQueue(initial)
    setIndex(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interests])

  // Refill when buffer runs low — infinite mode only
  useEffect(() => {
    if (quizMode) return
    if (queue.length === 0) return
    if (remaining > REFILL_THRESHOLD) return

    const more = buildBatch(profileRef.current, BUFFER_SIZE - remaining, gender)
    if (more.length === 0) return

    setQueue((prev) => {
      const tail = prev.slice(currentIndex)
      return [...tail, ...more]
    })
    setIndex(0)
  }, [remaining, currentIndex, gender, queue.length, quizMode])

  // Persist quiz progress after every swipe
  useEffect(() => {
    if (!quizMode || queue.length === 0 || isQuizFinished) return
    saveQuizProgress(queue, currentIndex, styleScores, quizLikedItems)
  }, [currentIndex, quizMode, queue, styleScores, quizLikedItems, isQuizFinished])

  // Clear saved progress when quiz finishes or mode turns off
  useEffect(() => {
    if (isQuizFinished || !quizMode) clearQuizProgress()
  }, [isQuizFinished, quizMode])

  const onLike = useCallback((product) => {
    const p = profileRef.current
    p.brandAffinities[product.brand]           = (p.brandAffinities[product.brand]           ?? 0) + 2
    p.typeAffinities[product.type]             = (p.typeAffinities[product.type]             ?? 0) + 3
    p.colorAffinities[product.color]           = (p.colorAffinities[product.color]           ?? 0) + 1
    p.parentTypeAffinities[product.parentType] = (p.parentTypeAffinities[product.parentType] ?? 0) + 1
    for (const [style, weight] of Object.entries(product.styleWeights ?? {})) {
      p.styleAffinities[style] = (p.styleAffinities[style] ?? 0) + weight
    }
    p.recentLikes = [product.id, ...p.recentLikes].slice(0, 10)
    p.seenIds.add(product.id)
    setScores({ ...p.styleAffinities })
    if (quizModeRef.current) {
      setQuizLikedItems((prev) => [...prev, product])
    }
    swipeCountRef.current += 1
    trackEvent('feed_swipe', {
      action:       'like',
      product_id:   product.id,
      brand:        product.brand,
      product_type: product.type,
      position:     swipeCountRef.current,
      mode:         quizModeRef.current ? 'quiz' : 'discover',
    })
    setIndex((i) => i + 1)
  }, [])

  const onSkip = useCallback((product) => {
    const p = profileRef.current
    p.brandAffinities[product.brand] = Math.max(0, (p.brandAffinities[product.brand] ?? 0) - 1)
    p.typeAffinities[product.type]   = Math.max(0, (p.typeAffinities[product.type]   ?? 0) - 1)
    p.seenIds.add(product.id)
    swipeCountRef.current += 1
    trackEvent('feed_swipe', {
      action:       'skip',
      product_id:   product.id,
      brand:        product.brand,
      product_type: product.type,
      position:     swipeCountRef.current,
      mode:         quizModeRef.current ? 'quiz' : 'discover',
    })
    setIndex((i) => i + 1)
  }, [])

  const onPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1))
  }, [])

  const reset = useCallback(() => {
    profileRef.current = createEmptyProfile()
    const initial = buildBatch(profileRef.current, quizModeRef.current ? QUIZ_SIZE : BUFFER_SIZE, gender)
    setQueue(initial)
    setIndex(0)
    setScores({})
    setQuizLikedItems([])
  }, [gender])

  return {
    currentProduct,
    remaining,
    onLike,
    onSkip,
    onPrev,
    styleScores,
    reset,
    seeded,
    isQuizFinished,
    quizProgress: quizMode ? { current: Math.min(currentIndex, queue.length), total: queue.length } : null,
    quizQueue:    queue,
    quizLikedItems,
  }
}
