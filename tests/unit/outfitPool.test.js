import { describe, it, expect } from 'vitest'
import { currentSeason, targetSeasons, outfitCandidates } from '../../src/services/outfitPool'

const item = (id, seasons = [], occasions = []) => ({ id, name: id, seasons, occasions })
const NOV = new Date(2026, 10, 13)

const closet = [
  item('summer-tee', ['summer']),
  item('summer-shorts', ['summer']),
  item('summer-sandals', ['summer']),
  item('winter-sweater', ['winter']),
  item('winter-trousers', ['winter']),
]
const ids = (items) => items.map((i) => i.id)

describe('currentSeason / targetSeasons', () => {
  it('maps months to seasons', () => {
    expect(currentSeason(NOV)).toBe('fall')
    expect(currentSeason(new Date(2026, 0, 1))).toBe('winter')
    expect(currentSeason(new Date(2026, 6, 1))).toBe('summer')
  })

  it('prefers the Settings seasons over the calendar season', () => {
    expect(targetSeasons(['summer'], NOV)).toEqual(['summer'])
    expect(targetSeasons([], NOV)).toEqual(['fall'])
    expect(targetSeasons(undefined, NOV)).toEqual(['fall'])
  })
})

describe('outfitCandidates', () => {
  it('keeps only items for the preferred seasons', () => {
    expect(ids(outfitCandidates(closet, { preferredSeasons: ['summer'], date: NOV })))
      .toEqual(['summer-tee', 'summer-shorts', 'summer-sandals'])
  })

  it('matches any of several preferred seasons, and keeps untagged items', () => {
    const withBasic = [...closet, item('basic-tee')]
    expect(ids(outfitCandidates(withBasic, { preferredSeasons: ['winter', 'spring'], date: NOV })))
      .toEqual(['winter-sweater', 'winter-trousers', 'basic-tee'])
  })

  it('uses the calendar season when no preference is set', () => {
    const c = [item('a', ['fall']), item('b', ['fall']), item('c'), item('d', ['summer'])]
    expect(ids(outfitCandidates(c, { date: NOV }))).toEqual(['a', 'b', 'c'])
  })

  it('falls back to the whole closet instead of sending too few items', () => {
    // No fall items at all: used to send an empty list to the AI.
    expect(ids(outfitCandidates(closet, { date: NOV }))).toEqual(ids(closet))
  })

  it('narrows to the occasion only when 5+ items fit it', () => {
    const c = [
      item('w1', [], ['work']), item('w2', [], ['work']), item('w3', [], ['work']),
      item('w4', [], ['work']), item('any'), item('gym', [], ['gym']),
    ]
    expect(ids(outfitCandidates(c, { occasion: 'work', date: NOV }))).toEqual(['w1', 'w2', 'w3', 'w4', 'any'])
    expect(ids(outfitCandidates(c, { occasion: 'gym', date: NOV }))).toEqual(ids(c))
  })
})
