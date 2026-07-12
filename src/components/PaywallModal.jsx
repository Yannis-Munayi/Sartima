import { useState } from 'react'
import { useSubscription } from '../context/SubscriptionContext'
import { createCheckoutSession } from '../services/subscriptionService'
import { useAuth } from '../context/AuthContext'
import LegalModal from './LegalModal'
import { TERMS_OF_SERVICE } from '../data/legalContent'

const FEATURE_COPY = {
  visionUploads: {
    headline: 'AI scan limit reached',
    sub:      'You\'ve used all 3 closet scans for this month.',
    bullets:  ['30 AI closet scans / month', 'Unlimited digital closet items', 'AI trip packer + outfit calendar'],
  },
  outfitGenerations: {
    headline: 'Daily outfit used',
    sub:      'Free users get one AI outfit per day.',
    bullets:  ['Unlimited daily outfit generation', '30 Virtual Try-On pieces / month', 'Trip packer + outfit calendar'],
  },
  tripPlans: {
    headline: 'Pro feature',
    sub:      'Trip Packer is available on Pro.',
    bullets:  ['3 AI trip plans / month', 'Unlimited closet items', '30 Virtual Try-On pieces / month'],
  },
  tryOns: {
    headline: 'Pro feature',
    sub:      'Virtual Try-On is available on Pro.',
    bullets:  ['30 Try-On pieces / month', 'Buy extra packs for $2.99 / 30 pieces', 'Unlimited closet + outfit boards'],
  },
  closetItems: {
    headline: 'Closet full',
    sub:      'Free closets hold up to 15 items.',
    bullets:  ['Unlimited closet items', '30 AI vision scans / month', 'Virtual Try-On + trip packer'],
  },
  aestheticPins: {
    headline: 'Pin limit reached',
    sub:      'Free users can pin up to 3 aesthetics.',
    bullets:  ['Unlimited aesthetic pins', 'Unlimited liked items', 'Full outfit boards + calendar'],
  },
  likedItems: {
    headline: 'Likes limit reached',
    sub:      'Free users can like up to 50 items.',
    bullets:  ['Unlimited liked items', 'Unlimited outfit boards', '30 AI vision scans / month'],
  },
  outfitBoards: {
    headline: 'Board limit reached',
    sub:      'Free users can create 1 outfit board.',
    bullets:  ['Unlimited outfit boards', 'Outfit calendar + trip packer', '30 Try-On pieces / month'],
  },
  outfitCalendar: {
    headline: 'Pro feature',
    sub:      'Outfit Calendar is available on Pro.',
    bullets:  ['Outfit calendar + smart scheduling', 'AI trip packer', '30 Try-On pieces / month'],
  },
  laundry: {
    headline: 'Pro feature',
    sub:      'Laundry care tracking is available on Pro.',
    bullets:  ['Wash reminders + care symbol guide', 'Sort items by colour & fabric', 'Outfit calendar + trip packer'],
  },
  upgrade: {
    headline: 'Unlock Sartima Pro',
    sub:      'Everything you need to build your style.',
    bullets:  ['Unlimited outfit generation + closet', '30 AI scans + 30 Try-Ons / month', 'Trip packer + outfit calendar'],
  },
}

export default function PaywallModal() {
  const { paywallFeature, closePaywall } = useSubscription()
  const { user } = useAuth()
  const [showTerms, setShowTerms] = useState(false)

  if (!paywallFeature) return null

  const copy = FEATURE_COPY[paywallFeature] ?? FEATURE_COPY.upgrade

  async function handleMonthly() {
    try {
      await createCheckoutSession(user?.uid, 'monthly')
    } catch {
      // subscriptionService will handle redirect; errors mean Stripe not yet configured
    }
    closePaywall()
  }

  async function handleAnnual() {
    try {
      await createCheckoutSession(user?.uid, 'annual')
    } catch {
      // same
    }
    closePaywall()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={closePaywall}>
      <div
        style={{
          width: '100%', maxWidth: 480,
          background: 'var(--bg-elevated)',
          borderRadius: '12px 12px 0 0',
          padding: '28px 24px 44px',
          borderTop: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 32, height: 3, background: 'var(--border-strong)', borderRadius: 2, margin: '0 auto 24px' }} />

        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 8px' }}>
          Sartima Pro
        </p>
        <h2 style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', serif", fontSize: 24, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px', letterSpacing: '0.01em' }}>
          {copy.headline}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.6 }}>
          {copy.sub}
        </p>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {copy.bullets.map((b) => (
            <li key={b} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-dim)' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 14, lineHeight: 1 }}>✓</span>
              {b}
            </li>
          ))}
        </ul>

        <button
          onClick={handleMonthly}
          style={{
            width: '100%', padding: '14px 0', marginBottom: 10,
            background: 'var(--accent)', border: 'none',
            borderRadius: 6, color: '#0B0907',
            fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
            letterSpacing: '1.5px', textTransform: 'uppercase',
          }}
        >
          Upgrade — $6.99 / month
        </button>
        <button
          onClick={handleAnnual}
          style={{
            width: '100%', padding: '13px 0',
            background: 'transparent',
            border: '1px solid var(--border-strong)',
            borderRadius: 6, color: 'var(--text-muted)',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
            letterSpacing: '1.5px', textTransform: 'uppercase',
          }}
        >
          Annual — $49.99 / year (save 40%)
        </button>

        <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '14px 0 0', lineHeight: 1.5, textAlign: 'center' }}>
          Subscriptions auto-renew until canceled. Cancel anytime from Settings → Manage subscription.
          No refunds for partial billing periods. See{' '}
          <button
            type="button"
            onClick={() => setShowTerms(true)}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', textDecoration: 'underline', fontSize: 'inherit', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            Terms
          </button>{' '}
          for details.
        </p>
      </div>

      <LegalModal doc={showTerms ? TERMS_OF_SERVICE : null} onClose={() => setShowTerms(false)} />
    </div>
  )
}
