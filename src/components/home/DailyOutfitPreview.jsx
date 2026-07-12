import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useCloset } from '../../context/ClosetContext'
import { generateOutfit } from '../../services/outfitAI'
import { getWeather, getWeatherEmoji } from '../../services/weather'
import styles from '../../screens/HomeScreen.module.css'

const CATEGORY_EMOJIS_HOME = {
  tops: '👕', bottoms: '👖', outerwear: '🧥',
  dresses: '👗', footwear: '👟', accessories: '👜',
}

export default function DailyOutfitPreview({ navigate, gender }) {
  const { user }        = useAuth()
  const { closetItems } = useCloset()
  const [outfit, setOutfit]   = useState(null)
  const [weather, setWeather] = useState(null)
  const [done, setDone]       = useState(false)

  useEffect(() => {
    getWeather().then(setWeather).catch(() => {})
  }, [])

  useEffect(() => {
    if (!user || closetItems.length < 3 || done) return
    setDone(true)
    const dateStr = new Date().toISOString().slice(0, 10)
    generateOutfit({ closetItems, weather, occasion: 'casual', dateStr, gender, occupation: null })
      .then(setOutfit)
      .catch(() => {})
  }, [user, closetItems.length, done, gender, weather])

  if (!user || closetItems.length < 3) {
    return (
      <div className={styles.closetCta} onClick={() => navigate('daily')}>
        <span className={styles.closetCtaIcon}>🪣</span>
        <div>
          <p className={styles.closetCtaTitle}>Build your digital closet</p>
          <p className={styles.closetCtaSub}>Add 3+ items to unlock daily AI outfits</p>
        </div>
        <span className={styles.closetCtaArrow}>→</span>
      </div>
    )
  }

  if (!outfit) return null

  return (
    <div className={styles.dailyPreview}>
      <div className={styles.dailyPreviewHeader}>
        <div>
          <h3 className={styles.dailyPreviewTitle}>Today's Look</h3>
          {weather && (
            <span className={styles.dailyWeather}>
              {getWeatherEmoji(weather.condition)} {weather.temp}°C · {weather.city}
            </span>
          )}
        </div>
        <button
          className={styles.dailySeeAll}
          onClick={() => navigate('daily')}
        >
          See full look →
        </button>
      </div>
      <div className={styles.dailyItems}>
        {outfit.items.slice(0, 3).map((item) => {
          const photoUrl = item.prettifiedUrl ?? item.imageUrl ?? item.thumbnailUrl
          return (
            <div key={item.id} className={styles.dailyItem}>
              {photoUrl
                ? <img src={photoUrl} alt={item.name} className={styles.dailyItemImg} />
                : <span className={styles.dailyItemEmoji}>{CATEGORY_EMOJIS_HOME[item.category] ?? '👕'}</span>
              }
            </div>
          )
        })}
      </div>
      {outfit.reasoning && (
        <p className={styles.dailyReasoning}>{outfit.reasoning}</p>
      )}
    </div>
  )
}
