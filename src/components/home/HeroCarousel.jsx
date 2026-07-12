import { useEffect, useRef, useState } from 'react'
import { STYLES, getStyleName } from '../../data/styles'
import { fetchPhotosWithFallback } from '../../services/pexels'
import AuthWidget from '../AuthWidget'
import styles from '../../screens/HomeScreen.module.css'

const HERO_SLIDE_IDS = ['oldmoney', 'darkacademia', 'streetwear', 'gorpcore', 'minimalist']

export default function HeroCarousel({ navigate, gender }) {
  const [photos, setPhotos]       = useState(new Array(HERO_SLIDE_IDS.length).fill(null))
  const [activeIdx, setActiveIdx] = useState(0)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [arrowsVisible, setArrowsVisible] = useState(true)
  const timerRef      = useRef(null)
  const arrowTimerRef = useRef(null)
  const touchStartX   = useRef(null)

  function resetArrowTimer() {
    setArrowsVisible(true)
    clearTimeout(arrowTimerRef.current)
    arrowTimerRef.current = setTimeout(() => setArrowsVisible(false), 3000)
  }

  useEffect(() => {
    setPhotos(new Array(HERO_SLIDE_IDS.length).fill(null))
    const hint = gender === 'women' ? 'women' : gender === 'men' ? 'men' : ''
    HERO_SLIDE_IDS.forEach((id, i) => {
      const s = STYLES[id]
      if (!s) return
      const name = getStyleName(s, gender)
      fetchPhotosWithFallback([
        ...(s.outfitQuery ? [s.outfitQuery] : []),
        `${name} ${hint} fashion aesthetic`.trim(),
        `${name} ${hint} outfit`.trim(),
        `${name} fashion`,
      ], 1).then(([url] = []) => {
        setPhotos((prev) => { const next = [...prev]; next[i] = url ?? null; return next })
        if (i === 0) setImgLoaded(false)
      })
    })
  }, [gender])

  function startTimer() {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setActiveIdx((i) => (i + 1) % HERO_SLIDE_IDS.length)
      setImgLoaded(false)
    }, 5000)
  }

  useEffect(() => {
    startTimer()
    resetArrowTimer()
    return () => {
      clearInterval(timerRef.current)
      clearTimeout(arrowTimerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function goTo(i) {
    setActiveIdx(i)
    setImgLoaded(false)
    startTimer()
    resetArrowTimer()
  }

  function onHeroTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    resetArrowTimer()
  }

  function onHeroTouchEnd(e) {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(delta) > 50) {
      const newIdx = delta < 0
        ? (activeIdx + 1) % HERO_SLIDE_IDS.length
        : (activeIdx - 1 + HERO_SLIDE_IDS.length) % HERO_SLIDE_IDS.length
      goTo(newIdx)
    }
  }

  const slideId = HERO_SLIDE_IDS[activeIdx]
  const style   = STYLES[slideId]
  const photo   = photos[activeIdx]

  return (
    <div className={styles.hero} onTouchStart={onHeroTouchStart} onTouchEnd={onHeroTouchEnd}>
      <div className={styles.heroBg} style={{ background: style?.gradient ?? '#1a1a1a' }}>
        {photo && (
          <img
            key={photo}
            src={photo}
            alt={style?.name}
            className={styles.heroImg}
            style={{ opacity: imgLoaded ? 1 : 0 }}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgLoaded(true)}
          />
        )}
      </div>
      <div className={styles.heroOverlay} />

      <div className={styles.heroTopBar}>
        <span className={styles.heroWordmark}>Sartima</span>
        <AuthWidget />
      </div>

      <div className={styles.heroContent}>
        <p className={styles.heroEyebrow}>Featured Aesthetic</p>
        <h2 className={styles.heroName}>{getStyleName(style, gender)}</h2>
        <p className={styles.heroTagline}>{style?.tagline}</p>
        <button
          className={styles.heroBtn}
          onClick={() => navigate(`aesthetic:${slideId}`)}
        >
          Explore look →
        </button>
      </div>

      <div className={styles.heroDots}>
        {HERO_SLIDE_IDS.map((_, i) => (
          <button
            key={i}
            className={`${styles.heroDot} ${i === activeIdx ? styles.heroDotActive : ''}`}
            onClick={() => goTo(i)}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>

      <button
        className={`${styles.heroArrow} ${styles.heroArrowLeft} ${arrowsVisible ? '' : styles.heroArrowHidden}`}
        onClick={() => goTo((activeIdx - 1 + HERO_SLIDE_IDS.length) % HERO_SLIDE_IDS.length)}
        aria-label="Previous slide"
      >
        ‹
      </button>
      <button
        className={`${styles.heroArrow} ${styles.heroArrowRight} ${arrowsVisible ? '' : styles.heroArrowHidden}`}
        onClick={() => goTo((activeIdx + 1) % HERO_SLIDE_IDS.length)}
        aria-label="Next slide"
      >
        ›
      </button>
    </div>
  )
}
