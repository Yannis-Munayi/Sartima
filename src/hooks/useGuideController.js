import { useEffect, useState } from 'react'
import { GUIDE_STEPS } from '../components/GuideTour'
import { SCREENS } from '../context/AppContext'

/**
 * Manages the onboarding guide tour state and navigation.
 * Extracted from AppShell to keep App.jsx focused on routing/layout.
 */
export function useGuideController({ state, dispatch, openAestheticTab, setActiveTab, setMyStyleSubTab }) {
  const [guideStep, setGuideStep] = useState(null)

  const currentGuideStep = guideStep !== null ? GUIDE_STEPS[guideStep] : null

  function navigateToTab(tab, step) {
    if (tab.startsWith('aesthetic:')) {
      openAestheticTab(tab.replace('aesthetic:', ''))
      setActiveTab(tab)
    } else {
      if (tab === 'mystyle' && step?.myStyleSubTab) setMyStyleSubTab(step.myStyleSubTab)
      setActiveTab(tab)
    }
  }

  function startGuide() {
    setGuideStep(0)
    setActiveTab('home')
  }

  function guideNext() {
    const next = guideStep + 1
    if (next >= GUIDE_STEPS.length) { setGuideStep(null); return }
    const nextStep = GUIDE_STEPS[next]
    const curStep  = GUIDE_STEPS[guideStep]
    setGuideStep(next)
    if (nextStep.tab !== curStep.tab) {
      navigateToTab(nextStep.tab, nextStep)
    } else if (nextStep.tab === 'mystyle' && nextStep.myStyleSubTab) {
      setMyStyleSubTab(nextStep.myStyleSubTab)
    }
  }

  function guideBack() {
    const prev = guideStep - 1
    if (prev < 0) return
    const prevStep = GUIDE_STEPS[prev]
    const curStep  = GUIDE_STEPS[guideStep]
    setGuideStep(prev)
    if (prevStep.tab !== curStep.tab) {
      navigateToTab(prevStep.tab, prevStep)
    } else if (prevStep.tab === 'mystyle' && prevStep.myStyleSubTab) {
      setMyStyleSubTab(prevStep.myStyleSubTab)
    }
  }

  function guideSkip() {
    if (state.screen === SCREENS.SEASONS || state.screen === SCREENS.CATEGORIES) {
      dispatch({ type: 'GO_TO_WELCOME' })
    }
    setGuideStep(null)
  }

  // When a step requires a specific quiz screen, drive the state machine
  useEffect(() => {
    if (guideStep === null) return
    const step = GUIDE_STEPS[guideStep]
    if (step.forceScreen === 'seasons') {
      dispatch({ type: 'GO_TO_SEASONS' })
      setActiveTab('quiz')
    }
  }, [guideStep, dispatch, setActiveTab])

  const guideContextValue = {
    isActive:      guideStep !== null,
    currentStep:   currentGuideStep,
    guideNext,
    forceSeason:   currentGuideStep?.forceSeason   ?? null,
    forceCategory: currentGuideStep?.forceCategory ?? null,
  }

  return { guideStep, startGuide, guideNext, guideBack, guideSkip, guideContextValue }
}
