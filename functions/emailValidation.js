import dns from 'dns/promises'
import { disposableEmailBlocklistSet } from 'disposable-email-domains-js'

// Pre-signup email checks behind the validateEmail function. Kept free of
// firebase imports so it can be exercised with plain `node`.
//
// What this can and can't prove: it rejects addresses that are malformed,
// throwaway, or on a domain with no mail server, and offers fixes for typos of
// big providers. It cannot prove a specific mailbox exists — gmail.com accepts
// any name at the DNS level — so the post-signup verification email is still
// what confirms ownership.

// Throwaway-inbox domains (mailinator, yopmail, guerrillamail…). Built once
// per instance — the package's own isDisposableEmailDomain() rebuilds this
// Set on every call.
const DISPOSABLE_DOMAINS = disposableEmailBlocklistSet()

// Big consumer providers. Used two ways: known-good (skip the DNS lookup) and
// as typo targets (gmial.com → gmail.com). Any real provider within an edit or
// two of another must be listed too (ymail.com, email.com, mail.com), or its
// users get told they probably meant gmail.com.
const POPULAR_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'ymail.com', 'rocketmail.com', 'yahoo.ca', 'yahoo.co.uk', 'yahoo.fr',
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
  'hotmail.ca', 'live.ca', 'hotmail.co.uk', 'live.co.uk', 'hotmail.fr',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'aim.com',
  'proton.me', 'protonmail.com', 'pm.me',
  'gmx.com', 'gmx.net', 'gmx.de', 'mail.com', 'email.com', 'web.de',
  'zoho.com', 'yandex.com', 'fastmail.com', 'hey.com', 'tutanota.com',
  // Canadian + US ISPs
  'rogers.com', 'shaw.ca', 'bell.net', 'sympatico.ca', 'videotron.ca', 'telus.net',
  'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net', 'cox.net', 'charter.net',
])

// RFC 2606 / 6761 names that can never receive real mail.
const RESERVED_TLDS    = new Set(['test', 'example', 'invalid', 'localhost', 'local'])
const RESERVED_DOMAINS = new Set(['example.com', 'example.net', 'example.org'])

// Addresses that exist only to send, never to receive.
const NO_REPLY_LOCALS = new Set(['noreply', 'no-reply', 'donotreply', 'do-not-reply'])

const LOCAL_RE = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/i
const LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i
const TLD_RE   = /^([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/i

// Short timeouts so a slow nameserver can't eat the function's 10s budget.
const resolver = new dns.Resolver({ timeout: 3000, tries: 2 })

// The domain itself doesn't exist, or exists without MX records.
const NO_MAIL_DNS_CODES = new Set(['ENOTFOUND', 'ENODATA'])

function parseEmail(raw) {
  const email = raw.trim()
  if (email.length > 254) return null
  const at = email.lastIndexOf('@')
  if (at < 1) return null
  const local  = email.slice(0, at)
  const domain = email.slice(at + 1).toLowerCase()
  if (local.length > 64 || !LOCAL_RE.test(local)) return null
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null
  const labels = domain.split('.')
  if (labels.length < 2 || !labels.every((l) => LABEL_RE.test(l))) return null
  if (!TLD_RE.test(labels[labels.length - 1])) return null
  return { local, domain, labels }
}

// Optimal string alignment distance: Levenshtein plus adjacent transpositions,
// so "gamil" → "gmail" counts as one typo, not two.
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[a.length][b.length]
}

// Closest popular domain, if the typed one looks like a typo of it. Short
// domains only get one edit of slack so e.g. aim.com isn't "fixed" to aol.com.
function closestPopularDomain(domain) {
  if (POPULAR_DOMAINS.has(domain)) return null
  const maxDistance = domain.length >= 10 ? 2 : 1
  let best = null
  let bestDistance = Infinity
  for (const candidate of POPULAR_DOMAINS) {
    const distance = editDistance(domain, candidate)
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return bestDistance <= maxDistance ? best : null
}

// Matches subdomains too (inbox.mailinator.com), but never a bare TLD.
function isDisposable(labels) {
  for (let i = 0; i < labels.length - 1; i++) {
    if (DISPOSABLE_DOMAINS.has(labels.slice(i).join('.'))) return true
  }
  return false
}

// true: a mail server accepts mail for the domain. false: definitively none
// (no such domain, no MX records, or an RFC 7505 null MX — "MX 0 ." — which
// is what example.com publishes). Throws on lookup failures (timeouts,
// SERVFAIL) since those say nothing about the address.
async function hasMailServer(domain) {
  try {
    const records = await resolver.resolveMx(domain)
    return records.some((r) => r.exchange && r.exchange !== '.')
  } catch (err) {
    if (NO_MAIL_DNS_CODES.has(err.code)) return false
    throw err
  }
}

// Resolves { valid, reason?, suggestion? }:
//   reason     — 'syntax' | 'disposable' | 'undeliverable' when !valid
//   suggestion — the full corrected address when the domain looks like a
//                typo of a popular provider ("you@gmail.com"); may accompany
//                valid: true, since typosquatters run real mail servers on
//                gamil.com, outlok.com, icould.com…
// Throws when DNS can't give an answer either way.
export async function checkEmail(raw) {
  const parsed = parseEmail(raw)
  if (!parsed) return { valid: false, reason: 'syntax' }
  const { local, domain, labels } = parsed

  if (NO_REPLY_LOCALS.has(local.toLowerCase())) return { valid: false, reason: 'undeliverable' }

  if (POPULAR_DOMAINS.has(domain)) return { valid: true }

  const typoOf     = closestPopularDomain(domain)
  const suggestion = typoOf ? `${local}@${typoOf}` : undefined

  // Some typo domains are squatted catch-all inboxes on the disposable list
  // (gmial.com, hotmial.com) — still offer the fix.
  if (isDisposable(labels)) return { valid: false, reason: 'disposable', suggestion }

  if (RESERVED_TLDS.has(labels[labels.length - 1]) || RESERVED_DOMAINS.has(domain)) {
    return { valid: false, reason: 'undeliverable', suggestion }
  }

  if (!(await hasMailServer(domain))) return { valid: false, reason: 'undeliverable', suggestion }

  // A same-name provider on another TLD that really takes mail (live.fr,
  // yahoo.de) is a regional variant, not a typo of live.ca / yahoo.ca.
  if (typoOf && typoOf.split('.')[0] === labels[0]) return { valid: true }

  return { valid: true, suggestion }
}
