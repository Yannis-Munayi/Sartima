import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import { logError } from './logger'

const CACHE_KEY = 'sartima_weather'
const CACHE_TTL  = 30 * 60 * 1000 // 30 minutes

function getCached() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, fetchedAt } = JSON.parse(raw)
    if (Date.now() - fetchedAt < CACHE_TTL) return data
  } catch {
    // ignore
  }
  return null
}

function setCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, fetchedAt: Date.now() }))
  } catch {
    // ignore
  }
}

function getCoords() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('no-geolocation')); return }

    const cached = sessionStorage.getItem('sartima_coords')
    if (cached) { resolve(JSON.parse(cached)); return }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Round to ~1 km precision — sufficient for weather, avoids storing exact address
        const coords = {
          lat: Math.round(pos.coords.latitude  * 100) / 100,
          lon: Math.round(pos.coords.longitude * 100) / 100,
        }
        try { sessionStorage.setItem('sartima_coords', JSON.stringify(coords)) } catch {}
        resolve(coords)
      },
      () => reject(new Error('permission-denied')),
      { timeout: 8000, maximumAge: 60 * 60 * 1000 }
    )
  })
}

const weatherFn = httpsCallable(functions, 'getWeather')

/**
 * Returns a WeatherData object or null if geolocation is unavailable/denied.
 * WeatherData shape:
 *   { city, temp, feelsLike, condition, description, icon, humidity, windSpeed, fetchedAt }
 */
export async function getWeather() {
  const cached = getCached()
  if (cached) return cached

  let coords
  try {
    coords = await getCoords()
  } catch {
    return null
  }

  try {
    const { data } = await weatherFn({ lat: coords.lat, lon: coords.lon })
    setCache(data)
    return data
  } catch (err) {
    logError('weather', 'getWeather failed', { lat: coords.lat, lon: coords.lon, error: err?.message })
    return null
  }
}

export function getWeatherEmoji(condition) {
  const c = condition?.toLowerCase() ?? ''
  if (c.includes('thunderstorm')) return '⛈️'
  if (c.includes('drizzle'))      return '🌦️'
  if (c.includes('rain'))         return '🌧️'
  if (c.includes('snow'))         return '❄️'
  if (c.includes('mist') || c.includes('fog') || c.includes('haze')) return '🌫️'
  if (c.includes('cloud'))        return '☁️'
  if (c.includes('clear'))        return '☀️'
  return '🌤️'
}
