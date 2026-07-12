import { useEffect, useState } from 'react'
import { STYLES, getPinterestUrl, getStyleName } from '../data/styles'
import { fetchPhotosWithFallback } from '../services/pexels'
import { useExplore } from '../context/ExploreContext'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useNavigation } from '../context/NavigationContext'
import { recordSignal } from '../services/interestTracker'
import ItemsTab from './aestheticScreen/ItemsTab'
import LooksTab from './aestheticScreen/LooksTab'
import GuideTab from './aestheticScreen/GuideTab'
import StoryTab from './aestheticScreen/StoryTab'
import styles from './AestheticScreen.module.css'

const TABS = [
  { id: 'story', label: 'Story' },
  { id: 'items', label: 'Items' },
  { id: 'looks', label: 'Looks' },
  { id: 'guide', label: 'Guide' },
]

export default function AestheticScreen({ aestheticId, forceSubTab }) {
  const navigate = useNavigation()
  const { closeAestheticTab, saveAesthetic, unsaveAesthetic, isSaved } = useExplore()
  const { state } = useApp()
  const { user } = useAuth()
  const gender = state.gender
  const [subTab, setSubTab] = useState('story')
  const [heroBg, setHeroBg] = useState(null)

  // Record aesthetic visit interest signal
  useEffect(() => {
    if (user && aestheticId) {
      recordSignal(user, 'aestheticVisit', { aestheticId })
    }
  }, [aestheticId, user])

  const style = STYLES[aestheticId]
  const saved = isSaved(aestheticId)

  useEffect(() => {
    setSubTab('story')
  }, [aestheticId])

  useEffect(() => {
    if (forceSubTab) setSubTab(forceSubTab)
  }, [forceSubTab])

  useEffect(() => {
    setHeroBg(null)
    let cancelled = false
    const genderHint = gender === 'women' ? 'women' : gender === 'men' ? 'men' : ''
    const heroQueries = style?.backgroundQuery
      ? [style.backgroundQuery, style.outfitQuery, `${style.name} aesthetic`].filter(Boolean)
      : [
          `${style?.name ?? ''} ${genderHint} fashion aesthetic`.trim(),
          `${style?.name ?? ''} ${genderHint} fashion`.trim(),
          `${style?.name ?? ''} style`,
        ]
    fetchPhotosWithFallback(heroQueries, 1).then(([url] = []) => {
      if (!cancelled && url) setHeroBg(url)
    })
    return () => { cancelled = true }
  }, [aestheticId, gender])

  if (!style) return null

  function handleBack() {
    closeAestheticTab()
    navigate('explore')
  }

  function handleSaveToggle() {
    if (saved) unsaveAesthetic(aestheticId)
    else saveAesthetic(aestheticId)
  }

  const heroStyle = heroBg
    ? { backgroundImage: `url(${heroBg})`, backgroundSize: 'cover', backgroundPosition: 'center top' }
    : { background: style.gradient }

  return (
    <div className={styles.screen}>
      {/* ── Hero header ── */}
      <div className={styles.hero} style={heroStyle}>
        <div className={styles.heroOverlay} />

        <button className={styles.backBtn} onClick={handleBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          className={`${styles.saveBtn} ${saved ? styles.saveBtnActive : ''}`}
          onClick={handleSaveToggle}
          title={saved ? 'Unpin this tab' : 'Pin this tab'}
        >
          {saved ? '📌 Saved' : '+ Save tab'}
        </button>

        <div className={styles.heroContent}>
          <span className={styles.heroIcon}>{style.icon}</span>
          <h1 className={styles.heroName}>{getStyleName(style, gender)}</h1>
          <p className={styles.heroTagline}>{style.tagline}</p>
          {style.description && (
            <p className={styles.heroDesc}>{style.description}</p>
          )}
        </div>

        {/* Pinterest link */}
        <a
          href={getPinterestUrl(style, gender)}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.pinterestBtn}
        >
          📌 Pinterest
        </a>
      </div>

      {/* ── Sub-tab bar ── */}
      <div className={styles.subTabBar}>
        <div className={styles.subTabGroup}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.subTab} ${subTab === tab.id ? styles.subTabActive : ''}`}
              onClick={() => setSubTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className={styles.tabContent}>
        {subTab === 'story' && <StoryTab aestheticId={aestheticId} />}
        {subTab === 'items' && <ItemsTab aestheticId={aestheticId} />}
        {subTab === 'looks' && <LooksTab aestheticId={aestheticId} />}
        {subTab === 'guide' && <GuideTab aestheticId={aestheticId} />}
      </div>
    </div>
  )
}
