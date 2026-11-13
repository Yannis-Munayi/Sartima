import {
  test, expect, open, go, openOutfitsSubTab, basicCloset, today, note, STUB_WEATHER,
} from '../lib/fixtures.js'
import { sampleProducts } from '../lib/catalog.js'

const likedSet = () => [...sampleProducts('tops', 2), ...sampleProducts('bottoms', 1), ...sampleProducts('footwear', 1)]

async function openToday(page) {
  await open(page, 'home')
  await openOutfitsSubTab(page, "Today's Outfit")
}

async function generateCasual(page) {
  await page.getByRole('button', { name: /^Casual/ }).first().click()
  await page.getByRole('button', { name: 'Generate Casual Outfit' }).click()
  await expect(page.getByText('QA stub outfit, picked by the test suite.')).toBeVisible({ timeout: 30_000 })
}

async function captureShares(context) {
  await context.addInitScript(() => {
    window.__qaShares = []
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (d) => { window.__qaShares.push({ title: d?.title, files: Array.from(d?.files ?? []).map((f) => ({ name: f.name, type: f.type, size: f.size })) }) },
    })
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true })
  })
}

test.describe('10. Outfits', () => {
  test.describe('Pro account (no daily limit)', () => {
    test.use({ role: 'pro' })

    test("Generate today's outfit from your closet, then from liked items, then from both → each one uses the right items", async ({ page, account, fns }) => {
      const closet = basicCloset()
      const liked = likedSet()
      await account.reset({ closet, liked })
      await openToday(page)
      const ids = (d) => (d.items ?? []).map((i) => i.id)
      const closetIds = closet.map((i) => i.id)
      const likedIds = liked.map((i) => i.id)

      await generateCasual(page)
      expect(ids(fns.last('anthropicOutfit')).every((id) => closetIds.includes(id)), 'closet source sends closet items only').toBe(true)

      await page.locator('[class*="sourcePill"]').filter({ hasText: /^Liked/ }).click()
      await page.getByRole('button', { name: 'Generate Outfit', exact: true }).click()
      await expect.poll(() => fns.count('anthropicOutfit')).toBe(2)
      expect(ids(fns.last('anthropicOutfit')).every((id) => likedIds.includes(id)), 'liked source sends liked items only').toBe(true)

      await page.locator('[class*="sourcePill"]').filter({ hasText: /^Both/ }).click()
      await page.getByRole('button', { name: 'Generate Outfit', exact: true }).click()
      await expect.poll(() => fns.count('anthropicOutfit')).toBe(3)
      const both = ids(fns.last('anthropicOutfit'))
      expect(both.some((id) => closetIds.includes(id)) && both.some((id) => likedIds.includes(id)), 'both source mixes closet and liked').toBe(true)
    })

    test('The weather shows and affects which outfit you get', async ({ page, account, fns }) => {
      note('Weather comes from a stubbed getWeather (4°C, rain); the test checks it is shown and sent to the outfit generator.')
      await account.reset({ closet: basicCloset() })
      await openToday(page)
      await expect(page.getByText(`${STUB_WEATHER.temp}°C`)).toBeVisible()
      await expect(page.getByText(new RegExp(STUB_WEATHER.city))).toBeVisible()
      await generateCasual(page)
      expect(fns.last('anthropicOutfit').weather?.condition).toBe(STUB_WEATHER.condition)
      await expect(page.getByText('QA weather note: Rain')).toBeVisible()
    })

    test('Log an outfit → timesWorn and lastWorn are updated on each item', async ({ page, account, fns }) => {
      await account.reset({ closet: basicCloset() })
      await openToday(page)
      await generateCasual(page)
      const picked = fns.last('anthropicOutfit').items.slice(0, 3).map((i) => i.id)
      await page.getByRole('button', { name: 'Log this outfit' }).click()
      await page.getByPlaceholder(/Add a note/).fill('QA log entry')
      await page.getByRole('button', { name: 'Save Entry' }).click()
      await expect(page.getByText('Outfit logged ✓')).toBeVisible()
      await expect.poll(async () => {
        const items = await account.closet()
        return picked.every((id) => {
          const it = items.find((i) => i.id === id)
          return it?.timesWorn >= 1 && it?.lastWorn === today()
        })
      }, { timeout: 20_000 }).toBe(true)
      expect((await account.prefs('outfitLog'))?.entries?.[0]?.notes).toBe('QA log entry')
    })

    test('Share an outfit → a PNG card is created', async ({ page, context, account }) => {
      await captureShares(context)
      await account.reset({ closet: basicCloset() })
      await openToday(page)
      await generateCasual(page)
      await page.getByRole('button', { name: '↗ Share' }).click()
      await expect.poll(() => page.evaluate(() => window.__qaShares.length), { timeout: 20_000 }).toBe(1)
      const [shared] = await page.evaluate(() => window.__qaShares)
      expect(shared.files[0]?.type).toBe('image/png')
      expect(shared.files[0]?.size).toBeGreaterThan(1_000)
    })
  })

  test.describe('free account', () => {
    test.use({ role: 'free' })

    test('As a free user, generate a second outfit on the same day → the paywall opens', async ({ page, account }) => {
      note("Uses today's free generation through the real anthropicOutfit Function (one call a day at most), then checks the app blocks the next one.")
      await account.reset({ closet: basicCloset() })
      const items = basicCloset().slice(0, 3).map(({ id, name, category, color }) => ({ id, name, category, color, seasons: [], occasions: [] }))
      const first = await account.call('anthropicOutfit', { items, weather: null, occasion: 'casual', dateStr: today(), occupation: null })
      expect(first.ok || first.status === 'RESOURCE_EXHAUSTED', `setup call: ${first.status} ${first.message}`).toBe(true)
      await expect.poll(async () => (await account.usage()).lastOutfitDate).toBe(new Date().toISOString().slice(0, 10))

      await openToday(page)
      await page.getByRole('button', { name: /^Casual/ }).first().click()
      await page.getByRole('button', { name: 'Generate Casual Outfit' }).click()
      await expect(page.getByText('Daily outfit used')).toBeVisible()
      await expect(page.getByText('Free users get one AI outfit per day.')).toBeVisible()
    })

    test('Create an outfit board. As a free user, try to make a 2nd board → the paywall opens', async ({ page, account }) => {
      note('Boards are built in the Try On studio at #/mystyle (the Outfits tab lists them under My Outfits but has no create button).')
      await account.reset({ closet: basicCloset() })
      await open(page, 'mystyle/boards')

      async function buildBoard(name) {
        await page.getByRole('button', { name: 'Tops', exact: true }).first().click()
        await page.locator('[class*="itemCard"]').filter({ hasText: 'QA White Tee' }).first().click()
        await page.getByRole('button', { name: /^Save Outfit \(/ }).click()
        const input = page.getByPlaceholder('Outfit name (e.g. Sunday Brunch)')
        await input.fill(name)
        await input.press('Enter')
        // Enter submits and closes the sheet (and on a free account's 2nd board the paywall opens over
        // the studio). Only fall back to the sheet's own Save button if the sheet is genuinely still open —
        // a loose /^Save/ match would hit the studio's "Save Outfit (n)" button behind the paywall.
        const closed = await input.waitFor({ state: 'hidden', timeout: 3_000 }).then(() => true, () => false)
        if (!closed) await page.getByRole('button', { name: 'Save', exact: true }).last().click()
      }

      await buildBoard('QA Board One')
      await expect.poll(async () => ((await account.prefs('outfitBoards'))?.items ?? []).length).toBe(1)
      await openOutfitsSubTab(page, 'My Outfits')
      await expect(page.getByText('Saved Outfits')).toBeVisible()
      await expect(page.getByText('QA Board One')).toBeVisible()

      await go(page, 'mystyle/boards')
      await buildBoard('QA Board Two')
      await expect(page.getByText('Board limit reached')).toBeVisible()
      expect(((await account.prefs('outfitBoards'))?.items ?? []).length).toBe(1)
    })

    test('The Liked sub-tab groups your liked items by category', async ({ page, account }) => {
      const liked = [...sampleProducts('footwear', 2), ...sampleProducts('tops', 1)]
      await account.reset({ liked })
      await open(page, 'home')
      await openOutfitsSubTab(page, 'Liked')
      await expect(page.getByText(`${liked.length} pieces liked`)).toBeVisible()
      const footwear = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Footwear', exact: true }) })
      const tops = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Tops', exact: true }) })
      await expect(footwear.locator('[class*="sectionCount"]')).toHaveText('2')
      await expect(tops.locator('[class*="sectionCount"]')).toHaveText('1')
    })

    test("Open a liked item's action sheet → Pinterest, Shop and Remove from liked each work", async ({ page, account }) => {
      note('The sheet offers View on Pinterest, Shop at <brand>, a brand search link and Remove from liked. It has no try-on, add-to-closet or share actions.')
      // Distinct names: the catalog has colourways sharing a name (e.g. two Supima tees),
      // which would make the "removed item is gone" check below see the other one.
      const liked = sampleProducts('tops', 20)
        .filter((p, i, all) => all.findIndex((q) => q.name === p.name) === i)
        .slice(0, 2)
      await account.reset({ liked })
      await open(page, 'home')
      await openOutfitsSubTab(page, 'Liked')
      await page.getByText(liked[0].name, { exact: true }).first().click()
      // Scope to the sheet: each liked card in the grid has its own "Shop at <brand>" link too.
      const sheet = page.getByRole('dialog', { name: liked[0].name })
      await expect(sheet.getByRole('link', { name: /View on Pinterest/ })).toHaveAttribute('href', /pinterest\./)
      await expect(sheet.getByRole('link', { name: new RegExp(`Shop at ${liked[0].brand}`) })).toHaveAttribute('href', /^https?:/)
      await sheet.getByRole('button', { name: /Remove from liked/ }).click()
      await expect(page.getByText(liked[0].name, { exact: true })).toHaveCount(0)
      await expect.poll(async () => ((await account.prefs('liked'))?.items ?? []).map((i) => i.id)).not.toContain(liked[0].id)
    })
  })
})
