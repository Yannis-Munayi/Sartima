import { test, expect, open, go, completeQuiz, openOutfitsSubTab } from '../lib/fixtures.js'

const BRAND = 'ralph-lauren'

test.describe('7. Brands', () => {
  test.describe('guest', () => {
    test('The brand list loads with images', async ({ page }) => {
      await open(page, 'brands')
      await expect(page.getByRole('heading', { name: 'Brands', exact: true })).toBeVisible()
      await expect(page.getByText(/^\d+ brands/)).toBeVisible()
      await expect.poll(
        () => page.locator('img').evaluateAll((imgs) => imgs.filter((i) => i.complete && i.naturalWidth > 0).length),
        { timeout: 30_000, message: 'brand images loaded' },
      ).toBeGreaterThanOrEqual(4)
    })

    test("With no style signal they're grouped by positioning. After the quiz they're ranked by fit", async ({ page }) => {
      await open(page, 'brands')
      for (const group of ['Luxury', 'Premium', 'Contemporary']) {
        await expect(page.getByRole('heading', { name: group, exact: true })).toBeVisible()
      }
      await completeQuiz(page)
      await go(page, 'brands')
      await expect(page.getByText('sorted by your style', { exact: false })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Closest to your style' })).toBeVisible()
    })

    test('Open a brand → the Story, Lines, Collections and Shop tabs load', async ({ page, pageErrors }) => {
      await open(page, `brand/${BRAND}`)
      await expect(page.getByRole('heading', { name: 'Ralph Lauren' })).toBeVisible()
      await expect(page.getByText(/^Est\. /).first()).toBeVisible()

      await page.getByRole('button', { name: 'Lines', exact: true }).click()
      await expect(page.locator('[class*="lineCard"], [class*="emptyText"]').first()).toBeVisible()

      await page.getByRole('button', { name: 'Collections', exact: true }).click()
      await expect(page.locator('[class*="collectionCard"]').first()).toBeVisible()

      await page.getByRole('button', { name: 'Shop', exact: true }).click()
      await expect(page.locator('[class*="shopCard"]').first()).toBeVisible()
      expect(pageErrors).toEqual([])
    })

    test('Leave a brand page with Back → you return to the tab you opened it from', async ({ page }) => {
      await open(page, 'search')
      await expect(page.getByText('Find something specific')).toBeVisible()
      await go(page, `brand/${BRAND}`)
      await expect(page.getByRole('heading', { name: 'Ralph Lauren' })).toBeVisible()
      await page.locator('[class*="backBtn"]').first().click()
      await expect(page).toHaveURL(/#\/search$/)
      await expect(page.getByText('Find something specific')).toBeVisible()
    })
  })

  test.describe('free account', () => {
    test.use({ role: 'free' })

    test('Like a product from the Shop tab → it appears in Liked', async ({ page, account }) => {
      await account.reset()
      await open(page, `brand/${BRAND}`)
      await page.getByRole('button', { name: 'Shop', exact: true }).click()
      const card = page.locator('[class*="shopCard"]').first()
      const name = (await card.locator('[class*="shopCardName"]').innerText()).trim()
      await card.getByRole('button', { name: 'Like', exact: true }).click()
      await expect(page.getByText('Added to liked')).toBeVisible()
      await expect.poll(async () => ((await account.prefs('liked'))?.items ?? []).map((i) => i.name)).toContain(name)

      await openOutfitsSubTab(page, 'Liked')
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
    })
  })
})
