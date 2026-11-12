// Quick checks that the live backend answers, with no browser involved.
// Cheap enough to run on every scheduled check of the live site.

import { test, expect, note } from '../lib/fixtures.js'
import * as fb from '../lib/firebase-rest.js'
import { BASE_URL, FIREBASE } from '../lib/env.js'

test.describe('16. Backend health', () => {
  test('The site responds and serves the app', async ({ request }) => {
    const res = await request.get(BASE_URL + '/')
    expect(res.status()).toBe(200)
    const html = await res.text()
    expect(html).toContain('id="root"')
    const script = html.match(/<script[^>]+src="([^"]+\.(?:js|jsx|mjs))"/)?.[1]
    expect(script, 'the page references its JS bundle').toBeTruthy()
    const js = await request.get(new URL(script, BASE_URL + '/').toString())
    expect(js.status()).toBe(200)
  })

  test('validateEmail answers (sign-up email checks work)', async () => {
    test.skip(!FIREBASE.projectId, 'Needs setup: Firebase web config')
    const res = await fb.callFunction(null, 'validateEmail', { email: 'someone@gmail.com' })
    expect(res.ok, `${res.status} ${res.message}`).toBe(true)
    expect(res.result.valid).toBe(true)
  })

  test('searchImages answers with photos (brand and aesthetic imagery work)', async () => {
    test.skip(!FIREBASE.projectId, 'Needs setup: Firebase web config')
    const res = await fb.callFunction(null, 'searchImages', { query: 'trench coat outfit', count: 2, source: 'stock' })
    expect(res.ok, `${res.status} ${res.message}`).toBe(true)
    expect(JSON.stringify(res.result)).toMatch(/https:\/\//)
  })

  test.describe('free account', () => {
    test.use({ role: 'free' })

    test('getWeather answers for a signed-in user', async ({ account }) => {
      note('One real OpenWeatherMap lookup per run.')
      const res = await account.call('getWeather', { lat: 43.65, lon: -79.38 })
      expect(res.ok, `${res.status} ${res.message}`).toBe(true)
      expect(typeof res.result.temp).toBe('number')
    })

    test("Firestore rules let you read your own data but not someone else's", async ({ account }) => {
      expect(await account.user()).toBeTruthy()
      await expect(fb.getDoc(account.session, 'users/qa-someone-else')).rejects.toThrow(/403/)
      await expect(fb.getDoc(account.session, `users/${account.uid}/prefs/usage`)).resolves.toBeDefined()
      // usage is server-written only: a client write must be refused
      await expect(fb.mergeDoc(account.session, `users/${account.uid}/prefs/usage`, { tripPlans: 0 })).rejects.toThrow(/403/)
    })
  })
})
