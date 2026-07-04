import { useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia('(min-width: 768px)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isDesktop
}
import { clearQuizProgress } from './hooks/useDiscoveryQueue'
import { useGuideController } from './hooks/useGuideController'
import { AppProvider, useApp, useTheme, useShowQuizTab, SCREENS } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NavigationProvider } from './context/NavigationContext'
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
import SearchScreen    from './screens/SearchScreen'
import AestheticScreen from './screens/AestheticScreen'
import WardrobeBuildScreen from './screens/WardrobeBuildScreen'
import DailyLookScreen from './screens/DailyLookScreen'
import OnboardingFlow  from './screens/onboarding/OnboardingFlow'
import TabBar          from './components/TabBar'
import GuideTour from './components/GuideTour'
import GuideLauncherButton from './components/GuideLauncherButton'
import Toast           from './components/Toast'
import PaywallModal    from './components/PaywallModal'
import { GuideProvider } from './context/GuideContext'
import { SubscriptionProvider } from './context/SubscriptionContext'
import { InterestProvider } from './context/InterestContext'
import BrandScreen  from './screens/BrandScreen'
import BrandsScreen from './screens/BrandsScreen'

// Screens where the tab bar is hidden (focused setup flow)
const HIDE_TABS_ON = new Set([
  SCREENS.AUTH,
  SCREENS.ONBOARDING,
  SCREENS.SEASONS,
  SCREENS.CATEGORIES,
])

function QuizRouter() {
  const { state } = useApp()
  switch (state.screen) {
    case SCREENS.AUTH:        return <AuthScreen />
    case SCREENS.WELCOME:     return <WelcomeScreen />
    case SCREENS.ONBOARDING:  return <OnboardingFlow />
    case SCREENS.SEASONS:     return <SeasonScreen />
    case SCREENS.CATEGORIES:  return <CategoryScreen />
    case SCREENS.DISCOVERY:   return <DiscoveryScreen />
    case SCREENS.RESULTS:     return <ResultsScreen />
    case SCREENS.PROFILE:     return <ProfileScreen />
    default:                  return <WelcomeScreen />
  }
}

function ResumeModal({ progress, total, onContinue, onDiscover }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'var(--bg-elevated)',
        borderRadius: '8px 8px 0 0',
        padding: '28px 24px 40px',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{ width: 28, height: 2, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '0 auto 28px' }} />
        <h2 style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px', letterSpacing: '0.01em' }}>
          Quiz in progress
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 28px', lineHeight: 1.65 }}>
          You've rated <strong style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{progress} of {total}</strong> items.
          Continue the quiz to get your results, or switch to free discovery.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onDiscover}
            style={{
              flex: 1, padding: '13px 0',
              background: 'transparent',
              border: '1px solid var(--border-strong)',
              borderRadius: 4, color: 'var(--text-muted)',
              fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
              letterSpacing: '1.5px', textTransform: 'uppercase',
            }}
          >
            Just Discover
          </button>
          <button
            onClick={onContinue}
            style={{
              flex: 1, padding: '13px 0',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 4, color: '#0B0907',
              fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
              letterSpacing: '1.5px', textTransform: 'uppercase',
            }}
          >
            Continue Quiz
          </button>
        </div>
      </div>
    </div>
  )
}

function AppShell() {
  const { state, dispatch } = useApp()
  const { user }            = useAuth()
  useTheme()
  const { openAesthetic, openAestheticTab, openBrand, openBrandTab } = useExplore()
  const { showQuizTab }                     = useShowQuizTab()
  const [activeTab, setActiveTab]           = useState('home')
  const [myStyleSubTab, setMyStyleSubTab]   = useState(null)
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [profileScrollTarget, setProfileScrollTarget] = useState(null)
  const [wardrobeBuilderPiece, setWardrobeBuilderPiece]           = useState(null)
  const [wardrobeBuilderSpecificName, setWardrobeBuilderSpecificName] = useState(null)
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

  // Only intercept navigation when a finite quiz is in progress
  const sessionInProgress =
    state.quizMode && state.screen === SCREENS.DISCOVERY && activeTab !== 'quiz'

  // Answered count for the modal
  const answeredCount = Object.keys(state.responses).length

  const { guideStep, activeSteps, startGuide, guideNext, guideBack, guideSkip, guideContextValue } = useGuideController({
    handleTabChange, showQuizTab,
  })
  const isDesktop = useIsDesktop()

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
    if (tabId.startsWith('brand:')) {
      const id = tabId.replace('brand:', '')
      openBrandTab(id, activeTab)
      setActiveTab(tabId)
      return
    }
    if (tabId === 'wardrobe-builder') {
      setWardrobeBuilderPiece(null)
      setWardrobeBuilderSpecificName(null)
      setActiveTab('wardrobe-builder')
      return
    }
    if (tabId.startsWith('wardrobe-builder:')) {
      const rest     = tabId.slice('wardrobe-builder:'.length)
      const pipeIdx  = rest.indexOf('|')
      const pieceId  = pipeIdx >= 0 ? rest.slice(0, pipeIdx) : rest
      const specific = pipeIdx >= 0 ? rest.slice(pipeIdx + 1) : null
      setWardrobeBuilderPiece(pieceId || null)
      setWardrobeBuilderSpecificName(specific || null)
      setActiveTab('wardrobe-builder')
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
      setActiveTab('daily')
      return
    }
    if (tabId === 'profile:quiz-history') {
      setProfileScrollTarget('quiz-history')
      setActiveTab('profile')
      return
    }
    setActiveTab(tabId)
  }

  function handleContinue() {
    setShowResumeModal(false)
    setActiveTab('quiz')
  }

  function handleDiscover() {
    setShowResumeModal(false)
    clearQuizProgress()
    dispatch({ type: 'GO_TO_DISCOVERY_DIRECT' })
    setActiveTab('quiz')
  }

  const isAestheticTab   = activeTab.startsWith('aesthetic:')
  const aestheticId      = isAestheticTab ? activeTab.replace('aesthetic:', '') : null
  const isBrandTab       = activeTab.startsWith('brand:')
  const brandTabId       = isBrandTab ? activeTab.replace('brand:', '') : null
  const guideForceSubTab = guideContextValue.currentStep?.subTab ?? null
  const guideForcedQuery = guideContextValue.currentStep?.forcedQuery ?? null

  const outerStyle = isDesktop
    ? { display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--bg)' }
    : { paddingBottom: showTabs ? 64 : 0 }

  const mainStyle = isDesktop
    ? { flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }
    : {}

  return (
    <NavigationProvider navigate={handleTabChange}>
    <GuideProvider value={guideContextValue}>
    <div style={outerStyle}>
      {/* Desktop sidebar — only shown once main tabs are visible */}
      {isDesktop && showTabs && (
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      )}

      {/* Scrollable content area */}
      <div style={mainStyle}>
        {/* Quiz flow */}
        {(!showTabs || activeTab === 'quiz') && <QuizRouter />}

        {/* Main tabs */}
        {showTabs && activeTab === 'home' && (
          <HomeScreen startGuide={startGuide} />
        )}
        {showTabs && activeTab === 'explore' && (
          <ExploreScreen />
        )}
        {showTabs && activeTab === 'brands' && (
          <BrandsScreen />
        )}
        {showTabs && activeTab === 'search' && (
          <SearchScreen forcedQuery={guideForcedQuery} />
        )}
        {showTabs && activeTab === 'wardrobe-builder' && (
          <WardrobeBuildScreen
            onBack={() => handleTabChange('home')}
            initialPiece={wardrobeBuilderPiece}
            initialSpecificName={wardrobeBuilderSpecificName}
          />
        )}
        {showTabs && isAestheticTab && (
          <AestheticScreen
            aestheticId={aestheticId ?? openAesthetic}
            forceSubTab={guideForceSubTab}
          />
        )}
        {showTabs && isBrandTab && (
          <BrandScreen brandId={brandTabId ?? openBrand} forceSubTab={guideForceSubTab} />
        )}
        {showTabs && activeTab === 'mystyle' && (
          <MyStyleScreen forceSubTab={myStyleSubTab} />
        )}
        {showTabs && activeTab === 'daily' && (
          <DailyLookScreen forceSubTab={guideForceSubTab} />
        )}
        {showTabs && activeTab === 'profile' && (
          <ProfileScreen
            onBack={() => handleTabChange('quiz')}
            scrollToQuiz={profileScrollTarget === 'quiz-history'}
            onScrollComplete={() => setProfileScrollTarget(null)}
          />
        )}

        {/* Mobile tab bar — hidden on desktop */}
        {!isDesktop && showTabs && (
          <TabBar activeTab={activeTab} setActiveTab={handleTabChange} />
        )}

        {/* Floating context-aware guide launcher */}
        {showTabs && !guideContextValue.isActive && (
          <GuideLauncherButton activeTab={activeTab} onLaunch={startGuide} />
        )}

        {/* Interactive guide tour */}
        {guideStep !== null && (
          <GuideTour
            step={guideStep}
            steps={activeSteps}
            isFullTour={guideContextValue.isFullTour}
            onNext={guideNext}
            onBack={guideBack}
            onSkip={guideSkip}
          />
        )}

        {/* Resume / restart modal */}
        {showResumeModal && (
          <ResumeModal
            progress={answeredCount}
            total={40}
            onContinue={handleContinue}
            onDiscover={handleDiscover}
          />
        )}

        <Toast />
        <PaywallModal />
      </div>
    </div>
    </GuideProvider>
    </NavigationProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
      <InterestProvider>
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
      </InterestProvider>
      </SubscriptionProvider>
    </AuthProvider>
  )
}
