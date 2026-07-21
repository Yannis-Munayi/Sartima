import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useExplore } from '../../context/ExploreContext'
import PreferenceSteps, { PREFERENCE_STEP_COUNT, INITIAL_PREFERENCE_ANSWERS } from '../onboarding/PreferenceSteps'
import EmailStep from './EmailStep'
import PasswordStep from './PasswordStep'
import ConfirmPasswordStep from './ConfirmPasswordStep'
import LoginStep from './LoginStep'
import GuestWarningModal from './GuestWarningModal'
import { finalizeOnboardingAnswers } from '../onboarding/finalizeAnswers'
import { friendlyError } from '../AuthScreen'
import { LEGAL_VERSION } from '../../data/legalContent'
import styles from './SignupFlow.module.css'

const TOTAL_STEPS = PREFERENCE_STEP_COUNT + 3 // + email, password, confirm

// The default landing experience for signed-out visitors: gender → 3
// aesthetics → up to 5 brands → missing categories → fashion goal →
// occasion → occupation → email → password → confirm password. Steps 1-7
// (PreferenceSteps) are also reused post-auth by OnboardingFlow — this
// component owns only the account-creation tail (8-10) plus the login/guest
// escape hatches around the whole thing.
export default function SignupFlow({ onDone, onGuestContinue }) {
  const { user, signup }  = useAuth()
  const { dispatch }      = useApp()
  const { saveAesthetic } = useExplore()

  const [phase, setPhase]         = useState('preferences') // preferences | email | password | confirm | login
  const [preLoginPhase, setPreLoginPhase] = useState('preferences')
  const [prefStep, setPrefStep]   = useState(0)
  const [answers, setAnswers]     = useState(INITIAL_PREFERENCE_ANSWERS)
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [showGuestModal, setShowGuestModal] = useState(false)
  const [pendingUid, setPendingUid] = useState(null)

  // Waits for `user` (from useAuth) to actually reflect the just-created
  // account before finishing — saveAesthetic/useExplore() read `user` off
  // their own hook, so calling them synchronously right after signup()
  // resolves would still close over the pre-signup (null) user and silently
  // drop the aestheticPin interest signal.
  useEffect(() => {
    if (!pendingUid || !user || user.uid !== pendingUid) return
    let cancelled = false
    ;(async () => {
      const { warmStart } = await finalizeOnboardingAnswers({ user, answers, dispatch, saveAesthetic })
      if (cancelled) return
      dispatch({ type: 'GO_TO_QUIZ', warmStart })
      onDone()
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUid, user])

  function goToLogin() {
    setPreLoginPhase(phase)
    setPhase('login')
  }

  async function handleCreateAccount() {
    setSaving(true)
    setError('')
    try {
      const newUser = await signup(email, password, '', { legalVersion: LEGAL_VERSION, ageAffirmed: true })
      setPendingUid(newUser.uid)
    } catch (err) {
      setError(friendlyError(err.code))
      setSaving(false)
    }
  }

  const dotIndex =
    phase === 'preferences' ? prefStep :
    phase === 'email'       ? PREFERENCE_STEP_COUNT :
    phase === 'password'    ? PREFERENCE_STEP_COUNT + 1 :
    PREFERENCE_STEP_COUNT + 2

  if (phase === 'login') {
    return <LoginStep onDone={onDone} onBack={() => setPhase(preLoginPhase)} />
  }

  return (
    <div className={styles.flow}>
      <div className={styles.topRow}>
        <button className={styles.topLink} onClick={goToLogin}>Log in</button>
        <button className={styles.topLink} onClick={() => setShowGuestModal(true)}>Continue as guest</button>
      </div>

      <div className={styles.dots}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <span key={i} className={`${styles.dot} ${i <= dotIndex ? styles.dotActive : ''}`} />
        ))}
      </div>

      {phase === 'preferences' && (
        <PreferenceSteps
          embedded
          initialStep={prefStep}
          initialAnswers={answers}
          onStepChange={(step, currentAnswers) => { setPrefStep(step); setAnswers(currentAnswers) }}
          onComplete={(finalAnswers) => { setAnswers(finalAnswers); setPhase('email') }}
        />
      )}
      {phase === 'email' && (
        <EmailStep value={email} onNext={(v) => { setEmail(v); setPhase('password') }} />
      )}
      {phase === 'password' && (
        <PasswordStep value={password} onNext={(v) => { setPassword(v); setPhase('confirm') }} />
      )}
      {phase === 'confirm' && (
        <ConfirmPasswordStep
          password={password}
          onSubmit={handleCreateAccount}
          saving={saving}
          error={error}
        />
      )}

      {phase === 'preferences' && (
        <button className={styles.skipAll} onClick={() => setPhase('email')}>
          Skip all →
        </button>
      )}

      {showGuestModal && (
        <GuestWarningModal
          onKeepGoing={() => setShowGuestModal(false)}
          onContinueAsGuest={onGuestContinue}
        />
      )}
    </div>
  )
}
