import { describe, it, expect } from 'vitest'
import { garmentPhoto, garmentDisplayPhoto, garmentCategory } from '../../src/services/tryOnGarment.js'

describe('garmentPhoto', () => {
  it('reads a closet item photo', () => {
    expect(garmentPhoto({ imageUrl: 'https://a/1.jpg', thumbnailUrl: 'https://a/t.jpg' })).toBe('https://a/1.jpg')
    expect(garmentPhoto({ thumbnailUrl: 'https://a/t.jpg' })).toBe('https://a/t.jpg')
  })

  it('reads a catalog product photo from `image`', () => {
    expect(garmentPhoto({ type: 'product', image: 'https://cdn/p.jpg' })).toBe('https://cdn/p.jpg')
  })

  it('is null when there is no photo', () => {
    expect(garmentPhoto({ name: 'x' })).toBeNull()
    expect(garmentPhoto(undefined)).toBeNull()
  })

  it('shows the background-removed photo when there is one', () => {
    expect(garmentDisplayPhoto({ prettifiedUrl: 'https://p', imageUrl: 'https://i' })).toBe('https://p')
    expect(garmentDisplayPhoto({ image: 'https://i' })).toBe('https://i')
  })
})

describe('garmentCategory', () => {
  it('uses a closet item category', () => {
    expect(garmentCategory({ category: 'bottoms' })).toBe('bottoms')
  })

  it("falls back to a catalog product's parentType", () => {
    expect(garmentCategory({ parentType: 'outerwear' })).toBe('outerwear')
  })

  it('is null for categories try-on cannot dress', () => {
    expect(garmentCategory({ category: 'footwear' })).toBeNull()
    expect(garmentCategory({ parentType: 'accessories' })).toBeNull()
    expect(garmentCategory({})).toBeNull()
  })
})
