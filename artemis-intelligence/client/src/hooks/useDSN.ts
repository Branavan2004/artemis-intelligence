import { useCallback, useEffect, useState } from 'react'

const POLL_INTERVAL_MS = 10000
const DSN_URL = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/dsn`

export interface DSNSignal {
  dataRateBps: number
  powerDbm: number
  frequencyMhz: number
}

export interface DSNDish {
  name: string
  friendlyName: string
  downlink: DSNSignal | null
  uplink: DSNSignal | null
  rangeKm: number
  lightTimeSeconds: number
}

export interface DSNStation {
  id: 'gdscc' | 'mdscc' | 'cdscc'
  friendlyName: 'Goldstone' | 'Madrid' | 'Canberra' | string
  location: {
    lat: number
    lng: number
  }
  isActive: boolean
  activeDish: DSNDish | null
}

export interface DSNPayload {
  stations: DSNStation[]
  orionInContact: boolean
  fetchedAt: string
  source: 'NASA DSN Now'
}

export function useDSN() {
  const [data, setData] = useState<DSNPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchDsn = useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch(DSN_URL)

      if (!response.ok) {
        let message = 'Failed to fetch DSN feed'

        try {
          const payload = (await response.json()) as { error?: string }
          message = payload.error || message
        } catch {
          message = response.statusText || message
        }

        throw new Error(message)
      }

      const payload = (await response.json()) as DSNPayload
      setData(payload)
      setError(null)
      const fetchedAt = new Date(payload.fetchedAt)
      setLastUpdated(Number.isNaN(fetchedAt.getTime()) ? new Date() : fetchedAt)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch DSN feed'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchDsn()

    const interval = window.setInterval(() => {
      void fetchDsn()
    }, POLL_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [fetchDsn])

  return { data, loading, error, lastUpdated }
}
