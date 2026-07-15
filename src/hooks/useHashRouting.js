import { useEffect, useRef } from 'react'

// Hash-based deep links mapped onto the existing tab-ID scheme:
//   'brands'          ↔ '#/brands'
//   'aesthetic:y2k'   ↔ '#/aesthetic/y2k'
//   'brand:nike'      ↔ '#/brand/nike'
// Parameterised IDs that handleTabChange resolves to another tab
// (closet:*, profile:quiz-history, mystyle:*) are accepted as inbound
// deep links; the hash then reflects whatever tab they resolve to.

const STATIC_TABS = new Set([
  'home', 'quiz', 'explore', 'brands', 'search', 'mystyle',
  'daily', 'profile', 'wardrobe-builder',
])
const PREFIX_TABS = ['aesthetic:', 'brand:', 'mystyle:', 'closet:', 'wardrobe-builder:', 'profile:', 'quiz:']

export function isRoutableTab(tabId) {
  if (!tabId) return false
  if (STATIC_TABS.has(tabId)) return true
  return PREFIX_TABS.some((p) => tabId.startsWith(p) && tabId.length > p.length)
}

export function tabToHash(tabId) {
  const sep = tabId.indexOf(':')
  if (sep === -1) return '#/' + encodeURIComponent(tabId)
  return '#/' + encodeURIComponent(tabId.slice(0, sep)) + '/' + encodeURIComponent(tabId.slice(sep + 1))
}

export function hashToTab(hash) {
  if (!hash || !hash.startsWith('#/')) return null
  const parts = hash.slice(2).split('/')
  let head = parts[0]
  let rest = parts.slice(1).join('/')
  try {
    head = decodeURIComponent(head)
    rest = decodeURIComponent(rest)
  } catch {
    return null
  }
  const tabId = rest ? `${head}:${rest}` : head
  return isRoutableTab(tabId) ? tabId : null
}

export function useHashRouting(activeTab, navigate) {
  const navigateRef  = useRef(navigate)
  const activeTabRef = useRef(activeTab)
  navigateRef.current  = navigate
  activeTabRef.current = activeTab

  // Apply an inbound deep link once on load
  useEffect(() => {
    const tab = hashToTab(window.location.hash)
    if (tab && tab !== activeTabRef.current) navigateRef.current(tab)
  }, [])

  // Reflect tab changes into the hash so every screen has a shareable URL
  // and back/forward walk the tab history
  const syncedOnce = useRef(false)
  useEffect(() => {
    const next = tabToHash(activeTab)
    if (window.location.hash === next) return
    if (!syncedOnce.current) {
      syncedOnce.current = true
      // First render: a pending deep link owns the hash; otherwise normalise
      // without adding a history entry
      if (hashToTab(window.location.hash)) return
      window.history.replaceState(null, '', next)
      return
    }
    window.location.hash = next
  }, [activeTab])

  // Back/forward buttons and hand-edited hashes
  useEffect(() => {
    function onHashChange() {
      const tab = hashToTab(window.location.hash) ?? 'home'
      if (tab !== activeTabRef.current) navigateRef.current(tab)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
}
