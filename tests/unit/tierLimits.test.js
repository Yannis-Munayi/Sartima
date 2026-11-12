import { describe, it, expect } from 'vitest'
import { CLIENT_LIMITS, tierFromClaims, isAtLimitFor } from '../../src/services/tierLimits.js'

const NOW = new Date('2026-11-12T15:00:00Z')

describe('tierFromClaims', () => {
  it('maps custom claims to a tier, admin role winning', () => {
    expect(tierFromClaims({})).toBe('free')
    expect(tierFromClaims(undefined)).toBe('free')
    expect(tierFromClaims({ sartima_tier: 'pro' })).toBe('pro')
    expect(tierFromClaims({ sartima_tier: 'free' })).toBe('free')
    expect(tierFromClaims({ sartima_role: 'admin', sartima_tier: 'free' })).toBe('admin')
  })

  it("doesn't trust look-alike values", () => {
    expect(tierFromClaims({ sartima_tier: 'PRO' })).toBe('free')
    expect(tierFromClaims({ sartima_role: 'pro' })).toBe('free')
  })
})

describe('plan limits match the documented plans', () => {
  it('free: 15 closet items, 3 pins, 1 board, 1 outfit a day, no trips or try-ons', () => {
    expect(CLIENT_LIMITS.free).toMatchObject({
      closetItems: 15, aestheticPins: 3, outfitBoards: 1, outfitGenerations: 1, tripPlans: 0, tryOns: 0, visionUploads: 3,
    })
  })

  it('pro: 3 trips and 30 try-ons a month, everything else unlimited', () => {
    expect(CLIENT_LIMITS.pro).toMatchObject({ tripPlans: 3, tryOns: 30, visionUploads: 30, closetItems: Infinity, outfitBoards: Infinity })
  })
})

describe('isAtLimitFor', () => {
  const usage = (fields) => ({ periodKey: '2026-11', ...fields })

  it('monthly counters block at the limit', () => {
    expect(isAtLimitFor('free', usage({ visionUploads: 2 }), 'visionUploads', NOW)).toBe(false)
    expect(isAtLimitFor('free', usage({ visionUploads: 3 }), 'visionUploads', NOW)).toBe(true)
    expect(isAtLimitFor('pro', usage({ tripPlans: 3 }), 'tripPlans', NOW)).toBe(true)
    expect(isAtLimitFor('pro', usage({ tripPlans: 2 }), 'tripPlans', NOW)).toBe(false)
  })

  it('counters from last month count as zero', () => {
    expect(isAtLimitFor('free', { periodKey: '2026-10', visionUploads: 3 }, 'visionUploads', NOW)).toBe(false)
    expect(isAtLimitFor('pro', { periodKey: '2026-10', tripPlans: 3 }, 'tripPlans', NOW)).toBe(false)
  })

  it('a zero allowance is always at the limit (free trips and try-ons)', () => {
    expect(isAtLimitFor('free', {}, 'tripPlans', NOW)).toBe(true)
    expect(isAtLimitFor('free', {}, 'tryOns', NOW)).toBe(true)
  })

  it('free users get one outfit generation per UTC day', () => {
    expect(isAtLimitFor('free', {}, 'outfitGenerations', NOW)).toBe(false)
    expect(isAtLimitFor('free', { lastOutfitDate: '2026-11-11' }, 'outfitGenerations', NOW)).toBe(false)
    expect(isAtLimitFor('free', { lastOutfitDate: '2026-11-12' }, 'outfitGenerations', NOW)).toBe(true)
  })

  it('pro and admin are never limited on unlimited features', () => {
    expect(isAtLimitFor('pro', { lastOutfitDate: '2026-11-12' }, 'outfitGenerations', NOW)).toBe(false)
    expect(isAtLimitFor('admin', usage({ tripPlans: 999, tryOns: 999 }), 'tripPlans', NOW)).toBe(false)
    expect(isAtLimitFor('admin', {}, 'tryOns', NOW)).toBe(false)
  })

  it('unknown features and tiers fail safe', () => {
    expect(isAtLimitFor('free', {}, 'teleport', NOW)).toBe(false)
    expect(isAtLimitFor('mystery', usage({ visionUploads: 3 }), 'visionUploads', NOW)).toBe(true) // treated as free
    expect(isAtLimitFor('free', undefined, 'visionUploads', NOW)).toBe(false)
  })
})
