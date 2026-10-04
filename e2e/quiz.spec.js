import { test, expect } from '@playwright/test'
import { dismissConsentBanner, bypassSignupGate } from './helpers.js'

// Core conversion funnel: home quiz CTA → 40 swipes in finite quiz mode →
// results screen. The "/ 40" progress assertion also guards the regression
// where the CTA dropped users into the infinite feed instead of the quiz.
test('completing the style quiz from the home CTA reaches the results screen', async ({ page }) => {
  test.setTimeout(120_000)

  await page.goto('/')
  await bypassSignupGate(page)
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

  // The browse tabs now rank by the result: the Aesthetics tab leads with
  // the same aesthetic the results hero names
  const primary = (await page.locator('[class*="heroStyleName"]').innerText()).trim()

  await page.getByRole('button', { name: /^Aesthetics/ }).first().click()
  await expect(page.getByText('sorted by your style', { exact: false })).toBeVisible()
  const closest = page.locator('section', { has: page.getByRole('heading', { name: 'Closest to your style' }) })
  await expect(closest.locator('[class*="cardName"]').first()).toHaveText(primary)

  await page.getByRole('button', { name: /^Brands/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Closest to your style' })).toBeVisible()

  // Search suggestions come from the profile, grouped by facet
  await page.getByRole('button', { name: /^Search/ }).first().click()
  await expect(page.getByText('Picked from your style profile', { exact: false })).toBeVisible()
  await expect(page.getByText('Pieces', { exact: true })).toBeVisible()

  // Shop Scout leads with garment types picked for the profile, then basics
  await page.getByRole('button', { name: /^Outfits/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Picked for your style' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Wardrobe basics' })).toBeVisible()
})
