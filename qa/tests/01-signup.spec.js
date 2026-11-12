import {
  test, expect, blockAuthEmails, requireSignup, loginAs, ready, open, go, note,
  basicCloset, signOutFromSettings, openOutfitsSubTab,
} from '../lib/fixtures.js'

// Answers validateEmail with "valid" so a test can get past the email step
// without depending on the real check (which has its own tests below).
async function allowAnyEmail(context) {
  await context.route(/\/validateEmail(\?[^/]*)?$/, async (route) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ result: { valid: true } }) })
  })
}

const emailInput    = (page) => page.getByPlaceholder('you@example.com')
const passwordInput = (page) => page.getByPlaceholder('At least 8 characters')
const confirmInput  = (page) => page.getByPlaceholder('Repeat your password')
const continueBtn   = (page) => page.getByRole('button', { name: 'Continue', exact: true })
const termsBox      = (page) => page.getByRole('checkbox', { name: /I agree to the/ })
const ageBox        = (page) => page.getByRole('checkbox', { name: /at least 16 years old/ })

async function toEmailStep(page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Skip all →', exact: true }).click()
  await expect(emailInput(page)).toBeVisible()
}

async function toConfirmStep(page, context, password = 'Sartima-QA-9!') {
  await allowAnyEmail(context)
  await toEmailStep(page)
  await emailInput(page).fill('qa.person@example.com')
  await continueBtn(page).click()
  await passwordInput(page).fill(password)
  await continueBtn(page).click()
  await expect(confirmInput(page)).toBeVisible()
}

test.describe('1. Sign-up, login and consent', () => {
  test.describe('signed out', () => {
    test.use({ role: 'gate' })

    test('Open the app signed out → the sign-up flow shows with Log in and Continue as guest', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByText('shopping for?')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Continue as guest', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Skip all →', exact: true })).toBeVisible()
    })

    test("Sign up with a badly formatted email → you get an error and can't continue", async ({ page }) => {
      await toEmailStep(page)
      for (const bad of ['jane@', 'jane.example.com']) {
        await emailInput(page).fill(bad)
        await continueBtn(page).click()
        expect(await emailInput(page).evaluate((el) => el.validity.valid), `"${bad}" should be rejected`).toBe(false)
        await expect(passwordInput(page)).toHaveCount(0)
      }
    })

    test("Sign up with a throwaway-domain email → it's rejected", async ({ page }) => {
      note('Uses the real validateEmail Function.')
      await toEmailStep(page)
      await emailInput(page).fill('jane@mailinator.com')
      await continueBtn(page).click()
      await expect(page.getByText("Temporary or throwaway inboxes can't be used")).toBeVisible({ timeout: 20_000 })
      await expect(passwordInput(page)).toHaveCount(0)
    })

    test('Type name@gmial.com → you see a "Did you mean gmail.com?" suggestion', async ({ page }) => {
      note('Uses the real validateEmail Function.')
      await toEmailStep(page)
      await emailInput(page).fill('name@gmial.com')
      await continueBtn(page).click()
      await expect(page.getByText('Did you mean')).toBeVisible({ timeout: 20_000 })
      await page.getByRole('button', { name: 'name@gmail.com' }).click()
      await expect(emailInput(page)).toHaveValue('name@gmail.com')
    })

    test('Enter a weak password → the strength meter shows weak. A strong password shows strong', async ({ page, context }) => {
      await allowAnyEmail(context)
      await toEmailStep(page)
      await emailInput(page).fill('qa.person@example.com')
      await continueBtn(page).click()
      await passwordInput(page).fill('aaaaaaaa')
      await expect(page.getByText('Weak', { exact: true })).toBeVisible()
      await continueBtn(page).click()
      await expect(page.getByText('Password is too weak')).toBeVisible()
      await passwordInput(page).fill('Abcdefg1')
      await expect(page.getByText('Strong', { exact: true })).toBeVisible()
      await passwordInput(page).fill('Abcdef1!x')
      await expect(page.getByText('Very strong', { exact: true })).toBeVisible()
    })

    test("Make the confirm-password field different from the password → you can't continue", async ({ page, context }) => {
      await toConfirmStep(page, context)
      await confirmInput(page).fill('Something-Else-1!')
      await termsBox(page).check()
      await ageBox(page).check()
      await page.getByRole('button', { name: 'Create account', exact: true }).click()
      await expect(page.getByText('Passwords do not match.')).toBeVisible()
    })

    test("Leave the ToS/Privacy or 16+ box unticked → you can't sign up", async ({ page, context }) => {
      await toConfirmStep(page, context)
      await confirmInput(page).fill('Sartima-QA-9!')
      const create = page.getByRole('button', { name: 'Create account', exact: true })
      await create.click()
      await expect(page.getByText('Please agree to the Terms of Service and Privacy Policy.')).toBeVisible()
      await termsBox(page).check()
      await create.click()
      await expect(page.getByText('Please confirm you are at least 16 years old.')).toBeVisible()
      // Still on the confirm step — nothing was created
      await expect(confirmInput(page)).toBeVisible()
    })

    test('Choose to continue as a guest → you see the guest warning', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: 'Continue as guest', exact: true }).click()
      await expect(page.getByText("Wait — don't miss out")).toBeVisible()
      await page.getByRole('button', { name: 'Continue as guest anyway', exact: true }).click()
      await ready(page)
    })

    test('Choose "Forgot password" on sign-in → the reset form sends and confirms', async ({ page, context }) => {
      note('Reset emails are intercepted, so nothing is sent. Whether the email arrives and the new password works is a manual check.')
      await blockAuthEmails(context)
      await page.goto('/')
      await page.getByRole('button', { name: 'Log in', exact: true }).click()
      await page.getByRole('button', { name: 'Forgot password?' }).click()
      await emailInput(page).fill('nobody-qa@example.com')
      await page.getByRole('button', { name: 'Send reset link' }).click()
      await expect(page.getByText('a reset link is on')).toBeVisible()
    })

    test('Complete sign-up → the user doc has the consent fields saved, and the verification banner can resend', async ({ page, context, throwaway }) => {
      requireSignup()
      note('Verification emails are intercepted, so nothing is sent. Clicking the real link is a manual check.')
      await blockAuthEmails(context)
      await allowAnyEmail(context)
      const email = throwaway.newEmail()
      const password = 'Sartima-QA-9!'
      throwaway.track(email, password)

      await toEmailStep(page)
      await emailInput(page).fill(email)
      await continueBtn(page).click()
      await passwordInput(page).fill(password)
      await continueBtn(page).click()
      await confirmInput(page).fill(password)
      await termsBox(page).check()
      await ageBox(page).check()
      await page.getByRole('button', { name: 'Create account', exact: true }).click()

      // New accounts go straight into the (warm-started) style quiz
      await expect(page.getByText(/^\d+ \/ 40$/)).toBeVisible({ timeout: 30_000 })

      const { signIn, getDoc } = await import('../lib/firebase-rest.js')
      const s = await signIn(email, password)
      const doc = await getDoc(s, `users/${s.uid}`)
      expect(doc?.ageAffirmed16Plus).toBe(true)
      expect(doc?.legalVersion).toBeTruthy()
      expect(doc?.legalAcceptedAt).toBeTruthy()

      // Unverified accounts see the banner on Home, and Resend responds
      await go(page, 'home')
      await expect(page.getByText('Verify your email')).toBeVisible()
      await page.getByRole('button', { name: 'Resend', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Sent ✓' })).toBeVisible()
    })

    test('A new account without consent (e.g. a first Google sign-in) sees the consent step', async ({ page, throwaway }) => {
      requireSignup()
      note('Google OAuth itself can\'t be automated, so this uses an account created without consent, which takes the same path.')
      const acc = await throwaway.create({ consent: false, onboarded: true })
      await loginAs(page, acc.email, acc.password)
      await expect(page.getByText('Please confirm the following to keep using your account.')).toBeVisible({ timeout: 30_000 })
      // Continue stays disabled until both boxes are ticked
      const cont = page.getByRole('button', { name: 'Continue', exact: true })
      await expect(cont).toBeDisabled()
      await termsBox(page).check()
      await expect(cont).toBeDisabled()
      await ageBox(page).check()
      await expect(cont).toBeEnabled()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await ready(page)
      expect((await acc.user())?.ageAffirmed16Plus).toBe(true)
    })
  })

  test.describe('guest', () => {
    test('Open sign-in from a tab, then press Back or Esc → you\'re returned to that same tab', async ({ page }) => {
      await open(page, 'search')
      await page.getByRole('button', { name: 'Sign in', exact: true }).first().click()
      await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
      await page.getByRole('button', { name: 'Back', exact: true }).click()
      await expect(page.getByText('Find something specific')).toBeVisible()
      await expect(page).toHaveURL(/#\/search$/)

      await page.getByRole('button', { name: 'Sign in', exact: true }).first().click()
      await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByText('Find something specific')).toBeVisible()
    })

    test('As a guest, open a feature that needs an account → the locked overlay offers sign-in', async ({ page }) => {
      await open(page, 'daily')
      await page.getByRole('button', { name: 'My Closet', exact: true }).first().click()
      await expect(page.getByText('Sign in to build your digital closet')).toBeVisible()
      await page.getByRole('button', { name: "Today's Outfit", exact: true }).first().click()
      await expect(page.getByText('Sign in to get AI-powered daily outfit suggestions')).toBeVisible()
    })
  })

  test.describe('free account', () => {
    test.use({ role: 'free' })

    test('Log out and log back in with email → you land in the app with your data intact', async ({ page, account, browser }) => {
      await account.reset({ closet: basicCloset() })
      await open(page, 'home')
      await signOutFromSettings(page)
      await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible({ timeout: 20_000 })

      const { ACCOUNTS } = await import('../lib/env.js')
      await page.getByRole('button', { name: 'Log in', exact: true }).click()
      await page.getByPlaceholder('you@example.com').fill(ACCOUNTS.free.email)
      await page.getByPlaceholder('••••••••').fill(ACCOUNTS.free.password)
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      await ready(page)
      await openOutfitsSubTab(page, 'My Closet')
      for (const item of basicCloset()) await expect(page.getByText(item.name, { exact: true }).first()).toBeVisible()
      void browser
    })
  })
})
