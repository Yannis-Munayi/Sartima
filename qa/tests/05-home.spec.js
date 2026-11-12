import {
  test, expect, open, go, completeQuiz, closetItem, basicCloset, today, thisMonth,
} from '../lib/fixtures.js'

function seasonLabel() {
  const m = new Date().getMonth()
  if (m <= 1 || m === 11) return 'Winter Picks'
  if (m <= 4) return 'Spring Picks'
  if (m <= 7) return 'Summer Picks'
  return 'Fall Picks'
}

const bell  = (page) => page.getByRole('button', { name: /^Notifications/ })
const panel = (page) => page.getByRole('dialog', { name: 'Notifications' })

const threeTops = () => [
  closetItem('QA Tee One', 'tops'),
  closetItem('QA Tee Two', 'tops'),
  closetItem('QA Tee Three', 'tops'),
]

test.describe('5. Home', () => {
  test.describe('guest', () => {
    test('The hero carousel advances by itself', async ({ page }) => {
      await open(page, 'home')
      const name = page.locator('h2[class*="heroName"]').first()
      const first = (await name.innerText()).trim()
      await expect.poll(async () => (await name.innerText()).trim(), { timeout: 15_000 }).not.toBe(first)
    })

    test('As a guest, the bell also offers "Build your digital closet", and opening it clears the unread badge', async ({ page }) => {
      await open(page, 'home')
      await expect(bell(page)).toHaveAccessibleName('Notifications (1 new)')
      await bell(page).click()
      await expect(panel(page).getByText('Build your digital closet')).toBeVisible()
      await expect(bell(page)).toHaveAccessibleName('Notifications')
      await page.keyboard.press('Escape')
      await expect(panel(page)).toBeHidden()
    })

    test('Fresh Looks, Brands For You and trending aesthetics all show', async ({ page }) => {
      await open(page, 'home')
      await expect(page.getByRole('heading', { name: 'Fresh Looks Today' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Trending Now' })).toBeVisible()
      // Brands For You appears once there's a style profile
      await completeQuiz(page)
      await go(page, 'home')
      await expect(page.getByRole('heading', { name: 'Brands for you' })).toBeVisible()
    })

    test("Seasonal picks disappear once you've pinned an aesthetic", async ({ page }) => {
      await open(page, 'home')
      await expect(page.getByRole('heading', { name: seasonLabel() })).toBeVisible()
      await go(page, 'aesthetic/y2k')
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible()
      await go(page, 'home')
      await expect(page.getByRole('heading', { name: 'Your Saved Aesthetics' })).toBeVisible()
      await expect(page.getByRole('heading', { name: seasonLabel() })).toHaveCount(0)
    })

    test('A new user with no quiz scores sees the guide launcher', async ({ page }) => {
      await open(page, 'home')
      await expect(page.getByText('Take the app tour')).toBeVisible()
    })
  })

  test.describe('free account', () => {
    test.use({ role: 'free' })

    test('With fewer than 3 closet items, the bell offers "Build your digital closet", and tapping it opens Outfits', async ({ page, account }) => {
      await account.reset({ closet: basicCloset().slice(0, 2) })
      await open(page, 'home')
      await bell(page).click()
      await panel(page).getByText('Build your digital closet').click()
      await expect(page).toHaveURL(/#\/daily$/)
    })

    test('With a closet missing a category, the bell shows "You\'re light on X" with AI-written text, and tapping it opens Shop Scout with that piece already chosen', async ({ page, account, fns }) => {
      await account.reset({ closet: threeTops() })
      await open(page, 'home')
      await bell(page).click()
      const gap = panel(page).getByText(/^You're light on \w+/)
      await expect(gap).toBeVisible()
      await expect(panel(page).getByText(/QA stub: one more/)).toBeVisible()
      expect(fns.count('anthropicGapReasoning')).toBeGreaterThan(0)
      await gap.click()
      await expect(page).toHaveURL(/#\/wardrobe-builder\/.+/)
      await expect(page.getByText('Budget & filters')).toBeVisible()
    })

    test('Dismiss a gap → it stays hidden for 14 days', async ({ page, account }) => {
      await account.reset({ closet: threeTops() })
      await open(page, 'home')
      await bell(page).click()
      const gapTitle = (await panel(page).getByText(/^You're light on \w+/).innerText()).trim()
      const category = gapTitle.replace("You're light on ", '')
      await panel(page).getByRole('button', { name: `Dismiss: ${gapTitle}` }).click()
      await expect(panel(page).getByText(gapTitle, { exact: true })).toHaveCount(0)

      await expect.poll(async () => (await account.prefs('gapDismissals'))?.[category] ?? 0).toBeGreaterThan(0)
      await page.reload()
      await bell(page).click()
      await expect(panel(page).getByText(gapTitle, { exact: true })).toHaveCount(0)

      // Older than 14 days → it comes back
      await account.setPrefs('gapDismissals', { [category]: Date.now() - 15 * 86_400_000 })
      await page.reload()
      await bell(page).click()
      await expect(panel(page).getByText(gapTitle, { exact: true })).toBeVisible()
    })

    test("With 3+ closet items, the daily outfit preview shows. With fewer, it doesn't", async ({ page, account }) => {
      await account.reset({ closet: basicCloset().slice(0, 2) })
      await open(page, 'home')
      await expect(page.getByRole('heading', { name: 'Fresh Looks Today' })).toBeVisible()
      await expect(page.getByText("Today's Look", { exact: true })).toHaveCount(0)

      await account.setCloset(basicCloset())
      await page.reload()
      await expect(page.getByText("Today's Look", { exact: true })).toBeVisible({ timeout: 20_000 })
    })

    test("The Wardrobe Recap appears once a month, and dismissing it means it doesn't come back that month", async ({ page, account }) => {
      const closet = basicCloset()
      await account.reset({
        closet,
        log: [{ id: 'log_qa_1', date: today(), itemIds: closet.slice(0, 2).map((i) => i.id), source: 'closet', occasion: 'casual', notes: '', loggedAt: new Date().toISOString() }],
      })
      await account.clearPrefs('recapSeen')
      await open(page, 'home')
      await expect(page.getByText('Your wardrobe this month')).toBeVisible({ timeout: 20_000 })
      await page.keyboard.press('Escape')
      await expect(page.getByText('Your wardrobe this month')).toHaveCount(0)
      await expect.poll(async () => (await account.prefs('recapSeen'))?.lastShownMonth).toBe(thisMonth())
      await page.reload()
      await expect(page.getByRole('heading', { name: 'Fresh Looks Today' })).toBeVisible()
      await expect(page.getByText('Your wardrobe this month')).toHaveCount(0)
    })
  })
})
