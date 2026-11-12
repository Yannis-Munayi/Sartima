import { test, expect, open, go, completeQuiz, currentCardName, note, knownIssue } from '../lib/fixtures.js'
import { productsNamed } from '../lib/catalog.js'

const like = (page) => page.getByRole('button', { name: 'Like', exact: true })
const skip = (page) => page.getByRole('button', { name: 'Skip', exact: true })

// Records navigator.share calls instead of opening the OS share sheet
async function captureShares(context) {
  await context.addInitScript(() => {
    window.__qaShares = []
    const share = async (data) => {
      window.__qaShares.push({
        title: data?.title, text: data?.text, url: data?.url,
        files: Array.from(data?.files ?? []).map((f) => ({ name: f.name, type: f.type, size: f.size })),
      })
    }
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
  })
}

test.describe('3. Style quiz', () => {
  test.describe('guest', () => {
    test('Like and skip each move the quiz on, and in Discover, undo restores the previous card', async ({ page }) => {
      note('The 40-card quiz has no undo button; undo (the back arrow) exists in the Discover feed, so that is where it is checked.')
      await open(page, 'home')
      await go(page, 'quiz/start')
      const counter = page.getByText(/^\d+ \/ 40$/)
      await expect(counter).toBeVisible({ timeout: 20_000 })
      await expect(like(page)).toBeVisible()
      const start = Number((await counter.innerText()).split(' ')[0])
      await like(page).click()
      await expect(counter).toHaveText(`${start + 1} / 40`)
      await skip(page).click()
      await expect(counter).toHaveText(`${start + 2} / 40`)

      await go(page, 'home')
      // Leaving mid-quiz then opening Discover offers to resume; pick free discovery
      await go(page, 'quiz')
      const justDiscover = page.getByRole('button', { name: 'Just Discover' })
      if (await justDiscover.isVisible({ timeout: 3_000 }).catch(() => false)) await justDiscover.click()
      await expect(page.getByText(/Swipe to explore|explored/)).toBeVisible({ timeout: 20_000 })

      const first = await currentCardName(page)
      await skip(page).click()
      await expect.poll(() => currentCardName(page)).not.toBe(first)
      await page.getByRole('button', { name: 'Previous', exact: true }).click()
      await expect.poll(() => currentCardName(page)).toBe(first)
    })

    test('Finish all 40 items → the Results screen shows your top 3 aesthetics', async ({ page }) => {
      await open(page, 'home')
      await completeQuiz(page)
      await expect(page.getByText('Not enough data yet')).toHaveCount(0)
      await expect(page.getByText('Your aesthetic breakdown')).toBeVisible()
      expect(await page.locator('[class*="scoreRowLink"]').count()).toBeGreaterThanOrEqual(3)
    })

    test('Share from the Results screen → the share sheet opens with your results text and link', async ({ page, context }) => {
      await captureShares(context)
      await open(page, 'home')
      await completeQuiz(page)
      await page.getByRole('button', { name: /Share your results/ }).click()
      const shares = await page.evaluate(() => window.__qaShares)
      expect(shares).toHaveLength(1)
      expect(shares[0].title).toBe('My Sartima Results')
      expect(shares[0].text).toContain('My style aesthetic is')
      expect(shares[0].url).toContain('http')
    })

    test('Choose infinite mode → cards keep coming past 40 and no Results screen appears', async ({ page }) => {
      await open(page, 'home')
      await go(page, 'quiz')
      await expect(page.getByText('Swipe to explore')).toBeVisible({ timeout: 20_000 })
      for (let i = 0; i < 45; i++) {
        await (i % 3 === 0 ? like(page) : skip(page)).click({ force: true, timeout: 3_000 }).catch(() => {})
        await page.waitForTimeout(330)
      }
      await expect(page.getByText(/^\d+ explored · \d+ liked$/)).toBeVisible()
      const explored = Number((await page.getByText(/explored ·/).innerText()).match(/^(\d+)/)[1])
      expect(explored).toBeGreaterThan(40)
      await expect(page.getByRole('heading', { name: 'Your style' })).toHaveCount(0)
      await expect(like(page)).toBeVisible()
    })

    test('Choose seasons and categories → the quiz items match what you chose', async ({ page }) => {
      knownIssue('The Discover feed (useDiscoveryQueue) may not read the seasons and categories picked on these screens.')
      await open(page, 'home')
      await completeQuiz(page)
      // "Start over" returns to the welcome screen, which leads into the season → category setup
      await page.getByRole('button', { name: 'Start over' }).last().click()
      await page.getByRole('button', { name: /Get started/ }).click()
      await expect(page.getByText('Which seasons matter most?')).toBeVisible()
      await page.getByRole('button', { name: /Winter/ }).click()
      await page.getByRole('button', { name: /^Continue/ }).click()
      await expect(page.getByText('What do you shop for most?')).toBeVisible()
      await page.getByRole('button', { name: /Footwear/ }).click()
      await page.getByRole('button', { name: /Start exploring/ }).click()

      const seen = []
      for (let i = 0; i < 6; i++) {
        await expect(like(page)).toBeVisible({ timeout: 20_000 })
        seen.push(await currentCardName(page))
        await skip(page).click({ force: true })
        await page.waitForTimeout(350)
      }
      const types = seen.map((name) => productsNamed(name)[0]?.parentType ?? 'unknown')
      const offTopic = seen.filter((_, i) => types[i] !== 'footwear' && types[i] !== 'unknown')
      expect(offTopic, `Asked for footwear, but saw: ${seen.map((n, i) => `${n} (${types[i]})`).join(', ')}`).toEqual([])
    })
  })

  test.describe('free account', () => {
    test.use({ role: 'free' })

    test("Take the quiz a second time → it shows up in Profile's quiz history and on the style-evolution chart", async ({ page, account }) => {
      await account.reset()
      const before = (await account.quizzes()).length
      await open(page, 'home')
      await completeQuiz(page)
      await expect.poll(async () => (await account.quizzes()).length, { timeout: 20_000 }).toBe(before + 1)
      if (before + 1 < 2) {
        await completeQuiz(page)
        await expect.poll(async () => (await account.quizzes()).length, { timeout: 20_000 }).toBe(before + 2)
      }
      await go(page, 'profile')
      await expect(page.getByText('Quiz history', { exact: true })).toBeVisible()
      expect(await page.locator('[class*="quizCard"]').count()).toBeGreaterThanOrEqual(2)
      await expect(page.getByText('Style evolution', { exact: true })).toBeVisible()
    })
  })
})
