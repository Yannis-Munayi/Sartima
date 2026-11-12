import { describe, it, expect, vi } from 'vitest'
import { sartimaHubActions, closetCategoryOf, topAesthetics } from '../../src/services/hubActions.js'

const STYLES = {
  oldmoney:   { id: 'oldmoney', name: 'Old Money', tagline: 'Quiet luxury' },
  streetwear: { id: 'streetwear', name: 'Streetwear', tagline: 'Loud' },
  y2k:        { id: 'y2k', name: 'Y2K', tagline: 'Shiny' },
}
const CATALOG = [
  { id: 'p1', name: 'Cable Knit Sweater', brand: 'Ralph Lauren', type: 'crewneck', parentType: 'knitwear', color: 'cream', gender: 'unisex', styleWeights: { oldmoney: 5 }, priceRange: 'premium' },
  { id: 'p2', name: 'Pleated Chinos', brand: 'Ralph Lauren', type: 'chinos', parentType: 'bottoms', color: 'khaki', gender: 'men', styleWeights: { oldmoney: 4 } },
  { id: 'p3', name: 'Graphic Hoodie', brand: 'Stussy', type: 'hoodie', parentType: 'knitwear', color: 'black', gender: 'unisex', styleWeights: { streetwear: 5 } },
  { id: 'p4', name: 'Baby Tee', brand: 'Brandy', type: 'baby-tee', parentType: 'tops', color: 'pink', gender: 'women', styleWeights: { y2k: 5 } },
  { id: 'p5', name: 'Running Leggings', brand: 'Nike', type: 'leggings', parentType: 'activewear', color: 'black', gender: 'women', styleWeights: {} },
]
const BASELINE = { tops: 2, bottoms: 1, footwear: 1 }

function setup({ user = { uid: 'u1', displayName: 'Ana', email: 'a@x.co', emailVerified: true }, tier = 'free', closetItems = [], liked = [], wishlist = [], closetLoading = false } = {}) {
  const ctx = {
    user,
    closet: {
      closetItems, closetLoading, closetError: null,
      addToCloset: vi.fn((item) => ctx.closet.closetItems.push(item)),
      updateClosetItem: vi.fn(), removeFromCloset: vi.fn(),
    },
    wishlist: {
      wishlist, liked, outfitBoards: [],
      addToWishlist: vi.fn(), addToLiked: vi.fn(), removeFromLiked: vi.fn(), removeFromWishlist: vi.fn(),
      isLiked: (id) => liked.some((e) => e.id === id),
    },
    subscription: {
      tier, isPro: tier !== 'free',
      limits: tier === 'free' ? { closetItems: 3, likedItems: 2 } : { closetItems: Infinity, likedItems: Infinity },
    },
    app: { state: { gender: 'women', styleScores: { y2k: 9, oldmoney: 2 } } },
    interests: { styleAffinities: { streetwear: 5 } },
  }
  const deps = { get: () => ctx, catalog: CATALOG, styles: STYLES, baseline: BASELINE, logOutfit: vi.fn(async () => {}), recordWear: vi.fn() }
  const { actions } = sartimaHubActions(deps)
  const run = (name, params = {}) => actions[name].run(params)
  return { ctx, deps, run }
}

describe('helpers', () => {
  it('maps catalog parent types onto closet categories', () => {
    expect(closetCategoryOf(CATALOG[1])).toBe('bottoms')
    expect(closetCategoryOf(CATALOG[0])).toBe('tops')     // knitwear
    expect(closetCategoryOf(CATALOG[4])).toBe('bottoms')  // activewear leggings
    expect(closetCategoryOf({ parentType: 'activewear', type: 'sports-bra' })).toBe('tops')
  })

  it('topAesthetics prefers live quiz scores, then the saved graph', () => {
    expect(topAesthetics({ y2k: 3, oldmoney: 5 }, { streetwear: 9 }, STYLES).map((a) => a.id)).toEqual(['oldmoney', 'y2k'])
    expect(topAesthetics({}, { streetwear: 9, ghost: 99 }, STYLES)).toEqual([{ id: 'streetwear', name: 'Streetwear' }])
  })
})

describe('profile and reading', () => {
  it('get_profile reports signed-out without throwing', async () => {
    const { run } = setup({ user: null })
    expect(await run('get_profile')).toMatchObject({ signed_in: false })
  })

  it('get_profile summarises plan, aesthetics, closet and gaps', async () => {
    const { run } = setup({ closetItems: [{ id: 'a', name: 'Tee', category: 'tops' }] })
    const p = await run('get_profile')
    expect(p).toMatchObject({ signed_in: true, plan: 'free', closet_limit: 3, shops_for: 'women' })
    expect(p.top_aesthetics[0].id).toBe('y2k')
    expect(p.closet.by_category).toEqual({ tops: 1 })
    expect(p.closet.short_of.map((g) => g.category)).toEqual(['tops', 'bottoms', 'footwear'])
  })

  it('reading actions need a signed-in user', async () => {
    const { run } = setup({ user: null })
    await expect(run('list_closet')).rejects.toThrow(/Nobody is signed in/)
    expect(() => run('list_saved')).toThrow(/Nobody is signed in/)
  })

  it('list_closet filters by category, season, favourites and words', async () => {
    const { run } = setup({
      closetItems: [
        { id: 'a', name: 'Black Denim Jacket', category: 'outerwear', seasons: ['fall'], favorite: true },
        { id: 'b', name: 'Linen Shirt', category: 'tops', seasons: ['summer'] },
        { id: 'c', name: 'Plain Tee', category: 'tops' },
      ],
    })
    expect((await run('list_closet', { category: 'tops' })).matched).toBe(2)
    expect((await run('list_closet', { season: 'summer' })).items.map((i) => i.id)).toEqual(['b', 'c'])
    expect((await run('list_closet', { favorites_only: true })).items.map((i) => i.id)).toEqual(['a'])
    expect((await run('list_closet', { search: 'den jack' })).items.map((i) => i.id)).toEqual(['a'])
    await expect(run('list_closet', { category: 'hats' })).rejects.toThrow(/category must be one of/)
  })

  it('waits for the closet to load, then gives up with a clear error', async () => {
    vi.useFakeTimers()
    const { run } = setup({ closetLoading: true })
    const pending = run('list_closet')
    const assertion = expect(pending).rejects.toThrow(/still loading/)
    await vi.advanceTimersByTimeAsync(11_000)
    await assertion
    vi.useRealTimers()
  })
})

describe('closet writes', () => {
  it('adds a described item', async () => {
    const { run, ctx } = setup()
    const out = await run('add_closet_item', { name: 'Grey Hoodie', category: 'tops', seasons: 'fall, winter', tags: ['cosy'] })
    expect(out).toMatchObject({ name: 'Grey Hoodie', category: 'tops', seasons: ['fall', 'winter'], tags: ['cosy'] })
    expect(ctx.closet.addToCloset).toHaveBeenCalledOnce()
    expect(ctx.closet.addToCloset.mock.calls[0][0].id).toMatch(/^ci_/)
  })

  it('adds a catalog product with its category worked out', async () => {
    const { run, ctx } = setup()
    await run('add_closet_item', { product_id: 'p2' })
    expect(ctx.closet.addToCloset.mock.calls[0][0]).toMatchObject({ type: 'catalog', productId: 'p2', category: 'bottoms', brand: 'Ralph Lauren' })
  })

  it('enforces the free closet cap, like the app does', async () => {
    const full = [1, 2, 3].map((i) => ({ id: `i${i}`, name: 'x', category: 'tops' }))
    const { run, ctx } = setup({ closetItems: full })
    await expect(run('add_closet_item', { name: 'One more', category: 'tops' })).rejects.toThrow(/closet is full/)
    expect(ctx.closet.addToCloset).not.toHaveBeenCalled()
    const pro = setup({ tier: 'pro', closetItems: [...full] })
    await expect(pro.run('add_closet_item', { name: 'One more', category: 'tops' })).resolves.toBeDefined()
  })

  it('validates required fields and enums', async () => {
    const { run } = setup()
    await expect(run('add_closet_item', { category: 'tops' })).rejects.toThrow(/name is required/)
    await expect(run('add_closet_item', { name: 'x' })).rejects.toThrow(/category is required/)
    await expect(run('add_closet_item', { name: 'x', category: 'tops', seasons: ['monsoon'] })).rejects.toThrow(/seasons must be one of/)
    await expect(run('add_closet_item', { product_id: 'nope' })).rejects.toThrow(/No catalog product/)
  })

  it('updates and removes items by id', async () => {
    const { run, ctx } = setup({ closetItems: [{ id: 'a', name: 'Tee', category: 'tops' }] })
    await run('update_closet_item', { id: 'a', favorite: 'true', color: 'blue' })
    expect(ctx.closet.updateClosetItem).toHaveBeenCalledWith('a', { favorite: true, color: 'blue' })
    await expect(run('update_closet_item', { id: 'a' })).rejects.toThrow(/at least one field/)
    await expect(run('update_closet_item', { id: 'zz', name: 'x' })).rejects.toThrow(/No closet item/)
    await run('remove_closet_item', { id: 'a' })
    expect(ctx.closet.removeFromCloset).toHaveBeenCalledWith('a')
  })
})

describe('log_outfit', () => {
  it('logs the outfit and records a wear on each piece', async () => {
    const items = [{ id: 'a', name: 'Tee', category: 'tops' }, { id: 'b', name: 'Jeans', category: 'bottoms' }]
    const { run, deps, ctx } = setup({ closetItems: items })
    const out = await run('log_outfit', { item_ids: 'a, b, a', occasion: 'work', date: '2026-11-10' })
    expect(out.logged).toEqual({ date: '2026-11-10', occasion: 'work', items: ['Tee', 'Jeans'] })
    expect(deps.logOutfit.mock.calls[0][1]).toMatchObject({ date: '2026-11-10', itemIds: ['a', 'b'], occasion: 'work', source: 'closet' })
    expect(deps.recordWear).toHaveBeenCalledWith(ctx.closet.closetItems, ['a', 'b'], ctx.closet.updateClosetItem, '2026-11-10')
  })

  it('rejects missing items, unknown ids and bad dates', async () => {
    const { run, deps } = setup({ closetItems: [{ id: 'a', name: 'Tee' }] })
    await expect(run('log_outfit', {})).rejects.toThrow(/item_ids is required/)
    await expect(run('log_outfit', { item_ids: ['zz'] })).rejects.toThrow(/No closet item/)
    await expect(run('log_outfit', { item_ids: ['a'], date: '12/11/2026' })).rejects.toThrow(/date must look like/)
    expect(deps.logOutfit).not.toHaveBeenCalled()
  })
})

describe('catalog and saved items', () => {
  it('search_catalog matches words, defaulting to the gender the owner shops for', () => {
    const { run } = setup()
    const res = run('search_catalog', { q: 'ralph' })
    // p2 is menswear; the owner shops women → only the unisex sweater
    expect(res.products.map((p) => p.id)).toEqual(['p1'])
    expect(run('search_catalog', { q: 'ralph', gender: 'both' }).matched).toBe(2)
  })

  it('search_catalog ranks name hits over description hits and filters by aesthetic and category', () => {
    const { run } = setup()
    expect(run('search_catalog', { aesthetic: 'oldmoney', gender: 'both' }).products[0].id).toBe('p1')
    expect(run('search_catalog', { category: 'bottoms', gender: 'both' }).products.map((p) => p.id).sort()).toEqual(['p2', 'p5'])
    expect(() => run('search_catalog', {})).toThrow(/Give q, aesthetic or category/)
    expect(() => run('search_catalog', { aesthetic: 'nope' })).toThrow(/No aesthetic/)
  })

  it('save_product saves to the wishlist by default, and to liked within the free limit', () => {
    const { run, ctx } = setup()
    run('save_product', { product_id: 'p3' })
    expect(ctx.wishlist.addToWishlist.mock.calls[0][0]).toMatchObject({ id: 'p3', type: 'product', name: 'Graphic Hoodie' })
    run('save_product', { product_id: 'p3', list: 'liked' })
    expect(ctx.wishlist.addToLiked).toHaveBeenCalledOnce()
  })

  it('save_product refuses a new like once free liked items are full', () => {
    const { run, ctx } = setup({ liked: [{ id: 'x' }, { id: 'y' }] })
    expect(() => run('save_product', { product_id: 'p3', list: 'liked' })).toThrow(/Liked items are full/)
    expect(ctx.wishlist.addToLiked).not.toHaveBeenCalled()
  })

  it('remove_saved removes an entry that exists', () => {
    const { run, ctx } = setup({ wishlist: [{ id: 'p3', name: 'Hoodie' }] })
    expect(run('remove_saved', { product_id: 'p3' }).removed).toMatchObject({ list: 'wishlist', id: 'p3' })
    expect(ctx.wishlist.removeFromWishlist).toHaveBeenCalledWith('p3')
    expect(() => run('remove_saved', { product_id: 'p9', list: 'liked' })).toThrow(/isn't in liked items/)
  })

  it('list_aesthetics lists every style', () => {
    const { run } = setup({ user: null })
    expect(run('list_aesthetics')).toHaveLength(3)
  })
})
