import { useMemo, useState } from 'react'
import { STYLES } from '../data/styles'
import { useApp } from '../context/AppContext'
import { useExplore } from '../context/ExploreContext'
import { useNavigation } from '../context/NavigationContext'
import WardrobeRecapCard from '../components/WardrobeRecapCard'
import HeroCarousel from '../components/home/HeroCarousel'
import FreshLooksSection from '../components/home/FreshLooksSection'
import AestheticProfileCard from '../components/home/AestheticProfileCard'
import AestheticGrid, { HorizontalScroll } from '../components/home/AestheticGrid'
import WardrobeBuilderCTA from '../components/home/WardrobeBuilderCTA'
import GuideLauncher from '../components/home/GuideLauncher'
import DailyOutfitPreview from '../components/home/DailyOutfitPreview'
import GapCard from '../components/home/GapCard'
import BrandsForYou from '../components/home/BrandsForYou'
import styles from './HomeScreen.module.css'

const SEASON_PICKS = {
  winter: ['oldmoney', 'darkacademia', 'preppy', 'military', 'knitwearaesthetic', 'gorpcore'],
  spring: ['lightacademia', 'cottagecore', 'indie', 'minimalist', 'softboy', 'preppy'],
  summer: ['athleisure', 'streetwear', 'hiphop', 'techwear', 'normcore', 'vintage'],
  fall:   ['darkacademia', 'gorpcore', 'workwear', 'grunge', 'vintage', 'military'],
}

const TRENDING = ['preppy', 'y2k', 'techwear', 'indie', 'hiphop', 'skater', 'grunge', 'athleisure', 'edgy', 'scandi']

const SEASON_META = {
  winter: { icon: '❄️', label: 'Winter Picks',  sub: 'Layers, texture, warmth' },
  spring: { icon: '🌸', label: 'Spring Picks',  sub: 'Light layers, fresh palettes' },
  summer: { icon: '☀️', label: 'Summer Picks',  sub: 'Breathable, bold, bright' },
  fall:   { icon: '🍂', label: 'Fall Picks',    sub: 'Earth tones, rich textures' },
}

function getSeason() {
  const m = new Date().getMonth()
  if (m <= 1 || m === 11) return 'winter'
  if (m <= 4) return 'spring'
  if (m <= 7) return 'summer'
  return 'fall'
}

export default function HomeScreen({ startGuide }) {
  const navigate            = useNavigation()
  const { savedAesthetics } = useExplore()
  const { state }           = useApp()
  const gender              = state.gender
  const season              = getSeason()
  const meta                = SEASON_META[season]
  const [trendingKey, setTrendingKey] = useState(0)
  const isNewUser = !Object.values(state.styleScores).some(s => s > 0)

  const trendingIds = useMemo(() => {
    if (trendingKey === 0) return TRENDING
    const arr = [...TRENDING]
    let seed = trendingKey * 1664525 + 1013904223
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      const j = seed % (i + 1)
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [trendingKey])

  return (
    <div className={styles.screen}>
      {/* Monthly wardrobe recap — full-screen modal, shows at most once/month */}
      <WardrobeRecapCard />

      {/* Hero */}
      <HeroCarousel navigate={navigate} gender={gender} />

      <div className={styles.body}>
        {/* Daily AI outfit preview + closet CTA */}
        <DailyOutfitPreview navigate={navigate} gender={gender} />

        {/* Wardrobe gap card — "what should I buy next", dismissible */}
        <GapCard navigate={navigate} />

        {/* Guide tour — show at top for new users */}
        {startGuide && isNewUser && <GuideLauncher onStart={startGuide} />}

        {/* Fresh Looks Today — daily rotating content, main daily pull */}
        <FreshLooksSection gender={gender} navigate={navigate} />

        {/* Wardrobe Builder CTA */}
        <WardrobeBuilderCTA navigate={navigate} />

        {/* Live Aesthetic Profile — only appears once user has swiped */}
        <AestheticProfileCard navigate={navigate} gender={gender} />

        {/* Brands for you — appears once user has an aesthetic profile */}
        <BrandsForYou navigate={navigate} gender={gender} />

        {/* Saved aesthetics */}
        {savedAesthetics.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionIcon}>📌</span>
              <div>
                <h2 className={styles.sectionTitle}>Your Saved Aesthetics</h2>
                <p className={styles.sectionSub}>{savedAesthetics.length} pinned from Explore</p>
              </div>
            </div>
            <HorizontalScroll ids={savedAesthetics} navigate={navigate} gender={gender} />
          </section>
        )}

        {/* Season picks — only shown before user has personalised saves */}
        {savedAesthetics.length === 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionIcon}>{meta.icon}</span>
              <div>
                <h2 className={styles.sectionTitle}>{meta.label}</h2>
                <p className={styles.sectionSub}>{meta.sub}</p>
              </div>
            </div>
            <HorizontalScroll ids={SEASON_PICKS[season]} navigate={navigate} gender={gender} />
          </section>
        )}

        {/* Trending — 2-column grid instead of another carousel */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>🔥</span>
            <div style={{ flex: 1 }}>
              <h2 className={styles.sectionTitle}>Trending Now</h2>
              <p className={styles.sectionSub}>Styles gaining momentum</p>
            </div>
            <button
              className={styles.refreshBtn}
              onClick={() => setTrendingKey((k) => k + 1)}
              aria-label="Shuffle trending"
            >
              ↻
            </button>
          </div>
          <AestheticGrid ids={trendingIds.slice(0, 6)} navigate={navigate} gender={gender} />
        </section>

        {/* Guide tour — bottom position for returning users */}
        {startGuide && !isNewUser && <GuideLauncher onStart={startGuide} />}

        <button className={styles.exploreAllBtn} onClick={() => navigate('explore')}>
          Browse all {Object.keys(STYLES).length} aesthetics →
        </button>
      </div>
    </div>
  )
}
