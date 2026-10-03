import { useEffect, useRef } from 'react'
import { hasOpenLayer } from './useEscapeKey'

// App-wide keyboard shortcuts (desktop):
//   /            focus the current page's search field, else open Search
//   Ctrl/⌘ + K   open catalog Search from anywhere
//   ?            show the shortcuts dialog
//   g then h…    jump to a main tab (Gmail/GitHub-style sequence)
//   Esc          leave the focused field (dialogs handle their own Esc via useEscapeKey)
// Swipe (←/→) and guide-tour keys live with those components.

export const GO_TO_KEYS = {
  h: 'home',
  a: 'explore',
  b: 'brands',
  d: 'quiz',
  s: 'search',
  o: 'daily',
  p: 'profile',
}

const SEQUENCE_TIMEOUT_MS = 1000

const NON_TEXT_INPUTS = new Set([
  'button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color', 'image',
])

export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)

// True while the user is typing — single-key shortcuts must not fire then
export function isTypingTarget(el) {
  if (!(el instanceof Element)) return false
  if (el.isContentEditable) return true
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true
  return el.tagName === 'INPUT' && !NON_TEXT_INPUTS.has(el.type)
}

// Screens mark their primary search input with data-page-search
function focusPageSearch() {
  const input = document.querySelector('[data-page-search]')
  if (!input) return false
  input.focus()
  input.select()
  return true
}

export function useKeyboardShortcuts({ enabled, activeTab, navigate, showQuizTab, onShowHelp }) {
  const latest = useRef(null)
  latest.current = { activeTab, navigate, showQuizTab, onShowHelp }

  useEffect(() => {
    if (!enabled) return
    let goPressedAt = 0

    function onKeyDown(e) {
      // Browser autofill fires keydown events with no key
      if (!e.key || e.defaultPrevented || e.isComposing) return
      const { activeTab, navigate, showQuizTab, onShowHelp } = latest.current
      const typing = isTypingTarget(e.target)
      const key    = e.key.toLowerCase()

      if (e.key === 'Escape') {
        if (typing && !hasOpenLayer()) e.target.blur()
        return
      }

      // An open dialog owns the keyboard
      if (hasOpenLayer()) return

      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && key === 'k') {
        e.preventDefault()
        if (activeTab === 'search') focusPageSearch()
        else navigate('search')
        return
      }

      if (typing || e.ctrlKey || e.metaKey || e.altKey) return

      if (goPressedAt && Date.now() - goPressedAt < SEQUENCE_TIMEOUT_MS) {
        goPressedAt = 0
        const tab = GO_TO_KEYS[key]
        if (tab && (tab !== 'quiz' || showQuizTab)) {
          e.preventDefault()
          navigate(tab)
        }
        return
      }
      goPressedAt = 0

      if (e.key === '/') {
        e.preventDefault()
        if (!focusPageSearch()) navigate('search')
      } else if (e.key === '?') {
        e.preventDefault()
        onShowHelp()
      } else if (key === 'g' && !e.shiftKey) {
        goPressedAt = Date.now()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
