// Temperature display helpers. Weather data always arrives in Celsius; the
// user's display unit ('c' | 'f') lives in localStorage under TEMP_UNIT_KEY.

export const TEMP_UNIT_KEY = 'sartima_temp_unit'
export const TEMP_UNIT_EVENT = 'sartima:temp-unit'

export function readTempUnit() {
  try {
    return localStorage.getItem(TEMP_UNIT_KEY) === 'f' ? 'f' : 'c'
  } catch {
    return 'c'
  }
}

export function toDisplayTemp(tempC, unit) {
  if (tempC === null || tempC === undefined || tempC === '') return null
  const n = Number(tempC)
  if (!Number.isFinite(n)) return null
  return Math.round(unit === 'f' ? n * 9 / 5 + 32 : n)
}

/** "39°F" / "4°C"; `withUnit: false` gives the compact "39°". */
export function formatTemp(tempC, unit, { withUnit = true } = {}) {
  const t = toDisplayTemp(tempC, unit)
  if (t === null) return ''
  return withUnit ? `${t}°${unit === 'f' ? 'F' : 'C'}` : `${t}°`
}
