import { test, expect } from '@playwright/test'

async function dismissConsentBanner(page) {
  const decline = page.getByRole('button', { name: 'Decline', exact: true })
  if (await decline.count()) {
    await decline.first().click({ force: true }).catch(() => {})
  }
}

// Core conversion funnel: home quiz CTA → 40 swipes in finite quiz mode →
// results screen. The "/ 40" progress assertion also guards the regression
// where the CTA dropped users into the infinite feed instead of the quiz.
test('completing the style quiz from the home CTA reaches the results screen', async ({ page }) => {
  test.setTimeout(120_000)

  await page.goto('/')
  await dismissConsentBanner(page)

  await page.getByRole('button', { name: /Take the style quiz/ }).click()

  // Finite quiz mode is active (infinite mode shows "Swipe to explore" instead)
  await expect(page.getByText('/ 40')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Like', exact: true })).toBeVisible()

  const results = page.getByRole('heading', { name: 'Your style' })
  const like    = page.getByRole('button', { name: 'Like', exact: true })
  const skip    = page.getByRole('button', { name: 'Skip', exact: true })

  // Alternate like/skip until the quiz hands off to results. Each swipe has a
  // ~300ms fly-away animation before the next card mounts, so pace the loop
  // and tolerate clicks that land mid-transition.
  for (let i = 0; i < 60; i++) {
    if (await results.isVisible().catch(() => false)) break
    const btn = i % 2 === 0 ? like : skip
    await btn.click({ force: true }).catch(() => {})
    await page.waitForTimeout(380)
  }

  await expect(results).toBeVisible({ timeout: 15_000 })
  // A primary aesthetic was computed (not the "Not enough data yet" fallback)
  await expect(page.getByText('Not enough data yet')).toHaveCount(0)
})
