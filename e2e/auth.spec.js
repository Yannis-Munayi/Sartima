import { test, expect } from '@playwright/test'

// UI-only coverage of the signup gate (no accounts are created, and the
// email step's live validateEmail call is never triggered): the default
// signed-out landing flow (SignupFlow), its login escape hatch, and the
// guest hand-off back into the app.
test.describe('signup gate (anonymous)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible()
  })

  test('signup flow opens on the gender step and Skip all reaches the email step', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Mixed/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Women/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Men/ })).toBeVisible()

    await page.getByRole('button', { name: 'Skip all →', exact: true }).click()
    await expect(page.getByText("What's your", { exact: false })).toBeVisible()
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
  })

  test('Log in reaches a login form with Google sign-in and a working forgot-password mode', async ({ page }) => {
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()

    await page.getByRole('button', { name: 'Forgot password?' }).click()
    await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible()
    // Reset mode has no password field and no Google button
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0)

    // Footer link returns to login mode
    await page.getByRole('button', { name: '← Back to sign in' }).click()
    await expect(page.getByRole('button', { name: 'Forgot password?' })).toBeVisible()

    // Back link returns to wherever the signup flow was left
    await page.getByRole('button', { name: '← Back', exact: true }).click()
    await expect(page.getByRole('button', { name: /Mixed/ })).toBeVisible()
  })

  test('continue as guest warns before returning to the app', async ({ page }) => {
    await page.getByRole('button', { name: 'Continue as guest', exact: true }).click()
    await expect(page.getByText("Wait — don't miss out")).toBeVisible()

    await page.getByRole('button', { name: 'Continue as guest anyway', exact: true }).click()
    await expect(page.getByText('SARTIMA').first()).toBeVisible()
  })
})
