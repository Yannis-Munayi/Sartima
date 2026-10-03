import { useState } from 'react'
import { validateSignupEmail } from '../../services/emailValidation'
import { EmailSuggestion } from '../AuthScreen'
import stepStyles from '../onboarding/OnboardingStep.module.css'
import styles from '../AuthScreen.module.css'
import Icon from '../../components/Icon'

export default function EmailStep({ value, onNext }) {
  const [email, setEmail]           = useState(value)
  const [error, setError]           = useState('')
  const [suggestion, setSuggestion] = useState(null) // { for: typed email, address: suggested }
  const [checking, setChecking]     = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    // Continuing again on the address we just offered a fix for means "mine
    // is right" — a suggestion only holds the user up once.
    const keepAsTyped = suggestion?.for === email
    setError('')
    setSuggestion(null)
    setChecking(true)
    const result = await validateSignupEmail(email)
    setChecking(false)
    if (result.suggestion && !keepAsTyped) {
      setSuggestion({ for: email, address: result.suggestion })
      return
    }
    if (result.error) {
      setError(result.error)
      return
    }
    onNext(email)
  }

  return (
    <div className={stepStyles.step}>
      <div className={stepStyles.iconBadge}><Icon name="mail" size={22} /></div>
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
            onChange={(e) => { setEmail(e.target.value); setSuggestion(null) }}
            required
            autoComplete="email"
            autoFocus
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {suggestion && (
          <EmailSuggestion
            address={suggestion.address}
            submitLabel="Continue"
            onAccept={() => { setEmail(suggestion.address); setSuggestion(null) }}
          />
        )}

        <button type="submit" className={styles.submitBtn} disabled={checking}>
          {checking ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
