import {
  test, expect, open, openOutfitsSubTab, basicCloset, closetItem, today, note, manual,
  fnError, QA_PHOTO,
} from '../lib/fixtures.js'
import { sampleProducts } from '../lib/catalog.js'

test.describe('12. Pro features', () => {
  test.describe('free / guest', () => {
    for (const { tab, copy } of [
      { tab: 'Calendar', copy: 'Outfit Calendar is available on Pro.' },
      { tab: 'Trip',     copy: 'Trip Packer is available on Pro.' },
      { tab: 'Laundry',  copy: 'Laundry care tracking is available on Pro.' },
    ]) {
      test(`As a free user, open ${tab} → it shows the paywall`, async ({ page }) => {
        await open(page, 'daily')
        await page.getByRole('button', { name: tab, exact: true }).first().click()
        await expect(page.getByText(copy)).toBeVisible()
        await expect(page.getByRole('button', { name: /Upgrade — \$6\.99/ })).toBeVisible()
        await expect(page.getByRole('button', { name: /Annual — \$49\.99/ })).toBeVisible()
      })
    }
  })

  test.describe('Pro account', () => {
    test.use({ role: 'pro' })

    async function tryOnReady(account, extraCloset = []) {
      // A fresh avatar timestamp means the try-on cache can't answer for the stub
      await account.mergeUser({ avatarUrl: QA_PHOTO, avatarUpdatedAt: Date.now() })
      await account.reset({ closet: [...basicCloset(), ...extraCloset] })
    }

    test("As Pro, assign an outfit to a day in Calendar → it's still there after a refresh", async ({ page, account }) => {
      await account.reset({ closet: basicCloset() })
      for (const p of await account.plans()) await account.deletePlan(p.id)
      await open(page, 'home')
      await openOutfitsSubTab(page, 'Calendar')
      await page.locator('[class*="dayCellToday"]').click()
      await expect(page.getByText(`Plan for ${today()}`)).toBeVisible()
      await page.locator('[class*="pickerItem"]').filter({ hasText: 'QA White Tee' }).click()
      await page.locator('[class*="pickerItem"]').filter({ hasText: 'QA Navy Chinos' }).click()
      await page.getByRole('button', { name: 'Save Plan' }).click()
      await expect(page.locator('[class*="dayCellToday"] [class*="dayThumb"]').first()).toBeVisible()

      await page.reload()
      await openOutfitsSubTab(page, 'Calendar')
      await expect(page.locator('[class*="dayCellToday"] [class*="dayThumb"]').first()).toBeVisible()
      const plans = await account.plans()
      expect(plans.find((p) => p.date === today())?.itemIds).toEqual(expect.arrayContaining(['qa_qa-white-tee', 'qa_qa-navy-chinos']))
      for (const p of plans) await account.deletePlan(p.id)
    })

    test('As Pro, run Trip with a destination and number of nights → you get a packing list and a daily plan', async ({ page, account, fns }) => {
      note('The trip AI call is stubbed. The monthly limit has its own test below.')
      await account.reset({ closet: basicCloset() })
      await open(page, 'home')
      await openOutfitsSubTab(page, 'Trip')
      await page.getByPlaceholder(/Paris, France/).fill('Lisbon, Portugal')
      await page.locator('[class*="stepBtn"]').filter({ hasText: '+' }).click()
      await page.getByRole('button', { name: '✦ Generate Trip Pack' }).click()
      await expect(page.getByRole('heading', { name: 'Lisbon, Portugal · 4 nights' })).toBeVisible({ timeout: 30_000 })
      await expect(page.getByRole('heading', { name: 'Packing list' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Daily outfits' })).toBeVisible()
      await expect(page.getByText('Day 4 - QA')).toBeVisible()
      expect(fns.last('anthropicTrip')).toMatchObject({ destination: 'Lisbon, Portugal', nights: 4 })
    })

    test.describe('real trip Function', () => {
      test.use({ realFunctions: ['anthropicTrip'] })

      test('As Pro, the 4th trip plan in a month hits the limit', async ({ page, account }) => {
        test.setTimeout(600_000)
        note('Uses the real anthropicTrip Function: tops the account up to its 3 plans for the month (at most 3 real AI calls a month), then checks the next one is refused in the app.')
        await account.reset({ closet: basicCloset() })
        const items = basicCloset().map(({ id, name, category, color }) => ({ id, name, category, color }))
        let refused = null
        for (let i = 0; i < 4 && !refused; i++) {
          const res = await account.call('anthropicTrip', { destination: 'Montreal', nights: 1, items, gender: 'both' })
          if (!res.ok) refused = res
        }
        expect(refused?.status, `the server refuses plans past the monthly limit (got ${refused?.status} ${refused?.message})`).toBe('RESOURCE_EXHAUSTED')

        await open(page, 'home')
        await openOutfitsSubTab(page, 'Trip')
        await page.getByPlaceholder(/Paris, France/).fill('Montreal')
        await page.getByRole('button', { name: '✦ Generate Trip Pack' }).click()
        const error = page.locator('p[class*="error"]').first()
        await expect(error).toBeVisible({ timeout: 60_000 })
        test.info().annotations.push({ type: 'note', description: `The app said: "${(await error.innerText()).trim()}"` })
        await expect(page.getByRole('heading', { name: 'Packing list' })).toHaveCount(0)
      })
    })

    test('As Pro, the Laundry care symbols load', async ({ page, account }) => {
      const weekAgo = new Date(Date.now() - 9 * 86_400_000).toISOString()
      await account.reset({
        closet: [
          closetItem('QA Laundry Tee', 'tops', { color: 'white', washFrequency: 'every-wear', lastWashedAt: weekAgo, careSymbols: ['wash-30'] }),
          closetItem('QA Laundry Jeans', 'bottoms', { color: 'navy', washFrequency: 'every-2-3-wears', lastWashedAt: weekAgo }),
          closetItem('QA Laundry Hoodie', 'tops', { color: 'black' }),
        ],
      })
      await open(page, 'home')
      await openOutfitsSubTab(page, 'Laundry')
      await expect(page.getByRole('heading', { name: 'Next laundry day' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Wash Together' })).toBeVisible()
      await expect(page.getByText('QA Laundry Tee').first()).toBeVisible()
    })

    test('As Pro, try on one garment → you get a result image', async ({ page, account, fns }) => {
      note('generateTryOn is stubbed: real try-ons are paid Replicate calls.')
      await tryOnReady(account)
      await open(page, 'home')
      await openOutfitsSubTab(page, 'My Closet')
      await page.locator('[class*="flipOuter"]').filter({ hasText: 'QA White Tee' }).getByRole('button', { name: 'Try On' }).click()
      await expect(page.getByAltText('Virtual try-on')).toBeVisible({ timeout: 30_000 })
      expect(fns.last('generateTryOn').garments).toHaveLength(1)
      await expect(page.getByRole('button', { name: 'Save look' })).toBeVisible()
    })

    test('Try on several garments → all of them go in one request for the server to layer', async ({ page, account, fns }) => {
      note('The server sorts garments bottoms → dresses → tops → outerwear before chaining them; seeing the layered image needs a paid Replicate call, so check that by hand.')
      await tryOnReady(account)
      await open(page, 'home')
      await openOutfitsSubTab(page, 'My Closet')
      await page.locator('[class*="flipOuter"]').filter({ hasText: 'QA White Tee' }).getByRole('button', { name: 'Try On' }).click()
      await expect(page.getByAltText('Virtual try-on')).toBeVisible({ timeout: 30_000 })
      await page.locator('button[title="Add a piece"]').click()
      await page.getByRole('button', { name: /QA Navy Chinos/ }).click()
      await page.getByRole('button', { name: /Generate Try-On/ }).click()
      await expect.poll(() => fns.count('generateTryOn')).toBe(2)
      const cats = fns.last('generateTryOn').garments.map((g) => g.category).sort()
      expect(cats).toEqual(['bottoms', 'tops'])
    })

    test("Use up the try-on allowance → you're offered a credit pack", async ({ page, account, fns }) => {
      await tryOnReady(account)
      fns.respond('generateTryOn', () => fnError('RESOURCE_EXHAUSTED', 'limit_tryOns'))
      await open(page, 'home')
      await openOutfitsSubTab(page, 'My Closet')
      await page.locator('[class*="flipOuter"]').filter({ hasText: 'QA White Tee' }).getByRole('button', { name: 'Try On' }).click()
      await expect(page.getByText('Out of Try-On credits')).toBeVisible({ timeout: 30_000 })
      await expect(page.getByRole('button', { name: 'Buy 30 more — $2.99' })).toBeVisible()
    })

    test('Try on from a card in the Liked sub-tab → you get a result image', async ({ page, account }) => {
      const [top] = sampleProducts('tops', 1)
      // Catalog products carry their photo as `image`, the way BrandScreen / Search save them
      await account.mergeUser({ avatarUrl: QA_PHOTO, avatarUpdatedAt: Date.now() })
      await account.reset({ liked: [{ ...top, image: QA_PHOTO }] })
      await open(page, 'home')
      await openOutfitsSubTab(page, 'Liked')
      // exact: the whole card is a role="button" whose name also contains "Try On"
      await page.getByRole('button', { name: 'Try On', exact: true }).first().click()
      await expect(page.getByText(/has no photo/)).toHaveCount(0)
      await expect(page.getByAltText('Virtual try-on')).toBeVisible({ timeout: 30_000 })
    })
  })

  test('Real multi-piece try-on layers bottoms → dresses → tops → outerwear', async () => {
    manual('Run one real 2–3 piece try-on as Pro and check the result image layers the pieces correctly. (Paid Replicate call, so not automated.)')
  })
})
