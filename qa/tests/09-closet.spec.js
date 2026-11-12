import {
  test, expect, open, openOutfitsSubTab, openSettings, closetItem, basicCloset, note,
} from '../lib/fixtures.js'

test.use({ role: 'free' })

// A JPEG drawn in the browser: a plain background with a few "garments".
// `noise` fills it with random pixels so it compresses badly (a big file).
async function makeJpeg(page, { width = 600, height = 800, noise = false, quality = 0.92 } = {}) {
  const base64 = await page.evaluate(async ({ width, height, noise, quality }) => {
    const c = document.createElement('canvas')
    c.width = width; c.height = height
    const ctx = c.getContext('2d')
    if (noise) {
      const img = ctx.createImageData(width, height)
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = Math.random() * 255; img.data[i + 1] = Math.random() * 255
        img.data[i + 2] = Math.random() * 255; img.data[i + 3] = 255
      }
      ctx.putImageData(img, 0, 0)
    } else {
      ctx.fillStyle = '#f2f2f2'; ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = '#1d3b6e'; ctx.fillRect(width * 0.2, height * 0.1, width * 0.6, height * 0.35)
      ctx.fillStyle = '#c9b38a'; ctx.fillRect(width * 0.28, height * 0.48, width * 0.44, height * 0.4)
    }
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', quality))
    const buf = new Uint8Array(await blob.arrayBuffer())
    let s = ''
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return btoa(s)
  }, { width, height, noise, quality })
  return Buffer.from(base64, 'base64')
}

const cardNames = (page) => page.locator('[class*="flipOuter"] [class*="cardFront"] [class*="itemName"]')

async function openCloset(page) {
  await open(page, 'home')
  await openOutfitsSubTab(page, 'My Closet')
}

async function openAddSheet(page, option) {
  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByRole('button', { name: new RegExp(option) }).click()
}

const card = (page, name) => page.locator('[class*="flipOuter"]').filter({ hasText: name }).first()

/** Flip a closet card over (its back holds Edit / Remove and the care label). */
async function flip(page, name) {
  await card(page, name).locator('[class*="cardFront"]').click()
}

/** Flip a closet card and open its detail sheet. */
async function openItemSheet(page, name) {
  await flip(page, name)
  await card(page, name).getByRole('button', { name: '✎ Edit', exact: true }).click()
  await expect(page.getByRole('button', { name: '✎ Edit Details' })).toBeVisible()
}

test.describe('9. Closet', () => {
  test('Upload a photo → the AI picks out the items and adds them to your closet', async ({ page, account, fns }) => {
    note('The vision call is stubbed (no AI spend); the photo really uploads to Storage.')
    await account.reset()
    await openCloset(page)
    await openAddSheet(page, 'Upload Photo')
    await page.getByRole('button', { name: /Analyze Outfit/ }).click()
    await page.locator('input[type="file"]').setInputFiles({ name: 'outfit.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(page) })
    await page.getByRole('button', { name: '✦ Identify items with AI' }).click()
    await expect(page.getByText('2 of 2 items selected')).toBeVisible({ timeout: 30_000 })
    expect(fns.count('anthropicVision')).toBe(1)
    await page.getByRole('button', { name: 'Add 2 items to Wardrobe' }).click()
    await expect(cardNames(page).filter({ hasText: 'QA Denim Jacket' })).toBeVisible({ timeout: 60_000 })
    await expect(cardNames(page).filter({ hasText: 'QA Striped Tee' })).toBeVisible()
    await expect.poll(async () => (await account.closet()).filter((i) => i.aiDetected).length, { timeout: 20_000 }).toBe(2)
  })

  test("Upload a large photo (over 5MB) → it's shrunk and still uploads", async ({ page, account }) => {
    await account.reset()
    await openCloset(page)
    const big = await makeJpeg(page, { width: 3200, height: 2600, noise: true, quality: 0.97 })
    expect(big.length, 'test photo is over 5MB').toBeGreaterThan(5 * 1024 * 1024)

    const uploaded = []
    page.on('request', (req) => {
      if (/firebasestorage\.googleapis\.com/.test(req.url()) && ['POST', 'PUT'].includes(req.method())) {
        uploaded.push(req.postDataBuffer()?.length ?? 0)
      }
    })
    await openAddSheet(page, 'Upload Photo')
    await page.getByRole('button', { name: /Add a Piece/ }).click()
    await page.locator('input[type="file"]').setInputFiles({ name: 'huge.jpg', mimeType: 'image/jpeg', buffer: big })
    await expect(page.getByText('Preparing photo…')).toHaveCount(0, { timeout: 60_000 })
    await page.getByPlaceholder(/Item name/).fill('QA Big Photo')
    await page.getByRole('button', { name: 'Save to Wardrobe' }).click()
    await expect(cardNames(page).filter({ hasText: 'QA Big Photo' })).toBeVisible({ timeout: 60_000 })
    expect(uploaded.length, 'a Storage upload happened').toBeGreaterThan(0)
    expect(Math.max(...uploaded), 'uploaded bytes').toBeLessThan(5 * 1024 * 1024)
  })

  test('Prettify a photo → the background is removed', async ({ page, account }) => {
    test.setTimeout(300_000)
    note('Runs the real in-browser background removal (downloads its model on first use, so it is slow).')
    await account.reset()
    await openCloset(page)
    await openAddSheet(page, 'Upload Photo')
    await page.getByRole('button', { name: /Add a Piece/ }).click()
    await page.locator('input[type="file"]').setInputFiles({ name: 'piece.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(page) })
    await page.getByPlaceholder(/Item name/).fill('QA Prettify Me')
    await page.getByRole('button', { name: 'Save to Wardrobe' }).click()
    await expect(cardNames(page).filter({ hasText: 'QA Prettify Me' })).toBeVisible({ timeout: 60_000 })

    await openItemSheet(page, 'QA Prettify Me')
    await page.getByRole('button', { name: '✦ Prettify' }).click()
    await expect.poll(async () => (await account.closet()).find((i) => i.name === 'QA Prettify Me')?.prettifiedUrl ?? '',
      { timeout: 240_000, intervals: [3_000] }).toMatch(/^https:/)
    await expect(page.getByText('Prettify failed')).toHaveCount(0)
  })

  test('Prettify a catalog item\'s photo → the background is removed (through the proxyImage Function)', async ({ page, account }) => {
    test.setTimeout(300_000)
    await account.reset({ closet: [closetItem('QA Catalog Photo', 'tops')] })
    const proxied = []
    page.on('request', (req) => { if (/\/proxyImage(\?|$)/.test(req.url()) && req.method() === 'POST') proxied.push(req.url()) })
    await openCloset(page)
    await openItemSheet(page, 'QA Catalog Photo')
    await page.getByRole('button', { name: '✦ Prettify' }).click()
    await expect.poll(async () => (await account.closet()).find((i) => i.name === 'QA Catalog Photo')?.prettifiedUrl ?? '',
      { timeout: 240_000, intervals: [3_000] }).toMatch(/^https:/)
    expect(proxied.length, 'the cross-origin photo went through proxyImage').toBeGreaterThan(0)
  })

  test('Add an item through catalog search → it appears in your closet', async ({ page, account }) => {
    await account.reset()
    await openCloset(page)
    await openAddSheet(page, 'Search Catalog')
    await page.getByPlaceholder(/white linen shirt/).fill('white linen shirt')
    await page.getByRole('button', { name: '→', exact: true }).click()
    await page.locator('[class*="resultCard"]').first().click({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Add 1 item to Closet' }).click()
    await expect(cardNames(page).filter({ hasText: 'white linen shirt' })).toBeVisible()
    await expect.poll(async () => (await account.closet()).map((i) => i.name)).toContain('white linen shirt')
  })

  test('Edit an item in its detail sheet → the change is saved after a refresh', async ({ page, account }) => {
    await account.reset({ closet: basicCloset() })
    await openCloset(page)
    await openItemSheet(page, 'QA White Tee')
    await page.getByRole('button', { name: '✎ Edit Details' }).click()
    const nameInput = page.locator('[class*="editTitle"] ~ input').first()
    await nameInput.fill('QA White Tee Edited')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(cardNames(page).filter({ hasText: 'QA White Tee Edited' })).toBeVisible()
    await page.reload()
    await openOutfitsSubTab(page, 'My Closet')
    await expect(cardNames(page).filter({ hasText: 'QA White Tee Edited' })).toBeVisible()
  })

  test('Mark an item as a favourite → it stays a favourite after a refresh', async ({ page, account }) => {
    await account.reset({ closet: basicCloset() })
    await openCloset(page)
    await openItemSheet(page, 'QA White Tee')
    const favourite = page.getByRole('button', { name: /favou?rite/i })
    await page.getByRole('button', { name: '✎ Edit Details' }).click()
    expect(await favourite.count(), 'No favourite control in the closet item sheet (the Favorites sort has nothing to sort by)').toBeGreaterThan(0)
    await favourite.first().click()
    await page.reload()
    await expect.poll(async () => (await account.closet()).find((i) => i.name === 'QA White Tee')?.favorite).toBe(true)
  })

  test("Delete an item → it's gone after a refresh, and the closet count drops", async ({ page, account }) => {
    await account.reset({ closet: basicCloset() })
    await openCloset(page)
    await flip(page, 'QA Navy Chinos')
    await card(page, 'QA Navy Chinos').getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(cardNames(page).filter({ hasText: 'QA Navy Chinos' })).toHaveCount(0)
    await expect.poll(async () => (await account.closet()).length).toBe(basicCloset().length - 1)
    await page.reload()
    await openOutfitsSubTab(page, 'My Closet')
    await expect(cardNames(page).filter({ hasText: 'QA White Tee' })).toBeVisible()
    await expect(cardNames(page).filter({ hasText: 'QA Navy Chinos' })).toHaveCount(0)
  })

  test("Set care symbols on an item → they're saved and show on its card", async ({ page, account }) => {
    await account.reset({ closet: basicCloset() })
    await openCloset(page)
    await openItemSheet(page, 'QA White Tee')
    await page.getByRole('button', { name: '✎ Edit Details' }).click()
    await page.getByRole('button', { name: /Machine wash cold/ }).first().click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect.poll(async () => (await account.closet()).find((i) => i.name === 'QA White Tee')?.careSymbols ?? []).toContain('wash-30')
    await page.reload()
    await openOutfitsSubTab(page, 'My Closet')
    await flip(page, 'QA White Tee')
    await expect(card(page, 'QA White Tee').getByText('Care label')).toBeVisible()
    await expect(card(page, 'QA White Tee').locator('[class*="symbolChip"]').filter({ hasText: '30°' })).toBeVisible()
  })

  test('As a free user, add a 16th item → the paywall opens', async ({ page, account }) => {
    const fifteen = Array.from({ length: 15 }, (_, i) => closetItem(`QA Filler ${i + 1}`, 'tops'))
    await account.reset({ closet: fifteen })
    await openCloset(page)
    await expect(cardNames(page)).toHaveCount(15)
    await openAddSheet(page, 'Search Catalog')
    await page.getByPlaceholder(/white linen shirt/).fill('black hoodie')
    await page.getByRole('button', { name: '→', exact: true }).click()
    await page.locator('[class*="resultCard"]').first().click({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Add 1 item to Closet' }).click()
    await expect(page.getByText('Closet full')).toBeVisible()
    await expect(page.getByText('Free closets hold up to 15 items.')).toBeVisible()
    expect((await account.closet()).length).toBe(15)
  })

  test('Each closet sort option works: date, category, favourites and least-worn', async ({ page, account }) => {
    const day = 86_400_000
    const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString()
    const ymd = (msAgo) => iso(msAgo).slice(0, 10)
    await account.reset({
      closet: [
        closetItem('QA Sort Newest', 'tops', { addedAt: iso(3_600_000), lastWorn: ymd(0), timesWorn: 1 }),
        closetItem('QA Sort Favourite', 'outerwear', { addedAt: iso(5 * day), lastWorn: ymd(day), timesWorn: 2, favorite: true }),
        closetItem('QA Sort Accessory', 'accessories', { addedAt: iso(3 * day), lastWorn: ymd(2 * day), timesWorn: 1 }),
        closetItem('QA Sort Ghost', 'footwear', { addedAt: iso(120 * day) }),
      ],
    })
    await open(page, 'home')
    for (const [label, expected] of [
      ['Date added', 'QA Sort Newest'],
      ['Category', 'QA Sort Accessory'],
      ['Favorites', 'QA Sort Favourite'],
      ['Least worn', 'QA Sort Ghost'],
    ]) {
      await openSettings(page)
      await page.getByRole('button', { name: label, exact: true }).click()
      await page.keyboard.press('Escape')
      await openOutfitsSubTab(page, 'My Closet')
      await expect(cardNames(page).first(), `sorted by ${label}`).toHaveText(expected)
    }
  })
})
