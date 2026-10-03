// What the Jarvis hub may do in Sartima (see hubBridge.js): read the profile, closet and saved items,
// search the catalog, and change the closet, wishlist and outfit log through the same context functions
// the screens use — so Firestore persistence and plan limits behave exactly as when the owner taps.
//
// Everything app-specific comes in through `deps`, which keeps this file free of Firebase and the
// catalog chunks (and testable in plain Node):
//   get()        → { user, closet, wishlist, subscription, app, interests } as the contexts last rendered
//   catalog      → PRODUCTS            styles → STYLES            baseline → CAPSULE_BASELINE
//   logOutfit(user, entry)            appends to users/{uid}/prefs/outfitLog
//   recordWear(items, ids, update, date)

export const CLOSET_CATEGORIES = ['tops', 'bottoms', 'outerwear', 'dresses', 'footwear', 'accessories']
export const SEASONS = ['spring', 'summer', 'fall', 'winter']
export const OCCASIONS = ['casual', 'work', 'date', 'gym', 'errand', 'formal', 'outdoor']

const NOT_SIGNED_IN = 'Nobody is signed in to Sartima here. Open Sartima in the hub and sign in; it remembers you after that.'
const BOTTOM_WORDS = ['pant', 'trouser', 'jean', 'legging', 'short', 'jogger', 'skirt', 'chino']

const text = (v, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
const words = (v) => String(v ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
const today = () => new Date().toISOString().slice(0, 10) // the same day key TodayTab logs with

function oneOf(value, allowed, name) {
  if (value === undefined || value === null || value === '') return undefined
  const v = String(value).toLowerCase()
  if (!allowed.includes(v)) throw new Error(`${name} must be one of: ${allowed.join(', ')}.`)
  return v
}

function listOf(value, allowed, name) {
  if (value === undefined || value === null) return undefined
  const list = Array.isArray(value) ? value : String(value).split(',')
  return [...new Set(list.map((x) => oneOf(String(x).trim(), allowed, name)).filter(Boolean))]
}

function tagsOf(value) {
  if (value === undefined || value === null) return undefined
  const list = Array.isArray(value) ? value : String(value).split(',')
  return list.map((t) => text(String(t), 40)).filter(Boolean).slice(0, 20)
}

/** A catalog product's closet category (the catalog also has knitwear and activewear). */
export function closetCategoryOf(product) {
  if (CLOSET_CATEGORIES.includes(product.parentType)) return product.parentType
  const type = String(product.type ?? '').toLowerCase()
  return BOTTOM_WORDS.some((w) => type.includes(w)) ? 'bottoms' : 'tops'
}

/** The user's strongest aesthetics: live quiz scores first, else the saved interest graph (as useAestheticFlavor). */
export function topAesthetics(styleScores, affinities, styles, n = 5) {
  const rank = (scores) => Object.entries(scores ?? {})
    .filter(([id, score]) => styles[id] && score > 0)
    .sort((a, b) => b[1] - a[1])
  const ranked = rank(styleScores).length ? rank(styleScores) : rank(affinities)
  return ranked.slice(0, n).map(([id]) => ({ id, name: styles[id].name }))
}

const itemOut = (i) => ({
  id: i.id,
  name: i.name ?? '',
  category: i.category ?? 'tops',
  color: i.color || undefined,
  brand: i.brand || undefined,
  favorite: Boolean(i.favorite),
  seasons: i.seasons ?? [],
  occasions: i.occasions ?? [],
  tags: i.tags?.length ? i.tags : undefined,
  times_worn: i.timesWorn ?? 0,
  last_worn: i.lastWorn ?? null,
})

const savedOut = (e) => ({ id: e.id, name: e.name, brand: e.brand, price: e.priceRange, shop_url: e.shopUrl })

// The entry shape SearchScreen saves for a liked or wishlisted product.
const productEntry = (p) => ({
  id: p.id, type: 'product',
  name: p.name, brand: p.brand,
  itemType: p.type, parentType: p.parentType,
  color: p.color, colorHex: p.colorHex,
  priceRange: p.priceRange, emoji: p.emoji,
  gradient: p.gradient, description: p.description,
  styleWeights: p.styleWeights ?? {},
  shopUrl: p.shopUrl, shopFallbackUrl: p.shopFallbackUrl,
  seasons: p.seasons,
  image: p.image, imageMen: p.imageMen, googleQuery: p.googleQuery,
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function sartimaHubActions(deps) {
  const { get, catalog, styles, baseline } = deps
  const byId = new Map(catalog.map((p) => [p.id, p]))

  function signedIn() {
    const ctx = get()
    if (!ctx?.user) throw new Error(NOT_SIGNED_IN)
    return ctx
  }

  async function closetReady() {
    signedIn()
    for (let i = 0; i < 50 && get().closet.closetLoading; i++) await sleep(200)
    const { closet } = signedIn()
    if (closet.closetLoading) throw new Error('The closet is still loading. Try again in a moment.')
    if (closet.closetError) throw new Error(`The closet couldn't be loaded: ${closet.closetError.message ?? closet.closetError}`)
    return get()
  }

  function closetItem(ctx, id) {
    const item = ctx.closet.closetItems.find((i) => i.id === id)
    if (!item) throw new Error(`No closet item with id "${id}". List them with list_closet.`)
    return item
  }

  function product(id) {
    const p = byId.get(text(id))
    if (!p) throw new Error(`No catalog product with id "${id}". Find one with search_catalog.`)
    return p
  }

  function gaps(closetItems) {
    const counts = {}
    for (const i of closetItems) counts[i.category ?? 'tops'] = (counts[i.category ?? 'tops'] ?? 0) + 1
    return Object.entries(baseline)
      .map(([category, target]) => ({ category, owned: counts[category] ?? 0, target }))
      .filter((g) => g.owned < g.target)
      .sort((a, b) => (b.target - b.owned) - (a.target - a.owned))
  }

  function closetFields(params, { creating }) {
    const fields = {
      name: text(params.name, 80),
      category: oneOf(params.category, CLOSET_CATEGORIES, 'category'),
      color: text(params.color, 40),
      brand: text(params.brand, 60),
      seasons: listOf(params.seasons, SEASONS, 'seasons'),
      occasions: listOf(params.occasions, OCCASIONS, 'occasions'),
      tags: tagsOf(params.tags),
      favorite: params.favorite === undefined ? undefined : params.favorite === true || params.favorite === 'true',
    }
    for (const k of Object.keys(fields)) if (fields[k] === undefined) delete fields[k]
    if (!creating && !Object.keys(fields).length) {
      throw new Error('Give at least one field to change: name, category, color, brand, seasons, occasions, tags or favorite.')
    }
    return fields
  }

  return {
    app: 'sartima',
    actions: {
      get_profile: {
        description: 'Who is signed in, their plan, their top aesthetics, closet size by category, the categories their closet is short of, and how much they have saved.',
        run: async () => {
          const ctx = get()
          if (!ctx?.user) return { signed_in: false, note: NOT_SIGNED_IN }
          const { user, closet, wishlist, subscription, app, interests } = await closetReady()
          const byCategory = {}
          for (const i of closet.closetItems) byCategory[i.category ?? 'tops'] = (byCategory[i.category ?? 'tops'] ?? 0) + 1
          return {
            signed_in: true,
            name: user.displayName || null,
            email: user.email || null,
            email_verified: Boolean(user.emailVerified),
            plan: subscription.tier,
            closet_limit: Number.isFinite(subscription.limits.closetItems) ? subscription.limits.closetItems : null,
            shops_for: app.state.gender,
            top_aesthetics: topAesthetics(app.state.styleScores, interests?.styleAffinities, styles),
            closet: { items: closet.closetItems.length, by_category: byCategory, short_of: gaps(closet.closetItems) },
            saved: { wishlist: wishlist.wishlist.length, liked: wishlist.liked.length, outfit_boards: wishlist.outfitBoards.length },
          }
        },
      },

      list_closet: {
        description: 'Clothes in the closet, newest first, with wear counts. Use it to put outfits together from what they own.',
        params: {
          category: `optional: ${CLOSET_CATEGORIES.join('|')}`,
          season: `optional: ${SEASONS.join('|')}`,
          occasion: `optional: ${OCCASIONS.join('|')}`,
          search: 'optional words to match in name, colour, brand or tags',
          favorites_only: 'optional boolean',
          limit: 'optional, default 100',
        },
        run: async (p) => {
          const { closet } = await closetReady()
          const category = oneOf(p.category, CLOSET_CATEGORIES, 'category')
          const season = oneOf(p.season, SEASONS, 'season')
          const occasion = oneOf(p.occasion, OCCASIONS, 'occasion')
          const terms = words(p.search)
          const limit = Math.min(200, Math.max(1, Number(p.limit) || 100))
          const items = closet.closetItems.filter((i) =>
            (!category || (i.category ?? 'tops') === category) &&
            // An item with no seasons or occasions set is treated as fitting any.
            (!season || !i.seasons?.length || i.seasons.includes(season)) &&
            (!occasion || !i.occasions?.length || i.occasions.includes(occasion)) &&
            (!(p.favorites_only === true || p.favorites_only === 'true') || i.favorite) &&
            terms.every((t) => words([i.name, i.color, i.brand, ...(i.tags ?? [])].join(' ')).some((w) => w.startsWith(t))))
          return { total: closet.closetItems.length, matched: items.length, items: items.slice(0, limit).map(itemOut) }
        },
      },

      add_closet_item: {
        description: 'Add a piece of clothing to the closet: describe it, or pass a catalog product_id from search_catalog.',
        params: {
          name: 'required unless product_id is given',
          category: `required unless product_id is given: ${CLOSET_CATEGORIES.join('|')}`,
          product_id: 'optional, a catalog product the owner has',
          color: 'optional', brand: 'optional',
          seasons: `optional list: ${SEASONS.join(', ')}`,
          occasions: `optional list: ${OCCASIONS.join(', ')}`,
          tags: 'optional list', favorite: 'optional boolean',
        },
        writes: true,
        run: async (p) => {
          const { closet, subscription } = await closetReady()
          const { isPro, limits } = subscription
          if (!isPro && closet.closetItems.length >= limits.closetItems) {
            throw new Error(`The closet is full: the free plan holds ${limits.closetItems} items. Pro removes the limit.`)
          }
          const fields = closetFields(p, { creating: true })
          let item = { ...fields }
          if (p.product_id !== undefined) {
            const prod = product(p.product_id)
            item = {
              type: 'catalog',
              productId: prod.id,
              name: prod.name,
              brand: prod.brand,
              color: prod.color,
              category: closetCategoryOf(prod),
              seasons: prod.seasons ?? [],
              itemType: prod.type,
              parentType: prod.parentType,
              styleWeights: prod.styleWeights ?? {},
              ...(prod.image ? { thumbnailUrl: prod.image } : {}),
              ...fields,
            }
          }
          if (!item.name) throw new Error('name is required.')
          if (!item.category) throw new Error(`category is required: ${CLOSET_CATEGORIES.join(', ')}.`)
          item.id = `ci_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
          item.addedAt = new Date().toISOString()
          closet.addToCloset(item)
          return itemOut({ type: 'uploaded', favorite: false, tags: [], seasons: [], occasions: [], ...item })
        },
      },

      update_closet_item: {
        description: 'Change a closet item: rename it, recategorise it, set colour, brand, seasons, occasions, tags or favourite.',
        params: { id: 'required, from list_closet', name: 'optional', category: 'optional', color: 'optional', brand: 'optional', seasons: 'optional list', occasions: 'optional list', tags: 'optional list', favorite: 'optional boolean' },
        writes: true,
        run: async (p) => {
          const ctx = await closetReady()
          const item = closetItem(ctx, text(p.id))
          const fields = closetFields(p, { creating: false })
          ctx.closet.updateClosetItem(item.id, fields)
          return itemOut({ ...item, ...fields })
        },
      },

      remove_closet_item: {
        description: 'Remove an item from the closet for good.',
        params: { id: 'required, from list_closet' },
        writes: true,
        run: async (p) => {
          const ctx = await closetReady()
          const item = closetItem(ctx, text(p.id))
          ctx.closet.removeFromCloset(item.id)
          return { removed: itemOut(item) }
        },
      },

      log_outfit: {
        description: 'Record an outfit the owner wore: adds it to the outfit log and counts a wear on each piece.',
        params: {
          item_ids: 'required list of closet item ids',
          occasion: `optional: ${OCCASIONS.join('|')} (default casual)`,
          date: 'optional YYYY-MM-DD (default today)',
          notes: 'optional',
        },
        writes: true,
        run: async (p) => {
          const ctx = await closetReady()
          const ids = [...new Set((Array.isArray(p.item_ids) ? p.item_ids : String(p.item_ids ?? '').split(',')).map((x) => String(x).trim()).filter(Boolean))]
          if (!ids.length) throw new Error('item_ids is required.')
          const items = ids.map((id) => closetItem(ctx, id))
          const date = text(p.date) ?? today()
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must look like 2026-09-17.')
          const entry = {
            id: `log_${Date.now()}`,
            date,
            itemIds: ids,
            source: 'closet',
            occasion: oneOf(p.occasion, OCCASIONS, 'occasion') ?? 'casual',
            notes: text(p.notes, 500) ?? '',
            weather: null,
            loggedAt: new Date().toISOString(),
          }
          await deps.logOutfit(ctx.user, entry)
          deps.recordWear(ctx.closet.closetItems, ids, ctx.closet.updateClosetItem, date)
          return { logged: { date, occasion: entry.occasion, items: items.map((i) => i.name) } }
        },
      },

      list_saved: {
        description: 'Products the owner saved to their wishlist or liked, and their outfit boards.',
        run: () => {
          const { wishlist } = signedIn()
          return {
            wishlist: wishlist.wishlist.map(savedOut),
            liked: wishlist.liked.map(savedOut),
            outfit_boards: wishlist.outfitBoards.map((b) => ({ id: b.id, name: b.name ?? b.title ?? '', pieces: (b.items ?? b.itemIds ?? []).length })),
          }
        },
      },

      search_catalog: {
        description: 'Search the ~7,500-product catalog to recommend new pieces. Words match name, brand, type, colour and description; an aesthetic ranks by fit.',
        params: {
          q: 'optional words, e.g. "white oxford shirt" or "Ralph Lauren"',
          aesthetic: 'optional aesthetic id (list_aesthetics), e.g. oldmoney',
          category: `optional: ${CLOSET_CATEGORIES.join('|')}|knitwear|activewear`,
          gender: 'optional men|women|both (default: what the owner shops for)',
          limit: 'optional, default 10, at most 25',
        },
        run: (p) => {
          const terms = words(p.q)
          const aesthetic = text(p.aesthetic)?.toLowerCase()
          if (aesthetic && !styles[aesthetic]) throw new Error(`No aesthetic "${aesthetic}". See list_aesthetics.`)
          if (!terms.length && !aesthetic && !p.category) throw new Error('Give q, aesthetic or category.')
          const category = oneOf(p.category, [...CLOSET_CATEGORIES, 'knitwear', 'activewear'], 'category')
          const gender = oneOf(p.gender, ['men', 'women', 'both'], 'gender') ?? get()?.app?.state?.gender ?? 'both'
          const limit = Math.min(25, Math.max(1, Number(p.limit) || 10))
          const results = []
          for (const prod of catalog) {
            if (gender !== 'both' && prod.gender !== 'unisex' && prod.gender !== gender) continue
            if (category && prod.parentType !== category && closetCategoryOf(prod) !== category) continue
            const fit = aesthetic ? prod.styleWeights?.[aesthetic] ?? 0 : 0
            if (aesthetic && fit <= 0) continue
            let score = fit
            if (terms.length) {
              const name = words(`${prod.name} ${prod.brand}`)
              const rest = words(`${prod.type} ${prod.color} ${prod.description}`)
              let hits = 0
              for (const t of terms) {
                if (name.some((w) => w.startsWith(t))) hits += 3
                else if (rest.some((w) => w.startsWith(t))) hits += 1
                else { hits = -1; break }
              }
              if (hits < 0) continue
              score += hits
            }
            results.push({ prod, score })
          }
          results.sort((a, b) => b.score - a.score || a.prod.name.length - b.prod.name.length)
          return {
            matched: results.length,
            products: results.slice(0, limit).map(({ prod }) => ({
              id: prod.id,
              name: prod.name,
              brand: prod.brand,
              category: closetCategoryOf(prod),
              type: prod.type,
              color: prod.color,
              price: prod.priceRange,
              seasons: prod.seasons,
              aesthetics: Object.entries(prod.styleWeights ?? {})
                .sort((a, b) => b[1] - a[1]).slice(0, 3)
                .map(([id]) => styles[id]?.name).filter(Boolean),
              shop_url: prod.shopUrl,
            })),
          }
        },
      },

      save_product: {
        description: 'Save a catalog product to the wishlist (to buy) or to liked items.',
        params: { product_id: 'required, from search_catalog', list: 'optional wishlist|liked (default wishlist)' },
        writes: true,
        run: (p) => {
          const { wishlist, subscription } = signedIn()
          const prod = product(p.product_id)
          const list = oneOf(p.list, ['wishlist', 'liked'], 'list') ?? 'wishlist'
          if (list === 'liked') {
            const { isPro, limits } = subscription
            if (!isPro && wishlist.liked.length >= limits.likedItems && !wishlist.isLiked(prod.id)) {
              throw new Error(`Liked items are full: the free plan keeps ${limits.likedItems}. Pro removes the limit.`)
            }
            wishlist.addToLiked(productEntry(prod))
          } else {
            wishlist.addToWishlist(productEntry(prod))
          }
          return { saved: { list, id: prod.id, name: prod.name, brand: prod.brand } }
        },
      },

      remove_saved: {
        description: 'Take a product off the wishlist or out of liked items.',
        params: { product_id: 'required, from list_saved', list: 'optional wishlist|liked (default wishlist)' },
        writes: true,
        run: (p) => {
          const { wishlist } = signedIn()
          const id = text(p.product_id)
          const list = oneOf(p.list, ['wishlist', 'liked'], 'list') ?? 'wishlist'
          const entries = list === 'liked' ? wishlist.liked : wishlist.wishlist
          const entry = entries.find((e) => e.id === id)
          if (!entry) throw new Error(`"${id}" isn't in ${list === 'liked' ? 'liked items' : 'the wishlist'}.`)
          if (list === 'liked') wishlist.removeFromLiked(id)
          else wishlist.removeFromWishlist(id)
          return { removed: { list, ...savedOut(entry) } }
        },
      },

      list_aesthetics: {
        description: 'Every aesthetic Sartima knows (ids for search_catalog, and for opening #/aesthetic/<id>).',
        run: () => Object.values(styles).map((s) => ({ id: s.id, name: s.name, tagline: s.tagline })),
      },
    },
  }
}
