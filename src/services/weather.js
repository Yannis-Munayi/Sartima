const CACHE_KEY = 'stylelab_weather'
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

    const cached = sessionStorage.getItem('stylelab_coords')
    if (cached) { resolve(JSON.parse(cached)); return }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        try { sessionStorage.setItem('stylelab_coords', JSON.stringify(coords)) } catch {}
        resolve(coords)
      },
      () => reject(new Error('permission-denied')),
      { timeout: 8000, maximumAge: 60 * 60 * 1000 }
    )
  })
}

/**
 * Returns a WeatherData object or null if geolocation is unavailable/denied.
 * WeatherData shape:
 *   { city, temp, feelsLike, condition, description, icon, humidity, windSpeed, fetchedAt }
 */
export async function getWeather() {
  const cached = getCached()
  if (cached) return cached

  const apiKey = import.meta.env.VITE_OPENWEATHER_KEY
  if (!apiKey) return null

  let coords
  try {
    coords = await getCoords()
  } catch {
    return null
  }

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&units=metric&appid=${apiKey}`
    )
    if (!res.ok) return null
    const json = await res.json()

    const data = {
      city:        json.name,
      temp:        Math.round(json.main.temp),
      feelsLike:   Math.round(json.main.feels_like),
      condition:   json.weather[0]?.main ?? 'Clear',
      description: json.weather[0]?.description ?? '',
      icon:        json.weather[0]?.icon ?? '01d',
      humidity:    json.main.humidity,
      windSpeed:   Math.round(json.wind?.speed ?? 0),
      fetchedAt:   Date.now(),
    }
    setCache(data)
    return data
  } catch {
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
