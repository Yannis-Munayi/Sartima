import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../services/firebase'
import stepStyles from '../onboarding/OnboardingStep.module.css'
import styles from '../AuthScreen.module.css'

export default function EmailStep({ value, onNext }) {
  const [email, setEmail]       = useState(value)
  const [error, setError]       = useState('')
  const [checking, setChecking] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setChecking(true)
    try {
      const validateFn = httpsCallable(functions, 'validateEmail')
      const { data } = await validateFn({ email })
      if (!data.valid) {
        setError("This email address doesn't appear to exist. Please use a real email.")
        return
      }
    } catch {
      // If the check fails (network/cold-start), proceed — Firebase email
      // verification acts as the fallback gate for unreachable addresses.
    } finally {
      setChecking(false)
    }
    onNext(email)
  }

  return (
    <div className={stepStyles.step}>
      <div className={stepStyles.iconBadge}>✉️</div>
      <h1 className={stepStyles.title}>
        What's your<br /><em>email?</em>
      </h1>
      <p className={stepStyles.sub}>We'll use this to save your results and sign you back in.</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label>Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.submitBtn} disabled={checking}>
          {checking ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
