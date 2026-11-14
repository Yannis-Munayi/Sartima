import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useCloset } from '../../context/ClosetContext'
import { useSubscription } from '../../context/SubscriptionContext'
import { generateOutfit, getCachedOutfit } from '../../services/outfitAI'
import { getWeather, getWeatherEmoji } from '../../services/weather'
import { formatTemp } from '../../services/temperature'
import { useTempUnit, useDefaultOccasion, usePreferredSeasons } from '../../context/AppContext'
import styles from '../../screens/HomeScreen.module.css'

const CATEGORY_EMOJIS_HOME = {
  tops: '👕', bottoms: '👖', outerwear: '🧥',
  dresses: '👗', footwear: '👟', accessories: '👜',
}

export default function DailyOutfitPreview({ navigate, gender }) {
  const { user }        = useAuth()
  const { closetItems } = useCloset()
  const { unit }        = useTempUnit()
  const { occasion }    = useDefaultOccasion()
  const { preferredSeasons } = usePreferredSeasons()
  const { isPro, isAtLimit } = useSubscription()
  const [outfit, setOutfit]   = useState(null)
  const [weather, setWeather] = useState(null)
  const [done, setDone]       = useState(false)

  useEffect(() => {
    getWeather().then(setWeather).catch(() => {})
  }, [])

  useEffect(() => {
    if (!user || closetItems.length < 3 || done) return
    const opts = {
      closetItems, weather, occasion, gender, occupation: null, preferredSeasons,
      dateStr: new Date().toISOString().slice(0, 10),
    }
    // Free accounts get one AI outfit a day. The preview mustn't spend it just
    // because Home opened, so it only shows one already generated in Today's Outfit.
    // (Tier starts as 'free' until claims load, so this re-runs when isPro flips.)
    if (!isPro) { setOutfit(getCachedOutfit(opts)); return }
    setDone(true)
    generateOutfit(opts).then(setOutfit).catch(() => {})
  }, [user, closetItems.length, done, gender, weather, occasion, preferredSeasons, isPro])

  // Too-small closet → the "Build your digital closet" prompt lives in the
  // Home notification bell (useHomeNotifications), not here.
  if (!user || closetItems.length < 3) return null
  // Free, nothing generated yet: invite them to Today's Outfit (unless today's is used up)
  const invite = !outfit && !isPro && !isAtLimit('outfitGenerations')
  if (!outfit && !invite) return null

  return (
    <div className={styles.dailyPreview}>
      <div className={styles.dailyPreviewHeader}>
        <div>
          <h3 className={styles.dailyPreviewTitle}>Today's Look</h3>
          {weather && (
            <span className={styles.dailyWeather}>
              {getWeatherEmoji(weather.condition)} {formatTemp(weather.temp, unit)} · {weather.city}
            </span>
          )}
        </div>
        <button
          className={styles.dailySeeAll}
          onClick={() => navigate('daily')}
        >
          {invite ? 'Create it →' : 'See full look →'}
        </button>
      </div>
      {invite && (
        <p className={styles.dailyReasoning}>Get an outfit from your closet, picked for today's weather.</p>
      )}
      {outfit && (
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
      )}
      {outfit?.reasoning && (
        <p className={styles.dailyReasoning}>{outfit.reasoning}</p>
      )}
    </div>
  )
}
