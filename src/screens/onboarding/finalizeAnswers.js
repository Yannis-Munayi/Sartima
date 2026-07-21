import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { recordSignal } from '../../services/interestTracker'
import { BRANDS } from '../../data/brands'

const BRAND_NAME_TO_ID = Object.fromEntries(
  Object.values(BRANDS).map((b) => [b.name, b.id])
)

// Boost weights mirror the existing aestheticPin (+5) / brandFavorite (+5)
// interest signals so the warm-started quiz and the persisted interest graph
// agree on how strongly onboarding answers should count.
const AESTHETIC_BOOST     = 5
const BRAND_BOOST         = 5
const MISSING_CATEGORY_BOOST = 4

// Applies the answers collected by PreferenceSteps: writes the profile
// fields to Firestore, persists aesthetic pins + brand interest signals for
// long-term personalization, seeds the default-occasion setting, and applies
// the gender preference. Returns a `warmStart` object for the caller to hand
// to a `GO_TO_QUIZ` dispatch — callers own that dispatch themselves since the
// post-auth OnboardingFlow needs to branch on `authReturnTo` first.
export async function finalizeOnboardingAnswers({ user, answers, dispatch, saveAesthetic }) {
  try {
    await setDoc(doc(db, 'users', user.uid), {
      occupation:         answers.occupation,
      preferredBrands:    answers.brands,
      missingCategories:  answers.missing,
      fashionGoal:        answers.goal,
      occasionFocus:      answers.occasion,
      onboardingComplete: true,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  } catch {
    // non-fatal — still proceed into the app
  }

  for (const aestheticId of answers.aesthetics) saveAesthetic(aestheticId)

  for (const brandName of answers.brands) {
    recordSignal(user, 'brandFavorite', { brandName })
    const brandId = BRAND_NAME_TO_ID[brandName]
    if (brandId) recordSignal(user, 'brandVisit', { brandId })
  }

  if (answers.occasion) {
    try {
      localStorage.setItem('sartima_default_occasion', answers.occasion)
    } catch {
      // non-fatal — the default-occasion setting just stays unset
    }
  }

  dispatch({ type: 'SET_GENDER', gender: answers.gender })

  return {
    warmStart: {
      styleAffinities:      Object.fromEntries(answers.aesthetics.map((id) => [id, AESTHETIC_BOOST])),
      brandAffinities:      Object.fromEntries(answers.brands.map((name) => [name, BRAND_BOOST])),
      parentTypeAffinities: Object.fromEntries(answers.missing.map((cat) => [cat, MISSING_CATEGORY_BOOST])),
    },
  }
}
