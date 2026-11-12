// Runs before every functions test file: swap the Admin SDK, Stripe and
// nodemailer for the in-memory fakes, and keep env keys predictable.
import { vi, beforeEach } from 'vitest'
import { resetFakes } from './fakes.js'

vi.mock('firebase-admin', async () => ({ default: (await import('./fakes.js')).admin }))
vi.mock('firebase-admin/firestore', async () => ({ FieldValue: (await import('./fakes.js')).FieldValue }))
vi.mock('stripe', async () => {
  const { stripe } = await import('./fakes.js')
  return { default: function Stripe() { return stripe } }
})
vi.mock('nodemailer', async () => {
  const { mail } = await import('./fakes.js')
  return { default: { createTransport: () => mail } }
})

const ENV = {
  OPENWEATHER_KEY: 'ow-key',
  UNSPLASH_KEY: 'un-key',
  PEXELS_KEY: 'px-key',
  REPLICATE_API_KEY: 'rep-key',
  GMAIL_APP_PASSWORD: 'mail-pass',
  STRIPE_SECRET_KEY: 'sk_test',
  STRIPE_WEBHOOK_SECRET: 'whsec',
  STRIPE_PRICE_ID_MONTHLY: 'price_monthly',
  STRIPE_PRICE_ID_ANNUAL: 'price_annual',
  STRIPE_PRICE_ID_TRYON_PACK: 'price_pack',
  APP_URL: 'https://sartima.test',
}

beforeEach(() => {
  resetFakes()
  for (const [k, v] of Object.entries(ENV)) process.env[k] = v
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
