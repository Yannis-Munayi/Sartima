import { test, expect } from '@playwright/test'

async function dismissConsentBanner(page) {
  const decline = page.getByRole('button', { name: 'Decline', exact: true })
  if (await decline.count()) {
    await decline.first().click({ force: true }).catch(() => {})
  }
}

test.describe('hash routing', () => {
  let pageErrors

  test.beforeEach(({ page }) => {
    pageErrors = []
    page.on('pageerror', (err) => pageErrors.push(err.message))
  })

  test.afterEach(() => {
    expect(pageErrors, `uncaught exceptions: ${pageErrors.join('; ')}`).toEqual([])
  })

  test('deep link opens the Brands tab', async ({ page }) => {
    await page.goto('/#/brands')
    await dismissConsentBanner(page)
    await expect(page.getByRole('heading', { name: 'Brands' })).toBeVisible()
  })

  test('deep link opens an aesthetic detail screen', async ({ page }) => {
    await page.goto('/#/aesthetic/y2k')
    await dismissConsentBanner(page)
    await expect(page.getByRole('button', { name: 'Story', exact: true })).toBeVisible()
    expect(page.url()).toContain('#/aesthetic/y2k')
  })

  test('tab clicks update the hash and back button restores the previous tab', async ({ page }) => {
    await page.goto('/')
    await dismissConsentBanner(page)
    await expect(page).toHaveURL(/#\/home$/)

    await page.getByRole('button', { name: /Aesthetics/i }).first().click()
    await expect(page).toHaveURL(/#\/explore$/)

    await page.goBack()
    await expect(page).toHaveURL(/#\/home$/)
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('unknown hash falls back to home without crashing', async ({ page }) => {
    await page.goto('/#/definitely-not-a-tab')
    await dismissConsentBanner(page)
    await expect(page.getByText('SARTIMA').first()).toBeVisible()
  })
})
