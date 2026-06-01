import { useState } from 'react'
import styles from './OnboardingStep.module.css'

export default function ShoppingEmailScreen({ userEmail, onFinish, saving }) {
  const [email, setEmail] = useState(userEmail)

  return (
    <div className={styles.step}>
      <div className={styles.iconBadge}>✉️</div>
      <h1 className={styles.title}>
        Your email<br />for <em>shopping</em>
      </h1>
      <p className={styles.sub}>
        Forward your receipts from this address to import your purchases automatically.
      </p>

      <input
        className={styles.emailInput}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
      />

      <button
        className={styles.nextBtn}
        onClick={() => onFinish(email)}
        disabled={saving}
        style={{ marginTop: 20 }}
      >
        {saving ? 'Setting up…' : 'Continue'}
      </button>

      <button className={styles.skipBtn} onClick={() => onFinish(null)} disabled={saving}>
        Skip for now
      </button>
    </div>
  )
}
