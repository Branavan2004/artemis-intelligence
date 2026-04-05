import { useEffect, useState } from 'react'
import MissionTimeline from '../components/MissionTimeline'
import TelemetryMap3D from '../components/TelemetryMap3D'
import { type TelemetryPayload, useTelemetry } from '../hooks/useTelemetry'
import { api } from '../lib/api'
import { formatMissionMetFromHours, formatMissionMetFromTimestamp, getMissionHoursElapsed } from '../lib/mission'
import {
  MissionPhaseWindow,
  clampMissionHour,
  getCrewFocus,
  getDistanceFromEarthKm,
  getLatestReplayEvents,
  getMissionBriefing,
  getPhaseCompletion,
  getReplayPhase,
  getReplayProgress,
  getUpcomingReplayEvent,
  getTrajectoryLabel,
  getVelocityKmS,
} from '../lib/replay'

interface MissionData {
  name: string
  status: string
  progress: number
  launchDate: string
  duration: string
  phases: MissionPhaseWindow[]
  objectives: string[]
  spacecraft: { name: string; rocket: string; launchSite: string; splashdownTarget: string }
}

const APOLLO_13_RECORD_KM = 400171
const REPLAY_SPEEDS = [0.5, 1, 2, 4] as const
const REPLAY_STEP_HOURS = 0.25

function formatReplayClock(hour: number) {
  const wholeHours = Math.floor(hour)
  const minutes = Math.floor((hour - wholeHours) * 60)
  return `T+ ${String(wholeHours).padStart(3, '0')}h ${String(minutes).padStart(2, '0')}m`
}

function getLiveSourceLabel(telemetry: TelemetryPayload | null) {
  return [telemetry?.trajectory?.source, telemetry?.spaceWeather?.source].filter(Boolean).join(' + ')
}

export default function Replay() {
  const [mission, setMission] = useState<MissionData | null>(null)
  const [replayHour, setReplayHour] = useState(0)
  const [isLiveMode, setIsLiveMode] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [replaySpeed, setReplaySpeed] = useState<(typeof REPLAY_SPEEDS)[number]>(1)
  const { data: telemetry, loading: telemetryLoading, error: telemetryError } = useTelemetry()

  useEffect(() => {
    api.get('/api/mission').then((response) => setMission(response.data))
  }, [])

  useEffect(() => {
    if (!mission || !isLiveMode) return

    const syncToLive = () => {
      setReplayHour(clampMissionHour(getMissionHoursElapsed(mission.launchDate)))
    }

    syncToLive()
    const interval = window.setInterval(syncToLive, 1000)
    return () => window.clearInterval(interval)
  }, [mission, isLiveMode])

  useEffect(() => {
    if (isLiveMode || !isPlaying) return

    const interval = window.setInterval(() => {
      setReplayHour((current) => Math.min(current + REPLAY_STEP_HOURS * replaySpeed, 240))
    }, 200)

    return () => window.clearInterval(interval)
  }, [isLiveMode, isPlaying, replaySpeed])

  useEffect(() => {
    if (replayHour >= 240 && isPlaying) {
      setIsPlaying(false)
    }
  }, [isPlaying, replayHour])

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
            <span className="panel-label">Replay</span>
            <h1 className="section-title">Loading mission replay</h1>
            <p className="section-copy">Syncing Artemis II phase windows, telemetry, and timeline state.</p>
          </div>
        </div>
      </div>
    )
  }

  const liveMissionHour = clampMissionHour(getMissionHoursElapsed(mission.launchDate))
  const liveTrajectory = telemetry?.trajectory
  const liveSpaceWeather = telemetry?.spaceWeather
  const liveSourceLabel = getLiveSourceLabel(telemetry)
  const liveMetElapsed = formatMissionMetFromTimestamp(
    mission.launchDate,
    liveTrajectory?.timestamp ?? liveSpaceWeather?.timestamp,
  )
  const liveDistance = liveTrajectory?.distanceFromEarthKm ?? getDistanceFromEarthKm(liveMissionHour)
  const liveVelocity = liveTrajectory?.speedKmS ?? getVelocityKmS(liveMissionHour)
  const activeHour = isLiveMode ? liveMissionHour : replayHour
  const selectedMetElapsed = isLiveMode ? liveMetElapsed : formatMissionMetFromHours(replayHour)
  const mapDistance = isLiveMode ? liveDistance : getDistanceFromEarthKm(replayHour)
  const mapVelocity = isLiveMode ? liveVelocity : getVelocityKmS(replayHour)
  const activePhase = getReplayPhase(mission.phases, activeHour)
  const briefing = getMissionBriefing(activePhase.name)
  const visibleEvents = getLatestReplayEvents(activeHour)
  const upcomingEvent = getUpcomingReplayEvent(activeHour)
  const replayProgress = getReplayProgress(activeHour)
  const phaseProgress = getPhaseCompletion(activePhase, activeHour)
  const signalDelaySeconds = mapDistance / 299792
  const selectedMoonDistance = Math.abs(384400 - mapDistance)
  const liveMoonDistance = liveTrajectory?.distanceFromMoonKm ?? Math.abs(384400 - liveDistance)
  const recordBroken = mapDistance >= APOLLO_13_RECORD_KM
  const recordProgress = Math.min(100, (mapDistance / APOLLO_13_RECORD_KM) * 100)
  const telemetryStatus = telemetryLoading ? 'Syncing' : telemetryError ? 'Fallback' : isLiveMode ? 'Live' : 'Replay'

  return (
    <div className="replay-immersive" data-mission-name={mission.name}>
      <div className="replay-immersive__stage">
        <div className="replay-immersive__map">
          <TelemetryMap3D
            distanceFromEarthKm={mapDistance}
            speedKmS={mapVelocity}
            metElapsed={selectedMetElapsed}
            riskLevel={liveSpaceWeather?.riskLevel ?? 'nominal'}
            fullscreen
          />
        </div>

        <section className="replay-overlay-panel replay-overlay-panel--hud replay-enter-left">
          <div className="replay-overlay-heading">Orion Telemetry</div>

          {[
            ['MET', selectedMetElapsed],
            ['DISTANCE', `${Math.round(mapDistance).toLocaleString()} km`],
            ['VELOCITY', `${mapVelocity.toFixed(3)} km/s`],
            ['SIGNAL', `${signalDelaySeconds.toFixed(2)}s delay`],
          ].map(([label, value]) => (
            <div key={label} className="replay-telemetry-row">
              <div className="replay-telemetry-label">{label}</div>
              <div className="replay-telemetry-value">{value}</div>
            </div>
          ))}
        </section>

        <section className="replay-overlay-panel replay-overlay-panel--phase replay-enter-right">
          <div className="panel-header" style={{ marginBottom: 12 }}>
            <span className="panel-label">Mission Phase</span>
            <span className={`replay-overlay-status${telemetryStatus === 'Live' ? ' replay-overlay-status--live' : ''}`}>
              {telemetryStatus}
            </span>
          </div>

          <h2 className="replay-phase-name">{activePhase.name}</h2>
          <p className="replay-phase-description">{briefing.summary}</p>

          <div className={`replay-record-row${recordBroken ? ' replay-record-row--broken' : ''}`}>
            <span>APOLLO 13</span>
            <span>400,171 km</span>
          </div>
          <div className="replay-record-row replay-record-row--current">
            <span>ARTEMIS II</span>
            <span>{Math.round(mapDistance).toLocaleString()} km</span>
          </div>

          <div className="replay-record-progress">
            <div
              className="replay-record-progress-fill"
              style={{
                width: `${Math.min(100, recordProgress)}%`,
                background: recordBroken ? 'var(--go)' : 'var(--accent)',
              }}
            />
          </div>
        </section>

        <section className="replay-overlay-panel replay-overlay-panel--controls replay-enter-bottom">
          <div className="panel-header" style={{ marginBottom: 14 }}>
            <span className="panel-label">Replay Controls</span>
            <span className="replay-overlay-status">{formatReplayClock(activeHour)}</span>
          </div>

          <div className="replay-overlay-mode-toggle">
            <button
              type="button"
              className={`replay-overlay-mode-button${isLiveMode ? ' replay-overlay-mode-button--active' : ''}`}
              onClick={() => {
                setReplayHour(liveMissionHour)
                setIsLiveMode(true)
                setIsPlaying(false)
              }}
            >
              Live
            </button>
            <button
              type="button"
              className={`replay-overlay-mode-button${!isLiveMode ? ' replay-overlay-mode-button--active' : ''}`}
              onClick={() => {
                if (isLiveMode) {
                  setReplayHour(liveMissionHour)
                }
                setIsLiveMode(false)
              }}
            >
              Replay
            </button>
          </div>

          <div className="replay-overlay-controls-row">
            <button
              type="button"
              className="replay-play-button"
              disabled={isLiveMode}
              onClick={() => setIsPlaying((current) => !current)}
            >
              {isPlaying ? 'II' : '>'}
            </button>

            <div className="replay-speed-selector">
              {REPLAY_SPEEDS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  className={`replay-speed-pill${replaySpeed === speed ? ' replay-speed-pill--active' : ''}`}
                  onClick={() => setReplaySpeed(speed)}
                >
                  {speed}×
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="replay-jump-live"
            onClick={() => {
              setReplayHour(liveMissionHour)
              setIsLiveMode(true)
              setIsPlaying(false)
            }}
          >
            Jump Live
          </button>

          <div className="replay-scrubber-wrap replay-scrubber-wrap--overlay">
            <input
              type="range"
              min={0}
              max={240}
              step={0.5}
              value={replayHour}
              onChange={(event) => {
                setIsLiveMode(false)
                setIsPlaying(false)
                setReplayHour(Number(event.target.value))
              }}
              className="replay-scrubber"
            />
          </div>

          <div className="replay-overlay-meta">
            <span>{isLiveMode ? 'Tracking real Orion position' : getTrajectoryLabel(replayHour)}</span>
            <span>
              {telemetryError
                ? 'Fallback mission profile'
                : liveSourceLabel || 'Real-time Orion position from JPL Horizons'}
            </span>
          </div>
        </section>

        <section className="replay-overlay-timeline replay-enter-timeline">
          <MissionTimeline metElapsed={selectedMetElapsed} compact />
        </section>
      </div>

      <div className="replay-immersive__details">
        <div className="replay-detail-grid">
          <section className="replay-detail-panel">
            <header className="panel-header">
              <span className="panel-label">Selected Phase</span>
              <span className="panel-live">{isLiveMode ? 'Live' : 'Replay'}</span>
            </header>

            <h2 className="replay-panel-title">{activePhase.name}</h2>

            <div className="replay-progress-copy">
              <span>Mission Completion</span>
              <span>{Math.round(replayProgress)}%</span>
            </div>
            <div className="mission-progress-track">
              <div className="mission-progress-fill" style={{ width: `${replayProgress}%` }} />
            </div>

            <div className="replay-progress-copy">
              <span>Phase Completion</span>
              <span>{Math.round(phaseProgress)}%</span>
            </div>
            <div className="mission-progress-track">
              <div className="mission-progress-fill" style={{ width: `${phaseProgress}%`, background: 'var(--text-data)' }} />
            </div>

            <div className="replay-key-value">
              <span className="replay-key">Mission Clock</span>
              <span className="replay-value">{selectedMetElapsed}</span>
            </div>
            <div className="replay-key-value">
              <span className="replay-key">Trajectory State</span>
              <span className="replay-value">{getTrajectoryLabel(activeHour)}</span>
            </div>
            <div className="replay-key-value">
              <span className="replay-key">Clock Ref</span>
              <span className="replay-value">{formatReplayClock(activeHour)}</span>
            </div>
          </section>

          <section className="replay-detail-panel">
            <header className="panel-header">
              <span className="panel-label">Telemetry Snapshot</span>
              <span className={`replay-overlay-status${telemetryStatus === 'Live' ? ' replay-overlay-status--live' : ''}`}>
                {telemetryStatus}
              </span>
            </header>

            <div className="replay-key-value">
              <span className="replay-key">Distance</span>
              <span className="replay-value">{Math.round(mapDistance).toLocaleString()} km</span>
            </div>
            <div className="replay-key-value">
              <span className="replay-key">Velocity</span>
              <span className="replay-value">{mapVelocity.toFixed(3)} km/s</span>
            </div>
            <div className="replay-key-value">
              <span className="replay-key">From Moon</span>
              <span className="replay-value">{Math.round(selectedMoonDistance).toLocaleString()} km</span>
            </div>
            <div className="replay-key-value">
              <span className="replay-key">Live Distance</span>
              <span className="replay-value">{Math.round(liveDistance).toLocaleString()} km</span>
            </div>
            <div className="replay-key-value">
              <span className="replay-key">Live Moon</span>
              <span className="replay-value">{Math.round(liveMoonDistance).toLocaleString()} km</span>
            </div>
            <div className="replay-key-value">
              <span className="replay-key">Radiation</span>
              <span className="replay-value">{(liveSpaceWeather?.riskLevel ?? 'nominal').toUpperCase()}</span>
            </div>

            <p className="replay-brief-copy">
              {telemetryError
                ? 'Live telemetry is temporarily unavailable, so this view is grounded in the mission simulation profile.'
                : liveSourceLabel || 'Telemetry sources will appear here when the current feed is available.'}
            </p>
          </section>

          <section className="replay-detail-panel">
            <header className="panel-header">
              <span className="panel-label">Phase Brief</span>
            </header>

            <h2 className="replay-panel-title" style={{ fontSize: 18 }}>
              {activePhase.name}
            </h2>
            <p className="replay-brief-copy">{briefing.summary}</p>
            <p className="replay-brief-copy">{getCrewFocus(activeHour)}</p>
            <div className="mission-sidebar-meta">
              {upcomingEvent ? `NEXT · T+${upcomingEvent.hour}h · ${upcomingEvent.title}` : 'MISSION SEQUENCE COMPLETE'}
            </div>
          </section>

          <section className="replay-detail-panel replay-detail-panel--wide">
            <header className="panel-header">
              <span className="panel-label">Event Log</span>
              <span className="replay-overlay-status">{visibleEvents.length} EVENTS</span>
            </header>

            <div className="replay-event-list">
              {visibleEvents.map((event) => (
                <div key={`${event.hour}-${event.title}`} className="replay-event">
                  <div className="replay-event-title">{event.title}</div>
                  <div className="replay-event-meta">T+ {event.hour}h</div>
                  <p className="replay-brief-copy" style={{ marginTop: 6 }}>
                    {event.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
