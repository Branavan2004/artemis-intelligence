import { type DSNStation, useDSN } from '../hooks/useDSN'

const POLL_INTERVAL_SECONDS = 10
const MAP_WIDTH = 1120
const MAP_HEIGHT = 520
const ORION_ANCHOR = { x: 640, y: 156 }
const FALLBACK_STATIONS: DSNStation[] = [
  {
    id: 'gdscc',
    friendlyName: 'Goldstone',
    location: { lat: 35.4267, lng: -116.89 },
    isActive: false,
    activeDish: null,
  },
  {
    id: 'mdscc',
    friendlyName: 'Madrid',
    location: { lat: 40.4314, lng: -4.2481 },
    isActive: false,
    activeDish: null,
  },
  {
    id: 'cdscc',
    friendlyName: 'Canberra',
    location: { lat: -35.4014, lng: 148.9817 },
    isActive: false,
    activeDish: null,
  },
]

function projectToMap(lat: number, lng: number) {
  return {
    x: ((lng + 180) / 360) * MAP_WIDTH,
    y: ((90 - lat) / 180) * MAP_HEIGHT,
  }
}

function formatFeedTime(value: string | Date | null | undefined) {
  if (!value) return 'Waiting for first sample'

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Waiting for first sample'
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatLightTime(totalSeconds: number | null | undefined) {
  if (totalSeconds === null || totalSeconds === undefined) return '—'
  if (totalSeconds < 60) return `${totalSeconds.toFixed(totalSeconds < 10 ? 1 : 0)} sec`

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.round(totalSeconds % 60)

  if (seconds === 60) {
    return `${minutes + 1} min 0 sec`
  }

  return `${minutes} min ${seconds} sec`
}

function formatTransferRate(dataRateBps: number | null | undefined) {
  if (!dataRateBps) return '—'
  if (dataRateBps < 1000) return `${Math.round(dataRateBps)} bps`
  if (dataRateBps < 1000000) return `${(dataRateBps / 1000).toFixed(1)} kbps`

  return `${(dataRateBps / 1000000).toFixed(2)} Mbps`
}

function formatRangeKm(rangeKm: number | null | undefined) {
  if (rangeKm === null || rangeKm === undefined) return '—'
  return `${Math.round(rangeKm).toLocaleString()} km`
}

function getPrimaryActiveStation(stations: DSNStation[]) {
  return stations.find((station) => station.isActive && station.activeDish) || null
}

function joinLabels(labels: string[]) {
  if (labels.length <= 1) return labels[0] || ''
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`
}

function getFeedStatus(hasSample: boolean, loading: boolean, error: string | null) {
  if (loading && !hasSample) {
    return {
      label: 'Connecting',
      detail: 'Waiting for the first DSN sample',
      tone: 'bg-amber-500',
    }
  }

  if (error && !hasSample) {
    return {
      label: 'Feed unavailable',
      detail: `Retrying every ${POLL_INTERVAL_SECONDS} seconds`,
      tone: 'bg-red-500',
    }
  }

  if (loading) {
    return {
      label: 'Refreshing feed',
      detail: `Polling DSN Now every ${POLL_INTERVAL_SECONDS} seconds`,
      tone: 'bg-slate-400',
    }
  }

  if (error) {
    return {
      label: 'Feed degraded',
      detail: 'Showing the last known network sample',
      tone: 'bg-amber-500',
    }
  }

  return {
    label: 'Feed active',
    detail: `Polling DSN Now every ${POLL_INTERVAL_SECONDS} seconds`,
    tone: 'bg-emerald-500',
  }
}

function getNetworkSummary(activeStations: DSNStation[]) {
  if (!activeStations.length) {
    return {
      eyebrow: 'Active dish',
      badge: 'NO CONTACT',
      badgeClass:
        'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200',
      title: 'None',
      detail:
        'None of the Deep Space Network dishes in the live feed are currently reporting an Orion or Artemis lock. The tracker will continue polling every 10 seconds.',
      support: 'Awaiting the next handoff or reacquisition window.',
    }
  }

  if (activeStations.length === 1) {
    return {
      eyebrow: 'Active dish',
      badge: 'LINK ACTIVE',
      badgeClass:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
      title: activeStations[0].friendlyName,
      detail: `${activeStations[0].friendlyName} is currently carrying the Orion link in the live DSN feed.`,
      support: activeStations[0].activeDish?.friendlyName || activeStations[0].activeDish?.name || 'Dish data available',
    }
  }

  const activeNames = joinLabels(activeStations.map((station) => station.friendlyName))

  return {
    eyebrow: 'Handoff state',
    badge: 'HANDOFF LIVE',
    badgeClass:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300',
    title: `${activeStations.length} stations`,
    detail: `${activeNames} are simultaneously reporting Orion contact, which usually indicates a live handoff or overlapping visibility window.`,
    support: 'Watch the station state rail below to see which dish remains in lock.',
  }
}

function getStationBadge(station: DSNStation) {
  if (station.isActive) {
    return {
      label: 'Tracking',
      dot: 'bg-emerald-500',
      badgeClass:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
      detail: station.activeDish?.friendlyName || station.activeDish?.name || 'Dish data available',
    }
  }

  return {
    label: 'Standby',
    dot: 'bg-slate-400',
    badgeClass:
      'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200',
    detail: 'No Orion lock reported in the current sample',
  }
}

function renderMap(stations: DSNStation[], activeStations: DSNStation[]) {
  return (
    <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="h-auto w-full">
      <defs>
        <linearGradient id="tracker-bg" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#060912" />
          <stop offset="50%" stopColor="#09111F" />
          <stop offset="100%" stopColor="#04070F" />
        </linearGradient>
        <radialGradient id="orion-glow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="rgba(96, 165, 250, 0.65)" />
          <stop offset="100%" stopColor="rgba(96, 165, 250, 0)" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} rx="28" fill="url(#tracker-bg)" />

      {[160, 320, 480, 640, 800, 960].map((x) => (
        <line key={`lon-${x}`} x1={x} y1="46" x2={x} y2={MAP_HEIGHT - 42} stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
      ))}
      {[104, 188, 272, 356, 440].map((y) => (
        <line key={`lat-${y}`} x1="44" y1={y} x2={MAP_WIDTH - 44} y2={y} stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
      ))}

      <path
        d="M114 166c34-40 86-67 144-72 57-5 118 11 156 43 35 31 55 76 44 118-12 44-57 78-117 91-65 14-149 6-189-27-42-35-54-88-38-127Z"
        fill="rgba(255,255,255,0.08)"
      />
      <path
        d="M289 298c34-29 79-43 124-39 35 4 75 21 89 51 14 30 1 66-31 90-32 24-80 37-121 30-41-7-79-35-86-70-6-24 4-43 25-62Z"
        fill="rgba(255,255,255,0.08)"
      />
      <path
        d="M438 118c41-30 103-44 165-38 65 7 123 34 154 78 29 42 31 102 1 149-31 47-101 79-177 84-81 5-154-16-190-58-36-44-35-110 1-156 12-16 27-30 46-41Z"
        fill="rgba(255,255,255,0.08)"
      />
      <path
        d="M732 308c36-16 81-17 116-4 36 14 65 45 76 83 11 40 2 84-28 113-30 28-79 39-121 26-44-14-80-53-85-98-6-48 12-92 42-120Z"
        fill="rgba(255,255,255,0.08)"
      />
      <path
        d="M888 144c22-18 55-28 87-26 27 1 53 13 69 33 15 20 21 48 15 74-7 29-31 52-62 64-34 14-74 17-103 2-25-12-40-37-42-63-3-32 9-60 36-84Z"
        fill="rgba(255,255,255,0.08)"
      />

      {activeStations.map((station) => {
        const { x, y } = projectToMap(station.location.lat, station.location.lng)

        return (
          <path
            key={`line-${station.id}`}
            d={`M ${x} ${y} Q ${(x + ORION_ANCHOR.x) / 2} ${Math.min(y, ORION_ANCHOR.y) - 60} ${ORION_ANCHOR.x} ${ORION_ANCHOR.y}`}
            fill="none"
            stroke="rgba(96,165,250,0.85)"
            strokeWidth="2.5"
            strokeDasharray="8 9"
            strokeLinecap="round"
          />
        )
      })}

      <circle cx={ORION_ANCHOR.x} cy={ORION_ANCHOR.y} r="44" fill="url(#orion-glow)" />
      <circle cx={ORION_ANCHOR.x} cy={ORION_ANCHOR.y} r="12" fill="#FFFFFF" />
      <circle cx={ORION_ANCHOR.x} cy={ORION_ANCHOR.y} r="22" fill="none" stroke="rgba(255,255,255,0.22)" />
      <text x={ORION_ANCHOR.x} y={ORION_ANCHOR.y - 28} textAnchor="middle" className="fill-white text-[13px] font-medium">
        Orion
      </text>

      <text x="52" y="54" className="fill-white/80 text-[12px] uppercase tracking-[0.28em]">
        Deep Space Network Coverage
      </text>

      {stations.map((station) => {
        const { x, y } = projectToMap(station.location.lat, station.location.lng)

        return (
          <g key={station.id}>
            {station.isActive ? <circle cx={x} cy={y} r="18" fill="rgba(16,185,129,0.18)" className="animate-pulse" /> : null}
            <circle cx={x} cy={y} r="7" fill={station.isActive ? '#10B981' : '#94A3B8'} />
            <circle cx={x} cy={y} r="13" fill="none" stroke={station.isActive ? 'rgba(16,185,129,0.45)' : 'rgba(148,163,184,0.3)'} />
            <text x={x} y={y + 26} textAnchor="middle" className="fill-white text-[12px] font-medium">
              {station.friendlyName}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function DSNTracker() {
  const { data, loading, error, lastUpdated } = useDSN()
  const hasSample = Boolean(data)
  const stations = data?.stations.length ? data.stations : FALLBACK_STATIONS
  const activeStations = stations.filter((station) => station.isActive && station.activeDish)
  const activeStation = getPrimaryActiveStation(stations)
  const feedStatus = getFeedStatus(hasSample, loading, error)
  const networkSummary = getNetworkSummary(activeStations)
  const feedTimestamp = data?.fetchedAt || lastUpdated
  const liveLinkProfile = [
    ['Light time', formatLightTime(activeStation?.activeDish?.lightTimeSeconds)],
    ['Range', formatRangeKm(activeStation?.activeDish?.rangeKm)],
    ['Downlink', formatTransferRate(activeStation?.activeDish?.downlink?.dataRateBps)],
    ['Uplink', formatTransferRate(activeStation?.activeDish?.uplink?.dataRateBps)],
  ]

  return (
    <div className="card overflow-hidden">
      <div
        className="border-b border-[color:var(--border)] px-6 py-6 md:px-8 md:py-8"
        style={{ backgroundImage: 'radial-gradient(circle at top left, rgba(37,99,235,0.12), transparent 42%)' }}
      >
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="section-label">Tracking map</p>
            <h3 className="section-title mt-2">Live antenna coverage</h3>
            <p className="section-copy mt-2">
              Goldstone, Madrid, and Canberra are plotted against a simplified global outline to show the current Deep Space Network handoff.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                Orion
              </span>
              {stations.map((station) => {
                const stationBadge = getStationBadge(station)

                return (
                  <span
                    key={station.id}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${stationBadge.badgeClass}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${stationBadge.dot}`} />
                    {station.friendlyName}
                  </span>
                )
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
            <div className="card-muted p-4">
              <p className="eyebrow">Feed state</p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${feedStatus.tone} ${loading ? 'animate-pulse' : ''}`} />
                <p className="text-sm font-medium text-[color:var(--text)]">{feedStatus.label}</p>
              </div>
              <p className="mt-2 text-sm text-[color:var(--muted)]">{feedStatus.detail}</p>
            </div>

            <div className="card-muted p-4">
              <p className="eyebrow">Last updated</p>
              <p className="mt-2 font-mono text-sm text-[color:var(--text)]">{formatFeedTime(feedTimestamp)}</p>
              <p className="mt-2 text-sm text-[color:var(--muted)]">{data?.source || 'NASA DSN Now'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1.6fr)_390px]">
        <div className="flex flex-col border-b border-[color:var(--border)] bg-[#050A14] p-4 md:p-6 xl:border-b-0 xl:border-r xl:p-8">
          {renderMap(stations, activeStations)}

          <div className="mt-10 border-t border-slate-800/60 pt-6">
            <h4 className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-white/50">
              Signal Telemetry
            </h4>
            <div className="flex flex-col gap-2">
              {stations.map((station) => {
                const isActive = station.isActive
                const tone = isActive ? 'text-emerald-400' : 'text-slate-500'
                const bgTone = isActive ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-800/30 border-slate-700/50'
                
                const freq = station.activeDish?.downlink?.frequencyMhz || station.activeDish?.uplink?.frequencyMhz || 0
                const rate = station.activeDish?.downlink?.dataRateBps || station.activeDish?.uplink?.dataRateBps || 0
                const rateKbps = (rate / 1000).toFixed(1)
                
                const dishName = station.activeDish?.name || ''
                const is70m = ['14', '43', '63'].some((id) => dishName.includes(id))
                const dishSize = station.activeDish ? (is70m ? '70M' : '34M') : '—'

                return (
                  <div key={station.id} className={`flex items-center justify-between rounded border px-4 py-3 font-mono text-xs ${bgTone}`}>
                    <div className="flex flex-[1.2] items-center gap-2 min-w-0">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                      <span className={`truncate uppercase tracking-wider ${tone}`}>{station.friendlyName}</span>
                    </div>
                    
                    <div className={`flex-1 tracking-wider ${tone}`}>
                      {isActive ? 'ACTIVE' : 'STANDBY'}
                    </div>

                    <div className="flex-1 text-slate-300">
                      {isActive && freq > 0 ? `${freq.toFixed(2)} MHz` : '—'}
                    </div>

                    <div className="flex-1 text-slate-300">
                      {isActive && rate > 0 ? `${rateKbps} kbps` : '—'}
                    </div>

                    <div className="flex-[0.8] text-right text-slate-400">
                      {dishSize}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="bg-[color:var(--surface)] p-6 md:p-8">
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="section-label">{networkSummary.eyebrow}</p>
                  <h3 className="mt-2 text-[30px] font-semibold tracking-[-0.02em] text-[color:var(--text)]">{networkSummary.title}</h3>
                </div>
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${networkSummary.badgeClass}`}>
                  {networkSummary.badge}
                </span>
              </div>

              <p className="text-sm leading-7 text-[color:var(--muted)]">{networkSummary.detail}</p>
              <p className="text-sm text-[color:var(--text)]">{networkSummary.support}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="card-muted p-4">
              <p className="eyebrow">Primary carrier</p>
              <p className="mt-2 text-lg font-semibold text-[color:var(--text)]">{activeStation?.friendlyName || 'None'}</p>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                {activeStation?.activeDish?.name || 'No station is reporting an Orion lock in the current sample.'}
              </p>
            </div>

            <div className="card-muted p-4">
              <p className="eyebrow">Stations in contact</p>
              <p className="mt-2 font-mono text-lg text-[color:var(--text)]">{activeStations.length}</p>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                {activeStations.length
                  ? `${joinLabels(activeStations.map((station) => station.friendlyName))} currently report Orion visibility.`
                  : 'Goldstone, Madrid, and Canberra are all in standby for the present sample.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid border-t border-[color:var(--border)] lg:grid-cols-[0.9fr_0.8fr_1.3fr]">
        <div className="border-b border-[color:var(--border)] p-6 md:p-8 lg:border-b-0 lg:border-r">
          <p className="section-label">Link profile</p>
          <div className="mt-5 divide-y divide-[color:var(--border)]">
            {liveLinkProfile.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 py-3">
                <span className="text-sm text-[color:var(--muted)]">{label}</span>
                <span className="font-mono text-sm text-[color:var(--text)]">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-b border-[color:var(--border)] p-6 md:p-8 lg:border-b-0 lg:border-r">
          <p className="section-label">Network health</p>
          <div className="mt-5 space-y-4">
            <div className="card-muted p-4">
              <p className="eyebrow">Feed source</p>
              <p className="mt-1 text-sm font-medium text-[color:var(--text)]">{data?.source || 'NASA DSN Now'}</p>
            </div>
            <div className="card-muted p-4">
              <p className="eyebrow">Refresh cadence</p>
              <p className="mt-1 text-sm font-medium text-[color:var(--text)]">Every {POLL_INTERVAL_SECONDS} seconds</p>
            </div>
            <div className="card-muted p-4">
              <p className="eyebrow">Tracker mode</p>
              <p className="mt-1 text-sm font-medium text-[color:var(--text)]">{activeStations.length > 1 ? 'Handoff watch' : 'Single-link watch'}</p>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="section-label">Station states</p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[color:var(--text)]">Ground network</h3>
            </div>
            <p className="pt-1 text-sm text-[color:var(--muted)]">{stations.length} stations monitored</p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {stations.map((station) => {
              const stationBadge = getStationBadge(station)

              return (
                <div key={station.id} className="card-muted h-full p-4">
                  <div className="flex h-full flex-col gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[color:var(--text)]">{station.friendlyName}</p>
                      <p className="mt-1 font-mono text-xs tracking-[0.06em] text-[color:var(--muted)]">
                        {station.location.lat.toFixed(2)}°, {station.location.lng.toFixed(2)}°
                      </p>
                    </div>

                    <div>
                      <span
                        className={`inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium ${stationBadge.badgeClass}`}
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${stationBadge.dot}`} />
                        {stationBadge.label}
                      </span>
                    </div>

                    <p className="text-sm leading-6 text-[color:var(--muted)]">{stationBadge.detail}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
