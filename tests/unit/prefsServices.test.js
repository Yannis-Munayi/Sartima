// Small Firestore-backed services, with Firebase replaced by an in-memory
// store: gap dismissals (14-day snooze), the monthly recap flag, AI gap
// signals, and the sign-up email check (fails open).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const store = new Map()
const failNext = { get: false, set: false }
const callable = vi.fn()

vi.mock('../../src/services/firebase', () => ({ db: {}, functions: {} }))
vi.mock('../../src/services/logger', () => ({ logError: vi.fn(), logWarn: vi.fn() }))
vi.mock('firebase/functions', () => ({ httpsCallable: () => callable }))
vi.mock('firebase/firestore', () => {
  const path = (ref) => ref.path
  return {
    doc: (_db, ...segments) => ({ path: segments.join('/') }),
    increment: (n) => ({ __inc: n }),
    serverTimestamp: () => 'SERVER_TS',
    getDoc: vi.fn(async (ref) => {
      if (failNext.get) { failNext.get = false; throw new Error('offline') }
      const data = store.get(path(ref))
      return { exists: () => data !== undefined, data: () => data }
    }),
    setDoc: vi.fn(async (ref, data) => {
      if (failNext.set) { failNext.set = false; throw new Error('denied') }
      const prev = store.get(path(ref)) ?? {}
      const next = { ...prev }
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === 'object' && v.count?.__inc) {
          next[k] = { ...v, count: (prev[k]?.count ?? 0) + v.count.__inc }
        } else next[k] = v
      }
      store.set(path(ref), next)
    }),
  }
})

const { dismissGap, loadDismissedCategories } = await import('../../src/services/gapDismissals.js')
const { hasSeenRecapThisMonth, markRecapSeen } = await import('../../src/services/recapSeen.js')
const { recordGapSignal, loadGapSignals } = await import('../../src/services/gapSignals.js')
const { validateSignupEmail } = await import('../../src/services/emailValidation.js')

const DAY = 86_400_000

beforeEach(() => {
  store.clear()
  failNext.get = failNext.set = false
  callable.mockReset()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-12T12:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('gap dismissals (14-day snooze)', () => {
  it('a dismissed category stays hidden for 14 days, then comes back', async () => {
    await dismissGap('u1', 'bottoms')
    expect(await loadDismissedCategories('u1')).toEqual(new Set(['bottoms']))
    vi.setSystemTime(Date.now() + 13 * DAY)
    expect((await loadDismissedCategories('u1')).has('bottoms')).toBe(true)
    vi.setSystemTime(Date.now() + 2 * DAY)
    expect((await loadDismissedCategories('u1')).has('bottoms')).toBe(false)
  })

  it('snoozes per category', async () => {
    await dismissGap('u1', 'tops')
    expect((await loadDismissedCategories('u1')).has('footwear')).toBe(false)
  })

  it('without a user, or when Firestore fails, nothing is snoozed and nothing throws', async () => {
    expect(await loadDismissedCategories(null)).toEqual(new Set())
    await expect(dismissGap(null, 'tops')).resolves.toBeUndefined()
    failNext.get = true
    expect(await loadDismissedCategories('u1')).toEqual(new Set())
    failNext.set = true
    await expect(dismissGap('u1', 'tops')).resolves.toBeUndefined()
  })
})

describe('recap seen (once a month)', () => {
  it('shows the recap until it is marked seen this month', async () => {
    expect(await hasSeenRecapThisMonth('u1')).toBe(false)
    await markRecapSeen('u1')
    expect(await hasSeenRecapThisMonth('u1')).toBe(true)
    vi.setSystemTime(new Date('2026-12-01T00:00:01Z'))
    expect(await hasSeenRecapThisMonth('u1')).toBe(false)
  })

  it('fails closed (does not nag) when the state cannot be read', async () => {
    failNext.get = true
    expect(await hasSeenRecapThisMonth('u1')).toBe(true)
    expect(await hasSeenRecapThisMonth(null)).toBe(true)
  })
})

describe('gap signals (AI missingCategory)', () => {
  it('counts each signal per category', async () => {
    await recordGapSignal('u1', 'bottoms')
    await recordGapSignal('u1', 'bottoms')
    await recordGapSignal('u1', 'footwear')
    expect(await loadGapSignals('u1')).toEqual({ bottoms: 2, footwear: 1 })
  })

  it('ignores calls without a user or category, and survives failures', async () => {
    await recordGapSignal(null, 'tops')
    await recordGapSignal('u1', null)
    expect(store.size).toBe(0)
    failNext.get = true
    expect(await loadGapSignals('u1')).toEqual({})
  })
})

describe('validateSignupEmail', () => {
  it('passes a valid address and offers typo suggestions', async () => {
    callable.mockResolvedValueOnce({ data: { valid: true, suggestion: 'you@gmail.com' } })
    expect(await validateSignupEmail('you@gmial.com')).toEqual({ error: null, suggestion: 'you@gmail.com' })
  })

  it('maps each rejection reason to user-facing copy', async () => {
    callable.mockResolvedValueOnce({ data: { valid: false, reason: 'disposable' } })
    expect((await validateSignupEmail('x@mailinator.com')).error).toMatch(/throwaway/)
    callable.mockResolvedValueOnce({ data: { valid: false, reason: 'syntax' } })
    expect((await validateSignupEmail('nope')).error).toMatch(/valid email/)
    callable.mockResolvedValueOnce({ data: { valid: false, reason: 'something-new' } })
    expect((await validateSignupEmail('x@y.zz')).error).toMatch(/can't receive email/)
  })

  it('fails open when the check itself cannot run', async () => {
    callable.mockRejectedValueOnce(Object.assign(new Error('unavailable'), { code: 'functions/unavailable' }))
    expect(await validateSignupEmail('real@person.com')).toEqual({ error: null, suggestion: null })
  })
})
