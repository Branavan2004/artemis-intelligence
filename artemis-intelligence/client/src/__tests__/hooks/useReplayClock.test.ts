import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  useReplayClock,
  metStringToSeconds,
  secondsToMetString,
  orionPositionFromMET,
  LAUNCH_EPOCH_MS,
  MISSION_DURATION_S,
} from '../../hooks/useReplayClock'

// ── metStringToSeconds ────────────────────────────────────────────────────────
describe('metStringToSeconds', () => {
  it('converts 000:00:00 to 0', () => {
    expect(metStringToSeconds('000:00:00')).toBe(0)
  })
  it('converts 001:00:00 to 3600', () => {
    expect(metStringToSeconds('001:00:00')).toBe(3600)
  })
  it('converts 083:42:16 correctly', () => {
    expect(metStringToSeconds('083:42:16')).toBe(83 * 3600 + 42 * 60 + 16)
  })
  it('converts 000:01:30 to 90', () => {
    expect(metStringToSeconds('000:01:30')).toBe(90)
  })
  it('returns 0 for invalid string', () => {
    expect(metStringToSeconds('bad')).toBe(0)
  })
})

// ── secondsToMetString ────────────────────────────────────────────────────────
describe('secondsToMetString', () => {
  it('formats 0 as 000:00:00', () => {
    expect(secondsToMetString(0)).toBe('000:00:00')
  })
  it('formats 3600 as 001:00:00', () => {
    expect(secondsToMetString(3600)).toBe('001:00:00')
  })
  it('formats 90 as 000:01:30', () => {
    expect(secondsToMetString(90)).toBe('000:01:30')
  })
  it('is the inverse of metStringToSeconds', () => {
    const original = '083:42:16'
    expect(secondsToMetString(metStringToSeconds(original))).toBe(original)
  })
  it('pads hours to 3 digits', () => {
    expect(secondsToMetString(3600)).toMatch(/^\d{3}:/)
  })
})

// ── orionPositionFromMET ──────────────────────────────────────────────────────
describe('orionPositionFromMET', () => {
  it('returns low distance at MET 0 (pre-TLI LEO phase)', () => {
    const pos = orionPositionFromMET(0)
    // At launch: should be near 400km (LEO floor)
    expect(pos.distanceFromEarthKm).toBeGreaterThanOrEqual(200)
    expect(pos.distanceFromEarthKm).toBeLessThan(5000)
  })

  it('returns near-max distance around record break MET ~115h', () => {
    const pos = orionPositionFromMET(115 * 3600)
    expect(pos.distanceFromEarthKm).toBeGreaterThan(380000)
    expect(pos.distanceFromEarthKm).toBeLessThanOrEqual(410000)
  })

  it('returns lower distance near splashdown MET ~203h', () => {
    const pos = orionPositionFromMET(203 * 3600)
    expect(pos.distanceFromEarthKm).toBeLessThan(50000)
  })

  it('trajectoryFraction is always between 0 and 1', () => {
    for (const s of [0, 50 * 3600, 102 * 3600, 203 * 3600]) {
      const pos = orionPositionFromMET(s)
      expect(pos.trajectoryFraction).toBeGreaterThanOrEqual(0)
      expect(pos.trajectoryFraction).toBeLessThanOrEqual(1)
    }
  })

  it('speed is always positive', () => {
    for (const s of [0, 25 * 3600, 100 * 3600, 200 * 3600]) {
      expect(orionPositionFromMET(s).speedKmS).toBeGreaterThan(0)
    }
  })

  it('clamps at MISSION_DURATION_S — overshooting yields same result', () => {
    const atEnd = orionPositionFromMET(MISSION_DURATION_S)
    const overEnd = orionPositionFromMET(MISSION_DURATION_S * 2)
    expect(overEnd.trajectoryFraction).toBe(atEnd.trajectoryFraction)
  })

  it('distanceFromEarthKm is always >= 200 (floor applied)', () => {
    expect(orionPositionFromMET(0).distanceFromEarthKm).toBeGreaterThanOrEqual(200)
  })
})

// ── useReplayClock hook ───────────────────────────────────────────────────────
describe('useReplayClock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Fix Date.now so initial MET is deterministic (~ mission day 5)
    vi.setSystemTime(new Date('2026-04-06T12:00:00-04:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes with real current MET — metSeconds > 0', () => {
    const { result } = renderHook(() => useReplayClock())
    expect(result.current.metSeconds).toBeGreaterThan(0)
  })

  it('metString matches HHH:MM:SS format', () => {
    const { result } = renderHook(() => useReplayClock())
    expect(result.current.metString).toMatch(/^\d{3}:\d{2}:\d{2}$/)
  })

  it('starts playing at speed 1 by default', () => {
    const { result } = renderHook(() => useReplayClock())
    expect(result.current.isPlaying).toBe(true)
    expect(result.current.speed).toBe(1)
  })

  it('advances metSeconds while playing at speed 1 (tick = 100ms = 0.1s MET)', () => {
    const { result } = renderHook(() => useReplayClock())
    const start = result.current.metSeconds
    act(() => { vi.advanceTimersByTime(1000) }) // 10 ticks × 0.1s = 1s MET
    expect(result.current.metSeconds).toBeCloseTo(start + 1, 0)
  })

  it('advances 4× faster at speed 4', () => {
    const { result } = renderHook(() => useReplayClock())
    act(() => { result.current.setSpeed(4) })
    const start = result.current.metSeconds
    act(() => { vi.advanceTimersByTime(1000) }) // 10 ticks × 0.4s = 4s MET
    expect(result.current.metSeconds).toBeCloseTo(start + 4, 0)
  })

  it('does not advance while paused', () => {
    const { result } = renderHook(() => useReplayClock())
    act(() => { result.current.setIsPlaying(false) })
    const paused = result.current.metSeconds
    act(() => { vi.advanceTimersByTime(5000) })
    expect(result.current.metSeconds).toBe(paused)
  })

  it('seekToFraction jumps to correct MET', () => {
    const { result } = renderHook(() => useReplayClock())
    act(() => { result.current.seekToFraction(0.5) })
    expect(result.current.metSeconds).toBeCloseTo(MISSION_DURATION_S * 0.5, -2)
  })

  it('seekToSeconds clamps to 0 for negative input', () => {
    const { result } = renderHook(() => useReplayClock())
    act(() => { result.current.seekToSeconds(-999) })
    expect(result.current.metSeconds).toBe(0)
  })

  it('seekToSeconds clamps to MISSION_DURATION_S for overflow', () => {
    const { result } = renderHook(() => useReplayClock())
    act(() => { result.current.seekToSeconds(MISSION_DURATION_S + 9999) })
    expect(result.current.metSeconds).toBe(MISSION_DURATION_S)
  })

  it('stops playing and clamps at mission end', () => {
    const { result } = renderHook(() => useReplayClock())
    act(() => { result.current.seekToSeconds(MISSION_DURATION_S - 0.05) })
    act(() => { vi.advanceTimersByTime(500) })
    expect(result.current.metSeconds).toBe(MISSION_DURATION_S)
    expect(result.current.isPlaying).toBe(false)
  })

  it('progressFraction is between 0 and 1', () => {
    const { result } = renderHook(() => useReplayClock())
    expect(result.current.progressFraction).toBeGreaterThanOrEqual(0)
    expect(result.current.progressFraction).toBeLessThanOrEqual(1)
  })

  it('LAUNCH_EPOCH_MS corresponds to April 1 2026 18:35 EDT', () => {
    const d = new Date(LAUNCH_EPOCH_MS)
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth()).toBe(3) // April = index 3
    expect(d.getUTCDate()).toBe(1)
  })

  it('MISSION_DURATION_S is 10 days in seconds', () => {
    expect(MISSION_DURATION_S).toBe(10 * 24 * 3600)
  })
})
