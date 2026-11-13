import { describe, it, expect } from 'vitest'
import { formatTemp, toDisplayTemp } from '../../src/services/temperature'

describe('formatTemp', () => {
  it('shows Celsius as-is', () => {
    expect(formatTemp(4, 'c')).toBe('4°C')
  })

  it('converts to Fahrenheit and rounds', () => {
    expect(formatTemp(4, 'f')).toBe('39°F')
    expect(formatTemp(-40, 'f')).toBe('-40°F')
  })

  it('rounds fractional Celsius', () => {
    expect(formatTemp(3.6, 'c')).toBe('4°C')
  })

  it('compact form drops the unit letter', () => {
    expect(formatTemp(4, 'f', { withUnit: false })).toBe('39°')
  })

  it('treats anything other than f as Celsius', () => {
    expect(formatTemp(10, undefined)).toBe('10°C')
  })

  it('returns empty for a missing temperature', () => {
    expect(formatTemp(undefined, 'f')).toBe('')
    expect(toDisplayTemp(null, 'c')).toBe(null)
  })
})
