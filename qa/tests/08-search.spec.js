import { test, expect, open, go, completeQuiz, openSettings, note } from '../lib/fixtures.js'
import { catalog, productsNamed } from '../lib/catalog.js'

const STUB_CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const stubPhoto = (label) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#B8956A"/><text x="150" y="200" font-size="28" text-anchor="middle" fill="#fff">${label}</text></svg>`,
)

const searchBox = (page) => page.getByPlaceholder('Search by brand, item, or color…')
const resultNames = (page) => page.locator('[class*="cardName"]')

async function search(page, q) {
  await searchBox(page).fill(q)
  await expect(page.locator('[class*="resultsCount"]')).toBeVisible()
}

async function resultCount(page) {
  const text = (await page.locator('[class*="resultsCount"]').textContent()).replace(/,/g, '').trim()
  return Number(text.match(/of (\d+) results/i)?.[1] ?? text.match(/^(\d+) results?$/i)?.[1])
}

async function setGender(page, label) {
  await openSettings(page)
  await page.getByRole('button', { name: label, exact: true }).first().click()
  await page.keyboard.press('Escape')
}

test.describe('8. Search', () => {
  test('Search for a brand name → products from that brand come first', async ({ page }) => {
    await open(page, 'search')
    await search(page, 'Salomon')
    const badges = await page.locator('[class*="brandBadge"]').evaluateAll((els) => els.slice(0, 8).map((e) => e.textContent.trim()))
    expect(badges.length).toBeGreaterThan(0)
    expect(badges.every((b) => b === 'Salomon'), `first results: ${badges.join(', ')}`).toBe(true)
  })

  test('Search for a colour or garment type → the results make sense', async ({ page }) => {
    await open(page, 'search')
    await search(page, 'boots')
    const names = (await resultNames(page).allInnerTexts()).slice(0, 8)
    const isBoot = (n) => productsNamed(n).some((p) => /boot/i.test(`${p.type} ${p.name}`)) || /boot/i.test(n)
    expect(names.filter(isBoot).length, `"boots" → ${names.join(', ')}`).toBe(names.length)

    await search(page, 'olive')
    const olive = (await resultNames(page).allInnerTexts()).slice(0, 8)
    const isOlive = (n) => productsNamed(n).some((p) => /olive/i.test(`${p.color} ${p.name}`)) || /olive/i.test(n)
    expect(olive.filter(isOlive).length, `"olive" → ${olive.join(', ')}`).toBe(olive.length)
  })

  test('The gender setting changes the results', async ({ page }) => {
    note('Search has no gender control of its own; it follows the gender chosen in Settings.')
    await open(page, 'search')
    await setGender(page, 'Men')
    await go(page, 'search')
    await search(page, 'jacket')
    const men = await resultCount(page)
    await setGender(page, 'Women')
    await go(page, 'search')
    await search(page, 'jacket')
    const women = await resultCount(page)
    expect(men, `men ${men} vs women ${women}`).not.toBe(women)
  })

  test("Unisex products show a men's/women's photo swap toggle", async ({ page }) => {
    note('With gender "Both", unisex products get a toggle that swaps between a men\'s and a women\'s photo (curated imageMen/image when a product has both, otherwise gendered stock photos fetched on tap). searchImages is stubbed here so the test spends no Unsplash/Pexels quota.')
    const unisex = catalog().products.filter((p) => p.gender === 'unisex').length
    expect(unisex, 'No unisex product in src/data/products, so the toggle can never appear').toBeGreaterThan(0)

    const queries = []
    await page.route(/\/searchImages(\?[^/]*)?$/, async (route) => {
      const req = route.request()
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: STUB_CORS })
      const query = req.postDataJSON()?.data?.query ?? ''
      queries.push(query)
      const side = /^(men|women) /.exec(query)?.[1] ?? 'default'
      await route.fulfill({ status: 200, headers: STUB_CORS, contentType: 'application/json', body: JSON.stringify({ result: { urls: [stubPhoto(side)] } }) })
    })

    await open(page, 'search')
    await search(page, 'shirt')
    // Locate by attribute so it keeps pointing at the same button as its label flips
    const toggle = page.locator('button[aria-label="Show men\'s photo"], button[aria-label="Show women\'s photo"]').first()
    await expect(toggle).toHaveAttribute('aria-label', "Show men's photo")
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-label', "Show women's photo")
    expect(queries.some((q) => q.startsWith('men ')), `searchImages queries: ${queries.join(' | ')}`).toBe(true)
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-label', "Show men's photo")
    expect(queries.some((q) => q.startsWith('women ')), `searchImages queries: ${queries.join(' | ')}`).toBe(true)
  })

  test("A narrowed gender setting hides the photo swap toggle", async ({ page }) => {
    await open(page, 'search')
    await setGender(page, 'Men')
    await go(page, 'search')
    await search(page, 'shirt')
    await expect(page.locator('[class*="cardName"]').first()).toBeVisible()
    await expect(page.locator('button[aria-label="Show men\'s photo"]')).toHaveCount(0)
  })

  test("The empty state shows personalised suggestions once you've done the quiz", async ({ page }) => {
    await open(page, 'search')
    await expect(page.getByText('Search the full catalog by brand, item type, or color.')).toBeVisible()
    await completeQuiz(page)
    await go(page, 'search')
    await expect(page.getByText('Picked from your style profile', { exact: false })).toBeVisible()
    await expect(page.getByText('Pieces', { exact: true })).toBeVisible()
  })

  test('Pressing / puts the cursor in the search box', async ({ page }) => {
    await open(page, 'home')
    await page.keyboard.press('/')
    await expect(page).toHaveURL(/#\/search$/)
    await expect(searchBox(page)).toBeFocused()
  })
})
