// Shared fixtures for the Sartima QA suite.
//
// Every test picks who it runs as with `test.use({ role })`:
//   'guest' — signed out, past the signup gate (the default)
//   'gate'  — signed out, landing on the signup gate itself
//   'free' / 'pro' — the test accounts from qa/.env, logged in once per run
//
// Account tests take a per-account lock for their whole run, so tests that
// seed and check the same account's data never overlap. Guest tests run in
// parallel.
//
// AI, weather, try-on and feedback Functions are answered by stubs (no AI
// spend, no Replicate charges, no emails); a test opts back into a real call
// with `test.use({ realFunctions: ['name'] })`.

import fs from 'node:fs'
import path from 'node:path'
import { test as base, expect } from '@playwright/test'
import {
  ACCOUNTS, ALLOW_SIGNUP, BASE_URL, FIREBASE, IS_PROD_BUILD, REAL_FEEDBACK,
  RESULTS_DIR, STRIPE_TEST_MODE, TARGET, legalVersion,
} from './env.js'
import * as fb from './firebase-rest.js'
import { startProdServer } from './prod-server.js'

export { expect }

// A real, stable https photo for seeded closet items (try-on needs https URLs)
export const QA_PHOTO = 'https://images.pexels.com/photos/996329/pexels-photo-996329.jpeg?auto=compress&cs=tinysrgb&w=400'
export const QA_RESULT_IMAGE =
  'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#B8956A"/><text x="150" y="200" font-size="28" text-anchor="middle" fill="#fff">QA try-on</text></svg>')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const today     = () => new Date().toISOString().slice(0, 10)
export const thisMonth = () => new Date().toISOString().slice(0, 7)

// ── Labels the dashboard reads ───────────────────────────────────────────────

function annotate(type, description) {
  base.info().annotations.push({ type, description })
}

/** Something a person has to check by hand; the test is listed but not run. */
export function manual(reason) {
  annotate('manual', reason)
  base.skip(true, `Manual check: ${reason}`)
}

/** Skip with a "needs setup" reason when a requirement isn't configured. */
export function needs(ok, what) {
  if (ok) return
  annotate('needs-setup', what)
  base.skip(true, `Needs setup: ${what}`)
}

export const requireSignup = () =>
  needs(ALLOW_SIGNUP && FIREBASE.apiKey, TARGET === 'live'
    ? 'QA_ALLOW_SIGNUP_LIVE=1 in qa/.env (creates and deletes throwaway @example.com accounts)'
    : 'QA_ALLOW_SIGNUP_LOCAL=1 in qa/.env (creates and deletes throwaway @example.com accounts)')

export const requireStripeTest = () =>
  needs(STRIPE_TEST_MODE, 'QA_STRIPE_TEST_MODE=1 in qa/.env, and deployed Functions using Stripe test keys')

/** A known bug: the test still runs, and the dashboard tags the failure. */
export const knownIssue = (text) => annotate('known-issue', text)

/** Extra context shown with the result (what the test does and doesn't prove). */
export const note = (text) => annotate('note', text)

// ── Account lock ─────────────────────────────────────────────────────────────

async function withLock(name, fn) {
  const dir = path.join(RESULTS_DIR, 'locks', name)
  fs.mkdirSync(path.dirname(dir), { recursive: true })
  const started = Date.now()
  for (;;) {
    try { fs.mkdirSync(dir); break } catch (err) {
      if (err.code !== 'EEXIST') throw err
      try {
        if (Date.now() - fs.statSync(dir).mtimeMs > 15 * 60 * 1000) fs.rmSync(dir, { recursive: true, force: true })
      } catch { /* raced with the holder */ }
      if (Date.now() - started > 40 * 60 * 1000) throw new Error(`Timed out waiting for the ${name} account`, { cause: err })
      await sleep(400)
    }
  }
  try { return await fn() } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}

// ── Logging the test accounts in (once, reused across tests) ─────────────────

async function prepareAccount(role) {
  const s = await fb.session(role)
  // Accounts used by the suite skip the consent gate and onboarding, and are
  // on the current legal version, so every test starts in the app itself.
  await fb.mergeDoc(s, `users/${s.uid}`, {
    ageAffirmed16Plus: true,
    onboardingComplete: true,
    legalVersion: legalVersion(),
  })
  return s
}

async function loginThroughUi(browser, email, password) {
  const ctx = await browser.newContext({ baseURL: BASE_URL })
  await ctx.addInitScript(() => {
    try { localStorage.setItem('sartima_analytics_consent', 'denied') } catch { /* */ }
  })
  const page = await ctx.newPage()
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await page.getByPlaceholder('you@example.com').fill(email)
  await page.getByPlaceholder('••••••••').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Home/ }).first()).toBeVisible({ timeout: 45_000 })
  return { ctx, page }
}

async function ensureStorageState(browser, role) {
  // Keyed by origin too: Firebase keeps the login per origin, so a state saved
  // against the dev server (:5180) is signed out on the production build (:4180).
  const origin = new URL(BASE_URL).host.replace(/[^a-z0-9]+/gi, '_')
  const file = path.join(RESULTS_DIR, 'auth', `${role}-${origin}.json`)
  try {
    if (Date.now() - fs.statSync(file).mtimeMs < 6 * 60 * 60 * 1000) {
      await prepareAccount(role)
      return file
    }
  } catch { /* first login */ }
  await prepareAccount(role)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const { ctx } = await loginThroughUi(browser, ACCOUNTS[role].email, ACCOUNTS[role].password)
  await ctx.storageState({ path: file, indexedDB: true })
  await ctx.close()
  return file
}

// ── Seeding and reading an account's data (as that account) ──────────────────

export function accountApi(s) {
  const u = `users/${s.uid}`
  const api = {
    uid: s.uid,
    email: s.email,
    session: s,
    user:       () => fb.getDoc(s, u),
    mergeUser:  (data) => fb.mergeDoc(s, u, data),
    prefs:      (key) => fb.getDoc(s, `${u}/prefs/${key}`),
    setPrefs:   (key, data) => fb.setDoc(s, `${u}/prefs/${key}`, data),
    clearPrefs: (key) => fb.deleteDoc(s, `${u}/prefs/${key}`),
    closet:     async () => (await fb.getDoc(s, `${u}/prefs/closet`))?.items ?? [],
    setCloset:  (items) => fb.setDoc(s, `${u}/prefs/closet`, { items }),
    usage:      async () => (await fb.getDoc(s, `${u}/prefs/usage`)) ?? {},
    quizzes:    () => fb.listDocs(s, `${u}/quizzes`),
    addQuiz:    (data) => fb.addDoc(s, `${u}/quizzes`, data),
    plans:      () => fb.listDocs(s, `${u}/outfitPlans`),
    deletePlan: (id) => fb.deleteDoc(s, `${u}/outfitPlans/${id}`),
    call:       (name, data) => fb.callFunction(s, name, data),
    /** Start from a known, quiet state: empty closet and lists, no recap pop-up. */
    async reset({ closet = [], liked = [], wishlist = [], boards = [], log = [] } = {}) {
      await Promise.all([
        api.setCloset(closet),
        api.setPrefs('liked', { items: liked }),
        api.setPrefs('wishlist', { items: wishlist }),
        api.setPrefs('outfitBoards', { items: boards }),
        api.setPrefs('outfitLog', { entries: log }),
        api.setPrefs('gapDismissals', {}),
        api.setPrefs('recapSeen', { lastShownMonth: thisMonth() }),
        api.setPrefs('gapSignals', {}),
      ])
    },
  }
  return api
}

/** A closet item in the shape ClosetContext stores. */
export function closetItem(name, category, extra = {}) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return {
    id: `qa_${slug}`,
    type: 'catalog',
    name,
    category,
    color: extra.color ?? '',
    thumbnailUrl: QA_PHOTO,
    aiDetected: false,
    favorite: false,
    tags: [],
    seasons: [],
    occasions: [],
    careSymbols: [],
    addedAt: new Date(Date.now() - 86_400_000).toISOString(),
    ...extra,
  }
}

export const basicCloset = () => [
  closetItem('QA White Tee', 'tops', { color: 'white' }),
  closetItem('QA Navy Chinos', 'bottoms', { color: 'navy' }),
  closetItem('QA Leather Sneakers', 'footwear', { color: 'white' }),
  closetItem('QA Wool Coat', 'outerwear', { color: 'grey' }),
]

// ── Function stubs ───────────────────────────────────────────────────────────

// searchImages is stubbed too. Guests are rate-limited per IP (a 60-call burst),
// and every parallel guest test starts with an empty photo cache from the same
// IP, so the suite drained that bucket within minutes and later screens (the
// Brands grid) got only 429s and showed no photos. It also spent the
// production Unsplash/Pexels hourly quota that real users rely on. The real
// Function is still checked directly in 16-backend.
const STUBBED = [
  'anthropicVision', 'anthropicOutfit', 'anthropicGapReasoning', 'anthropicTrip',
  'generateTryOn', 'getWeather', 'submitFeedback', 'submitCrashReport', 'searchImages',
]

/** An inline photo stand-in, so stubbed image searches load with no network. */
export const qaStockPhoto = (label = 'QA photo') => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#8B6840"/><text x="150" y="200" font-size="22" text-anchor="middle" fill="#fff">${label.replace(/[<&>"]/g, '')}</text></svg>`,
)

/** Return this from a stub handler to answer with a callable error. */
export const fnError = (status, message) => ({ __error: { status, message } })
const HTTP_FOR = { RESOURCE_EXHAUSTED: 429, PERMISSION_DENIED: 403, INVALID_ARGUMENT: 400, UNAVAILABLE: 503, INTERNAL: 500, UNAUTHENTICATED: 401 }

export const STUB_WEATHER = {
  city: 'Toronto', temp: 4, feelsLike: 1, condition: 'Rain', description: 'light rain',
  icon: '10d', humidity: 80, windSpeed: 5,
}

const DEFAULT_RESPONSES = {
  anthropicOutfit: (d) => ({
    selectedIds: (d.items ?? []).slice(0, 3).map((i) => i.id),
    reasoning: 'QA stub outfit, picked by the test suite.',
    weatherNote: d.weather ? `QA weather note: ${d.weather.condition}` : null,
    missingCategory: null,
  }),
  anthropicVision: () => ({
    items: [
      { name: 'QA Denim Jacket', category: 'outerwear', color: 'blue', description: 'Test jacket from the stubbed vision call', bbox: { x: 10, y: 10, w: 50, h: 50 } },
      { name: 'QA Striped Tee', category: 'tops', color: 'white', description: 'Test tee from the stubbed vision call', bbox: null },
    ],
  }),
  anthropicGapReasoning: (d) => ({ reasoning: `QA stub: one more ${d.category} piece would round out your closet.` }),
  anthropicTrip: (d) => ({
    destination: d.destination,
    nights: d.nights,
    packingList: (d.items ?? []).slice(0, 3).map((i) => ({ itemId: i.id, name: i.name, note: 'QA packing note', fromCloset: true })),
    dailyOutfits: Array.from({ length: d.nights ?? 1 }, (_, k) => ({
      day: k + 1, label: `Day ${k + 1} - QA`, itemIds: (d.items ?? []).slice(0, 2).map((i) => i.id), note: 'QA styling tip',
    })),
    gapItems: ['QA packable rain jacket'],
  }),
  generateTryOn: () => ({ outputUrl: QA_RESULT_IMAGE }),
  getWeather: () => ({ ...STUB_WEATHER, fetchedAt: Date.now() }),
  submitFeedback: () => ({ ok: true }),
  submitCrashReport: () => ({ ok: true }),
  searchImages: (d) => ({
    urls: Array.from({ length: Math.max(1, Math.min(d.count ?? 3, 10)) }, (_, i) => qaStockPhoto(`QA photo ${i + 1}`)),
  }),
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Page helpers ─────────────────────────────────────────────────────────────

/** Waits until the main app (sidebar on desktop) is showing. */
export async function ready(page) {
  await expect(page.getByRole('button', { name: /^Home/ }).first()).toBeVisible({ timeout: 30_000 })
}

/**
 * Load the app and switch to a tab, e.g. open(page, 'daily'). Loads "/" and
 * then changes the hash, so tests about other features don't depend on
 * deep-link handling (which has its own tests in 15-platform).
 */
export async function open(page, hash = 'home') {
  await page.goto('/')
  await ready(page)
  await expect(page).toHaveURL(/#\/home$/)
  if (hash !== 'home') {
    await go(page, hash)
    // Parameterised links (aesthetic/<id>, wardrobe-builder/<piece>) may keep
    // their parameter or settle on their base tab
    const base = hash.split('/')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    await expect(page).toHaveURL(new RegExp(`#/${base}(/|$)`))
  }
}

/** Switch tabs in the running app the way a deep link or back button would. */
export async function go(page, hash) {
  await page.evaluate((h) => { window.location.hash = h }, `#/${hash}`)
}

export async function openSettings(page) {
  await go(page, 'profile')
  await page.locator('button[aria-label="Settings"]').first().click()
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
}

export async function openOutfitsSubTab(page, label) {
  await go(page, 'daily')
  await page.getByRole('button', { name: label, exact: true }).first().click()
}

/** Runs the 40-card style quiz to the results screen. */
export async function completeQuiz(page) {
  await go(page, 'quiz/start')
  const counter = page.getByText(/^\d+ \/ 40$/)
  await expect(counter).toBeVisible({ timeout: 20_000 })
  const results = page.getByRole('heading', { name: 'Your style' })
  const like = page.getByRole('button', { name: 'Like', exact: true })
  const skip = page.getByRole('button', { name: 'Skip', exact: true })
  for (let i = 0; i < 70; i++) {
    if (await results.isVisible().catch(() => false)) break
    await (i % 2 === 0 ? like : skip).click({ force: true, timeout: 2_000 }).catch(() => {})
    await page.waitForTimeout(360)
  }
  await expect(results).toBeVisible({ timeout: 20_000 })
}

/** Name on the product card currently on top of the Discover / quiz stack. */
export async function currentCardName(page) {
  return (await page.locator('h2[class*="itemName"]').first().innerText()).trim()
}

export async function signOutFromSettings(page) {
  await openSettings(page)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
}

// ── The test object ──────────────────────────────────────────────────────────

export const test = base.extend({
  role: ['guest', { option: true }],
  realFunctions: [[], { option: true }],
  consent: ['denied', { option: true }],

  // The production build, started at most once per worker and only when a
  // test asks for prodURL against the dev server (see lib/prod-server.js).
  // eslint-disable-next-line no-empty-pattern
  prodServer: [async ({}, use) => {
    let pending = null
    await use({ start: () => (pending ??= startProdServer()) })
    if (pending) (await pending.catch(() => null))?.stop()
  }, { scope: 'worker' }],

  /**
   * Where a production build of the app is served: the target itself on the
   * Live tab or a Local "Production build" run, otherwise one built on demand.
   * Its own timeout, because the on-demand build takes a minute or two.
   */
  prodURL: [async ({ prodServer }, use) => {
    await use(IS_PROD_BUILD ? BASE_URL : (await prodServer.start()).url)
  }, { timeout: 300_000 }],

  accountLock: [async ({ role }, use, testInfo) => {
    if (role !== 'free' && role !== 'pro') return use(null)
    if (!ACCOUNTS[role]) {
      testInfo.annotations.push({ type: 'needs-setup', description: `QA_${role.toUpperCase()}_EMAIL and QA_${role.toUpperCase()}_PASSWORD in qa/.env (a dedicated ${role === 'pro' ? 'Pro ' : ''}test account)` })
      testInfo.skip(true, `Needs setup: a ${role} test account in qa/.env`)
      return use(null)
    }
    if (!FIREBASE.apiKey || !FIREBASE.projectId) {
      testInfo.annotations.push({ type: 'needs-setup', description: 'VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID in the app .env' })
      testInfo.skip(true, 'Needs setup: Firebase web config')
      return use(null)
    }
    await withLock(role, () => use(role))
    // Its own timeout: queueing behind other workers' tests on the same account
    // (a Prettify test can hold it for minutes) must not eat into this test's
    // 120s. withLock gives up after 40 minutes, so this only backs that up.
  }, { auto: true, timeout: 41 * 60 * 1000 }],

  storageState: async ({ role, accountLock, browser }, use) => {
    if (!accountLock) return use(undefined)
    await use(await ensureStorageState(browser, role))
  },

  account: async ({ role, accountLock }, use) => {
    if (!accountLock) return use(null)
    await use(accountApi(await fb.session(role)))
  },

  // Geolocation for the weather widget (answered by the getWeather stub)
  geolocation: { latitude: 43.65, longitude: -79.38 },
  permissions: ['geolocation'],

  context: async ({ context, role, consent }, use) => {
    await context.addInitScript(({ guest, consent }) => {
      try {
        if (guest) sessionStorage.setItem('sartima_guest_browsing', 'true')
        if (consent && localStorage.getItem('sartima_analytics_consent') === null) {
          localStorage.setItem('sartima_analytics_consent', consent)
        }
        localStorage.setItem('sartima_pin_hint_shown', '1')
      } catch { /* storage blocked */ }
    }, { guest: role === 'guest', consent })
    await use(context)
  },

  fns: [async ({ context, realFunctions }, use) => {
    const calls = {}
    const handlers = {}
    for (const name of STUBBED) {
      if (realFunctions.includes(name)) continue
      if (REAL_FEEDBACK && name.startsWith('submit')) continue
      await context.route(new RegExp(`/${name}(\\?[^/]*)?$`), async (route) => {
        const req = route.request()
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
        let data = {}
        try { data = req.postDataJSON()?.data ?? {} } catch { /* empty body */ }
        ;(calls[name] ??= []).push(data)
        const out = await (handlers[name] ?? DEFAULT_RESPONSES[name])(data)
        if (out?.__error) {
          return route.fulfill({
            status: HTTP_FOR[out.__error.status] ?? 500,
            headers: CORS,
            contentType: 'application/json',
            body: JSON.stringify({ error: out.__error }),
          })
        }
        await route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ result: out }) })
      })
    }
    await use({
      calls,
      /** Replace a stub's answer for this test. */
      respond(name, handler) { handlers[name] = handler },
      count: (name) => (calls[name] ?? []).length,
      last: (name) => (calls[name] ?? []).at(-1),
    })
  }, { auto: true }],

  // goto/reload wait for DOMContentLoaded instead of "load". "load" also waits
  // for every product photo from external image hosts, so one stalled image
  // (or a busy Vite dev server) timed out page.goto at 45s across a whole batch
  // of tests. Every test then waits for the UI it needs (ready(), expect...),
  // which is the real readiness check. An explicit waitUntil still wins.
  page: async ({ page }, use) => {
    for (const method of ['goto', 'reload']) {
      const original = page[method].bind(page)
      page[method] = method === 'goto'
        ? (url, opts) => original(url, { waitUntil: 'domcontentloaded', ...opts })
        : (opts) => original({ waitUntil: 'domcontentloaded', ...opts })
    }
    await use(page)
  },

  /** Uncaught page exceptions, checked by tests that care. */
  pageErrors: async ({ page }, use) => {
    const errors = []
    page.on('pageerror', (err) => errors.push(err.message))
    await use(errors)
  },

  /** Creates throwaway @example.com accounts and deletes them after the test. */
  // eslint-disable-next-line no-empty-pattern
  throwaway: async ({}, use) => {
    const made = []
    const api = {
      async create({ consent = true, onboarded = true } = {}) {
        const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
        const email = `sartima-qa-${stamp}@example.com`
        const password = `Qa-${stamp}-Zx9!`
        const s = await fb.signUp(email, password)
        made.push({ email, password })
        const fields = { email, displayName: '', createdAt: new Date() }
        if (consent) Object.assign(fields, { ageAffirmed16Plus: true, legalVersion: legalVersion() })
        if (onboarded) fields.onboardingComplete = true
        await fb.mergeDoc(s, `users/${s.uid}`, fields)
        return { ...accountApi(s), email, password }
      },
      /** Register an account created through the UI so it's cleaned up too. */
      track(email, password) { made.push({ email, password }) },
      newEmail() {
        return `sartima-qa-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`
      },
    }
    await use(api)
    for (const { email, password } of made) {
      try {
        const s = await fb.signIn(email, password)
        const res = await fb.callFunction(s, 'deleteAccount', {})
        if (!res.ok) await fb.deleteAuthUser(s.idToken)
      } catch { /* already deleted by the test */ }
    }
  },
})

/** Log a throwaway account in through the real login screen. */
export async function loginAs(page, email, password) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await page.getByPlaceholder('you@example.com').fill(email)
  await page.getByPlaceholder('••••••••').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

/** Stop the app from sending real verification / reset emails during a test. */
export async function blockAuthEmails(context) {
  await context.route(/identitytoolkit\.googleapis\.com\/v1\/accounts:sendOobCode/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ kind: 'identitytoolkit#GetOobConfirmationCodeResponse', email: 'qa@example.com' }) }))
}
