import { useEffect, useRef, useState } from 'react'

// Launch epoch: April 1 2026 6:35 PM EDT
export const LAUNCH_EPOCH_MS = new Date('2026-04-01T18:35:00-04:00').getTime()

// Total mission duration in seconds (10 days)
export const MISSION_DURATION_S = 10 * 24 * 3600

export function metStringToSeconds(met: string): number {
  // Handles "083:42:16" or "00:42:16"
  const parts = met.split(':').map(Number)
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return 0
}

export function secondsToMetString(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return `${String(h).padStart(3, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// Given simulated MET seconds, compute Orion's position on the free-return arc
// Returns distanceFromEarthKm and speedKmS
export function orionPositionFromMET(metSeconds: number): {
  distanceFromEarthKm: number
  speedKmS: number
  trajectoryFraction: number
} {
  // Total mission ~204 hours (splashdown). Normalize to 0-1
  const TOTAL_S = 204 * 3600
  const frac = Math.min(metSeconds / TOTAL_S, 1)

  // Free-return arc: distance peaks at ~406773 km around frac=0.57 (record break)
  // Uses a sine curve: starts at 400km (LEO), peaks at 406773, returns to ~0
  // TLI burn at MET ~25h = frac 0.122, so before that distance is low
  const TLI_FRAC = 25 / 204

  let distanceFromEarthKm: number
  if (frac < TLI_FRAC) {
    // Still in Earth orbit: 400km to 10000km (rising during high Earth orbit phase)
    distanceFromEarthKm = 400 + (10000 - 400) * (frac / TLI_FRAC)
  } else {
    // Outbound + return arc using sine
    const arcFrac = (frac - TLI_FRAC) / (1 - TLI_FRAC)
    distanceFromEarthKm = 400 + (406773 - 400) * Math.sin(arcFrac * Math.PI)
  }

  // Speed: fast at TLI (~3.1 km/s), slows mid-transit (~0.8 km/s),
  // speeds up on return, very fast at reentry (~11 km/s)
  let speedKmS: number
  if (frac < TLI_FRAC) {
    speedKmS = 7.8 // LEO orbital speed
  } else {
    const arcFrac = (frac - TLI_FRAC) / (1 - TLI_FRAC)
    // Bell curve: fast at ends, slow in middle
    speedKmS = 0.8 + 2.3 * (1 - Math.sin(arcFrac * Math.PI)) +
      (arcFrac > 0.9 ? (arcFrac - 0.9) * 80 : 0) // reentry spike
  }

  return {
    distanceFromEarthKm: Math.max(200, distanceFromEarthKm),
    speedKmS: Math.max(0.5, speedKmS),
    trajectoryFraction: frac,
  }
}

export type ReplaySpeed = 0 | 1 | 2 | 3 | 4

export function useReplayClock() {
  // Start simulated MET from real current MET
  const [metSeconds, setMetSeconds] = useState(() => {
    const realMETSeconds = Math.floor((Date.now() - LAUNCH_EPOCH_MS) / 1000)
    return Math.max(0, Math.min(realMETSeconds, MISSION_DURATION_S))
  })
  const [speed, setSpeed] = useState<ReplaySpeed>(1)
  const [isPlaying, setIsPlaying] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const metRef = useRef(metSeconds)
  metRef.current = metSeconds

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    if (!isPlaying || speed === 0) {
      return
    }

    // Tick every 100ms real time.
    const metPerTick = speed * 0.1

    intervalRef.current = setInterval(() => {
      setMetSeconds((prev) => {
        const next = prev + metPerTick
        if (next >= MISSION_DURATION_S) {
          setIsPlaying(false)
          return MISSION_DURATION_S
        }
        return next
      })
    }, 100)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [speed, isPlaying])

  const seekToFraction = (frac: number) => {
    setMetSeconds(Math.floor(Math.max(0, Math.min(frac, 1)) * MISSION_DURATION_S))
  }

  const seekToSeconds = (s: number) => {
    setMetSeconds(Math.max(0, Math.min(s, MISSION_DURATION_S)))
  }

  const metString = secondsToMetString(Math.floor(metSeconds))
  const position = orionPositionFromMET(metSeconds)
  const progressFraction = metSeconds / MISSION_DURATION_S

  return {
    metSeconds,
    metString,
    speed,
    setSpeed,
    isPlaying,
    setIsPlaying,
    seekToFraction,
    seekToSeconds,
    progressFraction,
    ...position,
  }
}
