import { useCallback, useEffect, useState } from 'react'

const POLL_INTERVAL_MS = 1800000
const SPLASHDOWN_WEATHER_URL = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/splashdown-weather`

export type SplashdownStatus = 'GO' | 'MONITOR' | 'NO-GO'

export interface SplashdownWeatherData {
  status: SplashdownStatus
  splashdownTime: string
  countdownMs: number
  conditions: {
    waveHeightM: number
    wavePeriodS: number
    swellHeightM: number
    windSpeedKmh: number
    windDirectionDeg: number
    visibilityKm: number
    cloudCoverPct: number
  }
  thresholds: {
    waveLimit: number
    windLimit: number
    visibilityMin: number
  }
  location: string
  source: string
  fetchedAt: string
}

export function useSplashdownWeather() {
  const [data, setData] = useState<SplashdownWeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch(SPLASHDOWN_WEATHER_URL)

      if (!response.ok) {
        let message = 'Failed to fetch splashdown weather'

        try {
          const payload = (await response.json()) as { error?: string }
          message = payload.error || message
        } catch {
          message = response.statusText || message
        }

        throw new Error(message)
      }

      const payload = (await response.json()) as SplashdownWeatherData
      setData(payload)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch splashdown weather'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()

    const interval = window.setInterval(() => {
      void refetch()
    }, POLL_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [refetch])

  return { data, loading, error, refetch }
}
