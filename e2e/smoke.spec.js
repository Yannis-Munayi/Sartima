import { test, expect } from '@playwright/test'
import { dismissConsentBanner, bypassSignupGate } from './helpers.js'

test.describe('anonymous smoke path', () => {
  let pageErrors

  test.beforeEach(async ({ page }) => {
    pageErrors = []
    page.on('pageerror', (err) => pageErrors.push(err.message))
    await page.goto('/')
    await bypassSignupGate(page)
    await dismissConsentBanner(page)
  })

  test.afterEach(() => {
    expect(pageErrors, `uncaught exceptions: ${pageErrors.join('; ')}`).toEqual([])
  })

  test('home loads with hero and tab bar', async ({ page }) => {
    await expect(page.getByText('SARTIMA').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('navigating to Aesthetics shows the grid and opens a detail screen', async ({ page }) => {
    await page.getByRole('button', { name: /Aesthetics/i }).first().click()
    await expect(page.getByText(/aesthetics$/i).first()).toBeVisible()

    await page.getByText('Old Money / Quiet Luxury', { exact: true }).click({ force: true })
    await expect(page.getByRole('button', { name: 'Story', exact: true })).toBeVisible()

    for (const tab of ['Items', 'Looks', 'Guide']) {
      await page.getByRole('button', { name: tab, exact: true }).click()
      await expect(page.getByRole('button', { name: tab, exact: true })).toHaveAttribute('class', /Active/)
    }
  })

  test('Outfits tab renders Shop Scout and sub-tabs are reachable', async ({ page }) => {
    await page.getByRole('button', { name: /Outfits/i }).first().click()
    await expect(page.getByText('Shop Scout', { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: 'My Closet', exact: true }).click({ force: true })
    await expect(page.getByRole('button', { name: 'My Closet', exact: true })).toHaveAttribute('class', /Active/)
  })

  test('Profile shows the signed-out preview and Settings sheet opens', async ({ page }) => {
    await page.getByRole('button', { name: /Profile/i }).first().click()
    await expect(page.getByText('Your style profile lives here')).toBeVisible()

    await page.locator('button[aria-label="Settings"]').click({ force: true })
    await expect(page.getByText('Settings', { exact: true })).toBeVisible()
    await expect(page.getByText('Appearance', { exact: true })).toBeVisible()
  })
})
