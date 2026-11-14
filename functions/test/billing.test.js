// Stripe checkout, the webhook → custom claims, delayed downgrades, and
// account deletion.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { call, newUid, getDoc, putDoc, addUser, claimsOf, stripe, fake } from './fakes.js'

vi.mock('../ai.js', () => ({ generateJson: vi.fn() }))
const fns = await import('../index.js')

const DAY = 86_400_000
const subDoc = (uid) => getDoc(`users/${uid}/prefs/subscription`)
const downgrade = (uid) => getDoc(`billingDowngrades/${uid}`)

afterEach(() => vi.useRealTimers())

function res() {
  return {
    statusCode: 200, body: undefined, headersSent: false,
    status(c) { this.statusCode = c; return this },
    send(b) { this.body = b; this.headersSent = true; return this },
    json(b) { this.body = b; this.headersSent = true; return this },
    setHeader() {}, getHeader() {}, on() {}, end() { this.headersSent = true },
  }
}

async function webhook(event) {
  if (event instanceof Error) stripe.webhooks.constructEvent.mockImplementationOnce(() => { throw event })
  else stripe.webhooks.constructEvent.mockReturnValueOnce({ id: 'evt_1', ...event })
  const req = {
    method: 'POST', headers: { 'stripe-signature': 't=1,v1=abc' }, rawBody: Buffer.from('{}'),
    header(n) { return this.headers[n.toLowerCase()] }, get(n) { return this.headers[n.toLowerCase()] },
  }
  const r = res()
  await fns.stripeWebhook(req, r)
  return r
}

const subEvent = (type, sub) => ({ type, data: { object: { id: 'sub_1', customer: 'cus_1', status: 'active', metadata: {}, ...sub } } })
const periodEnd = (ms) => ({ items: { data: [{ current_period_end: Math.floor(ms / 1000) }] } })

describe('createStripeCheckout', () => {
  it('creates a customer once and a monthly or annual subscription session', async () => {
    const uid = newUid()
    addUser(uid)
    stripe.customers.create.mockResolvedValue({ id: 'cus_new' })
    expect(await call(fns.createStripeCheckout, { uid, data: { plan: 'monthly' } })).toEqual({ url: 'https://checkout.stripe.test/s' })
    await call(fns.createStripeCheckout, { uid, data: { plan: 'annual' } })
    expect(stripe.customers.create).toHaveBeenCalledOnce()
    expect(stripe.customers.create.mock.calls[0][0]).toEqual({ email: `${uid}@example.com`, metadata: { uid } })
    expect(subDoc(uid).stripeCustomerId).toBe('cus_new')
    const [monthly, annual] = stripe.checkout.sessions.create.mock.calls.map(([s]) => s)
    expect(monthly).toMatchObject({ customer: 'cus_new', mode: 'subscription', line_items: [{ price: 'price_monthly', quantity: 1 }], metadata: { uid }, subscription_data: { metadata: { uid } }, success_url: 'https://sartima.test?upgrade=success' })
    expect(annual.line_items[0].price).toBe('price_annual')
  })

  it('unknown plans fall back to monthly', async () => {
    const uid = newUid()
    putDoc(`users/${uid}/prefs/subscription`, { stripeCustomerId: 'cus_x' })
    await call(fns.createStripeCheckout, { uid, data: { plan: 'lifetime' } })
    expect(stripe.checkout.sessions.create.mock.calls[0][0].line_items[0].price).toBe('price_monthly')
  })

  it('refuses a second subscription while one is live, even past due', async () => {
    for (const status of ['active', 'trialing', 'past_due', 'unpaid']) {
      const uid = newUid()
      putDoc(`users/${uid}/prefs/subscription`, { stripeCustomerId: 'cus_x', stripeSubscriptionId: 'sub_x', status })
      await expect(call(fns.createStripeCheckout, { uid, data: {} })).rejects.toMatchObject({ code: 'already-exists' })
    }
    const ended = newUid()
    putDoc(`users/${ended}/prefs/subscription`, { stripeCustomerId: 'cus_x', stripeSubscriptionId: 'sub_x', status: 'canceled' })
    await expect(call(fns.createStripeCheckout, { uid: ended, data: {} })).resolves.toBeDefined()
  })
})

describe('createStripeBillingPortal / purchaseTryOnPack', () => {
  it('opens the portal only for known customers', async () => {
    const uid = newUid()
    await expect(call(fns.createStripeBillingPortal, { uid })).rejects.toMatchObject({ code: 'not-found' })
    putDoc(`users/${uid}/prefs/subscription`, { stripeCustomerId: 'cus_9' })
    expect(await call(fns.createStripeBillingPortal, { uid })).toEqual({ url: 'https://billing.stripe.test/p' })
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({ customer: 'cus_9', return_url: 'https://sartima.test' })
  })

  it('sells try-on packs to Pro only, tagged for 30 credits', async () => {
    const free = newUid()
    await expect(call(fns.purchaseTryOnPack, { uid: free })).rejects.toMatchObject({ code: 'permission-denied' })
    const pro = newUid()
    putDoc(`users/${pro}/prefs/subscription`, { stripeCustomerId: 'cus_p' })
    await call(fns.purchaseTryOnPack, { uid: pro, tier: 'pro' })
    expect(stripe.checkout.sessions.create.mock.calls[0][0]).toMatchObject({ mode: 'payment', line_items: [{ price: 'price_pack', quantity: 1 }], metadata: { uid: pro, type: 'tryon_pack', qty: '30' } })
  })
})

describe('stripeWebhook', () => {
  it('rejects a bad signature with 400 and changes nothing', async () => {
    const r = await webhook(new Error('No signatures found'))
    expect(r.statusCode).toBe(400)
    expect(fake.users.size).toBe(0)
  })

  it('acknowledges events it does not handle', async () => {
    const r = await webhook({ type: 'invoice.created', data: { object: {} } })
    expect(r.body).toEqual({ ok: true })
  })

  describe('checkout completed', () => {
    it('a paid subscription checkout grants Pro', async () => {
      const uid = newUid()
      addUser(uid)
      putDoc(`billingDowngrades/${uid}`, { downgradeAt: 1 })
      await webhook({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', payment_status: 'paid', metadata: { uid }, customer: 'cus_1', subscription: 'sub_1' } } })
      expect(claimsOf(uid)).toEqual({ sartima_tier: 'pro' })
      expect(subDoc(uid)).toMatchObject({ stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1', status: 'active', graceEndsAt: null })
      expect(downgrade(uid)).toBeUndefined()
    })

    it("keeps an admin's role when setting the tier", async () => {
      const uid = newUid()
      addUser(uid, { customClaims: { sartima_role: 'admin' } })
      await webhook({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', payment_status: 'paid', metadata: { uid }, customer: 'c', subscription: 's' } } })
      expect(claimsOf(uid)).toEqual({ sartima_role: 'admin', sartima_tier: 'pro' })
    })

    it('waits for delayed payments to clear', async () => {
      const uid = newUid()
      addUser(uid)
      await webhook({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', payment_status: 'unpaid', metadata: { uid } } } })
      expect(claimsOf(uid)).toEqual({})
      await webhook({ type: 'checkout.session.async_payment_succeeded', data: { object: { mode: 'subscription', payment_status: 'paid', metadata: { uid }, customer: 'c', subscription: 's' } } })
      expect(claimsOf(uid)).toEqual({ sartima_tier: 'pro' })
    })

    it('a try-on pack adds 30 credits exactly once, even if Stripe resends it', async () => {
      const uid = newUid()
      putDoc(`users/${uid}/prefs/usage`, { tryOnCredits: 2 })
      const ev = { type: 'checkout.session.completed', data: { object: { id: `cs_${uid}`, mode: 'payment', payment_status: 'paid', metadata: { uid, type: 'tryon_pack' } } } }
      await webhook(ev)
      const again = await webhook(ev)
      await webhook({ ...ev, type: 'checkout.session.async_payment_succeeded' })
      expect(getDoc(`users/${uid}/prefs/usage`).tryOnCredits).toBe(32)
      expect(again.body).toEqual({ ok: true })
      expect(getDoc(`fulfilledCheckouts/cs_${uid}`)).toMatchObject({ uid, type: 'tryon_pack' })
    })

    it('ignores sessions without a uid', async () => {
      const r = await webhook({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', payment_status: 'paid', metadata: {} } } })
      expect(r.body).toEqual({ ok: true })
    })
  })

  describe('subscription updated', () => {
    it('a renewal keeps Pro and records the period end', async () => {
      const uid = newUid()
      addUser(uid)
      const end = Date.now() + 30 * DAY
      await webhook(subEvent('customer.subscription.updated', { metadata: { uid }, ...periodEnd(end) }))
      expect(claimsOf(uid)).toEqual({ sartima_tier: 'pro' })
      expect(subDoc(uid)).toMatchObject({ status: 'active', currentPeriodEnd: Math.floor(end / 1000) * 1000 })
    })

    it('a failed renewal starts a 7-day grace period from the first failure', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-01T00:00:00Z') })
      const uid = newUid()
      addUser(uid, { customClaims: { sartima_tier: 'pro' } })
      putDoc(`users/${uid}/prefs/subscription`, { stripeSubscriptionId: 'sub_1', status: 'active' })
      await webhook(subEvent('customer.subscription.updated', { status: 'past_due', metadata: { uid } }))
      const grace = Date.parse('2026-11-08T00:00:00Z')
      expect(subDoc(uid)).toMatchObject({ status: 'past_due', graceEndsAt: grace, paymentFailedAt: Date.parse('2026-11-01T00:00:00Z') })
      expect(downgrade(uid)).toMatchObject({ downgradeAt: grace, reason: 'payment_failed' })
      expect(claimsOf(uid)).toEqual({ sartima_tier: 'pro' }) // still Pro during grace

      vi.setSystemTime(new Date('2026-11-04T00:00:00Z'))
      await webhook(subEvent('customer.subscription.updated', { status: 'unpaid', metadata: { uid } }))
      expect(subDoc(uid).graceEndsAt).toBe(grace) // retries don't extend it
    })

    it('paying after a failure clears the grace period and the pending downgrade', async () => {
      const uid = newUid()
      addUser(uid)
      putDoc(`users/${uid}/prefs/subscription`, { stripeSubscriptionId: 'sub_1', status: 'past_due', graceEndsAt: 5, paymentFailedAt: 1 })
      putDoc(`billingDowngrades/${uid}`, { downgradeAt: 5 })
      await webhook(subEvent('customer.subscription.updated', { status: 'active', metadata: { uid } }))
      expect(subDoc(uid)).toMatchObject({ status: 'active', graceEndsAt: null, paymentFailedAt: null })
      expect(downgrade(uid)).toBeUndefined()
      expect(claimsOf(uid)).toEqual({ sartima_tier: 'pro' })
    })

    it('a portal cancellation scheduled through cancel_at counts as cancelling, and Pro stays', async () => {
      const uid = newUid()
      addUser(uid, { customClaims: { sartima_tier: 'pro' } })
      const endSecs = Math.floor((Date.now() + 10 * DAY) / 1000)
      await webhook(subEvent('customer.subscription.updated', { status: 'active', metadata: { uid }, cancel_at: endSecs, cancel_at_period_end: false }))
      expect(subDoc(uid)).toMatchObject({ status: 'active', cancelAtPeriodEnd: true, cancelAt: endSecs * 1000 })
      expect(claimsOf(uid)).toEqual({ sartima_tier: 'pro' })

      await webhook(subEvent('customer.subscription.updated', { status: 'active', metadata: { uid }, cancel_at: null, cancel_at_period_end: false }))
      expect(subDoc(uid)).toMatchObject({ cancelAtPeriodEnd: false, cancelAt: null })
    })

    it('finds the user through the Stripe customer when the subscription has no uid', async () => {
      const uid = newUid()
      addUser(uid)
      stripe.customers.retrieve.mockResolvedValueOnce({ id: 'cus_1', metadata: { uid } })
      await webhook(subEvent('customer.subscription.updated', {}))
      expect(claimsOf(uid)).toEqual({ sartima_tier: 'pro' })
    })

    it('ignores events for an old subscription, a deleted customer, or a deleted user', async () => {
      const uid = newUid()
      addUser(uid)
      putDoc(`users/${uid}/prefs/subscription`, { stripeSubscriptionId: 'sub_current' })
      await webhook(subEvent('customer.subscription.updated', { id: 'sub_old', metadata: { uid } }))
      expect(claimsOf(uid)).toEqual({})

      stripe.customers.retrieve.mockResolvedValueOnce({ deleted: true })
      expect((await webhook(subEvent('customer.subscription.updated', {}))).body).toEqual({ ok: true })

      const gone = newUid()
      expect((await webhook(subEvent('customer.subscription.updated', { metadata: { uid: gone } }))).body).toEqual({ ok: true })
    })
  })

  describe('subscription deleted', () => {
    it('a cancellation keeps Pro until the paid period ends', async () => {
      const uid = newUid()
      addUser(uid, { customClaims: { sartima_tier: 'pro' } })
      const end = Date.now() + 10 * DAY
      await webhook(subEvent('customer.subscription.deleted', { status: 'canceled', metadata: { uid }, ...periodEnd(end) }))
      expect(claimsOf(uid)).toEqual({ sartima_tier: 'pro' })
      expect(downgrade(uid)).toMatchObject({ reason: 'canceled', downgradeAt: Math.floor(end / 1000) * 1000 })
      expect(subDoc(uid)).toMatchObject({ status: 'canceled', downgradeAt: Math.floor(end / 1000) * 1000 })
    })

    it('a subscription that ended already drops to free straight away', async () => {
      const uid = newUid()
      addUser(uid, { customClaims: { sartima_tier: 'pro' } })
      await webhook(subEvent('customer.subscription.deleted', { status: 'canceled', metadata: { uid }, ...periodEnd(Date.now() - DAY) }))
      expect(claimsOf(uid)).toEqual({ sartima_tier: 'free' })
      expect(downgrade(uid)).toBeUndefined()
      expect(subDoc(uid).downgradeAt).toBeNull()
    })

    it('ended for non-payment: access ends with the grace period', async () => {
      const uid = newUid()
      addUser(uid, { customClaims: { sartima_tier: 'pro' } })
      const grace = Date.now() + 2 * DAY
      putDoc(`users/${uid}/prefs/subscription`, { stripeSubscriptionId: 'sub_1', graceEndsAt: grace })
      await webhook(subEvent('customer.subscription.deleted', { status: 'canceled', metadata: { uid }, cancellation_details: { reason: 'payment_failed' }, ...periodEnd(Date.now() + 20 * DAY) }))
      expect(downgrade(uid)).toMatchObject({ downgradeAt: grace, reason: 'payment_failed' })
    })

    it('ignores the cancellation that deleteAccount triggers', async () => {
      const uid = newUid()
      addUser(uid, { customClaims: { sartima_tier: 'pro' } })
      await webhook(subEvent('customer.subscription.deleted', { metadata: { uid }, cancellation_details: { comment: 'account_deleted' } }))
      expect(subDoc(uid)).toBeUndefined()
    })
  })

  it('answers 500 when a handler fails, so Stripe retries', async () => {
    const uid = newUid()
    addUser(uid)
    const auth = (await import('firebase-admin')).default.auth()
    auth.setCustomUserClaims.mockRejectedValueOnce(new Error('auth down'))
    const r = await webhook({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', payment_status: 'paid', metadata: { uid } } } })
    expect(r.statusCode).toBe(500)
  })
})

describe('enforceBillingDowngrades (hourly)', () => {
  it('downgrades due accounts and leaves future ones alone', async () => {
    const due = newUid(), later = newUid(), gone = newUid()
    addUser(due, { customClaims: { sartima_tier: 'pro' } })
    addUser(later, { customClaims: { sartima_tier: 'pro' } })
    putDoc(`billingDowngrades/${due}`, { downgradeAt: Date.now() - 1000 })
    putDoc(`billingDowngrades/${later}`, { downgradeAt: Date.now() + DAY })
    putDoc(`billingDowngrades/${gone}`, { downgradeAt: Date.now() - 1000 })
    await fns.enforceBillingDowngrades.run({})
    expect(claimsOf(due)).toEqual({ sartima_tier: 'free' })
    expect(downgrade(due)).toBeUndefined()
    expect(subDoc(due)).toMatchObject({ downgradeAt: null })
    expect(claimsOf(later)).toEqual({ sartima_tier: 'pro' })
    expect(downgrade(later)).toBeDefined()
    expect(downgrade(gone)).toBeUndefined() // user no longer exists
  })

  it('keeps the downgrade for a retry when it fails', async () => {
    const uid = newUid()
    addUser(uid, { customClaims: { sartima_tier: 'pro' } })
    putDoc(`billingDowngrades/${uid}`, { downgradeAt: Date.now() - 1000 })
    const auth = (await import('firebase-admin')).default.auth()
    auth.setCustomUserClaims.mockRejectedValueOnce(Object.assign(new Error('quota'), { code: 'auth/internal-error' }))
    await fns.enforceBillingDowngrades.run({})
    expect(downgrade(uid)).toBeDefined()
  })
})

describe('deleteAccount', () => {
  function seed(uid, sub) {
    addUser(uid)
    putDoc(`users/${uid}`, { name: 'x' })
    putDoc(`users/${uid}/prefs/closet`, { items: [] })
    putDoc(`users/${uid}/outfitPlans/p1`, { day: 1 })
    putDoc(`billingDowngrades/${uid}`, { downgradeAt: 1 })
    putDoc('users/someone-else/prefs/closet', { items: [1] })
    if (sub) putDoc(`users/${uid}/prefs/subscription`, sub)
  }

  it('cancels a live subscription (tagged), then wipes storage, data and the login — login last', async () => {
    const uid = newUid()
    seed(uid, { stripeSubscriptionId: 'sub_live', status: 'active' })
    expect(await call(fns.deleteAccount, { uid })).toEqual({ ok: true })
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_live', { cancellation_details: { comment: 'account_deleted' } })
    expect(fake.deletedPrefixes).toEqual([`users/${uid}/wardrobe/`, `users/${uid}/avatar/`])
    expect([...fake.docs.keys()].filter((p) => p.includes(uid))).toEqual([])
    expect(getDoc('users/someone-else/prefs/closet')).toBeDefined()
    expect(fake.users.has(uid)).toBe(false)
    expect(fake.order.at(-1)).toBe('auth')
  })

  it("doesn't cancel an already-canceled subscription, and tolerates one Stripe already removed", async () => {
    const a = newUid()
    seed(a, { stripeSubscriptionId: 'sub_old', status: 'canceled' })
    await call(fns.deleteAccount, { uid: a })
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled()

    const b = newUid()
    seed(b, { stripeSubscriptionId: 'sub_gone', status: 'active' })
    stripe.subscriptions.cancel.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'resource_missing' }))
    await expect(call(fns.deleteAccount, { uid: b })).resolves.toEqual({ ok: true })
  })

  it('stops before deleting anything if Stripe cancellation fails, so the user can retry', async () => {
    const uid = newUid()
    seed(uid, { stripeSubscriptionId: 'sub_live', status: 'active' })
    stripe.subscriptions.cancel.mockRejectedValueOnce(Object.assign(new Error('api down'), { code: 'api_error' }))
    await expect(call(fns.deleteAccount, { uid })).rejects.toThrow()
    expect(fake.users.has(uid)).toBe(true)
    expect(getDoc(`users/${uid}`)).toBeDefined()
  })
})
