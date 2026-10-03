import { createContext, useContext, useEffect, useReducer, useState } from 'react'
import { STYLES } from '../data/styles'
import { CLOTHING_ITEMS } from '../data/categories'
import { AESTHETIC_QUIZ_ITEMS } from '../data/aestheticItems'
import { LABEL_WEIGHTS, getItemLabels } from '../data/labels'
import { shuffle } from '../services/shuffle'

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
  quizId: null,
  authReturnTo: null,
  // Screen the auth screen was opened from, restored when it closes
  authFromScreen: null,
  // One-shot hand-off from onboarding into the very first post-signup quiz —
  // see useDiscoveryQueue's applyWarmStart. Not carried through RESTART/
  // RESTART_QUIZ, which intentionally start cold.
  quizWarmStart: null,
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

// Screens the auth screen can hand back to. Sign-in is only reachable from
// screens that show the tab bar, so the setup screens never appear here.
const AUTH_RETURN_SCREENS = new Set([SCREENS.WELCOME, SCREENS.DISCOVERY, SCREENS.RESULTS, SCREENS.PROFILE])

function screenBeforeAuth(state) {
  if (state.authReturnTo === 'results') return SCREENS.RESULTS
  return AUTH_RETURN_SCREENS.has(state.authFromScreen) ? state.authFromScreen : SCREENS.WELCOME
}

function reducer(state, action) {
  switch (action.type) {

    case 'GO_TO_AUTH':
      return {
        ...state,
        screen: SCREENS.AUTH,
        authReturnTo: action.returnTo ?? null,
        authFromScreen: state.screen === SCREENS.AUTH ? state.authFromScreen : state.screen,
      }

    case 'GO_TO_WELCOME':
      return { ...state, screen: SCREENS.WELCOME }

    // Auth screen finished (login / Google / guest) — return the user to the
    // screen they came from (quiz results, an in-progress feed) instead of
    // dropping them at the welcome screen. authReturnTo is kept so
    // SET_ONBOARDING_COMPLETE can still honour it if an onboarding redirect
    // interjects.
    case 'AUTH_FLOW_DONE':
      return { ...state, screen: screenBeforeAuth(state) }

    // Backed out of the auth screen without signing in
    case 'CANCEL_AUTH':
      return { ...state, screen: screenBeforeAuth(state), authReturnTo: null }

    case 'GO_TO_ONBOARDING':
      return { ...state, screen: SCREENS.ONBOARDING }

    case 'SET_ONBOARDING_COMPLETE':
      return {
        ...state,
        screen: state.authReturnTo === 'results' ? SCREENS.RESULTS : SCREENS.WELCOME,
        authReturnTo: null,
      }

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
        quizWarmStart: action.warmStart ?? null,
      }

    case 'SET_QUIZ_RESULTS':
      return {
        ...state,
        styleScores: action.styleScores,
        responses:   action.responses,
        itemQueue:   action.itemQueue,
        screen:      SCREENS.RESULTS,
        quizMode:    false,
        // Stable id for this quiz completion so the Firestore save is
        // idempotent even if ResultsScreen unmounts/remounts (e.g. sign-in flow)
        quizId:      `q_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
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
    const t = localStorage.getItem('sartima_theme') ?? 'light'
    document.documentElement.setAttribute('data-theme', t)
    return t
  })

  function setTheme(t) {
    localStorage.setItem('sartima_theme', t)
    document.documentElement.setAttribute('data-theme', t)
    setThemeState(t)
  }

  return { theme, setTheme }
}

// ── Temperature unit hook ─────────────────────────────────────────────────────
export function useTempUnit() {
  const [unit, setUnitState] = useState(() => localStorage.getItem('sartima_temp_unit') ?? 'c')
  function setUnit(u) {
    localStorage.setItem('sartima_temp_unit', u)
    setUnitState(u)
  }
  return { unit, setUnit }
}

// ── Default occasion hook ─────────────────────────────────────────────────────
export function useDefaultOccasion() {
  const [occasion, setOccasionState] = useState(
    () => localStorage.getItem('sartima_default_occasion') ?? 'casual'
  )
  function setOccasion(o) {
    localStorage.setItem('sartima_default_occasion', o)
    setOccasionState(o)
  }
  return { occasion, setOccasion }
}

// ── Preferred seasons hook ────────────────────────────────────────────────────
export function usePreferredSeasons() {
  const [seasons, setSeasonsState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sartima_preferred_seasons') ?? '[]') } catch { return [] }
  })
  function toggleSeason(s) {
    const next = seasons.includes(s) ? seasons.filter((x) => x !== s) : [...seasons, s]
    localStorage.setItem('sartima_preferred_seasons', JSON.stringify(next))
    setSeasonsState(next)
  }
  return { preferredSeasons: seasons, toggleSeason }
}

// ── Show quiz tab hook (cross-component reactive via custom event) ─────────────
const QUIZ_TAB_EVENT = 'sartima:quiz-tab-change'

export function useShowQuizTab() {
  const [show, setShowState] = useState(() => localStorage.getItem('sartima_show_quiz_tab') !== 'false')

  useEffect(() => {
    function onUpdate(e) { setShowState(e.detail !== false) }
    window.addEventListener(QUIZ_TAB_EVENT, onUpdate)
    return () => window.removeEventListener(QUIZ_TAB_EVENT, onUpdate)
  }, [])

  function setShow(v) {
    localStorage.setItem('sartima_show_quiz_tab', String(v))
    setShowState(v)
    window.dispatchEvent(new CustomEvent(QUIZ_TAB_EVENT, { detail: v }))
  }
  return { showQuizTab: show, setShowQuizTab: setShow }
}

// ── Adaptive aesthetic theme hook (cross-component reactive via custom events) ──
// On/off switch for theming the UI to the user's top aesthetic (default on),
// plus an optional pin that locks the theme to a specific flavor instead of
// following quiz results. The actual data-aesthetic attribute is managed by
// useAestheticFlavor.
const ADAPTIVE_THEME_EVENT = 'sartima:adaptive-theme-change'
const AESTHETIC_PIN_EVENT  = 'sartima:aesthetic-pin-change'

export function useAdaptiveTheme() {
  const [enabled, setEnabledState] = useState(() => localStorage.getItem('sartima_adaptive_theme') !== 'false')
  const [pin, setPinState]         = useState(() => localStorage.getItem('sartima_aesthetic_pin'))

  useEffect(() => {
    function onToggle(e) { setEnabledState(e.detail !== false) }
    function onPin(e)    { setPinState(e.detail ?? null) }
    window.addEventListener(ADAPTIVE_THEME_EVENT, onToggle)
    window.addEventListener(AESTHETIC_PIN_EVENT, onPin)
    return () => {
      window.removeEventListener(ADAPTIVE_THEME_EVENT, onToggle)
      window.removeEventListener(AESTHETIC_PIN_EVENT, onPin)
    }
  }, [])

  function setEnabled(v) {
    localStorage.setItem('sartima_adaptive_theme', String(v))
    setEnabledState(v)
    window.dispatchEvent(new CustomEvent(ADAPTIVE_THEME_EVENT, { detail: v }))
  }

  // flavorId from AESTHETIC_FLAVORS, or null to follow the top aesthetic
  function setPin(flavorId) {
    if (flavorId) localStorage.setItem('sartima_aesthetic_pin', flavorId)
    else localStorage.removeItem('sartima_aesthetic_pin')
    setPinState(flavorId ?? null)
    window.dispatchEvent(new CustomEvent(AESTHETIC_PIN_EVENT, { detail: flavorId ?? null }))
  }

  return { adaptiveTheme: enabled, setAdaptiveTheme: setEnabled, flavorPin: pin, setFlavorPin: setPin }
}

// ── Closet sort hook ──────────────────────────────────────────────────────────
export function useClosetSort() {
  const [sort, setSortState] = useState(() => localStorage.getItem('sartima_closet_sort') ?? 'date')
  function setSort(s) {
    localStorage.setItem('sartima_closet_sort', s)
    setSortState(s)
  }
  return { closetSort: sort, setClosetSort: setSort }
}
