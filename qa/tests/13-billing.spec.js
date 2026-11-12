import {
  test, expect, go, ready, loginAs, manual, note, requireSignup, requireStripeTest,
  accountApi, basicCloset, fnError, QA_PHOTO,
} from '../lib/fixtures.js'
import * as fb from '../lib/firebase-rest.js'
import { BASE_URL, legalVersion } from '../lib/env.js'

/** A throwaway account that outlives one test (cleaned up in afterAll). */
async function createLongLivedAccount() {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const email = `sartima-qa-${stamp}@example.com`
  const password = `Qa-${stamp}-Zx9!`
  const s = await fb.signUp(email, password)
  await fb.mergeDoc(s, `users/${s.uid}`, {
    email, ageAffirmed16Plus: true, legalVersion: legalVersion(), onboardingComplete: true,
  })
  return { email, password }
}

/** Fills Stripe's hosted Checkout with the 4242 test card and pays. */
async function payWithTestCard(page) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 })
  const cardTab = page.getByRole('button', { name: /^Card$/ })
  if (await cardTab.isVisible({ timeout: 3_000 }).catch(() => false)) await cardTab.click()
  await page.locator('#cardNumber').fill('4242 4242 4242 4242')
  await page.locator('#cardExpiry').fill('12 / 34')
  await page.locator('#cardCvc').fill('123')
  const name = page.locator('#billingName')
  if (await name.isVisible().catch(() => false)) await name.fill('Sartima QA')
  const zip = page.locator('#billingPostalCode')
  if (await zip.isVisible().catch(() => false)) await zip.fill('10001')
  await page.locator('button[type="submit"], .SubmitButton').first().click()
  await page.waitForURL((url) => !/stripe\.com/.test(url.hostname), { timeout: 120_000 })
}

async function claims(email, password) {
  const s = await fb.signIn(email, password)
  return fb.claimsOf(s.idToken)
}

async function subscribe(page, account, plan) {
  await loginAs(page, account.email, account.password)
  await ready(page)
  await go(page, 'profile')
  await page.getByRole('button', { name: /Upgrade to Pro/ }).click()
  await page.getByRole('button', { name: plan === 'annual' ? /Annual — \$49\.99/ : /Upgrade — \$6\.99/ }).click()
  await payWithTestCard(page)
  await expect.poll(async () => (await claims(account.email, account.password)).sartima_tier,
    { timeout: 90_000, intervals: [3_000], message: 'the webhook sets the Pro claim' }).toBe('pro')
  await page.goto(`${BASE_URL}/#/profile`)
  await expect(page.getByText('Sartima Pro', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
}

test.describe('13. Billing', () => {
  test.describe.serial('monthly subscription lifecycle (Stripe test mode)', () => {
    test.use({ role: 'gate' })
    let acc = null

    test.afterAll(async () => {
      if (!acc) return
      try {
        const s = await fb.signIn(acc.email, acc.password)
        await fb.callFunction(s, 'deleteAccount', {})
      } catch { /* already gone */ }
    })

    test("Subscribe monthly with Stripe's test card → you become Pro without reloading (the webhook updates the claim)", async ({ page }) => {
      requireSignup()
      requireStripeTest()
      test.setTimeout(240_000)
      // Kept past this test: the next steps in the chain use it
      acc = await createLongLivedAccount()
      await subscribe(page, acc, 'monthly')
    })

    test('Buy a try-on pack → your credits go up', async ({ page, fns }) => {
      requireSignup()
      requireStripeTest()
      test.skip(!acc, 'the monthly subscription step did not complete')
      test.setTimeout(240_000)
      const s = await fb.signIn(acc.email, acc.password)
      const a = accountApi(s)
      await a.mergeUser({ avatarUrl: QA_PHOTO, avatarUpdatedAt: Date.now() })
      await a.reset({ closet: basicCloset() })
      const before = (await a.usage()).tryOnCredits ?? 0
      fns.respond('generateTryOn', () => fnError('RESOURCE_EXHAUSTED', 'limit_tryOns'))

      await loginAs(page, acc.email, acc.password)
      await ready(page)
      await go(page, 'daily')
      await page.getByRole('button', { name: 'My Closet', exact: true }).first().click()
      await page.locator('[class*="flipOuter"]').filter({ hasText: 'QA White Tee' }).getByRole('button', { name: 'Try On' }).click()
      await page.getByRole('button', { name: 'Buy 30 more — $2.99' }).click()
      await payWithTestCard(page)
      await expect.poll(async () => (await a.usage()).tryOnCredits ?? 0, { timeout: 90_000, intervals: [3_000] }).toBe(before + 30)
    })

    test('Open the billing portal from Profile and cancel → you stay Pro until the end of the period you paid for', async ({ page }) => {
      requireSignup()
      requireStripeTest()
      test.skip(!acc, 'the monthly subscription step did not complete')
      test.setTimeout(240_000)
      note('The hourly enforceBillingDowngrades job moving the account to free once the period ends is a manual check (needs a Stripe test clock).')
      await loginAs(page, acc.email, acc.password)
      await ready(page)
      await go(page, 'profile')
      await page.getByRole('button', { name: 'Manage billing' }).click()
      await page.waitForURL(/billing\.stripe\.com/, { timeout: 60_000 })
      await page.getByRole('link', { name: /Cancel (plan|subscription)/i }).or(page.getByRole('button', { name: /Cancel (plan|subscription)/i })).first().click()
      await page.getByRole('button', { name: /Cancel (plan|subscription)/i }).last().click()
      await expect(page.getByText(/cancel/i).first()).toBeVisible()

      expect((await claims(acc.email, acc.password)).sartima_tier).toBe('pro')
      await page.goto(`${BASE_URL}/#/profile`)
      await expect(page.getByText(/Canceled — Pro until/)).toBeVisible({ timeout: 60_000 })
    })
  })

  test.describe('annual subscription (Stripe test mode)', () => {
    test.use({ role: 'gate' })

    test('Do the same with the annual plan', async ({ page, throwaway }) => {
      requireSignup()
      requireStripeTest()
      test.setTimeout(240_000)
      const created = await throwaway.create()
      await subscribe(page, created, 'annual')
    })
  })

  test.describe('free account', () => {
    test.use({ role: 'free' })

    test('Call a limited Function directly while over the limit → the server rejects it', async ({ account }) => {
      note('Free plans have 0 trip plans and 0 try-ons, so these are refused before any AI or Replicate work happens.')
      const items = basicCloset().map(({ id, name, category, color }) => ({ id, name, category, color }))
      const trip = await account.call('anthropicTrip', { destination: 'Paris', nights: 2, items, gender: 'both' })
      expect(trip.ok).toBe(false)
      expect(trip.status).toBe('RESOURCE_EXHAUSTED')
      const tryOn = await account.call('generateTryOn', {
        personImageUrl: QA_PHOTO,
        garments: [{ garmentImageUrl: QA_PHOTO, garmentName: 'QA tee', category: 'tops' }],
      })
      expect(tryOn.ok).toBe(false)
      expect(['PERMISSION_DENIED', 'RESOURCE_EXHAUSTED']).toContain(tryOn.status)
    })
  })

  test('A failed renewal shows the red payment warning with a 7-day countdown, and you stay Pro', async () => {
    manual('Needs a Stripe test clock: subscribe with card 4000 0000 0000 0341, advance past the renewal date, then check the warning and its countdown.')
  })
  test('"Remind me later" hides the payment warning until the next day', async () => {
    manual('With a failed renewal (see above), press "Remind me later" and confirm it stays hidden until tomorrow.')
  })
  test('When the 7-day grace period ends you drop to free, and the warning offers to restore Pro', async () => {
    manual('Advance the Stripe test clock 7 more days; within an hour enforceBillingDowngrades should move the account to free.')
  })
  test('Fix the payment during the grace period → the warning goes away and you stay Pro', async () => {
    manual('During the grace period, update the card in the billing portal and confirm the warning clears.')
  })
  test('After a cancelled plan\'s period ends, the hourly job moves the account to free', async () => {
    manual('Advance a Stripe test clock past the end of a cancelled period and check the claim drops to free within an hour.')
  })
  test('Usage counters reset when a new month starts', async () => {
    manual('Usage counters are written only by Cloud Functions, so a test can\'t backdate them. On the 1st of a month, check a Pro account\'s try-on and trip counters start from 0.')
  })
  test('Delete a Pro account → its Stripe subscription is cancelled, so there\'s no further charge', async () => {
    manual('Delete a Pro test account from Settings, then check the Stripe dashboard shows its subscription as cancelled.')
  })
})
