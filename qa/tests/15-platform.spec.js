import {
  test, expect, open, go, ready, openSettings, basicCloset, note, requireProdBuild,
} from '../lib/fixtures.js'
import { ACCOUNTS, BASE_URL, legalVersion } from '../lib/env.js'
import { sampleProducts } from '../lib/catalog.js'

const HUB_URL = 'http://localhost:5199/qa-hub.html'

/** A stand-in Jarvis hub page that frames the app and talks the bridge protocol. */
async function openHub(page) {
  await page.route(HUB_URL, (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html><body style="margin:0">
<iframe id="app" src="${BASE_URL}/" style="width:1280px;height:800px;border:0"></iframe>
<script>
  window.__hub = []
  window.addEventListener('message', (e) => { if (e.data && e.data['jarvis-hub'] === 1) window.__hub.push(e.data) })
  let n = 0
  window.hubCall = (action, params) => new Promise((resolve) => {
    const id = 'qa' + (++n)
    const onMsg = (e) => {
      const d = e.data
      if (d && d['jarvis-hub'] === 1 && d.type === 'result' && d.id === id) { window.removeEventListener('message', onMsg); resolve(d) }
    }
    window.addEventListener('message', onMsg)
    document.getElementById('app').contentWindow.postMessage({ 'jarvis-hub': 1, type: 'call', id, action, params }, '*')
    setTimeout(() => resolve({ timeout: true }), 20000)
  })
</script></body></html>`,
  }))
  await page.goto(HUB_URL)
  await expect.poll(() => page.evaluate(() => window.__hub.some((m) => m.type === 'ready')), { timeout: 45_000, message: 'the app announces itself to the hub' }).toBe(true)
  return {
    frame: page.frameLocator('#app'),
    call: (action, params = {}) => page.evaluate(([a, p]) => window.hubCall(a, p), [action, params]),
  }
}

test.describe('15. Platform-wide', () => {
  test.describe('guest', () => {
    test('Below 768px wide you get the bottom tab bar. At 768px or wider you get the sidebar', async ({ page }) => {
      const sidebar = page.getByRole('complementary')
      await page.setViewportSize({ width: 1280, height: 800 })
      await open(page, 'home')
      await expect(sidebar).toBeVisible()
      await expect(page.locator('[class*="discoverBtn"]')).toHaveCount(0)

      await page.setViewportSize({ width: 390, height: 844 })
      await expect(page.locator('[class*="discoverBtn"]')).toBeVisible()
      await expect(sidebar).toHaveCount(0)

      await page.setViewportSize({ width: 767, height: 900 })
      await expect(sidebar).toHaveCount(0)
      await page.setViewportSize({ width: 768, height: 900 })
      await expect(sidebar).toBeVisible()
    })

    test('Browser back and forward move through tab history', async ({ page }) => {
      await open(page, 'home')
      await page.getByRole('button', { name: /^Aesthetics/ }).first().click()
      await expect(page).toHaveURL(/#\/explore$/)
      await page.getByRole('button', { name: /^Brands/ }).first().click()
      await expect(page).toHaveURL(/#\/brands$/)
      await page.goBack()
      await expect(page).toHaveURL(/#\/explore$/)
      await expect(page.getByRole('heading', { name: 'Aesthetics', exact: true })).toBeVisible()
      await page.goBack()
      await expect(page).toHaveURL(/#\/home$/)
      await page.goForward()
      await expect(page).toHaveURL(/#\/explore$/)
    })

    test('Open a deep link → it stays on that tab, and the next tab switch updates the address bar', async ({ page }) => {
      await page.goto('/#/brands')
      await ready(page)
      await page.waitForTimeout(1_500)
      await expect(page).toHaveURL(/#\/brands$/)
      await expect(page.getByRole('heading', { name: 'Brands', exact: true })).toBeVisible()
      await page.getByRole('button', { name: /^Aesthetics/ }).first().click()
      await expect(page.getByRole('heading', { name: 'Aesthetics', exact: true })).toBeVisible()
      await expect(page).toHaveURL(/#\/explore$/)
    })

    test('? opens the shortcuts list. g+letter jumps to a tab, and Ctrl/⌘+K works', async ({ page }) => {
      await open(page, 'home')
      await page.keyboard.press('?')
      const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
      await expect(dialog).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)

      for (const [key, hash] of [['b', 'brands'], ['a', 'explore'], ['o', 'daily'], ['h', 'home']]) {
        await page.keyboard.press('g')
        await page.keyboard.press(key)
        await expect(page).toHaveURL(new RegExp(`#/${hash}$`))
      }
      await page.keyboard.press('Control+k')
      await expect(page).toHaveURL(/#\/search$/)
      await expect(page.getByPlaceholder('Search by brand, item, or color…')).toBeFocused()
    })

    test('With two layers open, Esc closes only the top one', async ({ page }) => {
      await open(page, 'daily')
      await page.getByRole('button', { name: 'Calendar', exact: true }).first().click()
      const paywall = page.getByText('Outfit Calendar is available on Pro.')
      await expect(paywall).toBeVisible()
      await page.getByRole('button', { name: 'Terms', exact: true }).click()
      const terms = page.getByRole('dialog').filter({ hasText: 'Terms' })
      await expect(terms).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(terms).toHaveCount(0)
      await expect(paywall).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(paywall).toHaveCount(0)
    })

    test('Shortcuts do nothing while a sheet is open', async ({ page }) => {
      await open(page, 'home')
      await openSettings(page)
      await page.keyboard.press('g')
      await page.keyboard.press('b')
      await page.keyboard.press('?')
      await expect(page).toHaveURL(/#\/profile$/)
      await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
    })

    test("Start the guided tour from a tab's guide button → it steps through the tab, and the search step fills in the query for you", async ({ page }) => {
      await open(page, 'search')
      await page.getByRole('button', { name: 'Take a guided tour of this tab' }).click()
      await expect(page.getByRole('heading', { name: 'Search the Catalog' })).toBeVisible()
      await page.getByRole('button', { name: 'Next →' }).click()
      await expect(page.getByRole('heading', { name: 'Live Results Example' })).toBeVisible()
      await expect(page.getByPlaceholder('Search by brand, item, or color…')).toHaveValue('Ralph Lauren')
      await page.getByRole('button', { name: /Done ✓|Skip tour/ }).first().click()
      await expect(page.getByRole('heading', { name: 'Live Results Example' })).toHaveCount(0)
    })

    test('Actions that confirm or fail show a toast, and it goes away on its own', async ({ page }) => {
      await open(page, 'search')
      await page.getByPlaceholder('Search by brand, item, or color…').fill('Salomon')
      await page.getByRole('button', { name: 'Like', exact: true }).first().click()
      const toast = page.locator('[aria-live="polite"]').filter({ hasText: 'Added to liked' })
      await expect(toast).toHaveClass(/visible/)
      await expect(toast).not.toHaveClass(/visible/, { timeout: 5_000 })
    })

    test('Run Sartima inside Jarvis → the bridge answers the hub. Outside a frame, the bridge does nothing', async ({ page }) => {
      const hub = await openHub(page)
      const described = await hub.call('describe')
      expect(described.ok).toBe(true)
      expect(described.result.app).toBe('sartima')
      expect(described.result.actions.map((a) => a.name)).toEqual(expect.arrayContaining(['list_closet', 'log_outfit', 'save_product', 'search_catalog']))
      const found = await hub.call('search_catalog', { q: 'boots', limit: 3 })
      expect(found.ok).toBe(true)
      expect(JSON.stringify(found.result).toLowerCase()).toContain('boot')
      const closet = await hub.call('list_closet')
      expect(closet.ok, 'closet needs a signed-in user').toBe(false)

      // Same message to the app opened on its own: nobody answers
      await open(page, 'home')
      const answered = await page.evaluate(() => new Promise((resolve) => {
        window.addEventListener('message', (e) => { if (e.data?.type === 'result') resolve(true) })
        window.postMessage({ 'jarvis-hub': 1, type: 'call', id: 'solo', action: 'describe' }, '*')
        setTimeout(() => resolve(false), 2500)
      }))
      expect(answered).toBe(false)
    })
  })

  test.describe('signed out, through the real gate', () => {
    test.use({ role: 'gate' })

    test("Copy a tab's URL and open it in a new tab → it opens on the same tab", async ({ page }) => {
      await page.goto('/#/brands')
      await page.getByRole('button', { name: 'Continue as guest', exact: true }).click()
      await page.getByRole('button', { name: 'Continue as guest anyway', exact: true }).click()
      await ready(page)
      await expect(page).toHaveURL(/#\/brands$/)
      await expect(page.getByRole('heading', { name: 'Brands', exact: true })).toBeVisible()
    })
  })

  test.describe('analytics consent', () => {
    test.use({ consent: null })

    test('With analytics consent declined, no events are sent. Once you accept, events are sent', async ({ page, context }) => {
      note('Analytics requests are intercepted and counted, so no test traffic reaches your real analytics.')
      const sent = []
      await context.route(/google-analytics\.com|googletagmanager\.com|analytics\.google\.com/, (route) => {
        sent.push(route.request().url())
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
      })
      await open(page, 'home')
      await page.getByRole('button', { name: 'Decline', exact: true }).click()
      await page.reload()
      await ready(page)
      await go(page, 'explore')
      await go(page, 'search')
      await page.waitForTimeout(3_000)
      expect(sent, 'no analytics requests after declining').toEqual([])

      await openSettings(page)
      await page.getByRole('button', { name: 'Turn on analytics' }).click()
      await page.reload()
      await ready(page)
      await go(page, 'explore')
      await expect.poll(() => sent.length, { timeout: 20_000, message: 'analytics requests after accepting' }).toBeGreaterThan(0)
    })
  })

  test.describe('production build', () => {
    test('Install the PWA → it launches and the app shell loads offline', async ({ page, context }) => {
      requireProdBuild()
      note('Checks the manifest and service worker, then reloads with the network off. The install prompt itself is a manual check.')
      await open(page, 'home')
      await expect(page.locator('link[rel="manifest"]')).toHaveCount(1)
      const sw = await page.evaluate(() => Promise.race([
        navigator.serviceWorker.ready.then((r) => Boolean(r.active)),
        new Promise((resolve) => setTimeout(() => resolve(false), 30_000)),
      ]))
      expect(sw, 'a service worker is active').toBe(true)
      await page.reload()
      await ready(page)
      await context.setOffline(true)
      try {
        await page.reload()
        await expect(page.getByRole('button', { name: /^Home/ }).first().or(page.getByRole('button', { name: 'Log in', exact: true }))).toBeVisible({ timeout: 30_000 })
      } finally {
        await context.setOffline(false)
      }
    })

    test('In a production build, an uncaught error is reported to Sentry', async ({ page, context }) => {
      requireProdBuild()
      note('Sentry requests are intercepted, so nothing reaches your Sentry project. The "Something went wrong" fallback screen is a manual check.')
      const envelopes = []
      await context.route(/sentry\.io|ingest\.(us|de)\.sentry/, async (route) => {
        envelopes.push(route.request().postData() ?? '')
        await route.fulfill({ status: 200, body: '{}' })
      })
      await open(page, 'home')
      await page.evaluate(() => setTimeout(() => { throw new Error('QA Sentry probe') }, 0))
      await expect.poll(() => envelopes.some((b) => b.includes('QA Sentry probe')), {
        timeout: 20_000, message: 'Sentry sent the error (is VITE_SENTRY_DSN set for production builds?)',
      }).toBe(true)
    })
  })

  test.describe('free account', () => {
    test.use({ role: 'free' })

    test('Bump the legal version → the update banner shows, and "Got it" saves the new version', async ({ page, account }) => {
      await account.reset()
      await account.mergeUser({ legalVersion: '2000-01-01' })
      await open(page, 'home')
      await expect(page.getByText("We've updated our Terms of Service and Privacy Policy.")).toBeVisible()
      await page.getByRole('button', { name: 'Got it', exact: true }).click()
      await expect(page.getByText("We've updated our Terms of Service and Privacy Policy.")).toHaveCount(0)
      await expect.poll(async () => (await account.user())?.legalVersion).toBe(legalVersion())
    })

    test('Run Sartima inside Jarvis → the hub can read your closet, log an outfit and add to your wishlist', async ({ page, account }) => {
      const [product] = sampleProducts('tops', 1)
      await account.reset({ closet: basicCloset() })
      const hub = await openHub(page)
      // A framed app on another site gets its own storage, so it may need its own sign-in
      const login = hub.frame.getByRole('button', { name: 'Log in', exact: true })
      if (await login.isVisible({ timeout: 8_000 }).catch(() => false)) {
        await login.click()
        await hub.frame.getByPlaceholder('you@example.com').fill(ACCOUNTS.free.email)
        await hub.frame.getByPlaceholder('••••••••').fill(ACCOUNTS.free.password)
        await hub.frame.getByRole('button', { name: 'Sign in', exact: true }).click()
      }
      await expect(hub.frame.getByRole('button', { name: /^Home/ }).first()).toBeVisible({ timeout: 45_000 })

      await expect.poll(async () => (await hub.call('list_closet')).ok, { timeout: 20_000 }).toBe(true)
      const closet = await hub.call('list_closet')
      expect(JSON.stringify(closet.result)).toContain('QA White Tee')

      const logged = await hub.call('log_outfit', { item_ids: ['qa_qa-white-tee', 'qa_qa-navy-chinos'], notes: 'QA hub log' })
      expect(logged.ok, logged.error).toBe(true)
      await expect.poll(async () => (await account.prefs('outfitLog'))?.entries?.[0]?.notes).toBe('QA hub log')

      const saved = await hub.call('save_product', { product_id: product.id, list: 'wishlist' })
      expect(saved.ok, saved.error).toBe(true)
      await expect.poll(async () => ((await account.prefs('wishlist'))?.items ?? []).map((i) => i.id)).toContain(product.id)
    })
  })
})
