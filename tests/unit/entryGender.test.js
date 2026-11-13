import { describe, it, expect } from 'vitest'
import { entriesNeedGender, fillEntryGender, groupsNeedGender, fillGroupGender } from '../../src/services/entryGender'

const byId = {
  a: { id: 'a', gender: 'unisex' },
  b: { id: 'b', gender: 'women' },
}

describe('fillEntryGender', () => {
  it('fills gender from the catalog for entries that lack it', () => {
    const out = fillEntryGender([{ id: 'a', name: 'A' }, { id: 'b' }], byId)
    expect(out).toEqual([{ id: 'a', name: 'A', gender: 'unisex' }, { id: 'b', gender: 'women' }])
  })

  it('keeps a stored gender and leaves unknown ids alone', () => {
    const kept = { id: 'a', gender: 'men' }
    const unknown = { id: 'gone' }
    const quizItem = { name: 'Old quiz item', categoryId: 'tops' }
    const out = fillEntryGender([kept, unknown, quizItem, { id: 'b' }], byId)
    expect(out[0]).toBe(kept)
    expect(out[1]).toBe(unknown)
    expect(out[2]).toBe(quizItem)
    expect(out[3].gender).toBe('women')
  })

  it('returns the same array when nothing changes, so setState bails out', () => {
    const list = [{ id: 'a', gender: 'unisex' }, { id: 'gone' }]
    expect(fillEntryGender(list, byId)).toBe(list)
    expect(fillEntryGender(undefined, byId)).toBeUndefined()
  })
})

describe('entriesNeedGender', () => {
  it('is true only when an entry with an id has no gender', () => {
    expect(entriesNeedGender([{ id: 'a' }])).toBe(true)
    expect(entriesNeedGender([{ id: 'a', gender: 'unisex' }, { name: 'no id' }])).toBe(false)
    expect(entriesNeedGender([])).toBe(false)
    expect(entriesNeedGender(null)).toBe(false)
  })
})

describe('Shop Scout groups', () => {
  it('fills nested products and keeps untouched groups as-is', () => {
    const done = { id: 'g1', products: [{ id: 'a', gender: 'unisex' }] }
    const groups = [done, { id: 'g2', products: [{ id: 'b' }] }, { id: 'g3' }]
    expect(groupsNeedGender(groups)).toBe(true)
    const out = fillGroupGender(groups, byId)
    expect(out[0]).toBe(done)
    expect(out[1].products[0].gender).toBe('women')
    expect(out[2]).toBe(groups[2])
    expect(groupsNeedGender(out)).toBe(false)
    expect(fillGroupGender(out, byId)).toBe(out)
  })
})
