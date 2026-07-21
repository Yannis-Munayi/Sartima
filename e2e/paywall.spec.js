import { test, expect } from '@playwright/test'
import { dismissConsentBanner, bypassSignupGate } from './helpers.js'

// Pro-gated Outfits sub-tabs must route non-Pro users through the real
// openPaywall path — this is the top of the Stripe checkout funnel.
test.describe('paywall gates (non-Pro user)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/daily')
    await bypassSignupGate(page)
    await dismissConsentBanner(page)
    await expect(page.getByText('Shop Scout', { exact: true }).first()).toBeVisible()
  })

  for (const { tab, copy } of [
    { tab: 'Calendar', copy: 'Outfit Calendar is available on Pro.' },
    { tab: 'Trip',     copy: 'Trip Packer is available on Pro.' },
    { tab: 'Laundry',  copy: 'Laundry care tracking is available on Pro.' },
  ]) {
    test(`${tab} sub-tab opens the paywall with pricing`, async ({ page }) => {
      await page.getByRole('button', { name: tab, exact: true }).click({ force: true })

      await expect(page.getByText('Sartima Pro').first()).toBeVisible()
      await expect(page.getByText(copy)).toBeVisible()
      await expect(page.getByRole('button', { name: /Upgrade/ })).toBeVisible()
    })
  }

  test('paywall can be dismissed and the app keeps working', async ({ page }) => {
    await page.getByRole('button', { name: 'Calendar', exact: true }).click({ force: true })
    await expect(page.getByText('Sartima Pro').first()).toBeVisible()

    // The modal has no dismiss button — clicking the backdrop closes it
    await page.mouse.click(10, 10)

    await expect(page.getByText('Sartima Pro')).toHaveCount(0)
    await expect(page.getByText('Shop Scout', { exact: true }).first()).toBeVisible()
  })
})
