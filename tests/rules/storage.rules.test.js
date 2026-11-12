// storage.rules against the emulator: closet photos and avatars are private
// to their owner, images only, under 10 MB.
import { readFileSync } from 'node:fs'
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'

let env

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-sartima',
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  })
})
afterAll(() => env?.cleanup())
beforeEach(async () => {
  await env.clearStorage()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref('users/alice/wardrobe/tee.jpg').put(PNG, { contentType: 'image/jpeg' })
    await ctx.storage().ref('users/alice/avatar/me.png').put(PNG, { contentType: 'image/png' })
  })
})

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const ref = (uid, path) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).storage().ref(path)
const upload = (uid, path, data = PNG, contentType = 'image/png') => ref(uid, path).put(data, { contentType })

for (const folder of ['wardrobe', 'avatar']) {
  describe(`users/{uid}/${folder}`, () => {
    it('the owner can upload an image, read it and delete it', async () => {
      await assertSucceeds(upload('alice', `users/alice/${folder}/new.png`))
      await assertSucceeds(ref('alice', `users/alice/${folder}/new.png`).getMetadata())
      await assertSucceeds(ref('alice', `users/alice/${folder}/new.png`).delete())
    })

    it('rejects files that are not images', async () => {
      await assertFails(upload('alice', `users/alice/${folder}/notes.txt`, PNG, 'text/plain'))
      await assertFails(upload('alice', `users/alice/${folder}/x.html`, PNG, 'text/html'))
    })

    it('rejects images of 10 MB or more', async () => {
      const big = new Uint8Array(10 * 1024 * 1024)
      await assertFails(upload('alice', `users/alice/${folder}/huge.png`, big))
    })

    it("other users and signed-out visitors can't read, write or delete", async () => {
      const existing = folder === 'wardrobe' ? 'users/alice/wardrobe/tee.jpg' : 'users/alice/avatar/me.png'
      await assertFails(ref('bob', existing).getMetadata())
      await assertFails(ref(null, existing).getMetadata())
      await assertFails(upload('bob', `users/alice/${folder}/planted.png`))
      await assertFails(ref('bob', existing).delete())
    })
  })
}

describe('other paths', () => {
  it('wardrobe allows nested folders (prettified copies) but avatars do not', async () => {
    await assertSucceeds(upload('alice', 'users/alice/wardrobe/prettified/tee.png'))
    await assertFails(upload('alice', 'users/alice/avatar/old/me.png'))
  })

  it('everything else is closed', async () => {
    await assertFails(upload('alice', 'users/alice/other/x.png'))
    await assertFails(upload('alice', 'public/x.png'))
    await assertFails(ref(null, 'public/x.png').getMetadata())
  })
})
