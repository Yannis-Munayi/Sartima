// Node-side access to the same Firebase project the app uses, through the
// public REST APIs and the test account's own ID token — so every read and
// write is still checked by the Firestore rules, exactly like the app's.
// Used to seed known data before a test and to check what the app saved.

import { FIREBASE, ACCOUNTS } from './env.js'

const IDT = 'https://identitytoolkit.googleapis.com/v1'
const fsBase = () =>
  `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents`

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { res, json }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signIn(email, password) {
  const { res, json } = await postJson(`${IDT}/accounts:signInWithPassword?key=${FIREBASE.apiKey}`,
    { email, password, returnSecureToken: true })
  if (!res.ok) throw new Error(`Sign-in failed for ${email}: ${json.error?.message ?? res.status}`)
  return { idToken: json.idToken, uid: json.localId, email }
}

export async function signUp(email, password) {
  const { res, json } = await postJson(`${IDT}/accounts:signUp?key=${FIREBASE.apiKey}`,
    { email, password, returnSecureToken: true })
  if (!res.ok) throw new Error(`Sign-up failed for ${email}: ${json.error?.message ?? res.status}`)
  return { idToken: json.idToken, uid: json.localId, email }
}

export async function deleteAuthUser(idToken) {
  await postJson(`${IDT}/accounts:delete?key=${FIREBASE.apiKey}`, { idToken })
}

/** Custom claims (sartima_tier / sartima_role) from a fresh ID token. */
export function claimsOf(idToken) {
  const payload = idToken.split('.')[1]
  return JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
}

const sessionCache = new Map()

/** Signed-in REST session for 'free' / 'pro' (cached for 40 minutes). */
export async function session(role) {
  const creds = ACCOUNTS[role]
  if (!creds) throw new Error(`No ${role} test account configured`)
  const cached = sessionCache.get(role)
  if (cached && Date.now() - cached.at < 40 * 60 * 1000) return cached
  const s = { ...(await signIn(creds.email, creds.password)), at: Date.now() }
  sessionCache.set(role, s)
  return s
}

// ── Firestore value encoding ─────────────────────────────────────────────────

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string') return { stringValue: v }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } }
  return { mapValue: { fields: toFields(v) } }
}

function toFields(obj) {
  const fields = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue
    fields[k] = toValue(v)
  }
  return fields
}

function fromValue(v) {
  if ('nullValue' in v) return null
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('stringValue' in v) return v.stringValue
  if ('timestampValue' in v) return v.timestampValue
  if ('referenceValue' in v) return v.referenceValue
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(fromValue)
  if ('mapValue' in v) return fromFields(v.mapValue.fields ?? {})
  return null
}

function fromFields(fields) {
  const out = {}
  for (const [k, v] of Object.entries(fields ?? {})) out[k] = fromValue(v)
  return out
}

// ── Firestore documents ──────────────────────────────────────────────────────

const auth = (s) => ({ Authorization: `Bearer ${s.idToken}` })

export async function getDoc(s, docPath) {
  const res = await fetch(`${fsBase()}/${docPath}`, { headers: auth(s) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Read ${docPath} failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return fromFields(json.fields)
}

/** Replace the whole document. */
export async function setDoc(s, docPath, data) {
  const res = await fetch(`${fsBase()}/${docPath}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...auth(s) },
    body: JSON.stringify({ fields: toFields(data) }),
  })
  if (!res.ok) throw new Error(`Write ${docPath} failed: ${res.status} ${await res.text()}`)
}

/** Update only the given top-level fields (others are kept). */
export async function mergeDoc(s, docPath, data) {
  const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  const res = await fetch(`${fsBase()}/${docPath}?${mask}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...auth(s) },
    body: JSON.stringify({ fields: toFields(data) }),
  })
  if (!res.ok) throw new Error(`Merge ${docPath} failed: ${res.status} ${await res.text()}`)
}

export async function deleteDoc(s, docPath) {
  const res = await fetch(`${fsBase()}/${docPath}`, { method: 'DELETE', headers: auth(s) })
  if (!res.ok && res.status !== 404) throw new Error(`Delete ${docPath} failed: ${res.status}`)
}

export async function listDocs(s, collectionPath) {
  const res = await fetch(`${fsBase()}/${collectionPath}?pageSize=300`, { headers: auth(s) })
  if (!res.ok) return []
  const json = await res.json()
  return (json.documents ?? []).map((d) => ({ id: d.name.split('/').pop(), ...fromFields(d.fields) }))
}

export async function addDoc(s, collectionPath, data) {
  const res = await fetch(`${fsBase()}/${collectionPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth(s) },
    body: JSON.stringify({ fields: toFields(data) }),
  })
  if (!res.ok) throw new Error(`Add to ${collectionPath} failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return json.name.split('/').pop()
}

// ── Cloud Functions (callable protocol) ──────────────────────────────────────

export function functionUrl(name) {
  return `https://${FIREBASE.region}-${FIREBASE.projectId}.cloudfunctions.net/${name}`
}

/** Call a callable Function as this session (or anonymously with s = null). */
export async function callFunction(s, name, data = {}) {
  const { res, json } = await postJson(functionUrl(name), { data }, s ? auth(s) : {})
  if (res.ok) return { ok: true, result: json.result }
  return { ok: false, httpStatus: res.status, status: json.error?.status ?? String(res.status), message: json.error?.message ?? '' }
}
