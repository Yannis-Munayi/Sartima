// AI callables, plan limits and the smaller utility functions.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpsError } from 'firebase-functions/v2/https'
import { call, newUid, getDoc, putDoc, mail, messaging, fake } from './fakes.js'

vi.mock('../ai.js', () => ({ generateJson: vi.fn() }))
vi.mock('../emailValidation.js', () => ({ checkEmail: vi.fn() }))

const { generateJson } = await import('../ai.js')
const { checkEmail } = await import('../emailValidation.js')
const fns = await import('../index.js')

const usage = (uid) => getDoc(`users/${uid}/prefs/usage`) ?? {}
const items3 = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

beforeEach(() => {
  generateJson.mockReset()
  checkEmail.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('every signed-in callable refuses anonymous calls', () => {
  const signedIn = ['anthropicVision', 'anthropicOutfit', 'anthropicGapReasoning', 'anthropicTrip', 'getWeather', 'proxyImage',
    'generateTryOn', 'createStripeCheckout', 'createStripeBillingPortal', 'purchaseTryOnPack', 'deleteAccount']
  for (const name of signedIn) {
    it(name, async () => {
      await expect(call(fns[name], { data: {} })).rejects.toMatchObject({ code: 'unauthenticated' })
    })
  }
})

describe('anthropicVision (closet photo upload)', () => {
  it('turns model boxes into crop percentages and caps at 10 items', async () => {
    const uid = newUid()
    generateJson.mockResolvedValueOnce({
      items: [
        { name: 'Tee', category: 'tops', color: 'white', description: 'x', box_2d: [100, 200, 500, 800] },
        { name: 'Bag', category: 'accessories', color: 'black', description: 'x', box_2d: [0, 0, 0, 0] },
        { name: 'Odd', category: 'tops', color: 'red', description: 'x', box_2d: 'nope' },
        ...Array.from({ length: 10 }, (_, i) => ({ name: `x${i}`, category: 'tops', color: 'c', description: 'd', box_2d: [0, 0, 1000, 1000] })),
      ],
    })
    const { items } = await call(fns.anthropicVision, { uid, data: { imageBase64: 'AAA' } })
    expect(items).toHaveLength(10)
    expect(items[0]).toMatchObject({ name: 'Tee', bbox: { x: 20, y: 10, w: 60, h: 40 } })
    expect(items[0]).not.toHaveProperty('box_2d')
    expect(items[1].bbox).toBeNull()
    expect(items[2].bbox).toBeNull()
  })

  it('free accounts get 3 uploads a month, then resource-exhausted', async () => {
    const uid = newUid()
    generateJson.mockResolvedValue({ items: [] })
    for (let i = 0; i < 3; i++) await call(fns.anthropicVision, { uid, data: { imageBase64: 'A' } })
    await expect(call(fns.anthropicVision, { uid, data: { imageBase64: 'A' } }))
      .rejects.toMatchObject({ code: 'resource-exhausted', message: 'limit_visionUploads' })
    expect(usage(uid).visionUploads).toBe(3)
    expect(generateJson).toHaveBeenCalledTimes(3)
  })

  it('pro gets 30, admin is unlimited', async () => {
    const pro = newUid()
    putDoc(`users/${pro}/prefs/usage`, { periodKey: new Date().toISOString().slice(0, 7), visionUploads: 29 })
    generateJson.mockResolvedValue({ items: [] })
    await call(fns.anthropicVision, { uid: pro, tier: 'pro', data: { imageBase64: 'A' } })
    await expect(call(fns.anthropicVision, { uid: pro, tier: 'pro', data: { imageBase64: 'A' } })).rejects.toMatchObject({ code: 'resource-exhausted' })

    const adm = newUid()
    putDoc(`users/${adm}/prefs/usage`, { periodKey: new Date().toISOString().slice(0, 7), visionUploads: 500 })
    await expect(call(fns.anthropicVision, { uid: adm, role: 'admin', data: { imageBase64: 'A' } })).resolves.toBeDefined()
  })

  it('a new month resets the counter', async () => {
    const uid = newUid()
    putDoc(`users/${uid}/prefs/usage`, { periodKey: '2001-01', visionUploads: 3, tryOnCredits: 7 })
    generateJson.mockResolvedValue({ items: [] })
    await call(fns.anthropicVision, { uid, data: { imageBase64: 'A' } })
    expect(usage(uid)).toMatchObject({ periodKey: new Date().toISOString().slice(0, 7), visionUploads: 1, tryOnCredits: 7 })
  })

  it('an AI failure gives the upload back', async () => {
    const uid = newUid()
    generateJson.mockRejectedValueOnce(new HttpsError('unavailable', 'AI is temporarily unavailable'))
    await expect(call(fns.anthropicVision, { uid, data: { imageBase64: 'A' } })).rejects.toMatchObject({ code: 'unavailable' })
    expect(usage(uid).visionUploads).toBe(0)
  })

  it('rejects a missing image without charging', async () => {
    const uid = newUid()
    await expect(call(fns.anthropicVision, { uid, data: {} })).rejects.toMatchObject({ code: 'invalid-argument' })
    expect(usage(uid).visionUploads).toBeUndefined()
  })
})

describe('anthropicOutfit (daily outfit)', () => {
  const data = { items: items3, occasion: 'casual', dateStr: '2026-11-12', weather: { temp: 4, condition: 'Snow', description: 'snow' } }

  it('returns the AI pick and passes weather into the prompt', async () => {
    const uid = newUid()
    generateJson.mockResolvedValueOnce({ selectedIds: ['a', 'b'], missingCategory: null })
    expect(await call(fns.anthropicOutfit, { uid, data })).toEqual({ selectedIds: ['a', 'b'], missingCategory: null })
    expect(generateJson.mock.calls[0][0].prompt).toMatch(/4°C, condition: Snow/)
  })

  it('free accounts get one generation per day', async () => {
    const uid = newUid()
    generateJson.mockResolvedValue({ selectedIds: [] })
    await call(fns.anthropicOutfit, { uid, data })
    await expect(call(fns.anthropicOutfit, { uid, data })).rejects.toMatchObject({ code: 'resource-exhausted', message: 'limit_outfitGenerations' })
    expect(usage(uid).lastOutfitDate).toBe(new Date().toISOString().slice(0, 10))
  })

  it("yesterday's generation doesn't count today", async () => {
    const uid = newUid()
    putDoc(`users/${uid}/prefs/usage`, { lastOutfitDate: '2001-01-01' })
    generateJson.mockResolvedValue({ selectedIds: [] })
    await expect(call(fns.anthropicOutfit, { uid, data })).resolves.toBeDefined()
  })

  it('pro is not limited per day', async () => {
    const uid = newUid()
    generateJson.mockResolvedValue({ selectedIds: [] })
    await call(fns.anthropicOutfit, { uid, tier: 'pro', data })
    await expect(call(fns.anthropicOutfit, { uid, tier: 'pro', data })).resolves.toBeDefined()
  })

  it("a failed generation doesn't use up the free daily one", async () => {
    const uid = newUid()
    generateJson.mockRejectedValueOnce(new HttpsError('unavailable', 'down'))
    await expect(call(fns.anthropicOutfit, { uid, data })).rejects.toMatchObject({ code: 'unavailable' })
    expect(usage(uid).lastOutfitDate).toBeUndefined()
    generateJson.mockResolvedValueOnce({ selectedIds: [] })
    await expect(call(fns.anthropicOutfit, { uid, data })).resolves.toBeDefined()
  })

  it("a request with fewer than 3 items is rejected without using the day's generation", async () => {
    const uid = newUid()
    await expect(call(fns.anthropicOutfit, { uid, data: { ...data, items: [{ id: 'a' }] } }))
      .rejects.toMatchObject({ code: 'invalid-argument' })
    expect(usage(uid).lastOutfitDate).toBeUndefined()
  })
})

describe('anthropicGapReasoning (Home bell copy)', () => {
  it('returns the reasoning line and counts toward the monthly allowance', async () => {
    const uid = newUid()
    generateJson.mockResolvedValueOnce({ reasoning: 'A pair of chinos would anchor your tees.' })
    const out = await call(fns.anthropicGapReasoning, { uid, data: { category: 'bottoms', owned: 1, target: 3, topStyles: ['Preppy'] } })
    expect(out).toEqual({ reasoning: 'A pair of chinos would anchor your tees.' })
    expect(usage(uid).gapReasoning).toBe(1)
    expect(generateJson.mock.calls[0][0].prompt).toMatch(/Preppy/)
  })

  it('stops free accounts at 20 a month', async () => {
    const uid = newUid()
    putDoc(`users/${uid}/prefs/usage`, { periodKey: new Date().toISOString().slice(0, 7), gapReasoning: 20 })
    await expect(call(fns.anthropicGapReasoning, { uid, data: { category: 'tops' } })).rejects.toMatchObject({ code: 'resource-exhausted' })
  })

  it('a request without a category is rejected without being counted', async () => {
    const uid = newUid()
    await expect(call(fns.anthropicGapReasoning, { uid, data: {} })).rejects.toMatchObject({ code: 'invalid-argument' })
    expect(usage(uid).gapReasoning ?? 0).toBe(0)
  })

  it('an AI failure is refunded', async () => {
    const uid = newUid()
    generateJson.mockRejectedValueOnce(new HttpsError('unavailable', 'down'))
    await expect(call(fns.anthropicGapReasoning, { uid, data: { category: 'tops' } })).rejects.toThrow()
    expect(usage(uid).gapReasoning).toBe(0)
  })
})

describe('anthropicTrip (Trip Packer)', () => {
  const data = { destination: 'Lisbon', nights: 4, items: items3, gender: 'women' }

  it('free accounts cannot plan trips', async () => {
    const uid = newUid()
    await expect(call(fns.anthropicTrip, { uid, data })).rejects.toMatchObject({ code: 'resource-exhausted', message: 'limit_tripPlans' })
    expect(generateJson).not.toHaveBeenCalled()
  })

  it('pro gets 3 plans a month', async () => {
    const uid = newUid()
    generateJson.mockResolvedValue({ destination: 'Lisbon', packingList: [] })
    for (let i = 0; i < 3; i++) await call(fns.anthropicTrip, { uid, tier: 'pro', data })
    await expect(call(fns.anthropicTrip, { uid, tier: 'pro', data })).rejects.toMatchObject({ code: 'resource-exhausted' })
    expect(usage(uid).tripPlans).toBe(3)
  })

  it('an invalid request does not use up one of the 3 monthly plans', async () => {
    const uid = newUid()
    await expect(call(fns.anthropicTrip, { uid, tier: 'pro', data: { ...data, destination: '' } })).rejects.toMatchObject({ code: 'invalid-argument' })
    await expect(call(fns.anthropicTrip, { uid, tier: 'pro', data: { ...data, items: [] } })).rejects.toMatchObject({ code: 'invalid-argument' })
    expect(usage(uid).tripPlans ?? 0).toBe(0)
  })

  it('an AI failure is refunded', async () => {
    const uid = newUid()
    generateJson.mockRejectedValueOnce(new HttpsError('unavailable', 'down'))
    await expect(call(fns.anthropicTrip, { uid, tier: 'pro', data })).rejects.toThrow()
    expect(usage(uid).tripPlans).toBe(0)
  })
})

describe('getWeather', () => {
  it('maps OpenWeatherMap into the app shape', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ name: 'Toronto', main: { temp: 3.6, feels_like: -1.2, humidity: 80 }, weather: [{ main: 'Snow', description: 'light snow', icon: '13d' }], wind: { speed: 4.4 } }) }))
    vi.stubGlobal('fetch', fetchMock)
    const w = await call(fns.getWeather, { uid: newUid(), data: { lat: 43.6, lon: -79.4 } })
    expect(w).toMatchObject({ city: 'Toronto', temp: 4, feelsLike: -1, condition: 'Snow', humidity: 80, windSpeed: 4 })
    expect(fetchMock.mock.calls[0][0]).toMatch(/lat=43.6&lon=-79.4&units=metric&appid=ow-key/)
  })

  it('validates input and reports upstream problems', async () => {
    const uid = newUid()
    await expect(call(fns.getWeather, { uid, data: { lat: 1 } })).rejects.toMatchObject({ code: 'invalid-argument' })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
    await expect(call(fns.getWeather, { uid, data: { lat: 1, lon: 2 } })).rejects.toMatchObject({ code: 'unavailable' })
    delete process.env.OPENWEATHER_KEY
    await expect(call(fns.getWeather, { uid, data: { lat: 1, lon: 2 } })).rejects.toMatchObject({ code: 'failed-precondition' })
  })
})

describe('searchImages (guest-friendly photo search)', () => {
  const unsplash = (n) => ({ ok: true, status: 200, json: async () => ({ results: Array.from({ length: n }, (_, i) => ({ urls: { raw: `https://images.unsplash.com/u${i}?ixid=1` } })) }) })
  const pexels = (n) => ({ ok: true, status: 200, json: async () => ({ photos: Array.from({ length: n }, (_, i) => ({ src: { large2x: `https://images.pexels.com/p${i}` } })) }) })

  it('works for guests and prefers Unsplash at a sharper size', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => unsplash(2)))
    const { urls } = await call(fns.searchImages, { data: { query: `q-${newUid()}`, count: 2 } })
    expect(urls).toEqual(['https://images.unsplash.com/u0?ixid=1&w=1600&q=80&fit=max&auto=format', 'https://images.unsplash.com/u1?ixid=1&w=1600&q=80&fit=max&auto=format'])
  })

  it('falls back to Pexels when Unsplash is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => (url.includes('unsplash') ? unsplash(0) : pexels(1))))
    const { urls } = await call(fns.searchImages, { data: { query: `q-${newUid()}` } })
    expect(urls).toEqual(['https://images.pexels.com/p0'])
  })

  it('serves repeats from cache without calling the providers', async () => {
    const fetchMock = vi.fn(async () => unsplash(1))
    vi.stubGlobal('fetch', fetchMock)
    const q = `cached-${newUid()}`
    await call(fns.searchImages, { data: { query: q } })
    await call(fns.searchImages, { data: { query: q } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rate-limits one caller after a burst of 60 uncached searches', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => pexels(0)))
    const ip = `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`
    for (let i = 0; i < 60; i++) await call(fns.searchImages, { ip, data: { query: `burst-${i}-${ip}`, source: 'pexels' } })
    await expect(call(fns.searchImages, { ip, data: { query: `burst-x-${ip}`, source: 'pexels' } }))
      .rejects.toMatchObject({ code: 'resource-exhausted' })
    // Someone else is unaffected
    await expect(call(fns.searchImages, { ip: '10.250.0.1', data: { query: `other-${ip}`, source: 'pexels' } })).resolves.toBeDefined()
  })

  it('requires a query', async () => {
    await expect(call(fns.searchImages, { data: {} })).rejects.toMatchObject({ code: 'invalid-argument' })
  })
})

describe('proxyImage', () => {
  it('fetches allow-listed image hosts only', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer, headers: { get: () => 'image/png' } })))
    const uid = newUid()
    expect(await call(fns.proxyImage, { uid, data: { url: 'https://images.pexels.com/x.png' } })).toEqual({ dataUrl: 'data:image/png;base64,AQID' })
    await expect(call(fns.proxyImage, { uid, data: { url: 'https://encrypted-tbn2.gstatic.com/x' } })).resolves.toBeDefined()
    for (const url of ['https://evil.example/x.png', 'https://images.pexels.com.evil.example/x', 'http://169.254.169.254/latest/meta-data']) {
      await expect(call(fns.proxyImage, { uid, data: { url } })).rejects.toMatchObject({ code: 'permission-denied' })
    }
    await expect(call(fns.proxyImage, { uid, data: { url: 'not a url' } })).rejects.toMatchObject({ code: 'invalid-argument' })
  })
})

describe('validateEmail', () => {
  it('passes the result through, and turns DNS outages into "unavailable"', async () => {
    checkEmail.mockResolvedValueOnce({ valid: true })
    expect(await call(fns.validateEmail, { data: { email: 'a@gmail.com' } })).toEqual({ valid: true })
    checkEmail.mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' }))
    await expect(call(fns.validateEmail, { data: { email: 'a@b.co' } })).rejects.toMatchObject({ code: 'unavailable' })
    await expect(call(fns.validateEmail, { data: { email: 42 } })).rejects.toMatchObject({ code: 'invalid-argument' })
  })
})

describe('submitFeedback / submitCrashReport', () => {
  it('saves feedback (trimmed and capped) and emails it', async () => {
    await call(fns.submitFeedback, { uid: 'fb-user', data: { category: 'Bug', message: `  ${'x'.repeat(3000)}  `, contactEmail: 'me@x.co' } })
    const saved = [...fake.docs.entries()].find(([p]) => p.startsWith('feedback/'))[1]
    expect(saved).toMatchObject({ category: 'Bug', contactEmail: 'me@x.co', uid: 'fb-user' })
    expect(saved.message).toHaveLength(2000)
    expect(mail.sendMail).toHaveBeenCalledOnce()
    expect(mail.sendMail.mock.calls[0][0].subject).toBe('[Sartima Feedback] Bug')
  })

  it('rejects empty feedback and skips email without a mail password', async () => {
    await expect(call(fns.submitFeedback, { data: { message: 'hi' } })).rejects.toMatchObject({ code: 'invalid-argument' })
    delete process.env.GMAIL_APP_PASSWORD
    await call(fns.submitFeedback, { data: { message: 'works for guests too' } })
    expect(mail.sendMail).not.toHaveBeenCalled()
  })

  it('crash reports keep diagnostics and summarise the last errors', async () => {
    const logs = [
      ...Array.from({ length: 7 }, (_, i) => ({ type: 'error', message: `e${i}` })),
      { type: 'networkError', message: 'fetch failed' },
    ]
    await call(fns.submitCrashReport, { data: { doing: 'Saving', saw: 'Spinner', diagnostics: { logs, browser: { userAgent: 'UA', url: '#/daily' } } } })
    const text = mail.sendMail.mock.calls[0][0].text
    expect(text).toMatch(/Errors in session \(7 total, last 5\)/)
    expect(text).toMatch(/\[error\] e6/)
    expect(text).not.toMatch(/\[error\] e1\b/)
    expect(text).toMatch(/Network failures: 1/)
  })
})

describe('sendDailyOutfitReminders', () => {
  const at = (iso) => vi.useFakeTimers({ toFake: ['Date'], now: new Date(iso) })

  it('pushes to users whose local reminder time falls in this 15-minute window', async () => {
    at('2026-11-12T13:05:00Z') // 08:05 in Toronto, 14:05 in Paris
    putDoc('users/due/prefs/notifications', { enabled: true, fcmTokens: ['t1'], reminderTime: '08:00', timezone: 'America/Toronto' })
    putDoc('users/later/prefs/notifications', { enabled: true, fcmTokens: ['t2'], reminderTime: '08:30', timezone: 'America/Toronto' })
    putDoc('users/paris/prefs/notifications', { enabled: true, fcmTokens: ['t3'], reminderTime: '14:00', timezone: 'Europe/Paris' })
    putDoc('users/off/prefs/notifications', { enabled: false, fcmTokens: ['t4'], reminderTime: '08:00', timezone: 'America/Toronto' })
    putDoc('users/bad/prefs/notifications', { enabled: true, fcmTokens: ['t5'], reminderTime: '08:00', timezone: 'Not/AZone' })
    await fns.sendDailyOutfitReminders.run({})
    expect(messaging.send.mock.calls.map(([m]) => m.token).sort()).toEqual(['t1', 't3'])
    expect(messaging.send.mock.calls[0][0].webpush.fcmOptions.link).toBe('/?tab=daily')
  })

  it('drops tokens that are no longer registered', async () => {
    at('2026-11-12T13:00:00Z')
    putDoc('users/u/prefs/notifications', { enabled: true, fcmTokens: ['good', 'stale'], reminderTime: '08:00', timezone: 'America/Toronto' })
    messaging.send.mockImplementation(async ({ token }) => {
      if (token === 'stale') throw Object.assign(new Error('gone'), { code: 'messaging/registration-token-not-registered' })
      return 'ok'
    })
    await fns.sendDailyOutfitReminders.run({})
    expect(getDoc('users/u/prefs/notifications').fcmTokens).toEqual(['good'])
  })

  it('defaults to 08:00 and skips users without tokens', async () => {
    at('2026-11-12T08:10:00Z')
    putDoc('users/a/prefs/notifications', { enabled: true, fcmTokens: ['x'], timezone: 'UTC' })
    putDoc('users/b/prefs/notifications', { enabled: true, fcmTokens: [], timezone: 'UTC' })
    await fns.sendDailyOutfitReminders.run({})
    expect(messaging.send).toHaveBeenCalledOnce()
  })
})
