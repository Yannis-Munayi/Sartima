import { createContext, useContext, useEffect, useReducer, useState } from 'react'
import { STYLES } from '../data/styles'
import { CLOTHING_ITEMS } from '../data/categories'
import { AESTHETIC_QUIZ_ITEMS } from '../data/aestheticItems'
import { LABEL_WEIGHTS, getItemLabels } from '../data/labels'

const AppContext = createContext(null)

export const SCREENS = {
  AUTH:        'auth',
  WELCOME:     'welcome',
  ONBOARDING:  'onboarding',
  SEASONS:     'seasons',
  CATEGORIES:  'categories',
  DISCOVERY:   'discovery',
  RESULTS:     'results',
  PROFILE:     'profile',
}

export const ALL_CATEGORIES = Object.keys(CLOTHING_ITEMS)

const BATCH_SIZE = 40

const initialState = {
  screen: SCREENS.WELCOME,
  selectedSeasons: [],
  selectedCategories: [],
  itemQueue: [],
  currentItemIndex: 0,
  responses: {},
  styleScores: Object.fromEntries(Object.keys(STYLES).map((k) => [k, 0])),
  gender: localStorage.getItem('fashionGender') ?? 'both',
  quizMode: false,
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function matchesGender(itemGender, preference) {
  if (preference === 'both') return true
  const g = itemGender || 'unisex'
  return g === 'unisex' || g === preference
}

function buildItemPool(categories, seasons, gender) {
  const cats   = categories.length > 0 ? categories : ALL_CATEGORIES
  const catSet = new Set(cats)
  const all    = []

  for (const catId of cats) {
    for (const item of (CLOTHING_ITEMS[catId] || [])) {
      if (
        (seasons.length === 0 || item.seasons.some((s) => seasons.includes(s))) &&
        matchesGender(item.gender, gender)
      ) {
        all.push({ ...item, categoryId: catId })
      }
    }
  }

  for (const item of AESTHETIC_QUIZ_ITEMS) {
    if (
      catSet.has(item._category) &&
      (seasons.length === 0 || item.seasons.some((s) => seasons.includes(s))) &&
      matchesGender(item.gender, gender)
    ) {
      all.push({ ...item, categoryId: item._category })
    }
  }

  const seen = new Map()
  for (const item of all) {
    const key = item.name.toLowerCase().trim()
    if (!seen.has(key)) {
      seen.set(key, { ...item, styleWeights: { ...item.styleWeights } })
    } else {
      const kept = seen.get(key)
      for (const [style, w] of Object.entries(item.styleWeights || {})) {
        kept.styleWeights[style] = Math.max(kept.styleWeights[style] || 0, w)
      }
    }
  }

  return [...seen.values()]
}

// Build a fresh shuffled batch, excluding already-liked items
function buildNextBatch(responses, categories, seasons, gender) {
  const pool     = buildItemPool(categories, seasons, gender)
  const likedIds = new Set(
    Object.entries(responses).filter(([, r]) => r.liked).map(([id]) => id)
  )
  return shuffle(pool.filter((item) => !likedIds.has(item.id))).slice(0, BATCH_SIZE)
}

function recalculateScores(responses, itemQueue) {
  const scores = Object.fromEntries(Object.keys(STYLES).map((k) => [k, 0]))
  for (const item of itemQueue) {
    const resp = responses[item.id]
    if (!resp?.liked) continue
    for (const [style, weight] of Object.entries(item.styleWeights || {})) {
      if (scores[style] !== undefined) scores[style] += weight
    }
    for (const label of getItemLabels(item)) {
      const lw = LABEL_WEIGHTS[label]
      if (!lw) continue
      for (const [style, weight] of Object.entries(lw)) {
        if (scores[style] !== undefined) scores[style] += weight
      }
    }
  }
  return scores
}

function reducer(state, action) {
  switch (action.type) {

    case 'GO_TO_AUTH':
      return { ...state, screen: SCREENS.AUTH }

    case 'GO_TO_WELCOME':
      return { ...state, screen: SCREENS.WELCOME }

    case 'GO_TO_ONBOARDING':
      return { ...state, screen: SCREENS.ONBOARDING }

    case 'SET_ONBOARDING_COMPLETE':
      return { ...state, screen: SCREENS.WELCOME }

    case 'GO_TO_PROFILE':
      return { ...state, screen: SCREENS.PROFILE }

    case 'GO_TO_SEASONS':
      return { ...state, screen: SCREENS.SEASONS }

    case 'SET_SEASONS':
      return { ...state, selectedSeasons: action.seasons }

    case 'GO_TO_CATEGORIES':
      return { ...state, screen: SCREENS.CATEGORIES }

    case 'SET_CATEGORIES':
      return { ...state, selectedCategories: action.categories }

    case 'SET_GENDER':
      return { ...state, gender: action.gender }

    // Original flow (via season/category setup)
    case 'START_DISCOVERY': {
      const queue = shuffle(buildItemPool(state.selectedCategories, state.selectedSeasons, state.gender))
      return {
        ...state,
        screen: SCREENS.DISCOVERY,
        itemQueue: queue,
        currentItemIndex: 0,
        responses: {},
        styleScores: Object.fromEntries(Object.keys(STYLES).map((k) => [k, 0])),
      }
    }

    // Jump straight to feed — all categories, all seasons, freshly shuffled
    case 'GO_TO_DISCOVERY_DIRECT': {
      const queue = shuffle(buildItemPool([], [], state.gender)).slice(0, BATCH_SIZE)
      return {
        ...state,
        screen: SCREENS.DISCOVERY,
        selectedCategories: [],
        selectedSeasons: [],
        itemQueue: queue,
        currentItemIndex: 0,
        responses: {},
        styleScores: Object.fromEntries(Object.keys(STYLES).map((k) => [k, 0])),
        quizMode: false,
      }
    }

    case 'GO_TO_RESULTS':
      return { ...state, screen: SCREENS.RESULTS }

    case 'PREV_ITEM':
      if (state.currentItemIndex === 0) return state
      return { ...state, currentItemIndex: state.currentItemIndex - 1 }

    case 'SKIP_ITEM': {
      const cur  = state.itemQueue[state.currentItemIndex]
      const responses  = { ...state.responses, [cur?.id]: { liked: false } }
      const nextIdx    = state.currentItemIndex + 1
      if (nextIdx >= state.itemQueue.length) {
        const more = buildNextBatch(responses, state.selectedCategories, state.selectedSeasons, state.gender)
        return { ...state, responses, itemQueue: [...state.itemQueue, ...more], currentItemIndex: nextIdx }
      }
      return { ...state, responses, currentItemIndex: nextIdx }
    }

    case 'LIKE_ITEM': {
      const { item } = action
      const responses    = { ...state.responses, [item.id]: { liked: true } }
      const styleScores  = recalculateScores(responses, state.itemQueue)
      const nextIdx      = state.currentItemIndex + 1
      if (nextIdx >= state.itemQueue.length) {
        const more = buildNextBatch(responses, state.selectedCategories, state.selectedSeasons, state.gender)
        return { ...state, styleScores, responses, itemQueue: [...state.itemQueue, ...more], currentItemIndex: nextIdx }
      }
      return { ...state, styleScores, responses, currentItemIndex: nextIdx }
    }

    // Rebuild the pending queue with new season/category filters, keeping history
    case 'UPDATE_FILTERS': {
      const cats  = action.categories ?? state.selectedCategories
      const seas  = action.seasons    ?? state.selectedSeasons
      const batch = buildNextBatch(state.responses, cats, seas, state.gender)
      return {
        ...state,
        selectedCategories: cats,
        selectedSeasons:    seas,
        // Keep the already-answered slice; replace everything from current position onward
        itemQueue: [...state.itemQueue.slice(0, state.currentItemIndex), ...batch],
      }
    }

    case 'GO_TO_QUIZ':
      return {
        ...state,
        quizMode: true,
        screen: SCREENS.DISCOVERY,
        selectedCategories: [],
        selectedSeasons: [],
        itemQueue: [],
        currentItemIndex: 0,
        responses: {},
        styleScores: Object.fromEntries(Object.keys(STYLES).map((k) => [k, 0])),
      }

    case 'SET_QUIZ_RESULTS':
      return {
        ...state,
        styleScores: action.styleScores,
        responses:   action.responses,
        itemQueue:   action.itemQueue,
        screen:      SCREENS.RESULTS,
        quizMode:    false,
      }

    case 'RESTART':
      return { ...initialState, gender: state.gender }

    case 'RESTART_QUIZ':
      return { ...initialState, gender: state.gender, screen: SCREENS.SEASONS }

    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    localStorage.setItem('fashionGender', state.gender)
  }, [state.gender])

  return <AppContext.Provider value={{ state, dispatch, SCREENS }}>{children}</AppContext.Provider>
}

export function useApp() {
  return useContext(AppContext)
}

// ── Theme hook ────────────────────────────────────────────────────────────────
export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    const t = localStorage.getItem('stylelab_theme') ?? 'dark'
    document.documentElement.setAttribute('data-theme', t)
    return t
  })

  function setTheme(t) {
    localStorage.setItem('stylelab_theme', t)
    document.documentElement.setAttribute('data-theme', t)
    setThemeState(t)
  }

  return { theme, setTheme }
}

// ── Temperature unit hook ─────────────────────────────────────────────────────
export function useTempUnit() {
  const [unit, setUnitState] = useState(() => localStorage.getItem('stylelab_temp_unit') ?? 'c')
  function setUnit(u) {
    localStorage.setItem('stylelab_temp_unit', u)
    setUnitState(u)
  }
  return { unit, setUnit }
}

// ── Default occasion hook ─────────────────────────────────────────────────────
export function useDefaultOccasion() {
  const [occasion, setOccasionState] = useState(
    () => localStorage.getItem('stylelab_default_occasion') ?? 'casual'
  )
  function setOccasion(o) {
    localStorage.setItem('stylelab_default_occasion', o)
    setOccasionState(o)
  }
  return { occasion, setOccasion }
}

// ── Preferred seasons hook ────────────────────────────────────────────────────
export function usePreferredSeasons() {
  const [seasons, setSeasonsState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('stylelab_preferred_seasons') ?? '[]') } catch { return [] }
  })
  function toggleSeason(s) {
    const next = seasons.includes(s) ? seasons.filter((x) => x !== s) : [...seasons, s]
    localStorage.setItem('stylelab_preferred_seasons', JSON.stringify(next))
    setSeasonsState(next)
  }
  return { preferredSeasons: seasons, toggleSeason }
}

// ── Show quiz tab hook (cross-component reactive via custom event) ─────────────
const QUIZ_TAB_EVENT = 'stylelab:quiz-tab-change'

export function useShowQuizTab() {
  const [show, setShowState] = useState(() => localStorage.getItem('stylelab_show_quiz_tab') !== 'false')

  useEffect(() => {
    function onUpdate(e) { setShowState(e.detail !== false) }
    window.addEventListener(QUIZ_TAB_EVENT, onUpdate)
    return () => window.removeEventListener(QUIZ_TAB_EVENT, onUpdate)
  }, [])

  function setShow(v) {
    localStorage.setItem('stylelab_show_quiz_tab', String(v))
    setShowState(v)
    window.dispatchEvent(new CustomEvent(QUIZ_TAB_EVENT, { detail: v }))
  }
  return { showQuizTab: show, setShowQuizTab: setShow }
}

// ── Closet sort hook ──────────────────────────────────────────────────────────
export function useClosetSort() {
  const [sort, setSortState] = useState(() => localStorage.getItem('stylelab_closet_sort') ?? 'date')
  function setSort(s) {
    localStorage.setItem('stylelab_closet_sort', s)
    setSortState(s)
  }
  return { closetSort: sort, setClosetSort: setSort }
}
