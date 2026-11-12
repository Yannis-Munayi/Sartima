import fs from 'node:fs'
import path from 'node:path'
import { test, expect, open, go, completeQuiz, openSettings, note } from '../lib/fixtures.js'
import { productsNamed } from '../lib/catalog.js'
import { ROOT } from '../lib/env.js'

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

  test("Products with both men's and women's photos show a swap toggle", async ({ page }) => {
    note('The toggle swaps a product\'s men\'s and women\'s photos (it is not a photo/gradient switch). It only renders with gender "Both" for products that have both images.')
    const dir = path.join(ROOT, 'src/data/products')
    const withAlt = fs.readdirSync(dir).reduce((n, f) => n + (fs.readFileSync(path.join(dir, f), 'utf8').match(/imageMen:/g)?.length ?? 0), 0)
    expect(withAlt, 'No product in src/data/products has an imageMen photo, so the toggle can never appear').toBeGreaterThan(0)

    await open(page, 'search')
    await search(page, 'shirt')
    const toggle = page.getByRole('button', { name: "Show men's photo" }).first()
    await expect(toggle).toBeVisible()
    await toggle.click()
    await expect(page.getByRole('button', { name: "Show women's photo" }).first()).toBeVisible()
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
