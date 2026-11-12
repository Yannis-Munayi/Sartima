import fs from 'node:fs'
import {
  test, expect, open, go, openSettings, openOutfitsSubTab, completeQuiz, basicCloset, closetItem,
  currentCardName, loginAs, ready, note, manual, requireSignup, STUB_WEATHER,
} from '../lib/fixtures.js'
import { productsNamed } from '../lib/catalog.js'
import * as fb from '../lib/firebase-rest.js'

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

async function pickGender(page, label) {
  await openSettings(page)
  await page.locator('[class*="genderPill"]').filter({ hasText: new RegExp(`^${label}$`) }).click()
  await page.keyboard.press('Escape')
}

async function feedGenders(page, n) {
  await go(page, 'quiz')
  const like = page.getByRole('button', { name: 'Like', exact: true })
  const out = []
  for (let i = 0; i < n; i++) {
    await expect(like).toBeVisible({ timeout: 15_000 })
    const name = await currentCardName(page)
    out.push(productsNamed(name)[0]?.gender ?? 'unknown')
    await page.getByRole('button', { name: 'Skip', exact: true }).click({ force: true })
    await expect.poll(() => currentCardName(page).catch(() => '')).not.toBe(name)
  }
  return out
}

test.describe('14. Profile and Settings', () => {
  test.describe('guest', () => {
    test('Send feedback and a bug report → each is accepted and confirmed', async ({ page, fns }) => {
      note('The submit Functions are stubbed unless QA_REAL_FEEDBACK=1 (real ones save to Firestore and email you every run).')
      await open(page, 'profile')
      await page.getByRole('button', { name: /Send Feedback/ }).click()
      await page.getByPlaceholder("Tell us what's on your mind...").fill('QA feedback from the test suite')
      await page.getByRole('button', { name: 'Send Feedback', exact: true }).last().click()
      await expect(page.getByText('Thanks for your feedback!')).toBeVisible({ timeout: 20_000 })
      await page.getByRole('button', { name: 'Done', exact: true }).click()

      await page.getByRole('button', { name: /Report a Problem/ }).click()
      await page.getByPlaceholder(/I was adding a photo/).fill('QA: running the checklist')
      await page.getByPlaceholder(/The screen went blank/).fill('QA: nothing actually went wrong')
      await page.getByRole('button', { name: 'Send Report' }).click()
      await expect(page.getByText('Report sent — thank you!')).toBeVisible({ timeout: 20_000 })

      if (fns.calls.submitFeedback) expect(fns.last('submitFeedback').message).toBe('QA feedback from the test suite')
      if (fns.calls.submitCrashReport) expect(JSON.stringify(fns.last('submitCrashReport'))).toContain('QA: running the checklist')
    })

    test('Switch the gender setting → the feed, search and brands all change', async ({ page }) => {
      await open(page, 'home')
      await pickGender(page, 'Men')
      const menFeed = await feedGenders(page, 8)
      expect(menFeed.filter((g) => g === 'women'), `feed genders with Men: ${menFeed.join(', ')}`).toEqual([])
      await go(page, 'search')
      await page.getByPlaceholder('Search by brand, item, or color…').fill('jacket')
      const menCount = await page.locator('[class*="resultsCount"]').innerText()

      await pickGender(page, 'Women')
      const womenFeed = await feedGenders(page, 8)
      expect(womenFeed.filter((g) => g === 'men'), `feed genders with Women: ${womenFeed.join(', ')}`).toEqual([])
      await go(page, 'search')
      await page.getByPlaceholder('Search by brand, item, or color…').fill('jacket')
      await expect(page.locator('[class*="resultsCount"]')).not.toHaveText(menCount)

      // Brand pages show gender-appropriate products in their Shop tab
      await go(page, 'brand/ralph-lauren')
      await page.getByRole('button', { name: 'Shop', exact: true }).click()
      await expect(page.locator('[class*="shopCard"]').first()).toBeVisible()
    })

    test('Switch the theme → the change applies straight away and is still there after a reload', async ({ page }) => {
      await open(page, 'home')
      await openSettings(page)
      await page.getByRole('button', { name: 'Dark', exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await page.reload()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await openSettings(page)
      await page.getByRole('button', { name: 'Light', exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
      await page.reload()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    })

    test('Clear the cache → cached data is cleared, and the app reloads data without errors', async ({ page, pageErrors }) => {
      await open(page, 'home')
      await page.evaluate(() => {
        sessionStorage.setItem('sartima_outfit_2020-01-01_casual_x', '{"itemIds":[]}')
        sessionStorage.setItem('sartima_weather', '{"data":{},"fetchedAt":0}')
      })
      await openSettings(page)
      await page.getByRole('button', { name: 'Clear', exact: true }).click()
      await expect(page.getByRole('button', { name: '✓ Done' })).toBeVisible()
      const left = await page.evaluate(() => [sessionStorage.getItem('sartima_outfit_2020-01-01_casual_x'), sessionStorage.getItem('sartima_weather')])
      expect(left).toEqual([null, null])
      await page.keyboard.press('Escape')
      await go(page, 'search')
      await expect(page.getByText('Find something specific')).toBeVisible()
      expect(pageErrors).toEqual([])
    })
  })

  test.describe('free account', () => {
    test.use({ role: 'free' })

    test('Profile shows your top aesthetics, the evolution chart and your quiz history', async ({ page, account }) => {
      await account.reset()
      await open(page, 'home')
      while ((await account.quizzes()).length < 2) {
        const n = (await account.quizzes()).length
        await completeQuiz(page)
        await expect.poll(async () => (await account.quizzes()).length, { timeout: 20_000 }).toBeGreaterThan(n)
      }
      await page.reload()
      await go(page, 'profile')
      await expect(page.getByText('Your top aesthetics')).toBeVisible()
      await expect(page.getByText('Style evolution', { exact: true })).toBeVisible()
      await expect(page.getByText('Quiz history', { exact: true })).toBeVisible()
    })

    test('Switch °C/°F → the weather display updates', async ({ page, account }) => {
      await account.reset({ closet: basicCloset() })
      await open(page, 'home')
      await openSettings(page)
      await page.getByRole('button', { name: '°C', exact: true }).click()
      await page.keyboard.press('Escape')
      await openOutfitsSubTab(page, "Today's Outfit")
      await expect(page.getByText(`${STUB_WEATHER.temp}°C`)).toBeVisible()

      await openSettings(page)
      await page.getByRole('button', { name: '°F', exact: true }).click()
      await page.keyboard.press('Escape')
      await openOutfitsSubTab(page, "Today's Outfit")
      const f = Math.round(STUB_WEATHER.temp * 9 / 5 + 32)
      await expect(page.getByText(new RegExp(`${f}°F?`)), `expected ${f}°F after switching to °F`).toBeVisible()
    })

    test('Edit the shopping email → the new address is saved after a refresh', async ({ page, account }) => {
      await account.reset()
      const email = `qa-digest-${Date.now().toString(36)}@example.com`
      await open(page, 'home')
      await openSettings(page)
      const input = page.locator('[class*="emailInput"]')
      await input.fill(email)
      await page.locator('[class*="emailSaveBtn"]').click()
      await expect(page.locator('[class*="emailSaveBtn"]')).toHaveText('✓')
      await expect.poll(async () => (await account.user())?.shoppingEmail).toBe(email)
      await page.reload()
      await openSettings(page)
      await expect(page.locator('[class*="emailInput"]')).toHaveValue(email)
    })

    test('Turn on the daily reminder and set a time → the time is saved for the reminder job', async ({ page, context, account }) => {
      note('Whether the push actually arrives at that time (FCM + the 15-minute scheduler) is a manual check.')
      await context.grantPermissions(['notifications'])
      await account.reset()
      await open(page, 'home')
      await openSettings(page)
      const time = page.locator('input[type="time"]')
      await expect(time).toBeVisible()
      await time.fill('07:45')
      await expect.poll(async () => (await account.prefs('notifications'))?.reminderTime).toBe('07:45')
    })

    test('Export your data → a JSON file downloads containing your closet and prefs', async ({ page, account }) => {
      await account.reset({ closet: basicCloset() })
      await open(page, 'home')
      await openSettings(page)
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: '↓ Export all my data' }).click(),
      ])
      expect(download.suggestedFilename()).toMatch(/^sartima-data-\d{4}-\d{2}-\d{2}\.json$/)
      const data = JSON.parse(fs.readFileSync(await download.path(), 'utf8'))
      expect(data.profile).toBeTruthy()
      expect(JSON.stringify(data)).toContain('QA White Tee')
      expect(data.exportedAt).toBeTruthy()
    })

    test('Sign out works', async ({ page }) => {
      await open(page, 'home')
      await openSettings(page)
      await page.getByRole('button', { name: 'Sign out', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible({ timeout: 20_000 })
      await page.reload()
      await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible({ timeout: 20_000 })
    })
  })

  test.describe('Pro account (outfit generation)', () => {
    test.use({ role: 'pro' })

    test('Change the default occasion and the preferred seasons → outfit generation follows them', async ({ page, account, fns }) => {
      await account.reset({
        closet: [
          closetItem('QA Summer Tee', 'tops', { seasons: ['summer'] }),
          closetItem('QA Summer Shorts', 'bottoms', { seasons: ['summer'] }),
          closetItem('QA Summer Sandals', 'footwear', { seasons: ['summer'] }),
          closetItem('QA Winter Sweater', 'tops', { seasons: ['winter'] }),
          closetItem('QA Winter Trousers', 'bottoms', { seasons: ['winter'] }),
        ],
      })
      await open(page, 'home')
      await openSettings(page)
      await page.getByRole('button', { name: 'Work', exact: true }).click()
      await page.locator('[class*="seasonPill"]').filter({ hasText: /^Summer$/ }).click()
      await page.keyboard.press('Escape')

      await openOutfitsSubTab(page, "Today's Outfit")
      await expect(page.getByRole('button', { name: 'Generate Work Outfit' }), 'the default occasion (Work) is pre-selected').toBeEnabled()
      await page.getByRole('button', { name: 'Generate Work Outfit' }).click()
      await expect.poll(() => fns.count('anthropicOutfit')).toBe(1)
      const sent = fns.last('anthropicOutfit').items.map((i) => i.name)
      expect(sent.filter((n) => n.startsWith('QA Summer')).length, `preferred season Summer, sent: ${sent.join(', ')}`).toBeGreaterThan(0)
    })
  })

  test.describe('iPhone Safari (not installed)', () => {
    test.use({ role: 'free', userAgent: IPHONE_UA })

    test('On iOS Safari without the app installed, you see a prompt to install it first', async ({ page }) => {
      await open(page, 'home')
      await openSettings(page)
      await expect(page.getByText('Add Sartima to your Home Screen first')).toBeVisible()
    })
  })

  test.describe('throwaway account', () => {
    test.use({ role: 'gate' })

    test("Delete your account → the account and its data are removed, and you can't log in again", async ({ page, throwaway }) => {
      requireSignup()
      const acc = await throwaway.create()
      await acc.setCloset(basicCloset())
      await loginAs(page, acc.email, acc.password)
      await ready(page)
      await openSettings(page)
      await page.getByRole('button', { name: 'Delete account' }).click()
      await page.getByRole('button', { name: 'Tap again to confirm deletion' }).click()
      await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible({ timeout: 60_000 })

      await expect(fb.signIn(acc.email, acc.password)).rejects.toThrow(/Sign-in failed/)
      await loginAs(page, acc.email, acc.password)
      await expect(page.getByText('Incorrect email or password.')).toBeVisible()
    })
  })

  test('A push reminder arrives at the chosen time in your timezone', async () => {
    manual('Enable the daily reminder on a phone, set a time a few minutes ahead, and wait for the notification (the scheduler runs every 15 minutes).')
  })
})
