import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useExplore } from '../../context/ExploreContext'
import PreferenceSteps from './PreferenceSteps'
import { finalizeOnboardingAnswers } from './finalizeAnswers'

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

  async function handleComplete(answers) {
    const { warmStart } = await finalizeOnboardingAnswers({ user, answers, dispatch, saveAesthetic })
    if (state.authReturnTo === 'results') {
      dispatch({ type: 'SET_ONBOARDING_COMPLETE' })
    } else {
      dispatch({ type: 'GO_TO_QUIZ', warmStart })
    }
  }

  return <PreferenceSteps onComplete={handleComplete} />
}
