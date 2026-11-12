import { describe, it, expect, vi } from 'vitest'
import { computeClosetGaps } from '../../src/services/closetGaps.js'
import { computeWardrobeRecap, RECAP_DAYS } from '../../src/services/wardrobeRecap.js'
import { recordWear } from '../../src/services/wearTracking.js'
import { CAPSULE_BASELINE } from '../../src/data/capsuleBaseline.js'

const items = (n, category) => Array.from({ length: n }, (_, i) => ({ id: `${category}${i}`, category }))

describe('computeClosetGaps (Home bell "You\'re light on…")', () => {
  it('an empty closet is short of every baseline category, biggest gap first', () => {
    const gaps = computeClosetGaps({})
    expect(gaps.map((g) => g.category)).toEqual(['tops', 'bottoms', 'footwear', 'accessories', 'outerwear'])
    expect(gaps[0]).toEqual({ category: 'tops', owned: 0, target: 5, deficit: 5 })
  })

  it('a closet that meets the baseline has no gaps', () => {
    const full = Object.fromEntries(Object.entries(CAPSULE_BASELINE).map(([c, n]) => [c, items(n, c)]))
    expect(computeClosetGaps(full)).toEqual([])
  })

  it('never flags dresses (a preference, not a staple)', () => {
    expect(computeClosetGaps({}).some((g) => g.category === 'dresses')).toBe(false)
  })

  it('owning more than the target never makes a negative deficit', () => {
    const gaps = computeClosetGaps({ tops: items(12, 'tops') })
    expect(gaps.find((g) => g.category === 'tops')).toBeUndefined()
  })

  it('AI "missingCategory" signals bump a category, even one that meets its target', () => {
    const closet = { tops: items(5, 'tops'), bottoms: items(1, 'bottoms') }
    const gaps = computeClosetGaps(closet, { tops: 4 })
    expect(gaps[0]).toEqual({ category: 'tops', owned: 5, target: 5, deficit: 4 })
    expect(gaps.find((g) => g.category === 'bottoms').deficit).toBe(2)
  })
})

describe('computeWardrobeRecap (monthly recap card)', () => {
  const NOW = Date.UTC(2026, 10, 12)
  const day = (n) => new Date(NOW - n * 86_400_000).toISOString().slice(0, 10)
  const closet = [
    { id: 'tee', name: 'White tee' }, { id: 'jeans', name: 'Jeans' },
    { id: 'boots', name: 'Boots' }, { id: 'coat', name: 'Coat' },
  ]

  it('finds the most-worn item, the closet ghosts and the repeat rate', () => {
    const log = [
      { date: day(1), itemIds: ['tee', 'jeans'] },
      { date: day(3), itemIds: ['tee', 'boots'] },
      { date: day(5), itemIds: ['tee', 'jeans'] },
    ]
    const recap = computeWardrobeRecap(closet, log, NOW)
    expect(recap.mostWornItem.id).toBe('tee')
    expect(recap.mostWornCount).toBe(3)
    expect(recap.outfitsLogged).toBe(3)
    expect(recap.uniqueItemsWorn).toBe(3)
    expect(recap.ghostItems.map((i) => i.id)).toEqual(['coat'])
    expect(recap.ghostCount).toBe(1)
    // 6 wear events, 3 distinct items → 50% repeats
    expect(recap.repeatRate).toBe(50)
    expect(recap.periodDays).toBe(RECAP_DAYS)
  })

  it('ignores outfits logged more than 30 days ago and bad dates', () => {
    const log = [
      { date: day(40), itemIds: ['coat'] },
      { date: 'not a date', itemIds: ['boots'] },
      { date: day(2), itemIds: ['jeans'] },
    ]
    const recap = computeWardrobeRecap(closet, log, NOW)
    expect(recap.outfitsLogged).toBe(1)
    expect(recap.ghostItems.map((i) => i.id)).toContain('coat')
  })

  it('handles an empty log', () => {
    const recap = computeWardrobeRecap(closet, [], NOW)
    expect(recap).toMatchObject({ outfitsLogged: 0, mostWornItem: null, mostWornCount: 0, repeatRate: 0, ghostCount: 4 })
  })

  it('caps the ghost preview at 6 but counts them all', () => {
    const big = Array.from({ length: 9 }, (_, i) => ({ id: `i${i}` }))
    const recap = computeWardrobeRecap(big, [], NOW)
    expect(recap.ghostItems).toHaveLength(6)
    expect(recap.ghostCount).toBe(9)
  })

  it('a worn item that has since left the closet is not reported as most-worn', () => {
    const recap = computeWardrobeRecap(closet, [{ date: day(1), itemIds: ['sold'] }, { date: day(2), itemIds: ['sold'] }], NOW)
    expect(recap.mostWornItem).toBeNull()
    expect(recap.mostWornCount).toBe(2)
  })
})

describe('recordWear (logging an outfit)', () => {
  it('bumps timesWorn and sets lastWorn on closet items only', () => {
    const update = vi.fn()
    recordWear([{ id: 'a', timesWorn: 2 }, { id: 'b' }], ['a', 'b', 'liked-only'], update, '2026-11-12')
    expect(update).toHaveBeenCalledTimes(2)
    expect(update).toHaveBeenCalledWith('a', { timesWorn: 3, lastWorn: '2026-11-12' })
    expect(update).toHaveBeenCalledWith('b', { timesWorn: 1, lastWorn: '2026-11-12' })
  })

  it('does nothing without item ids', () => {
    const update = vi.fn()
    recordWear([{ id: 'a' }], [], update, '2026-11-12')
    recordWear([{ id: 'a' }], undefined, update, '2026-11-12')
    expect(update).not.toHaveBeenCalled()
  })
})
