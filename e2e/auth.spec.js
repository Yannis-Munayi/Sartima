import { test, expect } from '@playwright/test'

async function dismissConsentBanner(page) {
  const decline = page.getByRole('button', { name: 'Decline', exact: true })
  if (await decline.count()) {
    await decline.first().click({ force: true }).catch(() => {})
  }
}

// UI-only coverage of the auth screen (no accounts are created):
// mode switching, the password-reset mode, signup consent controls,
// and the guest hand-off back into the app.
test.describe('auth screen (anonymous)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await dismissConsentBanner(page)
    await page.getByRole('button', { name: 'Sign in' }).first().click()
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  })

  test('login mode shows Google sign-in and a working forgot-password mode', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()

    await page.getByRole('button', { name: 'Forgot password?' }).click()
    await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible()
    // Reset mode has no password field and no Google button
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0)

    // Footer link returns to login mode
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Forgot password?' })).toBeVisible()
  })

  test('signup mode shows consent checkboxes and age affirmation', async ({ page }) => {
    await page.getByRole('button', { name: 'Create one' }).click()
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
    await expect(page.getByText('I am at least 16 years old.')).toBeVisible()
    await expect(page.getByText('Shop for')).toBeVisible()
  })

  test('continue as guest returns to the app', async ({ page }) => {
    await page.getByRole('button', { name: 'Continue as guest' }).click()
    await expect(page.getByText('SARTIMA').first()).toBeVisible()
  })
})
