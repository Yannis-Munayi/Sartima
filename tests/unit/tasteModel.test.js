import { describe, it, expect } from 'vitest'
import { TasteModel, createProfile, createSession, createBatchLog, DEFAULTS } from '../../src/services/tasteModel.js'

const DAY = 86_400_000
const T0  = Date.UTC(2026, 0, 15, 12)
const AESTHETICS = ['grunge', 'punk', 'preppy', 'minimalist', 'y2k', 'boho']
const BRANDS = ['acme', 'birch', 'cobalt', 'delta']
const TYPES  = ['boots', 'jeans', 'tee', 'blazer', 'skirt']
const COLORS = ['black', 'white', 'navy', 'red']

// 60 products: each has a strong main aesthetic, a weaker partner and a faint
// third one, so grunge↔punk, preppy↔minimalist and y2k↔boho co-occur most
// (adjacency), with weaker links across the pairs.
const TRIPLES = [
  ['grunge', 'punk', 'boho'], ['punk', 'grunge', 'minimalist'],
  ['preppy', 'minimalist', 'y2k'], ['minimalist', 'preppy', 'grunge'],
  ['y2k', 'boho', 'punk'], ['boho', 'y2k', 'preppy'],
]
function makeCatalog({ third = true } = {}) {
  const out = []
  for (let i = 0; i < 60; i++) {
    const [main, side, faint] = TRIPLES[i % TRIPLES.length]
    out.push({
      id: `p${i}`,
      name: `${COLORS[i % 4]} ${TYPES[i % 5]} ${i}`,
      brand: BRANDS[i % 4],
      type: TYPES[i % 5],
      parentType: 'x',
      color: COLORS[i % 4],
      price: 40 + (i % 6) * 30,
      popularity: 0.5,
      styleWeights: third ? { [main]: 5, [side]: 2, [faint]: 1 } : { [main]: 5, [side]: 2 },
    })
  }
  return out
}

const zero = () => 0
const model = (opts) => new TasteModel({ catalog: makeCatalog(opts), aesthetics: AESTHETICS })
const ev = (type, productId, ts = T0, extra = {}) => ({ type, productId, ts, ...extra })
const mainOf = (m, id) => m.vec.get(id).main

describe('construction', () => {
  it('skips products with no positive style weights', () => {
    const m = new TasteModel({
      catalog: [...makeCatalog(), { id: 'blank', brand: 'x', type: 'tee', color: 'red', styleWeights: { grunge: 0 } }],
      aesthetics: AESTHETICS,
    })
    expect(m.byId.has('blank')).toBe(false)
    expect(m.items).toHaveLength(60)
  })

  it('takes the highest-weighted aesthetic as the main one', () => {
    const m = model()
    expect(mainOf(m, 'p0')).toBe('grunge')
    expect(mainOf(m, 'p1')).toBe('punk')
  })

  it('builds adjacency from aesthetics that co-occur in the catalog', () => {
    const m = model()
    expect(m.adj.grunge[0]).toBe('punk')
    expect(m.adj.preppy[0]).toBe('minimalist')
    expect(m.adj.y2k[0]).toBe('boho')
  })

  it('merges a config override without losing the other defaults', () => {
    const m = new TasteModel({ catalog: makeCatalog(), aesthetics: AESTHETICS, config: { weights: { aesthetic: 0.9 } } })
    expect(m.cfg.weights.aesthetic).toBe(0.9)
    expect(m.cfg.weights.brand).toBe(DEFAULTS.weights.brand)
    expect(m.cfg.halfLife.aes).toBe(DEFAULTS.halfLife.aes)
  })
})

describe('createProfile / createSession', () => {
  it('starts empty, with zero evidence', () => {
    const p = createProfile(T0)
    expect(p).toMatchObject({ v: 1, updatedAt: T0, evidence: 0, aes: {}, hidden: [], quiz: null })
    expect(createSession(T0)).toEqual({ aes: {}, events: 0, run: 0, lastMain: null, startedAt: T0 })
  })
})

describe('learning from events', () => {
  it('a like adds positive affinity to the product aesthetics, weighted toward the main one', () => {
    const m = model(), p = createProfile(T0)
    m.applyEvent(p, ev('like', 'p0'))
    const aff = m.aestheticAffinity(p, null, T0)
    expect(aff.grunge).toBeGreaterThan(0)
    expect(aff.punk).toBeGreaterThan(0)
    expect(aff.grunge).toBeGreaterThan(aff.punk)
    expect(p.evidence).toBeGreaterThan(0)
  })

  it('a skip only nudges strongly-tagged aesthetics down', () => {
    const m = model(), p = createProfile(T0)
    m.applyEvent(p, ev('skip', 'p0'))
    const aff = m.aestheticAffinity(p, null, T0)
    expect(aff.grunge).toBeLessThan(0)
    expect(aff.punk ?? 0).toBe(0) // raw weight 2 < minRawWeight 4
  })

  it('a hide is a strong negative and removes the product from scoring', () => {
    const m = model(), p = createProfile(T0)
    m.applyEvent(p, ev('hide', 'p0'))
    expect(p.hidden).toEqual(['p0'])
    expect(m.aestheticAffinity(p, null, T0).grunge).toBeLessThan(0)
    const ids = m.scoreAll(p, null, { now: T0, rng: zero }).map((x) => x.product.id)
    expect(ids).not.toContain('p0')
  })

  it('unlike reverses a like', () => {
    const m = model(), p = createProfile(T0)
    m.applyEvent(p, ev('like', 'p0'))
    m.applyEvent(p, ev('unlike', 'p0', T0 + 1000))
    const aff = m.aestheticAffinity(p, null, T0 + 1000)
    expect(Math.abs(aff.grunge ?? 0)).toBeLessThan(0.01)
    expect(p.evidence).toBeCloseTo(0, 5)
  })

  it('counts one event per type per item per day', () => {
    const m = model(), once = createProfile(T0), twice = createProfile(T0)
    m.applyEvent(once, ev('like', 'p0'))
    m.applyEvent(twice, ev('like', 'p0'))
    m.applyEvent(twice, ev('like', 'p0', T0 + 60_000))
    expect(twice.aes.grunge.v).toBeCloseTo(once.aes.grunge.v, 10)
  })

  it('repeat likes on later days count for less (diminishing returns)', () => {
    const m = model(), p = createProfile(T0)
    m.applyEvent(p, ev('like', 'p0'))
    const first = p.aes.grunge.v
    m.applyEvent(p, ev('like', 'p0', T0 + DAY))
    const second = p.aes.grunge.v - first * Math.pow(0.5, DAY / DEFAULTS.halfLife.aes)
    expect(second).toBeGreaterThan(0)
    expect(second).toBeLessThan(first)
  })

  it('ignores views under 2 seconds and counts long views', () => {
    const m = model(), p = createProfile(T0)
    m.applyEvent(p, ev('view', 'p0', T0, { dwellMs: 1500 }))
    expect(p.aes.grunge).toBeUndefined()
    m.applyEvent(p, ev('view', 'p6', T0, { dwellMs: 6000 }))
    expect(p.aes.grunge.v).toBeGreaterThan(0)
  })

  it('closet adds count more than likes', () => {
    const m = model(), liked = createProfile(T0), owned = createProfile(T0)
    m.applyEvent(liked, ev('like', 'p0'))
    m.applyEvent(owned, ev('closet_add', 'p0'))
    expect(owned.aes.grunge.v).toBeGreaterThan(liked.aes.grunge.v)
  })

  it('ignores unknown products and unknown event types', () => {
    const m = model(), p = createProfile(T0)
    m.applyEvent(p, ev('like', 'nope'))
    m.applyEvent(p, ev('teleport', 'p0'))
    expect(p.aes).toEqual({})
    expect(p.evidence).toBe(0)
  })

  it('pinning an aesthetic adds a strong positive signal', () => {
    const m = model(), p = createProfile(T0)
    m.applyEvent(p, { type: 'pin_aesthetic', aestheticId: 'boho', ts: T0 })
    expect(p.aes.boho.v).toBe(DEFAULTS.events.pin)
    // A lone tally scales against itself: tanh(8 / 8)
    expect(m.aestheticAffinity(p, null, T0).boho).toBeCloseTo(Math.tanh(1))
  })

  it('onboarding quiz scores are stored and seed the tally', () => {
    const m = model(), p = createProfile(T0)
    m.applyEvent(p, { type: 'onboard_quiz', scores: { preppy: 100, y2k: 50 }, ts: T0 })
    expect(p.quiz).toEqual({ preppy: 100, y2k: 50 })
    expect(p.aes.preppy.v).toBeCloseTo(DEFAULTS.events.quizSeed)
    expect(p.aes.y2k.v).toBeCloseTo(DEFAULTS.events.quizSeed / 2)
  })

  it('onboarding brand picks raise that brand', () => {
    const m = model(), p = createProfile(T0)
    m.applyEvent(p, { type: 'onboard_brand', brandId: 'cobalt', ts: T0 })
    expect(p.brand.cobalt.pos).toBe(DEFAULTS.events.onboardBrand)
  })

  it('applies events in timestamp order, whatever order they arrive in', () => {
    const m = model(), a = createProfile(T0), b = createProfile(T0)
    const events = [ev('like', 'p0', T0), ev('unlike', 'p0', T0 + 5000), ev('like', 'p6', T0 + 9000)]
    m.applyEvents(a, events)
    m.applyEvents(b, [events[2], events[0], events[1]])
    expect(b.aes).toEqual(a.aes)
    expect(b.evidence).toBeCloseTo(a.evidence, 10)
  })
})

describe('decay', () => {
  it('aesthetic affinity halves after its 60-day half-life', () => {
    const m = model(), p = createProfile(T0)
    m.applyEvent(p, ev('like', 'p0'))
    const scale = DEFAULTS.aesScaleFloor
    const now  = Math.atanh(m.aestheticAffinity(p, null, T0).grunge) * scale
    const later = Math.atanh(m.aestheticAffinity(p, null, T0 + 60 * DAY).grunge) * scale
    expect(later).toBeCloseTo(now / 2, 6)
  })

  it('the session layer fades within the hour while the long-term layer stays', () => {
    const m = model(), p = createProfile(T0), s = createSession(T0)
    m.applyEvent(p, ev('like', 'p0'), s)
    expect(s.aes.grunge.v).toBeGreaterThan(0)
    const fresh = m.aestheticAffinity(p, s, T0).grunge
    const stale = m.aestheticAffinity(p, s, T0 + 3 * 60 * 60_000).grunge
    expect(stale).toBeGreaterThan(0)
    expect(stale).toBeLessThan(fresh)
  })
})

describe('session behaviour', () => {
  it('three skips in a row of the same aesthetic add a session penalty', () => {
    const m = model(), p = createProfile(T0), s = createSession(T0)
    for (const id of ['p0', 'p6', 'p12']) m.applyEvent(p, ev('skip', id), s)
    // Long-term skips are small; the run penalty makes the session layer more negative
    expect(s.aes.grunge.v).toBeLessThan(p.aes.grunge.v)
    expect(s.run).toBe(0)
    expect(s.events).toBe(3)
  })

  it('a like breaks a skip run', () => {
    const m = model(), p = createProfile(T0), s = createSession(T0)
    m.applyEvent(p, ev('skip', 'p0'), s)
    m.applyEvent(p, ev('skip', 'p6'), s)
    m.applyEvent(p, ev('like', 'p2'), s)
    expect(s.run).toBe(0)
    expect(s.lastMain).toBeNull()
  })
})

describe('search', () => {
  it('matches every query word as a word prefix', () => {
    const m = model()
    const ids = m.searchIds('blac boo')
    expect(ids.size).toBeGreaterThan(0)
    for (const id of ids) {
      const p = m.byId.get(id)
      expect(p.color).toBe('black')
      expect(p.type).toBe('boots')
    }
    expect(m.searchIds('').size).toBe(0)
    expect(m.searchIds('zzz').size).toBe(0)
  })

  it('records searches and doubles a repeat within 7 days', () => {
    const m = model(), p = createProfile(T0)
    m.applyEvent(p, { type: 'search', query: 'Black Boots', ts: T0 })
    const afterOne = p.evidence
    m.applyEvent(p, { type: 'search', query: 'black boots', ts: T0 + DAY })
    expect(p.searches['black boots'].count).toBe(2)
    expect(p.evidence - afterOne).toBeCloseTo(afterOne * 2)
  })

  it('lists repeated searches without engagement as unmet demand, until a result is liked', () => {
    const m = model(), p = createProfile(T0)
    m.applyEvent(p, { type: 'search', query: 'navy blazer', ts: T0 })
    m.applyEvent(p, { type: 'search', query: 'navy blazer', ts: T0 + 1000 })
    m.applyEvent(p, { type: 'search', query: 'red tee', ts: T0 + 2000 })
    expect(m.unmetDemand(p, T0 + 3000).map((x) => x.query)).toEqual(['navy blazer'])

    const hit = [...m.searchIds('navy blazer')][0]
    m.applyEvent(p, ev('like', hit, T0 + 4000, { searchTerm: 'Navy Blazer' }))
    expect(m.unmetDemand(p, T0 + 5000)).toEqual([])
  })

  it('drops unmet demand older than 7 days', () => {
    const m = model(), p = createProfile(T0)
    m.applyEvent(p, { type: 'search', query: 'red tee', ts: T0 })
    m.applyEvent(p, { type: 'search', query: 'red tee', ts: T0 + 1000 })
    expect(m.unmetDemand(p, T0 + 8 * DAY)).toEqual([])
  })
})

describe('compact', () => {
  it('trims old searches, extra touches and extra hidden ids', () => {
    const m = model(), p = createProfile(T0)
    p.searches.old = { v: 1, t: T0, count: 1, first: T0, last: T0, engaged: false }
    for (let i = 0; i < DEFAULTS.limits.touches + 10; i++) p.touches[`t${i}`] = { n: 1, d: {}, t: T0 + i }
    p.hidden = Array.from({ length: DEFAULTS.limits.hidden + 5 }, (_, i) => `h${i}`)
    m.compact(p, T0 + 31 * DAY)
    expect(p.searches.old).toBeUndefined()
    expect(Object.keys(p.touches)).toHaveLength(DEFAULTS.limits.touches)
    expect(p.touches.t0).toBeUndefined() // oldest dropped
    expect(p.hidden).toHaveLength(DEFAULTS.limits.hidden)
    expect(p.hidden.at(-1)).toBe(`h${DEFAULTS.limits.hidden + 4}`)
  })

  it('drops aesthetics that have decayed to nothing', () => {
    const m = model(), p = createProfile(T0)
    m.applyEvent(p, ev('like', 'p0'))
    m.compact(p, T0 + 600 * DAY)
    expect(p.aes.grunge).toBeUndefined()
  })
})

describe('confidence', () => {
  it('leans on the prior when new and on the learned profile once established', () => {
    const m = model()
    expect(m.priorWeight({ evidence: 0 })).toBeCloseTo(0.6)
    expect(m.priorWeight({ evidence: 15 })).toBeCloseTo(0.6)
    expect(m.priorWeight({ evidence: 37.5 })).toBeCloseTo(0.325)
    expect(m.priorWeight({ evidence: 60 })).toBeCloseTo(0.05)
    expect(m.priorWeight({ evidence: 500 })).toBeCloseTo(0.05)
  })
})

describe('scoring', () => {
  function likedGrunge(m) {
    const p = createProfile(T0)
    let t = T0
    for (const id of ['p0', 'p6', 'p12', 'p18', 'p24', 'p30', 'p36', 'p42']) m.applyEvent(p, ev('like', id, (t += 1000)))
    return p
  }

  it('ranks products matching liked aesthetics above unrelated ones', () => {
    const m = model(), p = likedGrunge(m)
    const scored = m.scoreAll(p, null, { now: T0 + DAY, rng: zero })
    const rank = (aes) => scored.findIndex((x) => mainOf(m, x.product.id) === aes)
    expect(rank('grunge')).toBeLessThan(rank('preppy'))
    expect(rank('grunge')).toBeLessThan(rank('boho'))
    expect(scored[0].parts).toHaveProperty('cos')
  })

  it('returns scores sorted high to low', () => {
    const m = model(), p = likedGrunge(m)
    const scores = m.scoreAll(p, null, { now: T0, rng: zero }).map((x) => x.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
  })

  it('leaves out excluded ids', () => {
    const m = model()
    const ids = m.scoreAll(createProfile(T0), null, { exclude: new Set(['p1', 'p2']), now: T0, rng: zero }).map((x) => x.product.id)
    expect(ids).not.toContain('p1')
    expect(ids).not.toContain('p2')
    expect(ids).toHaveLength(58)
  })

  it('penalises items that duplicate a closet piece (same type and colour)', () => {
    const m = model(), p = createProfile(T0)
    const target = m.byId.get('p7')
    const base = m.scoreAll(p, null, { now: T0, rng: zero }).find((x) => x.product.id === 'p7')
    const withCloset = m.scoreAll(p, null, {
      closet: { items: [{ id: 'mine', type: target.type, color: target.color }] }, now: T0, rng: zero,
    }).find((x) => x.product.id === 'p7')
    expect(withCloset.parts.penalty).toBe(DEFAULTS.penalties.nearDuplicate)
    expect(withCloset.score).toBeLessThan(base.score)
  })

  it('penalises items served recently without any reaction', () => {
    const m = model(), p = createProfile(T0)
    const s = m.scoreAll(p, null, { recentUnacted: new Set(['p3']), now: T0, rng: zero }).find((x) => x.product.id === 'p3')
    expect(s.parts.penalty).toBe(DEFAULTS.penalties.recentUnacted)
  })

  it('boosts types the closet is missing', () => {
    const m = model(), p = createProfile(T0)
    const scored = m.scoreAll(p, null, { closet: { items: [], gaps: { skirt: 3 } }, now: T0, rng: zero })
    const skirt = scored.find((x) => x.product.type === 'skirt')
    const tee   = scored.find((x) => x.product.type === 'tee')
    expect(skirt.parts.closet).toBeGreaterThan(0)
    expect(tee.parts.closet).toBe(0)
  })

  it('learns a price band and prefers items inside it', () => {
    const m = model(), p = createProfile(T0)
    // p0, p6, p12... all cost 40; like three of them
    for (const [i, id] of ['p0', 'p6', 'p12'].entries()) m.applyEvent(p, ev('like', id, T0 + i))
    const scored = m.scoreAll(p, null, { now: T0, rng: zero })
    const cheap = scored.find((x) => x.product.price === 40)
    const dear  = scored.find((x) => x.product.price === 190)
    expect(cheap.parts.price).toBeGreaterThan(dear.parts.price)
  })

  it('uses the quiz as the prior for new users', () => {
    const m = model(), p = createProfile(T0)
    m.applyEvent(p, { type: 'onboard_quiz', scores: { y2k: 100 }, ts: T0 })
    const scored = m.scoreAll(p, null, { now: T0, rng: zero })
    expect(mainOf(m, scored[0].product.id)).toBe('y2k')
    expect(scored[0].parts.prior).toBeGreaterThan(0)
  })
})

describe('rankFeed', () => {
  function established(m) {
    const p = createProfile(T0)
    let t = T0
    for (const id of ['p0', 'p6', 'p12', 'p18', 'p24', 'p30']) m.applyEvent(p, ev('save', id, (t += 1000)))
    return p
  }

  it('returns the requested count with no repeats', () => {
    const m = model()
    const feed = m.rankFeed({ profile: established(m), count: 20, now: T0, rng: zero })
    expect(feed).toHaveLength(20)
    expect(new Set(feed.map((x) => x.product.id)).size).toBe(20)
  })

  it('reserves about 15% of the batch for exploration', () => {
    const m = model()
    const feed = m.rankFeed({ profile: established(m), count: 20, now: T0, rng: zero })
    const slots = feed.map((x) => x.slot)
    expect(slots.filter((s) => s === 'exploit')).toHaveLength(17)
    expect(slots.filter((s) => s === 'adjacent')).toHaveLength(2)
    expect(slots.filter((s) => s === 'wildcard')).toHaveLength(1)
  })

  it('only uses wildcard exploration until there is enough evidence for adjacent picks', () => {
    const m = model()
    const feed = m.rankFeed({ profile: createProfile(T0), count: 20, now: T0, rng: zero })
    expect(feed.some((x) => x.slot === 'adjacent')).toBe(false)
    expect(feed.filter((x) => x.slot === 'wildcard')).toHaveLength(3)
  })

  it('fills the exploration share with wildcards when the top aesthetics have no neighbours', () => {
    const m = model({ third: false }), p = established(m)
    const feed = m.rankFeed({ profile: p, count: 20, now: T0, rng: zero })
    expect(feed.filter((x) => x.slot === 'adjacent')).toHaveLength(0)
    expect(feed.filter((x) => x.slot === 'wildcard')).toHaveLength(3)
  })

  it('adjacent picks come from neighbours of the top aesthetics', () => {
    const m = model(), p = established(m)
    const feed = m.rankFeed({ profile: p, count: 20, now: T0, rng: zero })
    for (const x of feed.filter((f) => f.slot === 'adjacent')) {
      expect(['grunge', 'punk']).not.toContain(mainOf(m, x.product.id))
    }
  })

  it('MMR spreads the batch across brands and types instead of near-duplicates', () => {
    const m = model(), p = established(m)
    const feed = m.rankFeed({ profile: p, count: 10, now: T0, rng: zero })
    const first4 = feed.filter((x) => x.slot === 'exploit').slice(0, 4)
    expect(new Set(first4.map((x) => x.product.brand + x.product.type)).size).toBe(4)
  })

  it('drops strong mismatches once the profile is trusted', () => {
    const m = model(), p = createProfile(T0)
    let t = T0
    for (const id of ['p2', 'p8', 'p14', 'p20', 'p26', 'p32', 'p38', 'p44', 'p50', 'p56']) m.applyEvent(p, ev('hide', id, (t += 1000)))
    expect(p.evidence).toBeGreaterThanOrEqual(DEFAULTS.penalties.hardExcludeMinEvidence)
    const feed = m.rankFeed({ profile: p, count: 6, now: T0 + DAY, rng: zero })
    for (const x of feed) expect(x.cos).toBeGreaterThanOrEqual(DEFAULTS.penalties.hardExcludeCos)
  })

  it('engaging with an exploration pick teaches its neighbourhood', () => {
    const m = model(), p = createProfile(T0)
    m.applyEvent(p, ev('like', 'p4', T0, { slot: 'wildcard' })) // y2k item
    expect(p.aes.boho.v).toBeGreaterThan(0)
    const plain = createProfile(T0)
    m.applyEvent(plain, ev('like', 'p4', T0))
    expect(p.aes.boho.v).toBeGreaterThan(plain.aes.boho.v)
  })
})

describe('createBatchLog', () => {
  it('summarises outcomes for tuning', () => {
    const log = createBatchLog()
    const item = (id, slot) => ({ product: { id }, slot })
    log.served(item('a', 'exploit'))
    log.served(item('b', 'exploit'))
    log.served(item('c', 'wildcard'))
    log.served(item('d', 'adjacent'))
    log.outcome('b', 'like')
    log.outcome('c', 'save')
    log.outcome('c', 'skip') // a skip never overwrites a real outcome
    expect(log.summary()).toEqual({
      shown: 4, likeRate: 0.5, saveRate: 0.25, itemsToFirstLike: 2, exploreLikeRate: 0.5,
    })
  })

  it('reports no first like when nothing was liked', () => {
    const log = createBatchLog()
    log.served({ product: { id: 'a' }, slot: 'exploit' })
    expect(log.summary()).toMatchObject({ itemsToFirstLike: null, exploreLikeRate: null })
  })
})
