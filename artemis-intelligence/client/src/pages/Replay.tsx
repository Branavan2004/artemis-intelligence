import { useEffect, useState } from 'react'
import MissionTimeline from '../components/MissionTimeline'
import TelemetryMap3D from '../components/TelemetryMap3D'
import { LAUNCH_EPOCH_MS, type ReplaySpeed, useReplayClock } from '../hooks/useReplayClock'
import { type TelemetryPayload, useTelemetry } from '../hooks/useTelemetry'
import { api } from '../lib/api'
import {
  MissionPhaseWindow,
  getCrewFocus,
  getLatestReplayEvents,
  getMissionBriefing,
  getPhaseCompletion,
  getReplayPhase,
  getReplayProgress,
  getTrajectoryLabel,
  getUpcomingReplayEvent,
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
const SPEEDS: ReplaySpeed[] = [1, 2, 3, 4]

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
  const { data: telemetry, loading: telemetryLoading, error: telemetryError } = useTelemetry()
  const {
    metString,
    metSeconds,
    speed,
    setSpeed,
    isPlaying,
    setIsPlaying,
    seekToSeconds,
    distanceFromEarthKm,
    speedKmS,
    trajectoryFraction,
  } = useReplayClock()

  useEffect(() => {
    api.get('/api/mission').then((response) => setMission(response.data))
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
            <span className="panel-label">Replay</span>
            <h1 className="section-title">Loading mission replay</h1>
            <p className="section-copy">Syncing Artemis II phase windows, telemetry, and timeline state.</p>
          </div>
        </div>
      </div>
    )
  }

  const activeHour = metSeconds / 3600
  const activePhase = getReplayPhase(mission.phases, activeHour)
  const briefing = getMissionBriefing(activePhase.name)
  const visibleEvents = getLatestReplayEvents(activeHour)
  const upcomingEvent = getUpcomingReplayEvent(activeHour)
  const replayProgress = getReplayProgress(activeHour)
  const phaseProgress = getPhaseCompletion(activePhase, activeHour)
  const signalDelaySeconds = distanceFromEarthKm / 299792
  const selectedMoonDistance = Math.abs(384400 - distanceFromEarthKm)
  const recordBroken = distanceFromEarthKm >= APOLLO_13_RECORD_KM
  const recordProgress = Math.min(100, (distanceFromEarthKm / APOLLO_13_RECORD_KM) * 100)

  const liveTrajectory = telemetry?.trajectory
  const liveSpaceWeather = telemetry?.spaceWeather
  const liveSourceLabel = getLiveSourceLabel(telemetry)
  const liveDistance = liveTrajectory?.distanceFromEarthKm ?? distanceFromEarthKm
  const liveMoonDistance = liveTrajectory?.distanceFromMoonKm ?? Math.abs(384400 - liveDistance)
  const telemetryStatus = telemetryLoading ? 'Syncing' : telemetryError ? 'Fallback' : 'Reference'

  const simDate = new Date(LAUNCH_EPOCH_MS + metSeconds * 1000)
  const simulatedDateLabel = simDate.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  })

  return (
    <div className="replay-immersive" data-mission-name={mission.name}>
      <div className="replay-immersive__stage">
        <div className="replay-immersive__map">
          <TelemetryMap3D
            metElapsed={metString}
            distanceFromEarthKm={distanceFromEarthKm}
            speedKmS={speedKmS}
            trajectoryFraction={trajectoryFraction}
            riskLevel={liveSpaceWeather?.riskLevel ?? 'nominal'}
            fullscreen
          />
        </div>

        <section className="replay-overlay-panel replay-overlay-panel--hud replay-enter-left">
          <div className="replay-overlay-heading">Orion Telemetry</div>

          {[
            ['MET', metString],
            ['DISTANCE', `${Math.round(distanceFromEarthKm).toLocaleString()} km`],
            ['VELOCITY', `${speedKmS.toFixed(3)} km/s`],
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
            <span className={isPlaying ? 'panel-live' : 'replay-overlay-status'}>
              {isPlaying ? `${speed}×` : 'Paused'}
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
            <span>{Math.round(distanceFromEarthKm).toLocaleString()} km</span>
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
            <span className="replay-overlay-status">MET {metString}</span>
          </div>

          <div className="replay-overlay-controls-row">
            <button type="button" className="replay-play-button" onClick={() => setIsPlaying((playing) => !playing)}>
              {isPlaying ? '⏸' : '▶'}
            </button>

            <div className="replay-speed-selector">
              {SPEEDS.map((nextSpeed) => (
                <button
                  key={nextSpeed}
                  type="button"
                  className={`replay-speed-pill${speed === nextSpeed ? ' replay-speed-pill--active' : ''}`}
                  onClick={() => {
                    setSpeed(nextSpeed)
                    setIsPlaying(true)
                  }}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    padding: '4px 10px',
                    background: speed === nextSpeed ? 'var(--accent-dim)' : 'transparent',
                    border: `0.5px solid ${speed === nextSpeed ? 'var(--accent)' : 'var(--border-2)'}`,
                    color: speed === nextSpeed ? 'var(--accent-hi)' : 'var(--text-3)',
                    cursor: 'pointer',
                    borderRadius: 2,
                    transition: 'all 120ms var(--ease-out)',
                  }}
                >
                  {nextSpeed}×
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              marginTop: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-3)',
              textAlign: 'center',
            }}
          >
            {simulatedDateLabel}
          </div>

          <div className="replay-overlay-meta">
            <span>{isPlaying ? `Unified replay clock running at ${speed}×` : 'Unified replay clock paused'}</span>
            <span>{getTrajectoryLabel(activeHour)}</span>
          </div>
        </section>

        <section className="replay-overlay-timeline replay-enter-timeline">
          <MissionTimeline metElapsed={metString} onSeek={seekToSeconds} compact />
        </section>
      </div>

      <div className="replay-immersive__details">
        <div className="replay-detail-grid">
          <section className="replay-detail-panel">
            <header className="panel-header">
              <span className="panel-label">Selected Phase</span>
              <span className={isPlaying ? 'panel-live' : 'replay-overlay-status'}>
                {isPlaying ? `${speed}×` : 'Paused'}
              </span>
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
              <span className="replay-value">{metString}</span>
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
              <span className={`replay-overlay-status${telemetryStatus === 'Reference' ? ' replay-overlay-status--live' : ''}`}>
                {telemetryStatus}
              </span>
            </header>

            <div className="replay-key-value">
              <span className="replay-key">Distance</span>
              <span className="replay-value">{Math.round(distanceFromEarthKm).toLocaleString()} km</span>
            </div>
            <div className="replay-key-value">
              <span className="replay-key">Velocity</span>
              <span className="replay-value">{speedKmS.toFixed(3)} km/s</span>
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
                ? 'Telemetry reference data is temporarily unavailable, but the shared replay clock remains active.'
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
