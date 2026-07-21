import { useEffect, useState } from 'react'
import GenderStep from './GenderStep'
import AestheticsStep from './AestheticsStep'
import BrandsStep from './BrandsStep'
import MissingItemsStep from './MissingItemsStep'
import GoalStep from './GoalStep'
import OccasionStep from './OccasionStep'
import OccupationStep from './OccupationStep'
import flowStyles from './OnboardingFlow.module.css'

export const PREFERENCE_STEP_COUNT = 7

export const INITIAL_PREFERENCE_ANSWERS = {
  gender: 'both',
  aesthetics: [],
  brands: [],
  missing: [],
  goal: '',
  occasion: '',
  occupation: '',
}

// Shared gender/aesthetics/brands/missing-items/goal/occasion/occupation
// sequence, reused pre-auth (SignupFlow, embedded inside a 10-step bar) and
// post-auth (OnboardingFlow, standalone with its own 7-dot chrome — Google
// sign-ins and legacy accounts skip straight here since they already have
// an account).
export default function PreferenceSteps({
  embedded = false,
  initialStep = 0,
  initialAnswers = INITIAL_PREFERENCE_ANSWERS,
  onComplete,
  onStepChange,
}) {
  // `initialStep`/`initialAnswers` only matter on first mount — they let a
  // parent that unmounts/remounts this (SignupFlow, when bouncing to the
  // "Log in" view and back) restore progress instead of resetting to step 0.
  const [step, setStep]       = useState(initialStep)
  const [answers, setAnswers] = useState(initialAnswers)

  useEffect(() => {
    onStepChange?.(step, answers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, answers])

  // `patch` carries a just-selected value straight into the completion
  // payload — reading it back off `answers` state here would race, since
  // setAnswers hasn't re-rendered yet when a single-select step calls this
  // synchronously after its own setter.
  function advance(patch) {
    const next = patch ? { ...answers, ...patch } : answers
    if (patch) setAnswers(next)
    if (step >= PREFERENCE_STEP_COUNT - 1) {
      onComplete(next)
      return
    }
    setStep((s) => s + 1)
  }

  function select(key) {
    return (updater) =>
      setAnswers((prev) => ({
        ...prev,
        [key]: typeof updater === 'function' ? updater(prev[key]) : updater,
      }))
  }

  const content = (
    <>
      {step === 0 && (
        <GenderStep
          value={answers.gender}
          onSelect={(v) => advance({ gender: v })}
          onSkip={() => advance()}
        />
      )}
      {step === 1 && (
        <AestheticsStep
          selected={answers.aesthetics}
          gender={answers.gender}
          onSelect={select('aesthetics')}
          onNext={() => advance()}
          onSkip={() => advance()}
        />
      )}
      {step === 2 && (
        <BrandsStep
          selected={answers.brands}
          onSelect={select('brands')}
          onNext={() => advance()}
          onSkip={() => advance()}
        />
      )}
      {step === 3 && (
        <MissingItemsStep
          selected={answers.missing}
          onSelect={select('missing')}
          onNext={() => advance()}
          onSkip={() => advance()}
        />
      )}
      {step === 4 && (
        <GoalStep
          value={answers.goal}
          onSelect={(v) => advance({ goal: v })}
          onSkip={() => advance()}
        />
      )}
      {step === 5 && (
        <OccasionStep
          value={answers.occasion}
          onSelect={(v) => advance({ occasion: v })}
          onSkip={() => advance()}
        />
      )}
      {step === 6 && (
        <OccupationStep
          value={answers.occupation}
          onSelect={(v) => advance({ occupation: v })}
          onSkip={() => advance()}
        />
      )}
    </>
  )

  if (embedded) return content

  return (
    <div className={flowStyles.flow}>
      <div className={flowStyles.dots}>
        {Array.from({ length: PREFERENCE_STEP_COUNT }).map((_, i) => (
          <span key={i} className={`${flowStyles.dot} ${i <= step ? flowStyles.dotActive : ''}`} />
        ))}
      </div>
      {content}
      <button className={flowStyles.skipAll} onClick={() => onComplete(answers)}>
        Skip all →
      </button>
    </div>
  )
}
