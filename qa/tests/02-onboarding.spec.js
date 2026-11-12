import { test, expect, requireSignup, loginAs, note } from '../lib/fixtures.js'

const STEP_TITLES = [
  'shopping for?',
  '3 aesthetics',
  'brands?',
  'closet missing?',
  'fashion goal?',
  'improve?',
  'for work?',
]

async function answerPreferenceSteps(page, { stopAfter = 7 } = {}) {
  // 1 — gender (single tap advances)
  await expect(page.getByText(STEP_TITLES[0])).toBeVisible()
  await page.getByRole('button', { name: /Women/ }).first().click()
  if (stopAfter === 1) return

  // 2 — pick three aesthetics, then Continue
  await expect(page.getByText(STEP_TITLES[1])).toBeVisible()
  const chips = page.locator('[class*="chipGrid"] button')
  for (let i = 0; i < 3; i++) await chips.nth(i).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  if (stopAfter === 2) return

  // 3 — a favourite brand
  await expect(page.getByText(STEP_TITLES[2])).toBeVisible()
  await page.locator('[class*="chipGrid"] button').first().click()
  await page.getByRole('button', { name: /^Continue( \(\d+ selected\))?$/ }).click()

  // 4 — what the closet is missing
  await expect(page.getByText(STEP_TITLES[3])).toBeVisible()
  await page.locator('[class*="tileGrid"] button').first().click()
  await page.getByRole('button', { name: /^Continue( \(\d+ selected\))?$/ }).click()

  // 5–7 — single-tap steps
  await expect(page.getByText(STEP_TITLES[4])).toBeVisible()
  await page.getByRole('button', { name: /Building a capsule wardrobe/ }).click()
  await expect(page.getByText(STEP_TITLES[5])).toBeVisible()
  await page.getByRole('button', { name: /^Work/ }).first().click()
  await expect(page.getByText(STEP_TITLES[6])).toBeVisible()
}

test.describe('2. Onboarding (7 steps)', () => {
  test.describe('before an account exists', () => {
    test.use({ role: 'gate' })

    test('Each step can be answered and moves you on: gender → aesthetics → brands → missing items → goal → occasion → occupation', async ({ page }) => {
      await page.goto('/')
      await answerPreferenceSteps(page)
      await page.getByRole('button', { name: /^Student/ }).click()
      // After occupation the flow asks for an email to create the account
      await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
    })
  })

  test.describe('a signed-in account that has not finished onboarding', () => {
    test.use({ role: 'gate' })

    test('A new account goes straight into onboarding', async ({ page, throwaway }) => {
      requireSignup()
      note('Email sign-ups answer these steps before the account exists; this covers accounts that reach onboarding after signing in (Google, older accounts).')
      const acc = await throwaway.create({ consent: true, onboarded: false })
      await loginAs(page, acc.email, acc.password)
      await expect(page.getByText(STEP_TITLES[0])).toBeVisible({ timeout: 30_000 })
    })

    test('Double-tap a tile on the last step → it only moves forward once, and onboardingComplete is saved', async ({ page, throwaway }) => {
      requireSignup()
      const acc = await throwaway.create({ consent: true, onboarded: false })
      await loginAs(page, acc.email, acc.password)
      await expect(page.getByText(STEP_TITLES[0])).toBeVisible({ timeout: 30_000 })
      await answerPreferenceSteps(page)
      await page.getByRole('button', { name: /^Student/ }).dblclick()

      // Lands in the warm-started quiz, once
      await expect(page.getByText(/^\d+ \/ 40$/)).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText(STEP_TITLES[6])).toHaveCount(0)
      await expect.poll(async () => (await acc.user())?.onboardingComplete, { timeout: 15_000 }).toBe(true)
    })

    test("Refresh partway through onboarding → you don't skip ahead into the app half-finished", async ({ page, throwaway }) => {
      requireSignup()
      const acc = await throwaway.create({ consent: true, onboarded: false })
      await loginAs(page, acc.email, acc.password)
      await expect(page.getByText(STEP_TITLES[0])).toBeVisible({ timeout: 30_000 })
      await answerPreferenceSteps(page, { stopAfter: 2 })
      await page.reload()
      await expect(page.getByText(STEP_TITLES[0])).toBeVisible({ timeout: 30_000 })
      await expect(page.getByRole('button', { name: /^Home/ })).toHaveCount(0)
    })
  })
})
