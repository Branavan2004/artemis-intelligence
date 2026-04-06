import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import CrewActivityFeed from '../components/CrewActivityFeed'
import DSNTracker from '../components/DSNTracker'
import WindowView from '../components/WindowView'
import { useDSN } from '../hooks/useDSN'
import { useTelemetry } from '../hooks/useTelemetry'
import { api, SOCKET_URL } from '../lib/api'
import { formatMissionMet, getMissionHoursElapsed } from '../lib/mission'
import { getDistanceFromEarthKm, getVelocityKmS } from '../lib/replay'

interface MissionData {
  name: string
  status: string
  progress: number
  launchDate: string
  duration: string
  phases: { name: string; startHour: number; endHour: number }[]
  objectives: string[]
  spacecraft: { name: string; rocket: string; launchSite: string; splashdownTarget: string }
}

interface MissionUpdate {
  timestamp: string
  missionElapsedTime: string
  phase: string
}

interface AnomalyLogEntry {
  met: string
  severity: 'nominal' | 'caution' | 'abort'
  system: string
  event: string
  resolved: boolean
  note?: string
}

const APOLLO_13_RECORD_KM = 400171
const SOLAR_ECLIPSE_START_MS = Date.parse('2026-04-07T00:02:00Z')
const SOLAR_ECLIPSE_END_MS = Date.parse('2026-04-07T00:55:00Z')

const PHASE_WINDOWS = [
  {
    name: 'Earth Orbit',
    start: 0,
    end: 25,
    description: 'Initial checkout, systems validation, and crew adaptation in Earth orbit.',
  },
  {
    name: 'Cislunar Transit',
    start: 25,
    end: 94,
    description: 'Orion rides outbound toward the Moon while teams watch navigation, comms, and crew tempo.',
  },
  {
    name: 'Lunar Flyby',
    start: 94,
    end: 120,
    description: 'The mission reaches lunar distance for its highest-precision and highest-visibility operations.',
  },
  {
    name: 'Return Transit',
    start: 120,
    end: 204,
    description: 'A long inbound coast back to Earth with consumables, systems, and crew rhythm under constant watch.',
  },
  {
    name: 'Reentry & Recovery',
    start: 204,
    end: Number.POSITIVE_INFINITY,
    description: 'Ground and flight teams converge on the final return corridor, splashdown, and recovery sequence.',
  },
] as const

const MISSION_MILESTONES = [
  { hour: 25 + 14 / 60, label: 'Translunar Injection' },
  { hour: 94, label: 'Lunar Sphere Entry' },
  { hour: 115 + 10 / 60, label: 'Record Break' },
  { hour: 120 + 27 / 60, label: 'Closest Approach' },
  { hour: 204 + 25 / 60, label: 'Reentry' },
  { hour: 204 + 55 / 60, label: 'Splashdown' },
] as const

const DSN_STATIONS = [
  { code: 'GOLDSTONE  CA', id: 'gdscc' },
  { code: 'MADRID     ES', id: 'mdscc' },
  { code: 'CANBERRA   AU', id: 'cdscc' },
] as const

const ANOMALY_LOG: AnomalyLogEntry[] = [
  {
    met: '00:02:15',
    severity: 'nominal',
    system: 'SOLAR ARRAYS',
    event: 'All 4 SAWs deployed — nominal configuration confirmed',
    resolved: true,
  },
  {
    met: '00:30:00',
    severity: 'caution',
    system: 'TOILET (WASTE MGT)',
    event: 'Toilet malfunction reported immediately after reaching orbit',
    resolved: false,
    note: 'Crew adapting — work-around in place',
  },
  {
    met: '74:09:00',
    severity: 'caution',
    system: 'ENVIRONMENTAL',
    event: 'Unusual smell reported by crew Saturday morning',
    resolved: false,
    note: 'Flight team investigated — power/heater data nominal. Possibly mechanical off-gassing from tapes/materials',
  },
  {
    met: '74:35:00',
    severity: 'nominal',
    system: 'ENVIRONMENTAL',
    event: 'NASA: No hazardous condition identified — investigation ongoing',
    resolved: true,
  },
] as const

const ORION_SYSTEM_STATUS = [
  { label: 'LIFE SUPPORT', status: 'GO' },
  { label: 'PROPULSION', status: 'GO' },
  { label: 'COMMUNICATIONS', status: 'GO' },
  { label: 'NAVIGATION', status: 'GO' },
  { label: 'POWER (SOLAR)', status: 'GO' },
  { label: 'THERMAL CTRL', status: 'GO' },
  { label: 'WASTE MGMT', status: 'FAULT' },
  { label: 'ENVIRONMENTAL', status: 'CAUTION' },
  { label: 'LASER COMMS', status: 'GO' },
] as const

function padMet(value: string) {
  const [hours = '00', minutes = '00', seconds = '00'] = (value || '00:00:00').split(':')
  return `${hours.padStart(3, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`
}

function formatCountdown(hoursRemaining: number) {
  const totalSeconds = Math.max(0, Math.round(hoursRemaining * 3600))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(3, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatEclipseCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `T−${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getRiskColor(riskLevel: 'nominal' | 'elevated' | 'severe') {
  if (riskLevel === 'severe') return 'var(--abort)'
  if (riskLevel === 'elevated') return 'var(--caution)'
  return 'var(--go)'
}

function getStatusTone(status: 'GO' | 'CAUTION' | 'FAULT') {
  if (status === 'FAULT') return 'var(--abort)'
  if (status === 'CAUTION') return 'var(--caution)'
  return 'var(--go)'
}

function getAnomalySeverityColor(severity: 'nominal' | 'caution' | 'abort') {
  if (severity === 'abort') return 'var(--abort)'
  if (severity === 'caution') return 'var(--caution)'
  return 'var(--go)'
}

function getMissionPhaseWindow(hoursElapsed: number) {
  return PHASE_WINDOWS.find((phase) => hoursElapsed >= phase.start && hoursElapsed < phase.end) ?? PHASE_WINDOWS[0]
}

export default function Dashboard() {
  const [mission, setMission] = useState<MissionData | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [apod, setApod] = useState<{ url: string; title: string; explanation: string } | null>(null)
  const [telemetryState, setTelemetryState] = useState<'connecting' | 'live' | 'offline'>('connecting')
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const { data: telemetry } = useTelemetry()
  const { data: dsnData, lastUpdated: dsnUpdatedAt } = useDSN()

  useEffect(() => {
    api.get('/api/mission').then((response) => setMission(response.data))
    api
      .get('/api/mission/apod')
      .then((response) => setApod(response.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const socket = io(SOCKET_URL)

    socket.on('connect', () => {
      setTelemetryState('live')
      socket.emit('subscribe:mission')
    })

    socket.on('connect_error', () => {
      setTelemetryState('offline')
    })

    socket.on('disconnect', () => {
      setTelemetryState('offline')
    })

    socket.on('mission:update', (update: MissionUpdate) => {
      setLastSyncAt(update.timestamp)
      setTelemetryState('live')
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  if (!mission) {
    return (
      <div className="page-shell">
        <div
          className="panel-frame"
          style={{
            minHeight: 'calc(100vh - 180px)',
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <span className="panel-label">Mission Control</span>
            <h1 className="section-title">Loading live mission desk</h1>
            <p className="section-copy">Pulling Artemis II mission data, telemetry feeds, and current cislunar context.</p>
          </div>
        </div>
      </div>
    )
  }

  const hoursElapsed = getMissionHoursElapsed(mission.launchDate, now)
  const totalMissionHours = mission.phases[mission.phases.length - 1]?.endHour ?? 240
  const metElapsed = padMet(formatMissionMet(mission.launchDate, now))
  const fallbackDistanceFromEarthKm = getDistanceFromEarthKm(hoursElapsed)
  const fallbackSpeedKmS = getVelocityKmS(hoursElapsed)
  const trajectorySampleTime = telemetry?.trajectory?.timestamp ? new Date(telemetry.trajectory.timestamp) : null
  const secondsSinceTrajectorySample =
    trajectorySampleTime && !Number.isNaN(trajectorySampleTime.getTime())
      ? Math.max(0, (now.getTime() - trajectorySampleTime.getTime()) / 1000)
      : 0
  const trajectoryDirection = hoursElapsed < 120 ? 1 : -1
  const distanceFromEarthKm = telemetry?.trajectory
    ? Math.max(0, telemetry.trajectory.distanceFromEarthKm + trajectoryDirection * telemetry.trajectory.speedKmS * secondsSinceTrajectorySample)
    : fallbackDistanceFromEarthKm
  const speedKmS = telemetry?.trajectory?.speedKmS ?? fallbackSpeedKmS
  const signalDelaySeconds = distanceFromEarthKm / 299792
  const distanceFromMoonKm = Math.abs(384400 - distanceFromEarthKm)
  const riskLevel = telemetry?.spaceWeather?.riskLevel ?? 'nominal'
  const riskColor = getRiskColor(riskLevel)
  const missionPhase = getMissionPhaseWindow(hoursElapsed)
  const missionProgress = Math.min(100, Math.max(0, (hoursElapsed / totalMissionHours) * 100))
  const nextMilestone = MISSION_MILESTONES.find((milestone) => hoursElapsed < milestone.hour) ?? null
  const activeStationIndex = Math.floor(now.getTime() / 3600000) % DSN_STATIONS.length
  const recordBroken = distanceFromEarthKm >= APOLLO_13_RECORD_KM
  const recordProgress = Math.min(100, (distanceFromEarthKm / APOLLO_13_RECORD_KM) * 100)
  const dsnTimestamp = dsnUpdatedAt
    ? dsnUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : telemetryState.toUpperCase()
  const nowMs = now.getTime()
  const eclipseState = nowMs < SOLAR_ECLIPSE_START_MS ? 'upcoming' : nowMs <= SOLAR_ECLIPSE_END_MS ? 'live' : 'complete'
  const eclipseCountdown = formatEclipseCountdown(SOLAR_ECLIPSE_START_MS - nowMs)
  const eclipseProgress = Math.min(
    100,
    Math.max(0, ((nowMs - SOLAR_ECLIPSE_START_MS) / (SOLAR_ECLIPSE_END_MS - SOLAR_ECLIPSE_START_MS)) * 100),
  )
  const anomalyOpenCount = ANOMALY_LOG.filter((entry) => !entry.resolved).length
  const anomalyClosedCount = ANOMALY_LOG.length - anomalyOpenCount

  return (
    <div
      className="dashboard-shell stagger"
      data-apod-title={apod?.title ?? ''}
      data-last-sync-at={lastSyncAt ?? ''}
      data-mission-name={mission.name}
      data-dsn-source={dsnData?.source ?? ''}
      data-telemetry-state={telemetryState}
    >
      <div className="dashboard-main">
        <section className="dashboard-telemetry-strip">
          <div className="dashboard-telemetry-cell">
            <span className="dashboard-telemetry-label">Mission Elapsed Time</span>
            <span key={metElapsed} className="dashboard-telemetry-value flash">
              {metElapsed}
            </span>
          </div>

          <div className="dashboard-telemetry-cell">
            <span className="dashboard-telemetry-label">Distance From Earth</span>
            <span key={Math.round(distanceFromEarthKm)} className="dashboard-telemetry-value flash">
              {Math.round(distanceFromEarthKm).toLocaleString()} km
            </span>
          </div>

          <div className="dashboard-telemetry-cell">
            <span className="dashboard-telemetry-label">Velocity</span>
            <span key={speedKmS.toFixed(3)} className="dashboard-telemetry-value flash">
              {speedKmS.toFixed(3)} km/s
            </span>
          </div>

          <div className="dashboard-telemetry-cell">
            <span className="dashboard-telemetry-label">Signal Delay</span>
            <span key={signalDelaySeconds.toFixed(2)} className="dashboard-telemetry-value flash">
              {signalDelaySeconds.toFixed(2)} s
            </span>
          </div>

          <div className="dashboard-telemetry-cell">
            <span className="dashboard-telemetry-label">Radiation</span>
            <span key={riskLevel} className="dashboard-telemetry-status flash" style={{ color: riskColor }}>
              <span className="dashboard-status-dot" style={{ background: riskColor }} />
              {riskLevel.toUpperCase()}
            </span>
          </div>
        </section>

        <section className="dashboard-section-frame" style={{ padding: 24 }}>
          <div className="panel-header">
            <span className="panel-label">Deep Space Network</span>
            <span className="panel-live">Live</span>
          </div>
          <DSNTracker />
        </section>

        <section className="dashboard-section-frame dashboard-feed-frame">
          <CrewActivityFeed metElapsed={metElapsed} />
        </section>
      </div>

      <aside className="dashboard-sidebar">
        <div className="dashboard-sticky">
          <section className="mission-sidebar-panel">
            <header className="panel-header">
              <span className="panel-label">Mission Phase</span>
              <span className="panel-live">Live</span>
            </header>

            <h2 className="mission-phase-name">{missionPhase.name}</h2>
            <p className="mission-phase-description">{missionPhase.description}</p>

            <div className="mission-progress-track">
              <div className="mission-progress-fill" style={{ width: `${missionProgress}%` }} />
            </div>

            <div className="mission-sidebar-meta">
              {nextMilestone ? `T-${formatCountdown(nextMilestone.hour - hoursElapsed)} to ${nextMilestone.label}` : 'T-000:00:00 to Recovery Complete'}
            </div>
          </section>

          <section className="mission-sidebar-panel">
            <div>
              <div className="signal-delay-display flash" key={signalDelaySeconds.toFixed(2)}>
                {signalDelaySeconds.toFixed(2)}
              </div>
              <div className="signal-delay-unit">Seconds</div>
              <p className="signal-delay-copy">one-way light speed delay</p>
            </div>

            <div className="panel-divider" />

            <div className="panel-label">Deep Space Network</div>
            <div className="dsn-station-list">
              {DSN_STATIONS.map((station, index) => {
                const isActive = index === activeStationIndex

                return (
                  <div key={station.id} className="dsn-station-row">
                    <div className="dsn-station-name">
                      <span className={`dsn-station-state${isActive ? ' dsn-station-state--active' : ''}`} />
                      {station.code}
                    </div>

                    <div className="dsn-bars" aria-hidden="true">
                      {Array.from({ length: 5 }).map((_, barIndex) => (
                        <span key={`${station.id}-${barIndex}`} className={`dsn-bar${isActive && barIndex < 3 ? ' dsn-bar--active' : ''}`} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mission-sidebar-meta" style={{ marginTop: 14 }}>
              Feed {dsnTimestamp}
            </div>
          </section>

          <section className="mission-sidebar-panel">
            <header className="panel-header">
              <span className="panel-label">Orion Window View</span>
              <span className="panel-live">Live</span>
            </header>

            <div className="dashboard-window-wrap">
              <WindowView
                distanceFromEarthKm={distanceFromEarthKm}
                distanceFromMoonKm={distanceFromMoonKm}
                metElapsed={metElapsed}
              />
            </div>
          </section>

          {/* Distance Record section hidden for demo
          <section className="mission-sidebar-panel">
            <header className="panel-header">
              <span className="panel-label">Distance Record</span>
            </header>

            <div className={`record-row record-row--baseline${recordBroken ? ' record-row--broken' : ''}`}>
              <span>Apollo 13</span>
              <span>400,171 km</span>
            </div>

            <div className="record-row record-row--current">
              <span>Artemis II</span>
              <span>{Math.round(distanceFromEarthKm).toLocaleString()} km</span>
            </div>

            <div className="mission-progress-track" style={{ marginTop: 16 }}>
              <div
                className="mission-progress-fill"
                style={{
                  width: `${Math.min(100, recordProgress)}%`,
                  background: recordBroken ? 'var(--go)' : 'var(--accent)',
                }}
              />
            </div>

            {recordBroken ? (
              <div className="record-new slide-up">★ NEW RECORD</div>
            ) : null}
          </section>
          */}

          <section className="mission-sidebar-panel dashboard-widget-panel">
            <header className="panel-header">
              <span className="panel-label">Solar Eclipse · Crew View</span>
              <span
                className={`dashboard-widget-badge${
                  eclipseState === 'live'
                    ? ' dashboard-widget-badge--live'
                    : eclipseState === 'complete'
                      ? ' dashboard-widget-badge--complete'
                      : ''
                }`}
              >
                {eclipseState === 'live' ? 'Live' : eclipseState === 'complete' ? 'Complete' : 'Upcoming'}
              </span>
            </header>

            <div className="dashboard-eclipse-shell">
              <div className="dashboard-eclipse-copy">
                {eclipseState === 'upcoming' ? (
                  <>
                    <div className="dashboard-eclipse-countdown flash" key={eclipseCountdown}>
                      {eclipseCountdown}
                    </div>
                    <p className="dashboard-eclipse-body">until crew witnesses total solar eclipse</p>
                    <p className="dashboard-eclipse-note">
                      Moon will block the Sun from Orion&apos;s perspective · 53 min duration
                    </p>
                  </>
                ) : null}

                {eclipseState === 'live' ? (
                  <>
                    <div className="dashboard-eclipse-active">
                      <span className="dashboard-eclipse-active-dot pulse" />
                      ECLIPSE ACTIVE
                    </div>
                    <div className="dashboard-mini-progress">
                      <div className="dashboard-mini-progress-fill" style={{ width: `${eclipseProgress}%` }} />
                    </div>
                    <p className="dashboard-eclipse-body">Moon occluding Sun · Crew in shadow</p>
                  </>
                ) : null}

                {eclipseState === 'complete' ? (
                  <div className="dashboard-eclipse-complete">ECLIPSE COMPLETE ✓</div>
                ) : null}
              </div>

              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                aria-hidden="true"
                className="dashboard-eclipse-icon"
              >
                <circle cx="10" cy="10" r="8" fill="none" stroke="var(--caution)" strokeWidth="1" />
                <circle cx="10" cy="10" r="6" fill="var(--surface)" />
              </svg>
            </div>
          </section>

          <section className="mission-sidebar-panel dashboard-widget-panel">
            <header className="panel-header">
              <span className="panel-label">Anomaly Log</span>
              <span className="dashboard-widget-badge">{ANOMALY_LOG.length} Entries</span>
            </header>

            <div className="dashboard-anomaly-list">
              {ANOMALY_LOG.map((entry) => (
                <article key={`${entry.met}-${entry.system}`} className="dashboard-anomaly-entry">
                  <div className="dashboard-anomaly-row">
                    <span
                      className="dashboard-severity-dot"
                      style={{ background: getAnomalySeverityColor(entry.severity) }}
                      aria-hidden="true"
                    />
                    <span className="dashboard-anomaly-met">{entry.met}</span>
                    <span className="dashboard-anomaly-system">{entry.system}</span>
                    <span
                      className={`dashboard-anomaly-badge${
                        entry.resolved ? ' dashboard-anomaly-badge--closed' : ' dashboard-anomaly-badge--open'
                      }`}
                    >
                      {entry.resolved ? 'CLOSED' : 'OPEN'}
                    </span>
                  </div>

                  <p className="dashboard-anomaly-event">{entry.event}</p>
                  {entry.note ? <p className="dashboard-anomaly-note">{entry.note}</p> : null}
                </article>
              ))}
            </div>

            <footer className="dashboard-anomaly-footer">
              {anomalyOpenCount} open · {anomalyClosedCount} closed
            </footer>
          </section>

          <section className="mission-sidebar-panel dashboard-widget-panel">
            <header className="panel-header">
              <span className="panel-label">Spacecraft Systems</span>
            </header>

            <div className="dashboard-systems-grid">
              {ORION_SYSTEM_STATUS.map((system) => {
                const tone = getStatusTone(system.status)

                return (
                  <div
                    key={system.label}
                    className={`dashboard-system-cell${
                      system.status === 'FAULT'
                        ? ' dashboard-system-cell--fault'
                        : system.status === 'CAUTION'
                          ? ' dashboard-system-cell--caution'
                          : ''
                    }`}
                  >
                    <div className="dashboard-system-name">{system.label}</div>
                    <div className="dashboard-system-status" style={{ color: tone }}>
                      <span className="dashboard-system-status-dot" style={{ background: tone }} />
                      {system.status}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </aside>
    </div>
  )
}
