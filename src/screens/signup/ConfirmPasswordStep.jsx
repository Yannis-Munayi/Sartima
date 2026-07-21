import { useState } from 'react'
import { EyeIcon, EyeOffIcon, ConsentCheckboxes } from '../AuthScreen'
import LegalModal from '../../components/LegalModal'
import { PRIVACY_POLICY, TERMS_OF_SERVICE } from '../../data/legalContent'
import stepStyles from '../onboarding/OnboardingStep.module.css'
import styles from '../AuthScreen.module.css'

export default function ConfirmPasswordStep({ password, onSubmit, saving, error }) {
  const [confirm, setConfirm]             = useState('')
  const [showConfirm, setShowConfirm]     = useState(false)
  const [localError, setLocalError]       = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [ageAffirmed, setAgeAffirmed]     = useState(false)
  const [legalDoc, setLegalDoc]           = useState(null) // 'terms' | 'privacy' | null

  function handleSubmit(e) {
    e.preventDefault()
    if (confirm !== password) return setLocalError('Passwords do not match.')
    if (!agreedToTerms) return setLocalError('Please agree to the Terms of Service and Privacy Policy.')
    if (!ageAffirmed) return setLocalError('Please confirm you are at least 16 years old.')
    setLocalError('')
    onSubmit()
  }

  return (
    <div className={stepStyles.step}>
      <div className={stepStyles.iconBadge}>✅</div>
      <h1 className={stepStyles.title}>
        Confirm your<br /><em>password</em>
      </h1>
      <p className={stepStyles.sub}>Almost there — one last check before we create your account.</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label>Confirm password</label>
          <div className={styles.passwordWrap}>
            <input
              type={showConfirm ? 'text' : 'password'}
              placeholder="Repeat your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              autoFocus
            />
            <button
              type="button"
              className={styles.eyeBtn}
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        <ConsentCheckboxes
          agreedToTerms={agreedToTerms}
          setAgreedToTerms={setAgreedToTerms}
          ageAffirmed={ageAffirmed}
          setAgeAffirmed={setAgeAffirmed}
          onOpenLegal={setLegalDoc}
        />

        {(localError || error) && <p className={styles.error}>{localError || error}</p>}

        <button type="submit" className={styles.submitBtn} disabled={saving}>
          {saving ? 'Creating your account…' : 'Create account'}
        </button>
      </form>

      <LegalModal
        doc={legalDoc === 'terms' ? TERMS_OF_SERVICE : legalDoc === 'privacy' ? PRIVACY_POLICY : null}
        onClose={() => setLegalDoc(null)}
      />
    </div>
  )
}
