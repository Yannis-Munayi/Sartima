import { useState } from 'react'
import { EyeIcon, EyeOffIcon, StrengthBar, getStrength } from '../AuthScreen'
import stepStyles from '../onboarding/OnboardingStep.module.css'
import styles from '../AuthScreen.module.css'

export default function PasswordStep({ value, onNext }) {
  const [password, setPassword]     = useState(value)
  const [error, setError]           = useState('')
  const [showPassword, setShowPassword] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (getStrength(password) < 2) return setError('Password is too weak — add uppercase letters, numbers, or symbols.')
    setError('')
    onNext(password)
  }

  return (
    <div className={stepStyles.step}>
      <div className={stepStyles.iconBadge}>🔒</div>
      <h1 className={stepStyles.title}>
        Choose a<br /><em>password</em>
      </h1>
      <p className={stepStyles.sub}>At least 8 characters, with a mix of letters, numbers, or symbols.</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label>Password</label>
          <div className={styles.passwordWrap}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              autoFocus
            />
            <button
              type="button"
              className={styles.eyeBtn}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          <StrengthBar password={password} />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.submitBtn}>Continue</button>
      </form>
    </div>
  )
}
