import { describe, it, expect, vi, beforeEach } from 'vitest'

import { canSwapGenderPhoto, resolveGenderPhoto, resolveProductImage } from '../../src/services/productImage'

const { fetchPhotosWithFallback } = vi.hoisted(() => ({ fetchPhotosWithFallback: vi.fn() }))
vi.mock('../../src/services/stockPhotos', () => ({ fetchPhotosWithFallback }))

const unisex  = { id: 'u', name: 'Wayfarer Sunglasses', gender: 'unisex' }
const curated = { id: 'c', name: 'Oxford Shirt', gender: 'unisex', image: 'https://img/w.jpg', imageMen: 'https://img/m.jpg' }

beforeEach(() => {
  fetchPhotosWithFallback.mockReset()
  fetchPhotosWithFallback.mockImplementation(async ([q]) => [`stock:${q}`])
})

describe('canSwapGenderPhoto', () => {
  it('offers the swap for unisex products only when gender is "both"', () => {
    expect(canSwapGenderPhoto(unisex, 'both')).toBe(true)
    expect(canSwapGenderPhoto(unisex, 'men')).toBe(false)
    expect(canSwapGenderPhoto(unisex, 'women')).toBe(false)
  })

  it('offers it for products with both curated photos', () => {
    expect(canSwapGenderPhoto({ ...curated, gender: 'men' }, 'both')).toBe(true)
  })

  it('does not swap a curated photo for stock ones', () => {
    expect(canSwapGenderPhoto({ ...unisex, image: 'https://img/x.jpg' }, 'both')).toBe(false)
  })

  it('skips gendered products and items with no gender', () => {
    expect(canSwapGenderPhoto({ ...unisex, gender: 'women' }, 'both')).toBe(false)
    expect(canSwapGenderPhoto({ name: 'Closet tee' }, 'both')).toBe(false)
    expect(canSwapGenderPhoto(null, 'both')).toBe(false)
  })
})

describe('resolveGenderPhoto', () => {
  it('uses curated photos when present, without a stock lookup', async () => {
    expect(await resolveGenderPhoto(curated, 'men')).toBe('https://img/m.jpg')
    expect(await resolveGenderPhoto(curated, 'women')).toBe('https://img/w.jpg')
    expect(fetchPhotosWithFallback).not.toHaveBeenCalled()
  })

  it('fetches a gendered stock photo otherwise', async () => {
    expect(await resolveGenderPhoto(unisex, 'men')).toBe('stock:men Wayfarer Sunglasses')
    expect(await resolveGenderPhoto({ ...unisex, pexelsQuery: 'aviators' }, 'women')).toBe('stock:women aviators')
  })

  it('returns null when no photo is found', async () => {
    fetchPhotosWithFallback.mockResolvedValue([])
    expect(await resolveGenderPhoto(unisex, 'men')).toBeNull()
  })
})

describe('resolveProductImage', () => {
  it('keeps the default stock query ungendered', async () => {
    expect(await resolveProductImage(unisex, 'both')).toBe('stock:Wayfarer Sunglasses')
  })

  it('prefers imageMen for the men filter', async () => {
    expect(await resolveProductImage(curated, 'men')).toBe('https://img/m.jpg')
    expect(await resolveProductImage(curated, 'women')).toBe('https://img/w.jpg')
  })
})
