// firestore.rules against the emulator. Run with `npm run test:rules`
// (starts the Firestore + Storage emulators around Vitest).
import { readFileSync } from 'node:fs'
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'

let env

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-sartima',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})
afterAll(() => env?.cleanup())
beforeEach(async () => {
  await env.clearFirestore()
  // Server-written docs (Cloud Functions use the Admin SDK, which bypasses rules)
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await db.doc('users/alice').set({ name: 'Alice', ageAffirmed16Plus: true })
    await db.doc('users/alice/prefs/closet').set({ items: [] })
    await db.doc('users/alice/prefs/usage').set({ periodKey: '2026-11', visionUploads: 1, tryOnCredits: 3 })
    await db.doc('users/alice/prefs/subscription').set({ status: 'active', stripeCustomerId: 'cus_1' })
    await db.doc('users/alice/outfitPlans/p1').set({ day: '2026-11-12' })
    await db.doc('users/bob/prefs/closet').set({ items: [{ id: 'x' }] })
    await db.doc('feedback/f1').set({ message: 'hi' })
    await db.doc('billingDowngrades/alice').set({ downgradeAt: 1 })
  })
})

const as = (uid) => env.authenticatedContext(uid).firestore()
const anon = () => env.unauthenticatedContext().firestore()

describe('profile document', () => {
  it('the owner can read and write it', async () => {
    await assertSucceeds(as('alice').doc('users/alice').get())
    await assertSucceeds(as('alice').doc('users/alice').set({ legalVersion: 3 }, { merge: true }))
  })

  it('other users and signed-out visitors cannot', async () => {
    await assertFails(as('bob').doc('users/alice').get())
    await assertFails(as('bob').doc('users/alice').set({ name: 'pwned' }))
    await assertFails(anon().doc('users/alice').get())
  })
})

describe('prefs documents', () => {
  for (const key of ['closet', 'wishlist', 'liked', 'interests', 'outfitLog', 'gapDismissals', 'notifications']) {
    it(`owner can read and write prefs/${key}`, async () => {
      await assertSucceeds(as('alice').doc(`users/alice/prefs/${key}`).set({ v: 1 }, { merge: true }))
      await assertSucceeds(as('alice').doc(`users/alice/prefs/${key}`).get())
    })
  }

  it("nobody else can read or write someone's prefs", async () => {
    await assertFails(as('alice').doc('users/bob/prefs/closet').get())
    await assertFails(as('alice').doc('users/bob/prefs/closet').set({ items: [] }))
    await assertFails(anon().doc('users/bob/prefs/closet').get())
    await assertFails(as('alice').collection('users/bob/prefs').get())
  })
})

describe('usage and subscription are server-written only', () => {
  for (const key of ['usage', 'subscription']) {
    it(`owner can read prefs/${key}`, async () => {
      await assertSucceeds(as('alice').doc(`users/alice/prefs/${key}`).get())
    })

    it(`owner cannot create, change or delete prefs/${key}`, async () => {
      await assertFails(as('alice').doc(`users/alice/prefs/${key}`).set({ tryOnCredits: 999 }, { merge: true }))
      await assertFails(as('alice').doc(`users/alice/prefs/${key}`).update({ visionUploads: 0 }))
      await assertFails(as('alice').doc(`users/alice/prefs/${key}`).delete())
      await assertFails(as('carol').doc(`users/carol/prefs/${key}`).set({ status: 'active' }))
    })

    it(`others cannot read prefs/${key}`, async () => {
      await assertFails(as('bob').doc(`users/alice/prefs/${key}`).get())
    })
  }
})

describe('subcollections', () => {
  for (const sub of ['outfitPlans', 'quizzes', 'uploadedItems']) {
    it(`owner can use ${sub}; others cannot`, async () => {
      await assertSucceeds(as('alice').collection(`users/alice/${sub}`).add({ v: 1 }))
      await assertSucceeds(as('alice').collection(`users/alice/${sub}`).get())
      await assertFails(as('bob').collection(`users/alice/${sub}`).get())
      await assertFails(as('bob').collection(`users/alice/${sub}`).add({ v: 1 }))
    })
  }

  it('an unlisted subcollection is denied, even to the owner', async () => {
    await assertFails(as('alice').doc('users/alice/secrets/s1').set({ v: 1 }))
    await assertFails(as('alice').doc('users/alice/secrets/s1').get())
  })
})

describe('server-only collections', () => {
  for (const path of ['feedback/f1', 'crashReports/c1', 'billingDowngrades/alice', 'fulfilledCheckouts/cs_1']) {
    it(`${path.split('/')[0]} is closed to every client`, async () => {
      await assertFails(as('alice').doc(path).get())
      await assertFails(as('alice').doc(path).set({ v: 1 }))
      await assertFails(anon().doc(path).set({ v: 1 }))
    })
  }

  it('unknown top-level collections are denied', async () => {
    await assertFails(as('alice').doc('anything/x').get())
    await assertFails(anon().doc('anything/x').set({ v: 1 }))
  })

  it('collection-group queries across users are denied', async () => {
    await assertFails(as('alice').collectionGroup('prefs').get())
  })
})
