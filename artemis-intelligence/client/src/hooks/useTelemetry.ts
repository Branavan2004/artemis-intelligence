import { useCallback, useEffect, useState } from 'react'

const POLL_INTERVAL_MS = 300000
const TELEMETRY_URL = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/telemetry`

export interface TrajectoryData {
  distanceFromEarthKm: number
  distanceFromMoonKm: number
  speedKmS: number
  positionVector: {
    x: number
    y: number
    z: number
  }
  source: 'JPL Horizons'
  timestamp: string
}

export interface SolarFlareSummary {
  classType: string | null
  beginTime: string | null
  peakTime: string | null
  sourceLocation: string | null
}

export interface CoronalMassEjectionSummary {
  activityID: string | null
  startTime: string | null
  sourceLocation: string | null
  speedKmS: number | null
}

export interface GeomagneticStormSummary {
  startTime: string | null
  maxKpIndex: number | null
  source: string | null
}

export interface SpaceWeatherData {
  riskLevel: 'nominal' | 'elevated' | 'severe'
  solarFlares: SolarFlareSummary[]
  coronalMassEjections: CoronalMassEjectionSummary[]
  geomagneticStorms: GeomagneticStormSummary[]
  source: 'NASA DONKI'
  timestamp: string
}

export interface TelemetryPayload {
  trajectory: TrajectoryData | null
  spaceWeather: SpaceWeatherData | null
}

export function useTelemetry() {
  const [data, setData] = useState<TelemetryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch(TELEMETRY_URL)

      if (!response.ok) {
        let message = 'Failed to fetch telemetry'

        try {
          const payload = (await response.json()) as { error?: string }
          message = payload.error || message
        } catch {
          message = response.statusText || message
        }

        throw new Error(message)
      }

      const payload = (await response.json()) as TelemetryPayload
      setData(payload)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch telemetry'
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
