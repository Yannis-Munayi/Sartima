// Settings for the QA suite and dashboard. Everything here is local tooling:
// nothing under qa/ is imported by the app, bundled by Vite, or deployed.
//
// Values come from (first match wins): the process environment, qa/.env,
// then the app's own .env for the public Firebase config.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const QA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const ROOT   = path.resolve(QA_DIR, '..')

function parseEnvFile(file) {
  const out = {}
  let text
  try { text = fs.readFileSync(file, 'utf8') } catch { return out }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    out[key] = value // later lines win, like Vite's dotenv parse
  }
  return out
}

const qaEnv  = parseEnvFile(path.join(QA_DIR, '.env'))
const appEnv = parseEnvFile(path.join(ROOT, '.env'))

export function setting(key, fallback = '') {
  const v = process.env[key] ?? qaEnv[key]
  return v === undefined || v === '' ? fallback : v
}

export const TARGET     = process.env.QA_TARGET === 'live' ? 'live' : 'local'
export const LOCAL_MODE = setting('QA_LOCAL_MODE', 'dev') === 'preview' ? 'preview' : 'dev'
// Dedicated ports (not Vite's usual 5173/4173), so a run never reuses a dev
// server you left open: a long-lived one slowed page loads past the 45s
// navigation timeout and failed unrelated tests.
export const LOCAL_PORT = LOCAL_MODE === 'preview' ? 4180 : 5180
export const LIVE_URL   = setting('QA_LIVE_URL', 'https://sartima.ca').replace(/\/+$/, '')
export const BASE_URL   = TARGET === 'live' ? LIVE_URL : `http://localhost:${LOCAL_PORT}`

export const RESULTS_ROOT = path.join(QA_DIR, 'results')
export const RESULTS_DIR  = path.join(RESULTS_ROOT, TARGET)

// The public web config (the same values the app ships to every browser).
export const FIREBASE = {
  apiKey:    setting('QA_FIREBASE_API_KEY', appEnv.VITE_FIREBASE_API_KEY ?? ''),
  projectId: setting('QA_FIREBASE_PROJECT_ID', appEnv.VITE_FIREBASE_PROJECT_ID ?? ''),
  region:    setting('QA_FUNCTIONS_REGION', 'us-central1'),
}

function account(prefix) {
  const email    = setting(`${prefix}_EMAIL`)
  const password = setting(`${prefix}_PASSWORD`)
  return email && password ? { email, password } : null
}

export const ACCOUNTS = {
  free: account('QA_FREE'),
  pro:  account('QA_PRO'),
}

// Throwaway accounts (sign-up, onboarding, consent, delete-account tests) are
// created on @example.com addresses, which never receive mail, and removed at
// the end of the test. On by default locally; opt in for the live site.
export const ALLOW_SIGNUP = TARGET === 'live'
  ? setting('QA_ALLOW_SIGNUP_LIVE', '0') === '1'
  : setting('QA_ALLOW_SIGNUP_LOCAL', '1') === '1'

export const STRIPE_TEST_MODE = setting('QA_STRIPE_TEST_MODE', '0') === '1'
export const REAL_FEEDBACK    = setting('QA_REAL_FEEDBACK', '0') === '1'

// Service worker, Sentry and other production-only behaviour
export const IS_PROD_BUILD = TARGET === 'live' || LOCAL_MODE === 'preview'

export function legalVersion() {
  const text = fs.readFileSync(path.join(ROOT, 'src/data/legalContent.js'), 'utf8')
  const m = text.match(/LEGAL_VERSION\s*=\s*'([^']+)'/)
  return m ? m[1] : ''
}

// What the dashboard shows in its setup panel — names only, never values.
export function setupSummary() {
  return {
    freeAccount:   Boolean(ACCOUNTS.free),
    proAccount:    Boolean(ACCOUNTS.pro),
    firebase:      Boolean(FIREBASE.apiKey && FIREBASE.projectId),
    signupLocal:   setting('QA_ALLOW_SIGNUP_LOCAL', '1') === '1',
    signupLive:    setting('QA_ALLOW_SIGNUP_LIVE', '0') === '1',
    stripeTest:    STRIPE_TEST_MODE,
    realFeedback:  REAL_FEEDBACK,
    liveUrl:       LIVE_URL,
  }
}
