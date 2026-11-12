import { test, expect, open, go, openSettings, currentCardName, note } from '../lib/fixtures.js'
import { productsNamed } from '../lib/catalog.js'

const like = (page) => page.getByRole('button', { name: 'Like', exact: true })
const skip = (page) => page.getByRole('button', { name: 'Skip', exact: true })

async function openFeed(page) {
  await open(page, 'home')
  await go(page, 'quiz')
  await expect(page.getByText('Swipe to explore')).toBeVisible({ timeout: 20_000 })
}

/** Swipes n cards; `decide(name)` returns true to like. Returns the names seen. */
async function swipe(page, n, decide) {
  const seen = []
  for (let i = 0; i < n; i++) {
    await expect(like(page)).toBeVisible({ timeout: 15_000 })
    const name = await currentCardName(page)
    seen.push(name)
    await (decide(name, i) ? like(page) : skip(page)).click({ force: true })
    await expect.poll(() => currentCardName(page).catch(() => ''), { timeout: 8_000 }).not.toBe(name)
  }
  return seen
}

const typeOf = (name) => productsNamed(name)[0]?.parentType ?? 'unknown'
const share = (names, type) => names.filter((n) => typeOf(n) === type).length / Math.max(1, names.length)

test.describe('4. Discover tab', () => {
  test('Swipe through 30+ items → the feed keeps loading without any blank cards', async ({ page }) => {
    await openFeed(page)
    const seen = await swipe(page, 32, (_, i) => i % 4 === 0)
    expect(seen.every((n) => n.length > 0), 'every card has a name').toBe(true)
    await expect(page.getByText('No items to show right now.')).toHaveCount(0)
    await expect(like(page)).toBeVisible()
  })

  test('Like several items in one style → that style shows up more often in the feed', async ({ page }) => {
    note('Statistical: likes every footwear card for 20 swipes, then compares how much footwear the next 20 cards contain.')
    await openFeed(page)
    const first = await swipe(page, 20, (name) => typeOf(name) === 'footwear')
    const next  = await swipe(page, 20, (name) => typeOf(name) === 'footwear')
    const before = share(first, 'footwear')
    const after  = share(next, 'footwear')
    test.info().annotations.push({ type: 'note', description: `Footwear share: ${Math.round(before * 100)}% → ${Math.round(after * 100)}%` })
    expect(after, `footwear share went from ${Math.round(before * 100)}% to ${Math.round(after * 100)}%`).toBeGreaterThan(before)
  })

  test('Some unrelated items still appear (the exploration slots)', async ({ page }) => {
    await openFeed(page)
    await swipe(page, 20, (name) => typeOf(name) === 'footwear')
    const next = await swipe(page, 20, (name) => typeOf(name) === 'footwear')
    const other = next.filter((n) => typeOf(n) !== 'footwear')
    expect(other.length, 'cards outside the liked category still appear').toBeGreaterThan(0)
  })

  test('Hide the Swipe tab in Settings → it disappears from the tab bar and the sidebar', async ({ page }) => {
    await open(page, 'home')
    const sidebarDiscover = page.getByRole('button', { name: /^Discover/ })
    await expect(sidebarDiscover.first()).toBeVisible()
    await openSettings(page)
    await page.getByRole('button', { name: 'Hide Swipe tab' }).click()
    await page.keyboard.press('Escape')
    await expect(sidebarDiscover).toHaveCount(0)

    // Mobile width: the bottom tab bar shouldn't offer it either
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('button', { name: /^Home/ }).first()).toBeVisible()
    await expect(page.locator('[class*="discoverBtn"]')).toHaveCount(0)
    await expect(page.getByText('Discover', { exact: true })).toHaveCount(0)
  })
})
