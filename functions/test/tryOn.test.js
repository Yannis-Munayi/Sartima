// generateTryOn: Pro gating, monthly allowance → purchased credits, layering.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { call, newUid, getDoc, putDoc } from './fakes.js'

vi.mock('../ai.js', () => ({ generateJson: vi.fn() }))
const fns = await import('../index.js')

const PERSON = 'https://cdn.test/me.jpg'
const garment = (category, n = category) => ({ category, garmentImageUrl: `https://cdn.test/${n}.jpg`, garmentName: n })
const usage = (uid) => getDoc(`users/${uid}/prefs/usage`) ?? {}
const period = () => new Date().toISOString().slice(0, 7)

// Replicate: every prediction succeeds on its first poll; output = input garment + 'on'
function replicateOk() {
  const created = []
  const fetchMock = vi.fn(async (url, opts) => {
    if (opts?.method === 'POST') {
      const body = JSON.parse(opts.body)
      created.push(body.input)
      return { ok: true, json: async () => ({ id: `pred${created.length}`, urls: { get: `https://replicate.test/p/${created.length}` } }) }
    }
    const n = Number(url.split('/').at(-1))
    return { ok: true, json: async () => ({ status: 'succeeded', output: [`https://out.test/${n}.png`] }) }
  })
  vi.stubGlobal('fetch', fetchMock)
  return created
}

async function run(opts) {
  const p = call(fns.generateTryOn, opts)
  p.catch(() => {})
  await vi.runAllTimersAsync()
  return p
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('generateTryOn', () => {
  it('is Pro-only', async () => {
    replicateOk()
    await expect(run({ uid: newUid(), data: { personImageUrl: PERSON, garments: [garment('tops')] } }))
      .rejects.toMatchObject({ code: 'permission-denied', message: 'limit_tryOns' })
  })

  it('chains garments base layer first: bottoms → dresses → tops → outerwear', async () => {
    const created = replicateOk()
    const uid = newUid()
    const out = await run({ uid, tier: 'pro', data: { personImageUrl: PERSON, garments: [garment('outerwear'), garment('tops'), garment('bottoms')] } })
    expect(created.map((i) => i.garm_img)).toEqual(['https://cdn.test/bottoms.jpg', 'https://cdn.test/tops.jpg', 'https://cdn.test/outerwear.jpg'])
    expect(created.map((i) => i.category)).toEqual(['lower_body', 'upper_body', 'upper_body'])
    // each output becomes the next person image
    expect(created[0].human_img).toBe(PERSON)
    expect(created[1].human_img).toBe('https://out.test/1.png')
    expect(out).toEqual({ outputUrl: 'https://out.test/3.png' })
    expect(usage(uid).tryOns).toBe(1)
  })

  it('uses the monthly allowance first, then purchased credits, then stops', async () => {
    replicateOk()
    const uid = newUid()
    putDoc(`users/${uid}/prefs/usage`, { periodKey: period(), tryOns: 30, tryOnCredits: 1 })
    await run({ uid, tier: 'pro', data: { personImageUrl: PERSON, garments: [garment('tops')] } })
    expect(usage(uid)).toMatchObject({ tryOns: 30, tryOnCredits: 0 })
    vi.advanceTimersByTime(31_000) // past the cooldown
    await expect(run({ uid, tier: 'pro', data: { personImageUrl: PERSON, garments: [garment('tops')] } }))
      .rejects.toMatchObject({ code: 'resource-exhausted', message: 'limit_tryOns' })
  })

  it('a new month restores the allowance and keeps credits', async () => {
    replicateOk()
    const uid = newUid()
    putDoc(`users/${uid}/prefs/usage`, { periodKey: '2001-01', tryOns: 30, tryOnCredits: 5 })
    await run({ uid, tier: 'pro', data: { personImageUrl: PERSON, garments: [garment('tops')] } })
    expect(usage(uid)).toMatchObject({ periodKey: period(), tryOns: 1, tryOnCredits: 5 })
  })

  it('admins are never charged', async () => {
    replicateOk()
    const uid = newUid()
    await run({ uid, role: 'admin', data: { personImageUrl: PERSON, garments: [garment('dresses')] } })
    expect(usage(uid).tryOns).toBeUndefined()
  })

  it('makes callers wait 30 seconds between try-ons', async () => {
    replicateOk()
    const uid = newUid()
    await run({ uid, tier: 'pro', data: { personImageUrl: PERSON, garments: [garment('tops')] } })
    await expect(run({ uid, tier: 'pro', data: { personImageUrl: PERSON, garments: [garment('tops')] } }))
      .rejects.toMatchObject({ code: 'resource-exhausted', message: 'Please wait before generating again' })
  })

  it('rejects bad requests without charging a try-on', async () => {
    replicateOk()
    const bad = [
      { personImageUrl: 'http://insecure.test/me.jpg', garments: [garment('tops')] },
      { personImageUrl: PERSON, garments: [] },
      { personImageUrl: PERSON, garments: [garment('tops'), garment('bottoms'), garment('outerwear'), garment('dresses')] },
      { personImageUrl: PERSON, garments: [garment('footwear')] },
      { personImageUrl: PERSON, garments: [{ category: 'tops', garmentImageUrl: 'ftp://x' }] },
    ]
    for (const data of bad) {
      const uid = newUid()
      putDoc(`users/${uid}/prefs/usage`, { periodKey: period(), tryOns: 3, tryOnCredits: 2 })
      await expect(run({ uid, tier: 'pro', data })).rejects.toMatchObject({ code: 'invalid-argument' })
      expect(usage(uid)).toMatchObject({ tryOns: 3, tryOnCredits: 2 })
    }
  })

  it('gives the try-on back when Replicate fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502, text: async () => 'bad gateway' })))
    const uid = newUid()
    putDoc(`users/${uid}/prefs/usage`, { periodKey: period(), tryOns: 30, tryOnCredits: 4 })
    await expect(run({ uid, tier: 'pro', data: { personImageUrl: PERSON, garments: [garment('tops')] } }))
      .rejects.toMatchObject({ code: 'unavailable' })
    expect(usage(uid)).toMatchObject({ tryOns: 30, tryOnCredits: 4 })
  })

  it('reports a failed or timed-out prediction', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => (opts?.method === 'POST'
      ? { ok: true, json: async () => ({ id: 'p', urls: { get: 'https://replicate.test/p/1' } }) }
      : { ok: true, json: async () => ({ status: 'failed' }) })))
    await expect(run({ uid: newUid(), tier: 'pro', data: { personImageUrl: PERSON, garments: [garment('tops')] } }))
      .rejects.toMatchObject({ code: 'internal' })

    vi.stubGlobal('fetch', vi.fn(async (url, opts) => (opts?.method === 'POST'
      ? { ok: true, json: async () => ({ id: 'p', urls: { get: 'https://replicate.test/p/1' } }) }
      : { ok: true, json: async () => ({ status: 'processing' }) })))
    await expect(run({ uid: newUid(), tier: 'pro', data: { personImageUrl: PERSON, garments: [garment('tops')] } }))
      .rejects.toMatchObject({ code: 'deadline-exceeded' })
  })
})
