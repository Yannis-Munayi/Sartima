import { useState } from 'react'
import { useSubscription } from '../context/SubscriptionContext'
import { openBillingPortal } from '../services/subscriptionService'
import styles from './PaymentDueModal.module.css'

const DAY_MS        = 24 * 60 * 60 * 1000
const DISMISSED_KEY = 'sartima_payment_warning_dismissed'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function readDismissed() {
  try { return localStorage.getItem(DISMISSED_KEY) } catch { return null }
}

// Red warning shown while a renewal payment has failed. During the 7-day grace
// period it counts down; once it's over (account back on free) it offers to restore.
// "Remind me later" hides it until the next day.
export default function PaymentDueModal() {
  const { paymentDue, billing } = useSubscription()
  const [dismissed, setDismissed] = useState(() => readDismissed() === today())
  const [opening, setOpening]     = useState(false)

  if (!paymentDue || dismissed) return null

  const msLeft   = (billing?.graceEndsAt ?? 0) - Date.now()
  const inGrace  = msLeft > 0
  const daysLeft = Math.max(1, Math.ceil(msLeft / DAY_MS))
  const endDate  = inGrace
    ? new Date(billing.graceEndsAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    : null

  function dismiss() {
    try { localStorage.setItem(DISMISSED_KEY, today()) } catch { /* private mode */ }
    setDismissed(true)
  }

  async function handleUpdate() {
    setOpening(true)
    try {
      await openBillingPortal()
    } catch {
      setOpening(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={dismiss}>
      <div
        className={styles.card}
        role="alertdialog"
        aria-labelledby="payment-due-title"
        aria-describedby="payment-due-body"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.icon} aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <p className={styles.eyebrow}>{inGrace ? 'Payment failed' : 'Pro paused'}</p>
        <h2 id="payment-due-title" className={styles.title}>
          {inGrace
            ? `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left to keep Pro`
            : 'Your Pro benefits have ended'}
        </h2>
        <p id="payment-due-body" className={styles.body}>
          {inGrace
            ? <>We couldn't charge your card for Sartima Pro. Update your payment method before <strong>{endDate}</strong> to keep your try-ons, trip packer and unlimited closet.</>
            : <>We still couldn't charge your card, so your account is back on the free plan. Update your payment method to restore Pro straight away.</>}
        </p>

        <button className={styles.primary} onClick={handleUpdate} disabled={opening}>
          {opening ? 'Opening billing…' : 'Update payment method'}
        </button>
        <button className={styles.secondary} onClick={dismiss}>
          Remind me later
        </button>
      </div>
    </div>
  )
}
