import { describe, it, expect } from 'vitest'
import { matchTier, singularQuery } from '../../src/services/catalogSearch.js'
import { PRODUCTS } from '../../src/data/products.js'

const product = (over) => ({ name: 'Item', brand: 'Brand', color: 'Black', type: 'tee', parentType: 'tops', description: '', ...over })

function search(query) {
  return PRODUCTS
    .map((p) => ({ p, tier: matchTier(p, query) }))
    .filter((h) => h.tier >= 0)
    .sort((a, b) => a.tier - b.tier)
    .map(({ p }) => p)
}

describe('singularQuery', () => {
  it('singularises each word', () => {
    expect(singularQuery('boots')).toBe('boot')
    expect(singularQuery('chelsea boots')).toBe('chelsea boot')
    expect(singularQuery('dresses')).toBe('dress')
    expect(singularQuery('shoes')).toBe('shoe')
    expect(singularQuery('hoodies')).toBe('hoody')
  })

  it('leaves singular words alone', () => {
    expect(singularQuery('dress')).toBe('dress')
    expect(singularQuery('olive')).toBe('olive')
    expect(singularQuery('cactus')).toBe('cactus')
  })
})

describe('matchTier', () => {
  it('matches a plural query to the singular type', () => {
    expect(matchTier(product({ type: 'boot' }), 'boots')).toBe(0)
    expect(matchTier(product({ type: 'chelsea-boot' }), 'boots')).toBe(3)
  })

  it('ranks a type match above a description mention', () => {
    const loafer = product({ type: 'loafer', description: 'Wear it where you would wear boots.' })
    expect(matchTier(loafer, 'boots')).toBe(4)
    expect(matchTier(product({ type: 'work-boot' }), 'boots')).toBeLessThan(4)
  })

  it('still matches the query as typed', () => {
    expect(matchTier(product({ type: 'jeans' }), 'jeans')).toBe(0)
    expect(matchTier(product({ name: 'Light Boots Brown' }), 'boots')).toBe(2)
  })
})

describe('catalog search', () => {
  it('"boots" leads with boots', () => {
    const top = search('boots').slice(0, 20)
    expect(top.every((p) => /boot/i.test(`${p.type} ${p.name}`)), top.map((p) => p.name).join(', ')).toBe(true)
  })

  it('"olive" leads with olive items', () => {
    const top = search('olive').slice(0, 20)
    expect(top.every((p) => /olive/i.test(`${p.color} ${p.name}`)), top.map((p) => p.name).join(', ')).toBe(true)
  })
})
