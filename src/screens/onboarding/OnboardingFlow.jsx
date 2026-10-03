import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useExplore } from '../../context/ExploreContext'
import PreferenceSteps from './PreferenceSteps'
import { finalizeOnboardingAnswers } from './finalizeAnswers'
import styles from './OnboardingFlow.module.css'

// Post-auth entry point: Google sign-ins and any legacy account still
// missing `onboardingComplete` land here. Runs the same 7-step preference
// sequence as the pre-auth SignupFlow (account already exists, so no email/
// password steps), then launches the same warm-started quiz — unless the
// user already has quiz results pending save (a guest who finished the quiz
// before signing up), in which case it routes to those results instead of
// forcing a second, redundant quiz.
export default function OnboardingFlow() {
  const { user }        = useAuth()
  const { state, dispatch } = useApp()
  const { saveAesthetic }   = useExplore()
  const [finishing, setFinishing] = useState(false)

  async function handleComplete(answers) {
    // The last step advances on tile tap, so guard against a second tap
    // firing another Firestore write while the first is in flight.
    if (finishing) return
    setFinishing(true)
    const { warmStart } = await finalizeOnboardingAnswers({ user, answers, dispatch, saveAesthetic })
    if (state.authReturnTo === 'results') {
      dispatch({ type: 'SET_ONBOARDING_COMPLETE' })
    } else {
      dispatch({ type: 'GO_TO_QUIZ', warmStart })
    }
  }

  if (finishing) {
    return (
      <div className={styles.flow}>
        <div className={styles.finishing} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          <p className={styles.finishingText}>Saving your preferences…</p>
        </div>
      </div>
    )
  }

  return <PreferenceSteps onComplete={handleComplete} />
}
