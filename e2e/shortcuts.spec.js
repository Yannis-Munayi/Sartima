import { test, expect } from '@playwright/test'
import { dismissConsentBanner, bypassSignupGate } from './helpers.js'

// Desktop keyboard shortcuts (src/hooks/useKeyboardShortcuts.js) and the
// shared Esc-closes-topmost-layer stack (src/hooks/useEscapeKey.js).
test.describe('keyboard shortcuts', () => {
  let pageErrors

  test.beforeEach(async ({ page }) => {
    pageErrors = []
    page.on('pageerror', (err) => pageErrors.push(err.message))
    await page.goto('/')
    await bypassSignupGate(page)
    await dismissConsentBanner(page)
    await expect(page).toHaveURL(/#\/home$/)
  })

  test.afterEach(() => {
    expect(pageErrors, `uncaught exceptions: ${pageErrors.join('; ')}`).toEqual([])
  })

  test('? opens the shortcuts dialog and Esc closes it', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' })

    await page.keyboard.press('?')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)

    // Also reachable from the desktop sidebar
    await page.getByRole('button', { name: /Keyboard shortcuts/ }).click()
    await expect(dialog).toBeVisible()
  })

  test('g-sequences jump between main tabs', async ({ page }) => {
    await page.keyboard.press('g')
    await page.keyboard.press('b')
    await expect(page).toHaveURL(/#\/brands$/)
    await expect(page.getByRole('heading', { name: 'Brands' })).toBeVisible()

    await page.keyboard.press('g')
    await page.keyboard.press('a')
    await expect(page).toHaveURL(/#\/explore$/)

    await page.keyboard.press('g')
    await page.keyboard.press('h')
    await expect(page).toHaveURL(/#\/home$/)
  })

  test('/ focuses the page search; typing there does not trigger shortcuts', async ({ page }) => {
    await page.keyboard.press('g')
    await page.keyboard.press('b')
    const brandSearch = page.getByPlaceholder('Search brands…')
    await expect(brandSearch).toBeVisible()

    await page.keyboard.press('/')
    await expect(brandSearch).toBeFocused()

    // g then a would navigate if it weren't typed into a field
    await page.keyboard.type('ga')
    await expect(brandSearch).toHaveValue('ga')
    await expect(page).toHaveURL(/#\/brands$/)

    // Esc leaves the field, after which shortcuts work again
    await page.keyboard.press('Escape')
    await expect(brandSearch).not.toBeFocused()
    await page.keyboard.press('/')
    await expect(brandSearch).toBeFocused()
  })

  test('/ on a page without its own search opens catalog Search', async ({ page }) => {
    await page.keyboard.press('/')
    await expect(page).toHaveURL(/#\/search$/)
    await expect(page.getByPlaceholder('Search by brand, item, or color…')).toBeFocused()
  })

  test('Ctrl+K opens catalog Search from anywhere', async ({ page }) => {
    await page.keyboard.press('g')
    await page.keyboard.press('b')
    await expect(page).toHaveURL(/#\/brands$/)

    await page.keyboard.press('Control+k')
    await expect(page).toHaveURL(/#\/search$/)
    await expect(page.getByPlaceholder('Search by brand, item, or color…')).toBeFocused()
  })

  test('Esc closes only the topmost layer (Terms over the paywall)', async ({ page }) => {
    await page.keyboard.press('g')
    await page.keyboard.press('o')
    await expect(page).toHaveURL(/#\/daily$/)

    await page.getByRole('button', { name: 'Calendar', exact: true }).click({ force: true })
    const paywall = page.getByText('Outfit Calendar is available on Pro.')
    await expect(paywall).toBeVisible()

    await page.getByRole('button', { name: 'Terms', exact: true }).click()
    const terms = page.getByRole('dialog').filter({ hasText: 'Terms' })
    await expect(terms).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(terms).toHaveCount(0)
    await expect(paywall).toBeVisible()

    // Shortcuts stay quiet while a dialog is open
    await page.keyboard.press('g')
    await page.keyboard.press('h')
    await expect(page).toHaveURL(/#\/daily$/)

    await page.keyboard.press('Escape')
    await expect(paywall).toHaveCount(0)
  })

  test('arrow keys like and skip in the style quiz', async ({ page }) => {
    await page.getByRole('button', { name: /Take the style quiz/ }).click()
    const counter = page.getByText(/^\d+ \/ 40$/)
    await expect(counter).toBeVisible()
    await expect(page.getByRole('button', { name: 'Like', exact: true })).toBeVisible()

    const start = await counter.textContent()
    await page.keyboard.press('ArrowRight')
    await expect(counter).not.toHaveText(start)

    const afterLike = await counter.textContent()
    await page.keyboard.press('ArrowLeft')
    await expect(counter).not.toHaveText(afterLike)
  })
})
