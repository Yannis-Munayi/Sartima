import { createContext, useContext } from 'react'

const GuideContext = createContext(null)

export function GuideProvider({ children, value }) {
  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>
}

export function useGuide() {
  return useContext(GuideContext) ?? { isActive: false, currentStep: null, guideNext: () => {} }
}
