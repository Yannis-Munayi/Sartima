// Pure parts of useHashRouting. The hook's behaviour in a real browser
// (StrictMode, back/forward, deep links through the signup gate) is covered
// by e2e/routing.spec.js and qa/tests/15-platform.spec.js.
import { describe, it, expect } from 'vitest'
import { isRoutableTab, tabToHash, hashToTab } from '../../src/hooks/useHashRouting.js'

describe('isRoutableTab', () => {
  it('accepts the main tabs and parameterised tabs', () => {
    for (const t of ['home', 'explore', 'brands', 'search', 'daily', 'profile', 'quiz', 'wardrobe-builder']) {
      expect(isRoutableTab(t), t).toBe(true)
    }
    for (const t of ['aesthetic:y2k', 'brand:nike', 'closet:liked', 'wardrobe-builder:boots', 'profile:quiz-history', 'mystyle:notes']) {
      expect(isRoutableTab(t), t).toBe(true)
    }
  })

  it('rejects unknown tabs and empty parameters', () => {
    for (const t of ['', null, undefined, 'admin', 'aesthetic:', 'brand:', 'settings']) {
      expect(isRoutableTab(t), String(t)).toBe(false)
    }
  })
})

describe('tabToHash / hashToTab', () => {
  it('maps tab ids to hashes and back', () => {
    expect(tabToHash('brands')).toBe('#/brands')
    expect(tabToHash('aesthetic:y2k')).toBe('#/aesthetic/y2k')
    expect(hashToTab('#/brands')).toBe('brands')
    expect(hashToTab('#/aesthetic/y2k')).toBe('aesthetic:y2k')
  })

  it('round-trips parameters that need encoding', () => {
    const tab = 'wardrobe-builder:type:wide-leg trousers|Pleated Wide Leg'
    expect(hashToTab(tabToHash(tab))).toBe(tab)
  })

  it('returns null for missing, unknown or malformed hashes', () => {
    expect(hashToTab('')).toBeNull()
    expect(hashToTab('#brands')).toBeNull()
    expect(hashToTab('#/definitely-not-a-tab')).toBeNull()
    expect(hashToTab('#/aesthetic/%E0%A4%A')).toBeNull()
  })
})
