// Shop Scout recommendations, against the real catalog.
import { describe, it, expect } from 'vitest'
import {
  PIECE_OPTIONS, PIECE_BY_ID, getPieceOption, recommendProducts, findComplements, countOutfits,
  matchesScoutGender, gapPieceOption, drawnPieceOptions, GAP_PIECE_FOR_CATEGORY, STARTER_CAPSULE,
  BUDGET_TIERS, PRIORITIES,
} from '../../src/services/wardrobeRecommend.js'
import { PRODUCTS } from '../../src/data/products.js'

const types = new Set(PRODUCTS.map((p) => p.type))

describe('wizard options', () => {
  it('every basic piece maps to at least one real catalog type', () => {
    for (const piece of PIECE_OPTIONS) {
      expect(piece.productTypes.some((t) => types.has(t)), piece.id).toBe(true)
    }
  })

  it('the starter capsule and gap fallbacks are real pieces', () => {
    for (const id of STARTER_CAPSULE) expect(PIECE_BY_ID[id], id).toBeDefined()
    for (const id of Object.values(GAP_PIECE_FOR_CATEGORY).filter(Boolean)) expect(PIECE_BY_ID[id], id).toBeDefined()
  })

  it('has the five budget tiers and the priority list', () => {
    expect(BUDGET_TIERS.map((t) => t.id)).toEqual(['any', 'budget', 'mid', 'premium', 'luxury'])
    expect(PRIORITIES.map((p) => p.id)).toContain('affordable')
  })
})

describe('getPieceOption', () => {
  it('resolves basic pieces and personal type: pieces', () => {
    expect(getPieceOption('plain-tee')).toBe(PIECE_BY_ID['plain-tee'])
    const someType = [...types].find((t) => !PIECE_OPTIONS.some((p) => p.productTypes.includes(t)))
    const personal = getPieceOption(`type:${someType}`)
    expect(personal).toMatchObject({ id: `type:${someType}`, productTypes: [someType], personal: true })
    expect(getPieceOption(`type:${someType}`)).toBe(personal) // cached
  })

  it('returns null for unknown ids', () => {
    expect(getPieceOption('nope')).toBeNull()
    expect(getPieceOption('type:not-a-type')).toBeNull()
    expect(getPieceOption(undefined)).toBeNull()
  })
})

describe('matchesScoutGender', () => {
  it('unisex and "both" see everything; men/women see their own', () => {
    expect(matchesScoutGender({ gender: 'unisex' }, 'men')).toBe(true)
    expect(matchesScoutGender({ gender: 'women' }, 'both')).toBe(true)
    expect(matchesScoutGender({ gender: 'mens' }, 'men')).toBe(true)
    expect(matchesScoutGender({ gender: 'womens' }, 'women')).toBe(true)
    expect(matchesScoutGender({ gender: 'women' }, 'men')).toBe(false)
    expect(matchesScoutGender({ gender: 'men' }, 'women')).toBe(false)
  })
})

describe('recommendProducts', () => {
  const tee = PIECE_BY_ID['plain-tee']

  it('returns only the chosen piece type, for the chosen gender', () => {
    const { primary } = recommendProducts(tee, 'any', [], 'women', {}, 20)
    expect(primary.length).toBeGreaterThan(0)
    for (const p of primary) {
      expect(tee.productTypes).toContain(p.type)
      expect(matchesScoutGender(p, 'women')).toBe(true)
    }
  })

  it('respects the result count', () => {
    expect(recommendProducts(tee, 'any', [], 'both', {}, 5).primary).toHaveLength(5)
  })

  it('only recommends products in the chosen budget tier', () => {
    // Priorities that favour pricey pieces must not pull them past the budget
    const { primary, outOfFilter } = recommendProducts(tee, 'budget', ['brand', 'versatile'], 'both', {}, 50)
    expect(primary.length).toBeGreaterThan(0)
    for (const p of primary) expect(p.priceRange ?? 'budget').toBe('budget')
    expect(outOfFilter).toHaveLength(0)
  })

  it('offers out-of-budget options behind a notice when nothing fits the budget', () => {
    // Find a piece + tier the catalog has nothing for (e.g. boots under $50)
    let gap = null
    for (const piece of PIECE_OPTIONS) {
      const tiers = new Set(recommendProducts(piece, 'any', [], 'both', {}, 1000).primary.map((p) => p.priceRange))
      const tier = ['budget', 'mid', 'premium', 'luxury'].find((t) => !tiers.has(t))
      if (tier) { gap = { piece, tier }; break }
    }
    expect(gap, 'the catalog has some piece missing a budget tier').not.toBeNull()
    const res = recommendProducts(gap.piece, gap.tier, [], 'both', {}, 10)
    expect(res.primary).toHaveLength(0)
    expect(res.outOfFilter.length).toBeGreaterThan(0)
    expect(res.filterMismatch).toMatch(/priced/)
  })

  it('a colour filter lifts that colour to the top', () => {
    const { primary } = recommendProducts(tee, 'any', [], 'both', { color: 'Black' }, 5)
    expect(primary[0].color.toLowerCase()).toContain('black')
  })

  it('style affinity reorders results toward the user taste', () => {
    const boots = PIECE_BY_ID.boots
    const plain = recommendProducts(boots, 'any', [], 'both', {}, 3).primary
    const style = Object.keys(plain.at(-1).styleWeights ?? {})[0]
    if (!style) return
    const tuned = recommendProducts(boots, 'any', [], 'both', {}, 3, null, { [style]: 10 }).primary
    expect(tuned[0].styleWeights[style]).toBeGreaterThan(0)
  })

  it('a specific item name splits exact matches from suggestions and applies hard filters', () => {
    const res = recommendProducts(tee, 'any', [], 'both', {}, 10, 'pocket tee')
    for (const p of res.primary) expect(p.name.toLowerCase()).toMatch(/pocket/)
    for (const p of res.suggested) expect(p.name.toLowerCase()).not.toMatch(/pocket.*tee|tee.*pocket/)
    expect(res.specificName).toBe('pocket tee')
  })

  it('explains when filters remove every specific match', () => {
    const res = recommendProducts(tee, 'luxury', [], 'both', { color: 'chartreuse-zz' }, 10, 'tee')
    expect(res.primary).toHaveLength(0)
    expect(res.outOfFilter.length).toBeGreaterThan(0)
    expect(res.filterMismatch).toMatch(/available in|priced/)
  })

  it('falls back to the parent category when a type has no products', () => {
    const fake = { id: 'x', productTypes: ['no-such-type'], parentType: 'footwear', role: 'shoes' }
    const { primary } = recommendProducts(fake, 'any', [], 'both', {}, 5)
    expect(primary.length).toBeGreaterThan(0)
    for (const p of primary) expect(p.parentType).toBe('footwear')
  })
})

describe('findComplements', () => {
  it('suggests up to 4 other basic pieces seen with the selection in looks', () => {
    const picks = findComplements(['plain-tee', 'slim-jeans', 'clean-sneakers'])
    expect(picks.length).toBeLessThanOrEqual(4)
    for (const id of picks) {
      expect(PIECE_BY_ID[id]).toBeDefined()
      expect(['plain-tee', 'slim-jeans', 'clean-sneakers']).not.toContain(id)
    }
  })

  it('needs at least two selected pieces to find a look', () => {
    expect(findComplements([])).toEqual([])
    expect(findComplements(['plain-tee'])).toEqual([])
  })
})

describe('countOutfits', () => {
  it('multiplies tops × bottoms × shoes, with outerwear adding half each', () => {
    expect(countOutfits(['plain-tee', 'graphic-tee', 'slim-jeans', 'clean-sneakers'])).toBe(2)
    expect(countOutfits(['plain-tee', 'graphic-tee', 'slim-jeans', 'clean-sneakers', 'bomber'])).toBe(3)
    expect(countOutfits(STARTER_CAPSULE)).toBe(3) // tee+hoodie, jeans, sneakers, bomber
  })

  it('counts at least one outfit for any selection', () => {
    expect(countOutfits([])).toBe(1)
  })
})

describe('gap pieces (Home bell → Shop Scout)', () => {
  it('falls back to the basic piece with no style signal', () => {
    expect(gapPieceOption('bottoms', {}, {}, 'both')).toBe(PIECE_BY_ID['slim-jeans'])
    expect(gapPieceOption('footwear', {}, {}, 'both')).toBe(PIECE_BY_ID['clean-sneakers'])
  })

  it('has no piece for accessories or unknown categories', () => {
    expect(gapPieceOption('accessories', {}, {}, 'both')).toBeNull()
    expect(gapPieceOption('nonsense', {}, {}, 'both')).toBeNull()
  })

  it('picks a style-fit piece in the right category that the closet lacks', () => {
    const style = Object.keys(PRODUCTS.find((p) => p.parentType === 'footwear' && p.styleWeights)?.styleWeights ?? {})[0]
    const piece = gapPieceOption('footwear', { [style]: 1 }, {}, 'both')
    expect(piece.parentType).toBe('footwear')
    const owned = piece.productTypes.map((t) => t.replace(/-/g, ' '))
    const next = gapPieceOption('footwear', { [style]: 1 }, {}, 'both', owned)
    expect(next).not.toBe(piece)
  })

  it('drawnPieceOptions is empty without a signal and returns distinct pieces with one', () => {
    expect(drawnPieceOptions({}, {}, 'both')).toEqual([])
    const style = Object.keys(PRODUCTS[0].styleWeights ?? {})[0]
    const picks = drawnPieceOptions({ [style]: 1 }, {}, 'both', 4)
    expect(picks.length).toBeGreaterThan(0)
    expect(picks.length).toBeLessThanOrEqual(4)
    expect(new Set(picks.map((p) => p.id)).size).toBe(picks.length)
    for (const p of picks) expect(p.parentType).not.toBe('accessories')
  })
})
