import { useCallback, useEffect, useRef, useState } from 'react'
import { PRODUCTS, PRODUCTS_BY_ID } from '../data/products'

const BUFFER_SIZE      = 30
const REFILL_THRESHOLD = 8
const QUIZ_SIZE        = 40

const WEIGHTS = {
  brand:          10,
  type:           15,
  parentType:      4,
  color:           5,
  style:          0.5,
  companionBonus:  8,
}

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

function genderFilter(gender) {
  return (p) =>
    p.gender === 'unisex' ||
    p.gender === gender ||
    gender === 'both'
}

function scoreProduct(product, profile) {
  let score = 0

  score += (profile.brandAffinities[product.brand]           ?? 0) * WEIGHTS.brand
  score += (profile.typeAffinities[product.type]             ?? 0) * WEIGHTS.type
  score += (profile.parentTypeAffinities[product.parentType] ?? 0) * WEIGHTS.parentType
  score += (profile.colorAffinities[product.color]           ?? 0) * WEIGHTS.color

  for (const [style, weight] of Object.entries(product.styleWeights ?? {})) {
    score += (profile.styleAffinities[style] ?? 0) * weight * WEIGHTS.style
  }

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

  // Cold start: no likes yet → random shuffle
  if (profile.recentLikes.length === 0) {
    const shuffled = [...unseen].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, batchSize)
  }

  const scored = unseen.map((p) => ({ product: p, score: scoreProduct(p, profile) }))
  scored.sort((a, b) => b.score - a.score)

  const diverse = injectDiversity(scored, batchSize)
  return diverse.map(({ product }) => product)
}

export function useDiscoveryQueue(gender = 'both', quizMode = false) {
  const [queue,          setQueue]          = useState([])
  const [currentIndex,   setIndex]          = useState(0)
  const [styleScores,    setScores]         = useState({})
  const [quizLikedItems, setQuizLikedItems] = useState([])
  const profileRef  = useRef(createEmptyProfile())
  const quizModeRef = useRef(quizMode)
  useEffect(() => { quizModeRef.current = quizMode }, [quizMode])

  const currentProduct  = queue[currentIndex] ?? null
  const remaining       = queue.length - currentIndex
  const isQuizFinished  = quizMode && queue.length > 0 && currentIndex >= queue.length

  // Seed queue on mount / gender change / mode change
  useEffect(() => {
    profileRef.current = createEmptyProfile()
    const initial = buildBatch(profileRef.current, quizMode ? QUIZ_SIZE : BUFFER_SIZE, gender)
    setQueue(initial)
    setIndex(0)
    setScores({})
    setQuizLikedItems([])
  }, [gender, quizMode])

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
    setIndex((i) => i + 1)
  }, [])

  const onSkip = useCallback((product) => {
    const p = profileRef.current
    p.brandAffinities[product.brand] = Math.max(0, (p.brandAffinities[product.brand] ?? 0) - 1)
    p.typeAffinities[product.type]   = Math.max(0, (p.typeAffinities[product.type]   ?? 0) - 1)
    p.seenIds.add(product.id)
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
    isQuizFinished,
    quizProgress: quizMode ? { current: Math.min(currentIndex, queue.length), total: queue.length } : null,
    quizQueue:    queue,
    quizLikedItems,
  }
}
