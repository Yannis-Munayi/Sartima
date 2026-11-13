import { describe, it, expect } from 'vitest'
import { discoveryFilter, matchesCategory, matchesSeasons } from '../../src/services/discoveryFilter.js'
import { PRODUCTS } from '../../src/data/products.js'

const sneaker = { id: 's', type: 'sneaker', parentType: 'footwear', seasons: ['spring', 'summer'] }
const boot    = { id: 'b', type: 'boot',    parentType: 'footwear', seasons: ['fall', 'winter'] }
const coat    = { id: 'c', type: 'coat',    parentType: 'outerwear', seasons: ['winter'] }
const blazer  = { id: 'z', type: 'blazer',  parentType: 'outerwear', seasons: ['spring', 'fall'] }
const untagged = { id: 'u', type: 'tee',    parentType: 'tops' }
const ALL = [sneaker, boot, coat, blazer, untagged]

const pick = (products, filters) => products.filter(discoveryFilter(products, filters))

describe('discoveryFilter', () => {
  it('passes everything when nothing is picked', () => {
    expect(pick(ALL, {})).toEqual(ALL)
    expect(pick(ALL, { categories: [], seasons: [] })).toEqual(ALL)
  })

  it('keeps only the picked categories and seasons', () => {
    expect(pick(ALL, { categories: ['footwear'], seasons: ['winter'] })).toEqual([boot])
    expect(pick(ALL, { categories: ['footwear'] })).toEqual([sneaker, boot])
    expect(pick(ALL, { seasons: ['winter'] })).toEqual([boot, coat, untagged])
  })

  it('matches formalwear by garment type, not parentType', () => {
    expect(matchesCategory(blazer, 'formalwear')).toBe(true)
    expect(matchesCategory(coat, 'formalwear')).toBe(false)
    expect(pick(ALL, { categories: ['formalwear'] })).toEqual([blazer])
  })

  it('treats untagged products as all-season', () => {
    expect(matchesSeasons(untagged, ['summer'])).toBe(true)
  })

  it('drops the seasons rather than emptying the feed', () => {
    expect(pick(ALL, { categories: ['formalwear'], seasons: ['winter'] })).toEqual([blazer])
  })

  it('falls back to seasons alone when the categories match nothing', () => {
    expect(pick(ALL, { categories: ['swimwear'], seasons: ['summer'] })).toEqual([sneaker, untagged])
  })

  it('finds winter footwear and every setup-screen category in the real catalog', () => {
    const winterShoes = pick(PRODUCTS, { categories: ['footwear'], seasons: ['winter'] })
    expect(winterShoes.length).toBeGreaterThan(50)
    expect(winterShoes.every((p) => p.parentType === 'footwear')).toBe(true)
    for (const category of ['outerwear', 'tops', 'bottoms', 'knitwear', 'footwear', 'accessories', 'activewear', 'formalwear']) {
      expect(PRODUCTS.some((p) => matchesCategory(p, category)), category).toBe(true)
    }
  })
})
