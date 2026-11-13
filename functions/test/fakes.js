// In-memory stand-ins for firebase-admin and Stripe, shared by the
// functions tests through vi.mock factories. Only what functions/index.js
// uses is implemented; writes follow Firestore's merge / FieldValue rules.
import { vi } from 'vitest'

export const FieldValue = {
  increment: (n) => ({ __op: 'inc', n }),
  delete: () => ({ __op: 'del' }),
  serverTimestamp: () => ({ __op: 'ts' }),
}

function applyWrite(prev, data, merge) {
  const out = merge ? { ...(prev ?? {}) } : {}
  for (const [k, v] of Object.entries(data)) {
    if (v && v.__op === 'inc') out[k] = (merge ? (prev?.[k] ?? 0) : 0) + v.n
    else if (v && v.__op === 'del') delete out[k]
    else if (v && v.__op === 'ts') out[k] = 'SERVER_TIMESTAMP'
    else out[k] = v
  }
  return out
}

export const fake = {
  docs: new Map(),
  users: new Map(),
  order: [],            // deleteAccount step order
  deletedPrefixes: [],
  files: new Map(),     // Storage objects: path → { bytes, contentType }
  autoId: 0,
}

function ref(path) {
  const segs = path.split('/')
  return {
    path,
    id: segs.at(-1),
    parent: { id: segs.at(-2), parent: segs.length >= 3 ? { id: segs.at(-3) } : null },
    get: async () => snap(path),
    set: async (data, opts) => { fake.docs.set(path, applyWrite(fake.docs.get(path), data, opts?.merge)) },
    delete: async () => { fake.docs.delete(path) },
  }
}

function snap(path) {
  const d = fake.docs.get(path)
  return {
    id: path.split('/').at(-1),
    exists: d !== undefined,
    data: () => (d === undefined ? undefined : structuredClone(d)),
    ref: ref(path),
  }
}

const compare = { '==': (a, b) => a === b, '<=': (a, b) => a <= b, '>=': (a, b) => a >= b, '<': (a, b) => a < b }

function query(match) {
  return {
    where(field, op, value) {
      return query((path, data) => match(path, data) && data[field] !== undefined && compare[op](data[field], value))
    },
    get: async () => ({ docs: [...fake.docs.entries()].filter(([p, d]) => match(p, d)).map(([p]) => snap(p)) }),
  }
}

const firestore = {
  doc: (path) => ref(path),
  collection: (name) => ({
    add: async (data) => { const r = ref(`${name}/auto${++fake.autoId}`); await r.set(data); return r },
    ...query((p) => p.startsWith(`${name}/`) && p.split('/').length === 2),
  }),
  collectionGroup: (name) => query((p) => p.split('/').at(-2) === name),
  async runTransaction(fn) {
    const pending = []
    const tx = {
      get: (r) => r.get(),
      set: (r, data, opts) => { pending.push(() => r.set(data, opts)) },
    }
    const result = await fn(tx)
    for (const write of pending) await write()
    return result
  },
  batch() {
    const ops = []
    return {
      create: (r, data) => ops.push({ kind: 'create', r, data }),
      set: (r, data, opts) => ops.push({ kind: 'set', r, data, opts }),
      async commit() {
        for (const op of ops) {
          if (op.kind === 'create' && fake.docs.has(op.r.path)) throw Object.assign(new Error('ALREADY_EXISTS'), { code: 6 })
        }
        for (const op of ops) await op.r.set(op.data, op.opts)
      },
    }
  },
  async recursiveDelete(r) {
    fake.order.push('firestore')
    for (const p of [...fake.docs.keys()]) if (p === r.path || p.startsWith(`${r.path}/`)) fake.docs.delete(p)
  },
}

const notFound = () => Object.assign(new Error('no user'), { code: 'auth/user-not-found' })

const auth = {
  getUser: vi.fn(async (uid) => {
    const u = fake.users.get(uid)
    if (!u) throw notFound()
    return structuredClone(u)
  }),
  setCustomUserClaims: vi.fn(async (uid, claims) => {
    const u = fake.users.get(uid)
    if (!u) throw notFound()
    u.customClaims = claims
  }),
  deleteUser: vi.fn(async (uid) => { fake.order.push('auth'); fake.users.delete(uid) }),
}

export const messaging = { send: vi.fn(async () => 'msg-id') }

const missingFile = () => Object.assign(new Error('No such object'), { code: 404 })

const bucket = {
  name: 'test-bucket.firebasestorage.app',
  deleteFiles: vi.fn(async ({ prefix }) => { fake.order.push('storage'); fake.deletedPrefixes.push(prefix) }),
  file: (path) => ({
    download: async () => {
      const f = fake.files.get(path)
      if (!f) throw missingFile()
      return [Buffer.from(f.bytes)]
    },
    getMetadata: async () => {
      const f = fake.files.get(path)
      if (!f) throw missingFile()
      return [{ contentType: f.contentType }]
    },
  }),
}

export const admin = {
  initializeApp: () => {},
  firestore: () => firestore,
  auth: () => auth,
  messaging: () => messaging,
  storage: () => ({ bucket: () => bucket }),
}

export const stripe = {
  customers: { create: vi.fn(), retrieve: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
  subscriptions: { cancel: vi.fn() },
  webhooks: { constructEvent: vi.fn() },
}

export const mail = { sendMail: vi.fn(async () => {}) }

/** Wipe state and mock history between tests. */
export function resetFakes() {
  fake.docs.clear()
  fake.users.clear()
  fake.order.length = 0
  fake.deletedPrefixes.length = 0
  fake.files.clear()
  for (const group of [auth, messaging, bucket, mail, stripe.customers, stripe.checkout.sessions, stripe.billingPortal.sessions, stripe.subscriptions, stripe.webhooks]) {
    for (const fn of Object.values(group)) fn.mockClear?.()
  }
  stripe.customers.create.mockReset()
  stripe.customers.retrieve.mockReset()
  stripe.checkout.sessions.create.mockReset().mockResolvedValue({ url: 'https://checkout.stripe.test/s' })
  stripe.billingPortal.sessions.create.mockReset().mockResolvedValue({ url: 'https://billing.stripe.test/p' })
  stripe.subscriptions.cancel.mockReset().mockResolvedValue({})
  stripe.webhooks.constructEvent.mockReset()
  messaging.send.mockReset().mockResolvedValue('msg-id')
}

export const getDoc = (path) => fake.docs.get(path)
export const putDoc = (path, data) => fake.docs.set(path, structuredClone(data))
export const addUser = (uid, extra = {}) => fake.users.set(uid, { uid, email: `${uid}@example.com`, customClaims: {}, ...extra })
export const claimsOf = (uid) => fake.users.get(uid)?.customClaims

let uidSeq = 0
/** A fresh uid per test, so in-process cooldowns and rate limits never leak between tests. */
export const newUid = (prefix = 'u') => `${prefix}${++uidSeq}_${Date.now().toString(36)}`

/** Invoke an onCall function the way the Functions runtime does. */
export function call(fn, { uid, tier, role, data = {}, ip = '10.0.0.1' } = {}) {
  const token = {}
  if (tier) token.sartima_tier = tier
  if (role) token.sartima_role = role
  return fn.run({ auth: uid ? { uid, token } : undefined, data, rawRequest: { ip } })
}
