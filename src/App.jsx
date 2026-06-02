import { useEffect, useRef, useState } from 'react'
import { AppProvider, useApp, SCREENS } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ShopProvider } from './context/ShopContext'
import { WishlistProvider } from './context/WishlistContext'
import { ExploreProvider, useExplore } from './context/ExploreContext'
import { ClosetProvider } from './context/ClosetContext'
import { doc, getDoc } from 'firebase/firestore'
import { db } from './services/firebase'
import HomeScreen      from './screens/HomeScreen'
import WelcomeScreen   from './screens/WelcomeScreen'
import SeasonScreen    from './screens/SeasonScreen'
import CategoryScreen  from './screens/CategoryScreen'
import DiscoveryScreen from './screens/DiscoveryScreen'
import ResultsScreen   from './screens/ResultsScreen'
import AuthScreen      from './screens/AuthScreen'
import ProfileScreen   from './screens/ProfileScreen'
import MyStyleScreen   from './screens/MyStyleScreen'
import ExploreScreen   from './screens/ExploreScreen'
import AestheticScreen from './screens/AestheticScreen'
import WardrobeBuildScreen from './screens/WardrobeBuildScreen'
import ClosetScreen    from './screens/ClosetScreen'
import DailyLookScreen from './screens/DailyLookScreen'
import OnboardingFlow  from './screens/onboarding/OnboardingFlow'
import TabBar          from './components/TabBar'
import GuideTour, { GUIDE_STEPS } from './components/GuideTour'
import Toast           from './components/Toast'
import { GuideProvider } from './context/GuideContext'

// Screens where the tab bar is hidden (focused setup flow)
const HIDE_TABS_ON = new Set([
  SCREENS.AUTH,
  SCREENS.ONBOARDING,
  SCREENS.SEASONS,
  SCREENS.CATEGORIES,
])

function QuizRouter({ setActiveTab }) {
  const { state } = useApp()
  switch (state.screen) {
    case SCREENS.AUTH:        return <AuthScreen />
    case SCREENS.WELCOME:     return <WelcomeScreen />
    case SCREENS.ONBOARDING:  return <OnboardingFlow />
    case SCREENS.SEASONS:     return <SeasonScreen />
    case SCREENS.CATEGORIES:  return <CategoryScreen />
    case SCREENS.DISCOVERY:   return <DiscoveryScreen />
    case SCREENS.RESULTS:     return <ResultsScreen setActiveTab={setActiveTab} />
    case SCREENS.PROFILE:     return <ProfileScreen />
    default:                  return <WelcomeScreen />
  }
}

function ResumeModal({ progress, total, onContinue, onRestart }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: '#1a1a1a',
        borderRadius: '20px 20px 0 0',
        padding: '28px 24px 40px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '0 auto 24px' }} />
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>
          Continue your session?
        </h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', margin: '0 0 28px', lineHeight: 1.6 }}>
          You've rated <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{progress} of {total}</strong> items.
          Pick up where you left off, or start fresh.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onRestart}
            style={{
              flex: 1, padding: '13px 0',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12, color: 'rgba(255,255,255,0.6)',
              fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            Start fresh
          </button>
          <button
            onClick={onContinue}
            style={{
              flex: 1, padding: '13px 0',
              background: 'linear-gradient(135deg, #E8735A, #D4896A)',
              border: 'none',
              borderRadius: 12, color: '#fff',
              fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  )
}

function AppShell() {
  const { state, dispatch } = useApp()
  const { user }            = useAuth()
  const { openAesthetic, openAestheticTab } = useExplore()
  const [activeTab, setActiveTab]           = useState('home')
  const [myStyleSubTab, setMyStyleSubTab]   = useState(null)
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [guideStep, setGuideStep]           = useState(null)
  const prevUserRef = useRef(user)

  const showTabs = !HIDE_TABS_ON.has(state.screen)

  // Keep activeTab in sync when the quiz flow enters DISCOVERY
  useEffect(() => {
    if (state.screen === SCREENS.DISCOVERY) {
      setActiveTab('quiz')
    }
  }, [state.screen])

  // When the user signs out, reset to home tab so ProfileScreen doesn't linger
  useEffect(() => {
    const wasSignedIn = prevUserRef.current !== null
    prevUserRef.current = user
    if (wasSignedIn && !user) {
      setActiveTab('home')
    }
  }, [user])

  // After a new sign-in, check whether onboarding has been completed
  const onboardingCheckedRef = useRef(false)
  useEffect(() => {
    if (!user || onboardingCheckedRef.current) return
    onboardingCheckedRef.current = true
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      if (snap.exists() && snap.data().onboardingComplete) return
      dispatch({ type: 'GO_TO_ONBOARDING' })
    }).catch(() => {})
  }, [user])

  // A session is "in progress" when the discovery queue is loaded and the
  // user has left the quiz tab (so they can be offered to resume).
  const sessionInProgress =
    state.screen === SCREENS.DISCOVERY && activeTab !== 'quiz'

  // Answered count for the modal
  const answeredCount = Object.keys(state.responses).length

  function startGuide() {
    setGuideStep(0)
    setActiveTab('home')
  }

  function navigateGuideTab(tab, step) {
    if (tab.startsWith('aesthetic:')) {
      const id = tab.replace('aesthetic:', '')
      openAestheticTab(id)
      setActiveTab(tab)
    } else {
      if (tab === 'mystyle' && step?.myStyleSubTab) {
        setMyStyleSubTab(step.myStyleSubTab)
      }
      setActiveTab(tab)
    }
  }

  function guideNext() {
    const next = guideStep + 1
    if (next >= GUIDE_STEPS.length) { setGuideStep(null); return }
    setGuideStep(next)
    const nextStep = GUIDE_STEPS[next]
    const curStep  = GUIDE_STEPS[guideStep]
    if (nextStep.tab !== curStep.tab) {
      navigateGuideTab(nextStep.tab, nextStep)
    } else if (nextStep.tab === 'mystyle' && nextStep.myStyleSubTab) {
      setMyStyleSubTab(nextStep.myStyleSubTab)
    }
  }

  function guideBack() {
    const prev = guideStep - 1
    if (prev < 0) return
    setGuideStep(prev)
    const prevStep = GUIDE_STEPS[prev]
    const curStep  = GUIDE_STEPS[guideStep]
    if (prevStep.tab !== curStep.tab) {
      navigateGuideTab(prevStep.tab, prevStep)
    } else if (prevStep.tab === 'mystyle' && prevStep.myStyleSubTab) {
      setMyStyleSubTab(prevStep.myStyleSubTab)
    }
  }

  function guideSkip() {
    // If we're mid-quiz-setup, reset so the user isn't stuck on season/category screens
    if (state.screen === SCREENS.SEASONS || state.screen === SCREENS.CATEGORIES) {
      dispatch({ type: 'GO_TO_WELCOME' })
    }
    setGuideStep(null)
  }

  // When a guide step requires a specific quiz screen, dispatch the transition
  useEffect(() => {
    if (guideStep === null) return
    const step = GUIDE_STEPS[guideStep]
    if (step.forceScreen === 'seasons') {
      dispatch({ type: 'GO_TO_SEASONS' })
      setActiveTab('quiz')
    }
  }, [guideStep])

  function handleTabChange(tabId) {
    if (tabId === 'quiz' && sessionInProgress) {
      setShowResumeModal(true)
      return
    }
    // Auto-start the infinite feed on first Discover tap — no season/category gates
    // Don't override if quiz mode was explicitly started
    if (tabId === 'quiz' && state.screen === SCREENS.WELCOME && !state.quizMode) {
      dispatch({ type: 'GO_TO_DISCOVERY_DIRECT' })
      setActiveTab('quiz')
      return
    }
    if (tabId.startsWith('aesthetic:')) {
      const id = tabId.replace('aesthetic:', '')
      openAestheticTab(id)
      setActiveTab(tabId)
      return
    }
    if (tabId.startsWith('mystyle:')) {
      setMyStyleSubTab(tabId.replace('mystyle:', ''))
      setActiveTab('mystyle')
      return
    }
    if (tabId === 'mystyle') {
      setMyStyleSubTab(null)
    }
    if (tabId.startsWith('closet:')) {
      setMyStyleSubTab(tabId.replace('closet:', ''))
      setActiveTab('closet')
      return
    }
    setActiveTab(tabId)
  }

  function handleContinue() {
    setShowResumeModal(false)
    setActiveTab('quiz')
  }

  function handleRestart() {
    setShowResumeModal(false)
    dispatch({ type: 'GO_TO_DISCOVERY_DIRECT' })
    setActiveTab('quiz')
  }

  const isAestheticTab = activeTab.startsWith('aesthetic:')
  const aestheticId    = isAestheticTab ? activeTab.replace('aesthetic:', '') : null

  const currentGuideStep  = guideStep !== null ? GUIDE_STEPS[guideStep] : null
  const guideForceSubTab  = currentGuideStep?.subTab ?? null

  const guideContextValue = {
    isActive:      guideStep !== null,
    currentStep:   currentGuideStep,
    guideNext,
    forceSeason:   currentGuideStep?.forceSeason   ?? null,
    forceCategory: currentGuideStep?.forceCategory ?? null,
  }

  return (
    <GuideProvider value={guideContextValue}>
    <div style={{ paddingBottom: showTabs ? 64 : 0 }}>
      {/* Quiz flow */}
      {(!showTabs || activeTab === 'quiz') && <QuizRouter setActiveTab={handleTabChange} />}

      {/* Main tabs */}
      {showTabs && activeTab === 'home' && (
        <HomeScreen setActiveTab={handleTabChange} startGuide={startGuide} />
      )}
      {showTabs && activeTab === 'explore' && (
        <ExploreScreen setActiveTab={handleTabChange} />
      )}
      {showTabs && activeTab === 'wardrobe-builder' && (
        <WardrobeBuildScreen onBack={() => handleTabChange('home')} />
      )}
      {showTabs && isAestheticTab && (
        <AestheticScreen
          aestheticId={aestheticId ?? openAesthetic}
          setActiveTab={handleTabChange}
          forceSubTab={guideForceSubTab}
        />
      )}
      {showTabs && activeTab === 'mystyle' && (
        <MyStyleScreen forceSubTab={myStyleSubTab} />
      )}
      {showTabs && activeTab === 'closet' && (
        <ClosetScreen setActiveTab={handleTabChange} />
      )}
      {showTabs && activeTab === 'daily' && (
        <DailyLookScreen setActiveTab={handleTabChange} />
      )}
      {showTabs && activeTab === 'profile'  && (
        <ProfileScreen onBack={() => handleTabChange('quiz')} />
      )}

      {showTabs && (
        <TabBar activeTab={activeTab} setActiveTab={handleTabChange} />
      )}

      {/* Interactive guide tour */}
      {guideStep !== null && (
        <GuideTour
          step={guideStep}
          onNext={guideNext}
          onBack={guideBack}
          onSkip={guideSkip}
        />
      )}

      {/* Resume / restart modal */}
      {showResumeModal && (
        <ResumeModal
          progress={answeredCount}
          total={state.itemQueue.length}
          onContinue={handleContinue}
          onRestart={handleRestart}
        />
      )}

      <Toast />
    </div>
    </GuideProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <ShopProvider>
          <WishlistProvider>
            <ClosetProvider>
              <ExploreProvider>
                <AppShell />
              </ExploreProvider>
            </ClosetProvider>
          </WishlistProvider>
        </ShopProvider>
      </AppProvider>
    </AuthProvider>
  )
}
