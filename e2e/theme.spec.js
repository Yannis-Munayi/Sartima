import { test, expect } from '@playwright/test'

async function dismissConsentBanner(page) {
  const decline = page.getByRole('button', { name: 'Decline', exact: true })
  if (await decline.count()) {
    await decline.first().click({ force: true }).catch(() => {})
  }
}

async function openSettings(page) {
  await page.goto('/')
  await dismissConsentBanner(page)
  await page.getByRole('button', { name: /Profile/i }).first().click()
  await page.locator('button[aria-label="Settings"]').click({ force: true })
  await expect(page.getByText('Appearance', { exact: true })).toBeVisible()
}

test('theme toggle flips data-theme and persists across reload', async ({ page }) => {
  await openSettings(page)

  await page.getByRole('button', { name: '☀️ Light', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  const stored = await page.evaluate(() => localStorage.getItem('sartima_theme'))
  expect(stored).toBe('light')

  await openSettings(page)
  await page.getByRole('button', { name: '🌑 Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('adaptive theme toggle persists and clears the flavor attribute', async ({ page }) => {
  await openSettings(page)
  await expect(page.getByText('Adaptive theme', { exact: true })).toBeVisible()

  // Default is on — turning it off persists and strips any applied flavor
  await page.locator('button[aria-label="Disable adaptive theme"]').click()
  expect(await page.evaluate(() => localStorage.getItem('sartima_adaptive_theme'))).toBe('false')
  expect(await page.locator('html').getAttribute('data-aesthetic')).toBeNull()

  // Off state survives a reload, then can be re-enabled
  await page.reload({ waitUntil: 'networkidle' })
  await dismissConsentBanner(page)
  await page.getByRole('button', { name: /Profile/i }).first().click()
  await page.locator('button[aria-label="Settings"]').click({ force: true })
  await page.locator('button[aria-label="Enable adaptive theme"]').click()
  expect(await page.evaluate(() => localStorage.getItem('sartima_adaptive_theme'))).toBe('true')
})

test('pinning a flavor applies it immediately, survives reload, and Auto reverts', async ({ page }) => {
  await openSettings(page)

  // Pin Street — applies without any quiz signal
  await page.getByRole('button', { name: 'Street', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-aesthetic', 'street')
  expect(await page.evaluate(() => localStorage.getItem('sartima_aesthetic_pin'))).toBe('street')

  // Boot cache re-applies the pinned flavor before React mounts
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('html')).toHaveAttribute('data-aesthetic', 'street')

  // Back to Auto — signed out with no quiz signal, so the attribute clears
  await dismissConsentBanner(page)
  await page.getByRole('button', { name: /Profile/i }).first().click()
  await page.locator('button[aria-label="Settings"]').click({ force: true })
  await page.getByRole('button', { name: '✦ Auto', exact: true }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-aesthetic', /.+/)
  expect(await page.evaluate(() => localStorage.getItem('sartima_aesthetic_pin'))).toBeNull()
})
