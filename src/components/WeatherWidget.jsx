import { useEffect, useState } from 'react'
import { getWeather, getWeatherEmoji } from '../services/weather'
import styles from './WeatherWidget.module.css'

export default function WeatherWidget({ compact = false }) {
  const [weather, setWeather] = useState(undefined) // undefined = loading

  useEffect(() => {
    getWeather().then(setWeather).catch(() => setWeather(null))
  }, [])

  if (weather === undefined) {
    return <div className={styles.skeleton} />
  }

  if (!weather) return null

  if (compact) {
    return (
      <div className={styles.compact}>
        <span className={styles.emoji}>{getWeatherEmoji(weather.condition)}</span>
        <span className={styles.compactTemp}>{weather.temp}°</span>
        <span className={styles.compactCity}>{weather.city}</span>
      </div>
    )
  }

  return (
    <div className={styles.widget}>
      <span className={styles.weatherEmoji}>{getWeatherEmoji(weather.condition)}</span>
      <div className={styles.info}>
        <span className={styles.temp}>{weather.temp}°C</span>
        <span className={styles.desc}>{weather.description} · {weather.city}</span>
      </div>
      <span className={styles.humidity}>{weather.humidity}% humidity</span>
    </div>
  )
}
