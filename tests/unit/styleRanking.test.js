import { describe, it, expect } from 'vitest'
import {
  normalizeAffinities, blendStyleAffinities, productAffinity, sortByScore, splitByMatch,
  scoreBrands, makeFacetRanker, buildSearchSuggestions, titleCase,
} from '../../src/services/styleRanking.js'
import { BRANDS } from '../../src/data/brands.js'

describe('normalizeAffinities', () => {
  it('scales to 0–1 against the strongest entry', () => {
    expect(normalizeAffinities({ a: 10, b: 5, c: 2.5 })).toEqual({ a: 1, b: 0.5, c: 0.25 })
  })

  it('drops non-positive and non-numeric values', () => {
    expect(normalizeAffinities({ a: 4, b: 0, c: -3, d: NaN, e: 'x', f: Infinity })).toEqual({ a: 1 })
    expect(normalizeAffinities(null)).toEqual({})
    expect(normalizeAffinities({ a: -1 })).toEqual({})
  })
})

describe('blendStyleAffinities', () => {
  it('a fresh quiz and a long history both count, neither drowning the other', () => {
    const blended = blendStyleAffinities({ y2k: 3 }, { oldmoney: 900, y2k: 90 })
    expect(blended.y2k).toBe(1)          // 1 (quiz) + 0.1 (history)
    expect(blended.oldmoney).toBeCloseTo(1 / 1.1)
  })

  it('works with either source missing', () => {
    expect(blendStyleAffinities(null, { a: 2 })).toEqual({ a: 1 })
    expect(blendStyleAffinities({ a: 2 }, undefined)).toEqual({ a: 1 })
    expect(blendStyleAffinities({}, {})).toEqual({})
  })
})

describe('productAffinity / sortByScore / splitByMatch', () => {
  it('weights each style the product carries by the user affinity', () => {
    expect(productAffinity({ styleWeights: { a: 4, b: 2 } }, { a: 0.5, b: 1 })).toBe(4)
    expect(productAffinity({}, { a: 1 })).toBe(0)
  })

  it('sorts strongest first and keeps ties in their original order', () => {
    const items = [{ id: 'x', s: 1 }, { id: 'y', s: 3 }, { id: 'z', s: 1 }, { id: 'w', s: 2 }]
    expect(sortByScore(items, (i) => i.s).map((i) => i.id)).toEqual(['y', 'w', 'x', 'z'])
  })

  it('splits into close matches and the rest, both ranked', () => {
    const items = [{ s: 0.1 }, { s: 0.9 }, { s: 0.5 }, { s: 0.2 }]
    const { matches, rest } = splitByMatch(items, (i) => i.s, 0.4)
    expect(matches.map((i) => i.s)).toEqual([0.9, 0.5])
    expect(rest.map((i) => i.s)).toEqual([0.2, 0.1])
  })
})

describe('scoreBrands', () => {
  const brands = [
    { id: 'a', aesthetics: ['oldmoney'] },
    { id: 'b', aesthetics: ['streetwear', 'y2k', 'grunge', 'punk'] },
    { id: 'c', aesthetics: ['boho'] },
  ]

  it('a brand that nails the top aesthetic beats one that brushes many', () => {
    const scores = scoreBrands(brands, { oldmoney: 1, streetwear: 0.4, y2k: 0.4, grunge: 0.4, punk: 0.4 }, {})
    expect(scores.a).toBe(1)
    expect(scores.b).toBeLessThan(1)
    expect(scores.c ?? 0).toBe(0)
  })

  it('returns {} with no signal at all', () => {
    expect(scoreBrands(brands, {}, {})).toEqual({})
  })

  it('liked brands and visits nudge a brand up without outranking the aesthetic fit', () => {
    const real = Object.values(BRANDS).slice(0, 3)
    const [fit, liked, visited] = real
    const affinity = Object.fromEntries((fit.aesthetics ?? []).map((a) => [a, 1]))
    // Make sure only `fit` matches by aesthetic
    const list = [
      { ...fit },
      { ...liked, aesthetics: ['zz-none'] },
      { ...visited, aesthetics: ['zz-none'] },
    ]
    const scores = scoreBrands(list, affinity, {
      brandAffinities: { [liked.name]: 5 },
      brandVisits: { [visited.id]: 3 },
    })
    expect(scores[fit.id]).toBe(1)
    expect(scores[liked.id]).toBeCloseTo(0.4)
    expect(scores[visited.id]).toBeCloseTo(0.2)
  })
})

describe('makeFacetRanker / buildSearchSuggestions', () => {
  // 120 products: "camel" coats carry oldmoney; black is everywhere
  function catalog() {
    const out = []
    for (let i = 0; i < 120; i++) {
      const old = i % 3 === 0
      out.push({
        id: `p${i}`,
        brand: old ? (i % 2 ? 'Heritage Co' : 'Loro Fake') : `Street${i % 6}`,
        type: old ? 'overcoat' : (i % 2 ? 'hoodie' : 'cargo-pants'),
        color: old ? 'camel' : (i % 2 ? 'black' : 'mid grey'),
        colorHex: old ? '#C19A6B' : '#111111',
        styleWeights: old ? { oldmoney: 5 } : { streetwear: 5 },
      })
    }
    // a few black oldmoney pieces so "black" is aligned but not over-represented
    for (let i = 0; i < 6; i++) out.push({ id: `b${i}`, brand: 'Heritage Co', type: 'overcoat', color: 'black', styleWeights: { oldmoney: 2 } })
    return out
  }

  it('returns null without a style signal', () => {
    expect(makeFacetRanker(catalog(), {}, {})).toBeNull()
    expect(buildSearchSuggestions(catalog(), {}, {})).toBeNull()
  })

  it('surfaces the values that define the style, over-represented ones first', () => {
    const top = makeFacetRanker(catalog(), { oldmoney: 1 }, {})
    expect(top('color', 2)[0]).toBe('camel')
    expect(top('type', 3)).toEqual(['overcoat'])
    expect(top('brand', 2)).toEqual(expect.arrayContaining(['Heritage Co', 'Loro Fake']))
  })

  it('leaves out values too thin in the catalog to give a real results page', () => {
    const top = makeFacetRanker(catalog(), { streetwear: 1 }, {})
    // Each "StreetN" brand has 13–14 products (≥5) so they qualify; colours need 12+
    expect(top('brand', 10).every((b) => b.startsWith('Street'))).toBe(true)
  })

  it('the interest graph boosts a facet value', () => {
    const ranked = makeFacetRanker(catalog(), { oldmoney: 1, streetwear: 1 }, { typeAffinities: { hoodie: 50 } })('type', 1)
    expect(ranked).toEqual(['hoodie'])
  })

  it('builds Brands / Pieces / Colors chips with title case and swatches', () => {
    const s = buildSearchSuggestions(catalog(), { oldmoney: 1 }, {}, 2)
    expect(s.pieces[0]).toEqual({ label: 'Overcoat' })
    expect(s.colors[0]).toEqual({ label: 'Camel', hex: '#C19A6B' })
    expect(s.brands.length).toBeGreaterThan(0)
  })

  it('titleCase turns catalog slugs into labels', () => {
    expect(titleCase('wide-leg-trousers')).toBe('Wide Leg Trousers')
  })
})
