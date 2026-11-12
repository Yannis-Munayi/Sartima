import { describe, it, expect, vi } from 'vitest'
import { createBoundedCache } from '../../src/services/cache.js'
import { shuffle } from '../../src/services/shuffle.js'

describe('createBoundedCache', () => {
  it('stores and returns values', () => {
    const c = createBoundedCache(3)
    c.set('a', 1)
    expect(c.has('a')).toBe(true)
    expect(c.get('a')).toBe(1)
    expect(c.get('zz')).toBeUndefined()
  })

  it('evicts the oldest entry once over capacity', () => {
    const c = createBoundedCache(2)
    c.set('a', 1); c.set('b', 2); c.set('c', 3)
    expect(c.has('a')).toBe(false)
    expect(c.has('b')).toBe(true)
    expect(c.has('c')).toBe(true)
  })
})

describe('shuffle', () => {
  it('returns a permutation and leaves the input untouched', () => {
    const input = [1, 2, 3, 4, 5]
    const out = shuffle(input)
    expect(input).toEqual([1, 2, 3, 4, 5])
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('is unbiased: every position is equally likely', () => {
    const counts = Array.from({ length: 4 }, () => [0, 0, 0, 0])
    for (let n = 0; n < 8000; n++) shuffle([0, 1, 2, 3]).forEach((v, i) => counts[i][v]++)
    for (const row of counts) for (const c of row) expect(c).toBeGreaterThan(1700) // expected 2000
  })

  it('uses Math.random (Fisher–Yates swaps)', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(shuffle([1, 2, 3])).toEqual([2, 3, 1])
    spy.mockRestore()
  })
})
