import { test, expect } from '@playwright/test'
import { dismissConsentBanner, bypassSignupGate } from './helpers.js'

// UI-only coverage of the signup gate (no accounts are created, and the
// email step's validateEmail call is stubbed, never live): the default
// signed-out landing flow (SignupFlow), its email check, its login escape
// hatch, and the guest hand-off back into the app.
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
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page.getByRole('button', { name: /Mixed/ })).toBeVisible()

    // Esc backs out of the login step too
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: /Mixed/ })).toBeVisible()
  })

  test('continue as guest warns before returning to the app', async ({ page }) => {
    await page.getByRole('button', { name: 'Continue as guest', exact: true }).click()
    await expect(page.getByText("Wait — don't miss out")).toBeVisible()

    await page.getByRole('button', { name: 'Continue as guest anyway', exact: true }).click()
    await expect(page.getByText('SARTIMA').first()).toBeVisible()
  })
})

// The header "Sign in" button opens the full-screen auth screen from inside
// the app; backing out must land on the tab it was opened from.
test.describe('auth screen (opened from the app)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await bypassSignupGate(page)
    await dismissConsentBanner(page)
    await page.getByRole('button', { name: /^Search/ }).first().click()
    await expect(page.getByText('Find something specific')).toBeVisible()
  })

  test('Back returns to the tab sign-in was opened from', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()

    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page.getByText('Find something specific')).toBeVisible()
    await expect(page).toHaveURL(/#\/search$/)
  })

  test('Esc backs out the same way', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByText('Find something specific')).toBeVisible()
  })
})

// Answers the validateEmail callable the way the deployed function would:
// `respond(email)` returns its result object, or a number to fail with that
// HTTP status. Handles the CORS preflight since the function is cross-origin.
async function stubValidateEmail(page, respond) {
  await page.route('**/validateEmail', async (route) => {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const result = respond(route.request().postDataJSON().data.email)
    const body = typeof result === 'number'
      ? { error: { status: 'UNAVAILABLE', message: 'stubbed failure' } }
      : { result }
    await route.fulfill({
      status: typeof result === 'number' ? result : 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
}

test.describe('signup email check', () => {
  test.beforeEach(async ({ page }) => {
    await stubValidateEmail(page, (email) => {
      if (email === 'jane@gamil.com')      return { valid: true, suggestion: 'jane@gmail.com' }
      if (email === 'jane@mailinator.com') return { valid: false, reason: 'disposable' }
      if (email === 'jane@down.example')   return 503
      return { valid: true }
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Skip all →', exact: true }).click()
  })

  const emailInput    = (page) => page.getByPlaceholder('you@example.com')
  const continueBtn   = (page) => page.getByRole('button', { name: 'Continue', exact: true })
  const passwordInput = (page) => page.getByPlaceholder('At least 8 characters')

  test('offers a typo fix, and accepting it fills the field', async ({ page }) => {
    await emailInput(page).fill('jane@gamil.com')
    await continueBtn(page).click()
    await expect(page.getByText('Did you mean')).toBeVisible()
    await expect(passwordInput(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'jane@gmail.com' }).click()
    await expect(emailInput(page)).toHaveValue('jane@gmail.com')
    await continueBtn(page).click()
    await expect(passwordInput(page)).toBeVisible()
  })

  test('continuing again keeps the address as typed', async ({ page }) => {
    await emailInput(page).fill('jane@gamil.com')
    await continueBtn(page).click()
    await expect(page.getByText('Did you mean')).toBeVisible()
    await continueBtn(page).click()
    await expect(passwordInput(page)).toBeVisible()
  })

  test('blocks throwaway inboxes', async ({ page }) => {
    await emailInput(page).fill('jane@mailinator.com')
    await continueBtn(page).click()
    await expect(page.getByText("Temporary or throwaway inboxes can't be used")).toBeVisible()
    await continueBtn(page).click()
    await expect(page.getByText("Temporary or throwaway inboxes can't be used")).toBeVisible()
    await expect(passwordInput(page)).toHaveCount(0)
  })

  test('lets the user through when the check itself is down', async ({ page }) => {
    await emailInput(page).fill('jane@down.example')
    await continueBtn(page).click()
    await expect(passwordInput(page)).toBeVisible()
  })
})
