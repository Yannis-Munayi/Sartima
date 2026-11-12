import { test, expect, open, go, openSettings, note } from '../lib/fixtures.js'

const piece = (page, name) => page.locator('[class*="pieceCard"]').filter({ hasText: name }).first()
const listBadge = (page) => page.locator('[class*="viewTabBadge"]')

async function openScout(page) {
  await open(page, 'daily')
  await expect(page.getByRole('heading', { name: 'Shop Scout', exact: true })).toBeVisible()
}

async function runScout(page, { pieces = ['Plain T-Shirt'], budget = 'Under $50', priority = 'Versatility' } = {}) {
  for (const p of pieces) await piece(page, p).click()
  await page.getByRole('button', { name: 'Next: Set your budget →' }).click()
  await expect(page.getByText('Budget & filters')).toBeVisible()
  const sections = page.locator('[class*="pieceBudgetSection"]')
  const n = await sections.count()
  for (let i = 0; i < n; i++) await sections.nth(i).getByRole('button', { name: new RegExp(budget.replace(/\$/g, '\\$')) }).click()
  await page.getByRole('button', { name: 'Next: Your priorities →' }).click()
  if (priority) await page.getByRole('button', { name: new RegExp(priority) }).click()
  await page.getByRole('button', { name: 'Find my picks →' }).click()
  await expect(page.getByText('Your Core Pieces')).toBeVisible()
}

test.describe('11. Shop Scout', () => {
  test('Shop Scout is the sub-tab that opens by default under Outfits', async ({ page }) => {
    await openScout(page)
    await expect(page.getByRole('button', { name: 'Shop Scout', exact: true }).first()).toHaveAttribute('class', /Active/)
    await expect(page.getByText('Step 1 of 3')).toBeVisible()
    await expect(page.getByText('What pieces are you looking for?')).toBeVisible()
  })

  test('Go through Pieces → Budget → Priorities → Results → the products shown fit the budget you chose', async ({ page }) => {
    await openScout(page)
    await runScout(page, { pieces: ['Plain T-Shirt'], budget: 'Under $50' })
    const cards = await page.locator('[class*="productCardBody"]').evaluateAll((els) => els.map((el) => ({
      name: `${el.querySelector('[class*="productBrand"]')?.textContent ?? ''} ${el.querySelector('[class*="productName"]')?.textContent ?? ''}`.trim(),
      tier: el.querySelector('[class*="productPriceTag"]')?.textContent?.trim() ?? '',
    })))
    expect(cards.length, 'some products are recommended').toBeGreaterThan(0)
    const offBudget = cards.filter((c) => c.tier && c.tier !== 'Budget').map((c) => `${c.name} (${c.tier})`)
    expect(offBudget, `chose "Under $50" but these are outside it: ${offBudget.join(', ')}`).toEqual([])
  })

  test('Choose "Not sure" → you get a starter capsule', async ({ page }) => {
    await openScout(page)
    await page.getByRole('button', { name: /Not sure yet\? Show me a starter capsule/ }).click()
    await expect(page.getByText('Budget & filters')).toBeVisible()
    for (const name of ['Plain T-Shirt', 'Slim Jeans', 'Hoodie', 'White Sneakers', 'Bomber Jacket']) {
      await expect(page.locator('[class*="pieceBudgetTitle"]').filter({ hasText: name })).toBeVisible()
    }
  })

  test("Add a complement suggestion partway through → it's added to the results", async ({ page }) => {
    note('Complements come from looks that share at least two of your pieces, so this picks two.')
    await openScout(page)
    await runScout(page, { pieces: ['Plain T-Shirt', 'Slim Jeans'] })
    const complement = page.locator('[class*="complementCard"]').first()
    await expect(complement).toBeVisible()
    const name = (await complement.locator('[class*="complementName"]').innerText()).trim()
    await complement.click()
    // A new piece needs a budget, so the wizard goes back to that step with it added
    await expect(page.locator('[class*="pieceBudgetTitle"]').filter({ hasText: name })).toBeVisible()
    const sections = page.locator('[class*="pieceBudgetSection"]')
    for (let i = 0; i < await sections.count(); i++) await sections.nth(i).getByRole('button', { name: /Any price/ }).click()
    await page.getByRole('button', { name: 'Next: Your priorities →' }).click()
    await page.getByRole('button', { name: 'Find my picks →' }).click()
    await expect(page.locator('[class*="pieceGroupName"]').filter({ hasText: name })).toBeVisible()
  })

  test('Save a product → the My List badge count goes up. Remove it → the count goes down', async ({ page }) => {
    await openScout(page)
    await expect(listBadge(page)).toHaveCount(0)
    await runScout(page)
    await page.getByRole('button', { name: /^Save \d+ products? to My List$/ }).click()
    await expect(page.getByText('Saved to My List')).toBeVisible()
    await expect(listBadge(page)).toHaveText('1')

    await page.getByRole('button', { name: /^My List/ }).click()
    await page.locator('[class*="cardHeader"]').first().click()
    await page.getByRole('button', { name: 'Remove', exact: true }).first().click()
    await expect(listBadge(page)).toHaveCount(0)
    await expect(page.getByText('Nothing here yet')).toBeVisible()
  })

  test('Change the Scout settings (auto-save, result count) → the next Scout run follows them', async ({ page }) => {
    await open(page, 'home')
    await openSettings(page)
    await page.getByRole('button', { name: 'Enable auto-save' }).click()
    const decrease = page.getByRole('button', { name: 'Decrease' })
    while (await decrease.isEnabled()) await decrease.click()
    await expect(page.locator('[class*="scoutCountValue"]')).toHaveText('5')
    await page.keyboard.press('Escape')

    await go(page, 'daily')
    await expect(page.getByRole('heading', { name: 'Shop Scout', exact: true })).toBeVisible()
    await runScout(page, { pieces: ['Plain T-Shirt'], budget: 'Any price' })
    // Auto-save: no manual Save button, saved straight away
    await expect(page.getByRole('button', { name: /to My List$/ })).toHaveCount(0)
    await expect(page.getByText('Saved to My List')).toBeVisible()
    await expect(listBadge(page)).toHaveText('1')
    expect(await page.locator('[class*="productBrand"]').count(), 'at most 5 results per piece').toBeLessThanOrEqual(5)
  })

  test('Open #/wardrobe-builder/{pieceId} → that piece is already selected', async ({ page }) => {
    note('The deep link is #/wardrobe-builder/plain-tee (a slash, not a colon, after wardrobe-builder).')
    await open(page, 'wardrobe-builder/plain-tee')
    await expect(page.getByText('Budget & filters')).toBeVisible()
    await expect(page.locator('[class*="pieceBudgetTitle"]').filter({ hasText: 'Plain T-Shirt' })).toBeVisible()
    await expect(page.getByText('Step 2 of 3')).toBeVisible()
  })
})
