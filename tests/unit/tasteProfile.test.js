// Sartima ⇄ taste model wiring, against the real catalog.
import { describe, it, expect } from 'vitest'
import { getTasteModel, applySignals, loadTasteProfile, tasteCloset, createSession } from '../../src/services/tasteProfile.js'
import { createProfile } from '../../src/services/tasteModel.js'
import { PRODUCTS } from '../../src/data/products.js'
import { STYLES } from '../../src/data/styles.js'

const T0 = Date.UTC(2026, 10, 1)
const product = PRODUCTS.find((p) => Object.keys(p.styleWeights ?? {}).length)
const mainStyle = Object.entries(product.styleWeights).sort((a, b) => b[1] - a[1])[0][0]

describe('getTasteModel', () => {
  it('builds one shared model over the whole catalog', () => {
    const m = getTasteModel()
    expect(getTasteModel()).toBe(m)
    expect(m.items.length).toBeGreaterThan(5000)
    expect(m.aesthetics).toEqual(Object.keys(STYLES))
  })

  it('gives every catalog item a numeric price from its tier', () => {
    const m = getTasteModel()
    const priced = m.items.filter((p) => p.priceRange)
    expect(priced.every((p) => Number.isFinite(p.price) && p.price > 0)).toBe(true)
  })
})

describe('applySignals', () => {
  it('turns tracker signals into model events', () => {
    const p = createProfile(T0)
    applySignals(p, [{ type: 'like', ts: T0, productId: product.id }])
    expect(getTasteModel().aestheticAffinity(p, null, T0)[mainStyle]).toBeGreaterThan(0)
  })

  it('maps pins, brand favourites and quiz results', () => {
    const p = createProfile(T0)
    const [a, b] = Object.keys(STYLES)
    applySignals(p, [
      { type: 'aestheticPin', ts: T0, aestheticId: a },
      { type: 'brandFavorite', ts: T0, brandName: 'Stussy' },
      { type: 'quizComplete', ts: T0, styleScores: { [b]: 30, [a]: 10, notastyle: 99 } },
    ])
    expect(p.aes[a].v).toBeGreaterThan(0)
    expect(p.brand.Stussy.pos).toBeGreaterThan(0)
    expect(p.quiz).toEqual({ [b]: 75, [a]: 25 })
  })

  it('ignores signals the model has no use for', () => {
    const p = createProfile(T0)
    applySignals(p, [
      { type: 'brandVisit', ts: T0, brandId: 'x' },
      { type: 'like', ts: T0 },                              // no product id
      { type: 'quizComplete', ts: T0, styleScores: {} },
    ])
    expect(p).toEqual(createProfile(T0))
  })

  it('feeds the session layer when given one', () => {
    const p = createProfile(T0), s = createSession(T0)
    applySignals(p, [{ type: 'save', ts: T0, productId: product.id }], s)
    expect(s.events).toBe(1)
    expect(s.aes[mainStyle].v).toBeGreaterThan(0)
  })
})

describe('loadTasteProfile', () => {
  it('returns a copy of a saved v1 profile', () => {
    const saved = createProfile(T0)
    saved.evidence = 12
    const loaded = loadTasteProfile({ taste: saved })
    expect(loaded).toEqual(saved)
    expect(loaded).not.toBe(saved)
  })

  it('seeds accounts from before the taste model from their legacy tallies', () => {
    const [a] = Object.keys(STYLES)
    const p = loadTasteProfile({ styleAffinities: { [a]: 40 } }, T0)
    expect(p.quiz).toEqual({ [a]: 100 })
    expect(p.aes[a].v).toBeGreaterThan(0)
  })

  it('starts empty for brand-new accounts', () => {
    const p = loadTasteProfile(null, T0)
    expect(p.evidence).toBe(0)
    expect(p.aes).toEqual({})
  })
})

describe('tasteCloset', () => {
  it('keeps catalog closet items and spreads gaps over the category types', () => {
    const shoe = PRODUCTS.find((p) => p.parentType === 'footwear')
    const ctx = tasteCloset([{ id: shoe.id }, { id: 'upload_123' }], [{ category: 'bottoms', deficit: 2 }])
    expect(ctx.items).toEqual([{ id: shoe.id, type: shoe.type, color: shoe.color }])
    const bottomTypes = new Set(PRODUCTS.filter((p) => p.parentType === 'bottoms').map((p) => p.type))
    expect(Object.keys(ctx.gaps).length).toBe(bottomTypes.size)
    expect(Object.values(ctx.gaps).every((v) => v === 2)).toBe(true)
  })

  it('handles an empty closet', () => {
    expect(tasteCloset(undefined, undefined)).toEqual({ items: [], gaps: {} })
  })
})
