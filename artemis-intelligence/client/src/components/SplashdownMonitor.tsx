import { useEffect, useMemo, useState } from 'react'
import { useSplashdownWeather } from '../hooks/useSplashdownWeather'

const MONO_FONT = '"SFMono-Regular", "SF Mono", "Cascadia Code", "Roboto Mono", "Courier New", monospace'

function formatCountdown(countdownMs: number) {
  const totalSeconds = Math.max(0, Math.floor(countdownMs / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [days, hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}

function getThresholdColor(value: number, limit: number) {
  if (value > limit) {
    return '#ff4444'
  }

  if (value >= limit * 0.8) {
    return '#ffaa44'
  }

  return '#00ff88'
}

function getVisibilityColor(value: number, minimum: number) {
  if (value < minimum) {
    return '#ff4444'
  }

  if (value <= minimum * 1.2) {
    return '#ffaa44'
  }

  return '#00ff88'
}

function getWavePeriodColor(value: number) {
  if (value > 14) {
    return '#ff4444'
  }

  if (value >= 10) {
    return '#ffaa44'
  }

  return '#00ff88'
}

function getCloudCoverColor(value: number) {
  if (value > 80) {
    return '#ff4444'
  }

  if (value >= 50) {
    return '#ffaa44'
  }

  return '#00ff88'
}

function getStatusStyle(status: 'GO' | 'MONITOR' | 'NO-GO') {
  switch (status) {
    case 'NO-GO':
      return {
        label: 'NO-GO',
        color: '#ff4444',
        background: 'rgba(255,68,68,0.1)',
        border: 'rgba(255,68,68,0.3)',
      }
    case 'MONITOR':
      return {
        label: 'MONITOR CONDITIONS',
        color: '#ffaa44',
        background: 'rgba(255,170,68,0.1)',
        border: 'rgba(255,170,68,0.3)',
      }
    default:
      return {
        label: 'GO FOR RECOVERY',
        color: '#00ff88',
        background: 'rgba(0,255,136,0.1)',
        border: 'rgba(0,255,136,0.3)',
      }
  }
}

function SkeletonCell() {
  return (
    <div
      className="animate-pulse"
      style={{
        borderRadius: 12,
        border: '1px solid rgba(68, 136, 255, 0.12)',
        background: 'rgba(4, 10, 30, 0.62)',
        padding: 14,
      }}
    >
      <div style={{ height: 10, width: '56%', borderRadius: 999, background: 'rgba(68, 136, 255, 0.12)' }} />
      <div style={{ height: 18, width: '72%', borderRadius: 999, background: 'rgba(255, 255, 255, 0.08)', marginTop: 12 }} />
    </div>
  )
}

export default function SplashdownMonitor() {
  const { data, error, loading } = useSplashdownWeather()
  const [remainingMs, setRemainingMs] = useState(0)

  useEffect(() => {
    setRemainingMs(data?.countdownMs ?? 0)
  }, [data?.countdownMs])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemainingMs((current) => Math.max(0, current - 1000))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  const statusStyle = useMemo(() => getStatusStyle(data?.status ?? 'MONITOR'), [data?.status])

  if (loading && !data) {
    return (
      <div
        style={{
          display: 'grid',
          gap: 16,
          fontFamily: MONO_FONT,
        }}
      >
        <div className="animate-pulse" style={{ height: 82, borderRadius: 16, background: 'rgba(5, 10, 30, 0.78)' }} />
        <div className="animate-pulse" style={{ height: 64, borderRadius: 16, background: 'rgba(5, 10, 30, 0.78)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCell key={index} />
          ))}
        </div>
      </div>
    )
  }

  const conditions = data?.conditions
  const thresholds = data?.thresholds

  return (
    <div style={{ display: 'grid', gap: 16, fontFamily: MONO_FONT }}>
      <style>
        {`
          @keyframes splashdownPulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.35; transform: scale(0.86); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}
      </style>

      {error ? (
        <div
          style={{
            borderRadius: 12,
            border: '1px solid rgba(255, 170, 68, 0.28)',
            background: 'rgba(255, 170, 68, 0.08)',
            color: '#ffaa44',
            padding: '10px 14px',
            fontSize: 12,
            letterSpacing: '0.04em',
          }}
        >
          Weather data unavailable — using last cached conditions
        </div>
      ) : null}

      <div
        style={{
          borderRadius: 16,
          border: '1px solid rgba(68, 136, 255, 0.18)',
          background: 'rgba(2, 8, 24, 0.84)',
          padding: 18,
        }}
      >
        <div
          style={{
            color: '#f6fbff',
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: '0.08em',
            lineHeight: 1.1,
          }}
        >
          {formatCountdown(remainingMs)}
        </div>
        <div
          style={{
            color: '#5b7294',
            fontSize: 11,
            letterSpacing: '0.16em',
            marginTop: 10,
          }}
        >
          APRIL 10 2026 · 20:06 EDT · PACIFIC OCEAN
        </div>
        <div
          style={{
            color: '#334b69',
            fontSize: 11,
            letterSpacing: '0.08em',
            marginTop: 6,
          }}
        >
          DD:HH:MM:SS until splashdown
        </div>
      </div>

      <div
        style={{
          width: '100%',
          borderRadius: 16,
          border: `1px solid ${statusStyle.border}`,
          background: statusStyle.background,
          color: statusStyle.color,
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          textAlign: 'center',
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: '0.12em',
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: statusStyle.color,
            animation: 'splashdownPulse 2s ease-in-out infinite',
            flexShrink: 0,
          }}
        />
        <span>{statusStyle.label}</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 12,
        }}
      >
        {[
          {
            label: 'WAVE HEIGHT',
            value: conditions ? `${conditions.waveHeightM.toFixed(1)} m` : '—',
            color: conditions && thresholds ? getThresholdColor(conditions.waveHeightM, thresholds.waveLimit) : '#dce8ff',
          },
          {
            label: 'SWELL HEIGHT',
            value: conditions ? `${conditions.swellHeightM.toFixed(1)} m` : '—',
            color: conditions && thresholds ? getThresholdColor(conditions.swellHeightM, thresholds.waveLimit) : '#dce8ff',
          },
          {
            label: 'WAVE PERIOD',
            value: conditions ? `${conditions.wavePeriodS.toFixed(0)} sec` : '—',
            color: conditions ? getWavePeriodColor(conditions.wavePeriodS) : '#dce8ff',
          },
          {
            label: 'WIND SPEED',
            value: conditions ? `${conditions.windSpeedKmh.toFixed(0)} km/h` : '—',
            color: conditions && thresholds ? getThresholdColor(conditions.windSpeedKmh, thresholds.windLimit) : '#dce8ff',
          },
          {
            label: 'VISIBILITY',
            value: conditions ? `${conditions.visibilityKm.toFixed(1)} km` : '—',
            color: conditions && thresholds ? getVisibilityColor(conditions.visibilityKm, thresholds.visibilityMin) : '#dce8ff',
          },
          {
            label: 'CLOUD COVER',
            value: conditions ? `${conditions.cloudCoverPct}%` : '—',
            color: conditions ? getCloudCoverColor(conditions.cloudCoverPct) : '#dce8ff',
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              borderRadius: 12,
              border: '1px solid rgba(68, 136, 255, 0.14)',
              background: 'rgba(4, 10, 30, 0.7)',
              padding: 14,
            }}
          >
            <div
              style={{
                color: '#536781',
                fontSize: 10,
                letterSpacing: '0.12em',
                marginBottom: 10,
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                color: item.color,
                fontSize: 21,
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          color: '#5d7291',
          fontSize: 11,
          letterSpacing: '0.06em',
        }}
      >
        LIMITS: Wave ≤2.4m · Wind ≤55km/h · Vis ≥1.6km · NASA recovery thresholds
      </div>

      <div
        style={{
          display: 'grid',
          gap: 8,
          borderRadius: 999,
          border: '1px solid rgba(68, 136, 255, 0.18)',
          background: 'rgba(2, 8, 24, 0.76)',
          padding: '12px 16px',
          color: '#dbe8ff',
          fontSize: 11,
          letterSpacing: '0.12em',
        }}
      >
        <div>{(data?.location ?? 'Pacific Ocean · 32.5°N 117.1°W · off San Diego').toUpperCase()}</div>
        <div style={{ color: '#5d7291' }}>
          DATA: {(data?.source ?? 'Open-Meteo Marine API').toUpperCase()} · UPDATES EVERY 30 MIN
        </div>
      </div>
    </div>
  )
}
