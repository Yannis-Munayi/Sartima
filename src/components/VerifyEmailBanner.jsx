import { useState } from 'react'
import { sendEmailVerification } from 'firebase/auth'
import { auth } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import styles from './VerifyEmailBanner.module.css'

/**
 * Slim, dismissible nudge shown on Home/Profile until the account's email
 * is verified. Non-blocking by design — verification is encouraged, not
 * gated. Google accounts arrive pre-verified so they never see this.
 */
export default function VerifyEmailBanner() {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [sent, setSent]           = useState(false)
  const [sending, setSending]     = useState(false)

  if (!user || user.emailVerified || dismissed) return null

  async function handleResend() {
    setSending(true)
    try {
      if (auth.currentUser) await sendEmailVerification(auth.currentUser)
    } catch {
      // rate-limited or already verified — treat as sent either way
    } finally {
      setSent(true)
      setSending(false)
    }
  }

  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>
        Verify your email — we sent a link to <strong>{user.email}</strong>
      </span>
      <div className={styles.actions}>
        <button
          className={styles.resendBtn}
          onClick={handleResend}
          disabled={sending || sent}
        >
          {sent ? 'Sent ✓' : sending ? 'Sending…' : 'Resend'}
        </button>
        <button
          className={styles.closeBtn}
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
