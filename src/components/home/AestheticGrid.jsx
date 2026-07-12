import { useEffect, useRef, useState } from 'react'
import { STYLES, getStyleName } from '../../data/styles'
import { fetchPhotosWithFallback } from '../../services/pexels'
import styles from '../../screens/HomeScreen.module.css'

function AestheticMiniCard({ aestheticId, navigate, gender }) {
  const [photo, setPhoto]   = useState(null)
  const [loaded, setLoaded] = useState(false)
  const cardRef  = useRef(null)
  const fetched  = useRef(false)
  const style    = STYLES[aestheticId]

  useEffect(() => {
    fetched.current = false
    setPhoto(null)
    setLoaded(false)
  }, [gender])

  useEffect(() => {
    const el = cardRef.current
    if (!el || !style) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fetched.current) {
        fetched.current = true
        const name = getStyleName(style, gender)
        const hint = gender === 'women' ? 'women' : gender === 'men' ? 'men' : ''
        fetchPhotosWithFallback([
          ...(style.outfitQuery ? [style.outfitQuery] : []),
          `${name} ${hint} outfit aesthetic`.trim(),
          `${name} ${hint} fashion`.trim(),
          `${name} fashion`,
          `${name} outfit`,
        ], 1).then(([url] = []) => setPhoto(url ?? null))
        obs.disconnect()
      }
    }, { rootMargin: '100px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [aestheticId, style, gender])

  if (!style) return null

  return (
    <button
      ref={cardRef}
      className={styles.miniCard}
      onClick={() => navigate(`aesthetic:${aestheticId}`)}
    >
      <div className={styles.miniCardBg} style={{ background: style.gradient }}>
        {photo && (
          <img
            src={photo}
            alt={style.name}
            className={styles.miniCardImg}
            style={{ opacity: loaded ? 1 : 0 }}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        )}
      </div>
      <div className={styles.miniCardOverlay} />
      <span className={styles.miniCardName}>{getStyleName(style, gender).split(' / ')[0]}</span>
    </button>
  )
}

export function HorizontalScroll({ ids, navigate, gender }) {
  return (
    <div className={styles.hScroll}>
      {ids.filter((id) => STYLES[id]).map((id) => (
        <AestheticMiniCard key={`${id}-${gender}`} aestheticId={id} navigate={navigate} gender={gender} />
      ))}
    </div>
  )
}

export default function AestheticGrid({ ids, navigate, gender }) {
  return (
    <div className={styles.aestheticGrid}>
      {ids.filter((id) => STYLES[id]).map((id) => (
        <AestheticMiniCard key={`${id}-${gender}`} aestheticId={id} navigate={navigate} gender={gender} />
      ))}
    </div>
  )
}
