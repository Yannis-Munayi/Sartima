import { useMemo, useState } from 'react'
import { GUIDE_ORDER, GUIDES } from '../data/guideSteps'

function flattenFull(showQuizTab) {
  return GUIDE_ORDER
    .filter((key) => showQuizTab || key !== 'quiz')
    .flatMap((key) => GUIDES[key].map((step) => ({ ...step, guideKey: key })))
}

export function useGuideController({ handleTabChange, showQuizTab }) {
  const [activeGuideKey, setActiveGuideKey] = useState(null) // one of GUIDE_ORDER, or 'full'
  const [guideStep, setGuideStep]           = useState(null) // index into activeSteps

  const activeSteps = useMemo(() => {
    if (activeGuideKey === 'full') return flattenFull(showQuizTab)
    if (activeGuideKey == null)    return []
    return GUIDES[activeGuideKey].map((step) => ({ ...step, guideKey: activeGuideKey }))
  }, [activeGuideKey, showQuizTab])

  function startGuide(key = 'full') {
    setActiveGuideKey(key)
    setGuideStep(0)
    const steps = key === 'full' ? flattenFull(showQuizTab) : GUIDES[key]
    handleTabChange(steps[0].tab)
  }

  function guideNext() {
    const next = guideStep + 1
    if (next >= activeSteps.length) { setGuideStep(null); setActiveGuideKey(null); return }
    const nextStep = activeSteps[next]
    const curStep  = activeSteps[guideStep]
    setGuideStep(next)
    if (nextStep.tab !== curStep.tab) handleTabChange(nextStep.tab)
  }

  function guideBack() {
    const prev = guideStep - 1
    if (prev < 0) return
    const prevStep = activeSteps[prev]
    const curStep  = activeSteps[guideStep]
    setGuideStep(prev)
    if (prevStep.tab !== curStep.tab) handleTabChange(prevStep.tab)
  }

  function guideSkip() {
    setGuideStep(null)
    setActiveGuideKey(null)
  }

  const guideContextValue = {
    isActive:    guideStep !== null,
    currentStep: guideStep !== null ? activeSteps[guideStep] : null,
    activeGuideKey,
    isFullTour:  activeGuideKey === 'full',
    guideNext,
  }

  return { guideStep, activeSteps, startGuide, guideNext, guideBack, guideSkip, guideContextValue }
}
