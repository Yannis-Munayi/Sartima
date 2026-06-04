import { useState } from 'react'
import { GUIDE_STEPS } from '../components/GuideTour'

export function useGuideController({ openAestheticTab, setActiveTab }) {
  const [guideStep, setGuideStep] = useState(null)

  function navigateToTab(tab) {
    if (tab.startsWith('aesthetic:')) {
      openAestheticTab(tab.replace('aesthetic:', ''))
    }
    setActiveTab(tab)
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
    if (nextStep.tab !== curStep.tab) navigateToTab(nextStep.tab)
  }

  function guideBack() {
    const prev = guideStep - 1
    if (prev < 0) return
    const prevStep = GUIDE_STEPS[prev]
    const curStep  = GUIDE_STEPS[guideStep]
    setGuideStep(prev)
    if (prevStep.tab !== curStep.tab) navigateToTab(prevStep.tab)
  }

  function guideSkip() {
    setGuideStep(null)
  }

  const guideContextValue = {
    isActive:    guideStep !== null,
    currentStep: guideStep !== null ? GUIDE_STEPS[guideStep] : null,
    guideNext,
  }

  return { guideStep, startGuide, guideNext, guideBack, guideSkip, guideContextValue }
}
