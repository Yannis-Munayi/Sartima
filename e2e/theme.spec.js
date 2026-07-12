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
