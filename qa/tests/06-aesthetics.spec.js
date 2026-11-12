import { test, expect, open, go, completeQuiz } from '../lib/fixtures.js'

const cards = (page) => page.locator('[class*="cardName"]')

async function pin(page, id) {
  await go(page, `aesthetic/${id}`)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
}

test.describe('6. Aesthetics', () => {
  test('All 51 aesthetics show, and search filters them', async ({ page }) => {
    await open(page, 'explore')
    await expect(page.getByText(/^51 aesthetics/)).toBeVisible()
    await page.getByRole('button', { name: 'Popular', exact: true }).click()
    await expect(cards(page)).toHaveCount(51)

    await page.getByRole('button', { name: 'All', exact: true }).click()
    await page.getByPlaceholder('Search aesthetics…').fill('academia')
    await expect(cards(page).filter({ hasText: /Dark Academia/i }).first()).toBeVisible()
    const n = await cards(page).count()
    expect(n).toBeGreaterThan(0)
    expect(n).toBeLessThan(51)

    await page.getByPlaceholder('Search aesthetics…').fill('zzzz-no-such-style')
    await expect(page.getByText('No aesthetics match')).toBeVisible()
  })

  test('The All, Saved and Popular filters each work', async ({ page }) => {
    await open(page, 'explore')
    await page.getByRole('button', { name: 'Saved', exact: true }).click()
    await expect(page.getByText('No saved aesthetics yet.')).toBeVisible()

    await pin(page, 'y2k')
    // Leave the detail page with its own back arrow (the Aesthetics tab keeps
    // showing the last-opened aesthetic until you do)
    await page.locator('[class*="backBtn"]').first().click()
    await expect(page.getByPlaceholder('Search aesthetics…')).toBeVisible()
    await page.getByRole('button', { name: 'Saved', exact: true }).click()
    await expect(cards(page)).toHaveCount(1)
    await expect(cards(page).first()).toHaveText(/Y2K/i)

    await page.getByRole('button', { name: 'Popular', exact: true }).click()
    await expect(cards(page)).toHaveCount(51)

    await page.getByRole('button', { name: 'All', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Saved', exact: true })).toBeVisible()
  })

  test('With no style signal yet, aesthetics are grouped by category. After the quiz, the list is ranked under "Closest to your style"', async ({ page }) => {
    await open(page, 'explore')
    for (const group of ['Core', 'Subculture', 'Academic & Refined']) {
      await expect(page.getByRole('heading', { name: group, exact: true })).toBeVisible()
    }
    await expect(page.getByRole('heading', { name: 'Closest to your style' })).toHaveCount(0)

    await completeQuiz(page)
    await go(page, 'explore')
    await expect(page.getByText('sorted by your style', { exact: false })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Closest to your style' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Core', exact: true })).toHaveCount(0)
  })

  test('Open an aesthetic → the Story, Items, Looks and Guide tabs all load', async ({ page, pageErrors }) => {
    await open(page, 'explore')
    await cards(page).filter({ hasText: /Old Money/ }).first().click()
    const content = page.locator('[class*="tabContent"]').first()
    for (const tab of ['Story', 'Items', 'Looks', 'Guide']) {
      await page.getByRole('button', { name: tab, exact: true }).click()
      await expect(page.getByRole('button', { name: tab, exact: true })).toHaveAttribute('class', /Active/)
      await expect.poll(async () => (await content.innerText()).trim().length, { message: `${tab} tab has content` }).toBeGreaterThan(20)
    }
    expect(pageErrors).toEqual([])
  })

  test('As a free user, pin 3 aesthetics, then try a 4th → the paywall opens', async ({ page }) => {
    await open(page, 'home')
    for (const id of ['y2k', 'preppy', 'grunge']) {
      await pin(page, id)
      await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible()
    }
    await pin(page, 'minimalist')
    await expect(page.getByText('Pin limit reached')).toBeVisible()
    await expect(page.getByText('Free users can pin up to 3 aesthetics.')).toBeVisible()
  })
})
