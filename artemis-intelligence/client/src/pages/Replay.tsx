import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Pause, Play } from 'lucide-react'
import DSNTracker from '../components/DSNTracker'
import TrajectoryMap3D from '../components/TrajectoryMap3D'
import { type TelemetryPayload, useTelemetry } from '../hooks/useTelemetry'
import { api } from '../lib/api'
import { getMissionHoursElapsed } from '../lib/mission'
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
  getTrajectoryLabel,
  getTrajectoryPoint,
  getUpcomingReplayEvent,
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

type SpaceWeatherRisk = 'nominal' | 'elevated' | 'severe'

const fadeIn = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

function formatReplayClock(hour: number) {
  const wholeHours = Math.floor(hour)
  const minutes = Math.floor((hour - wholeHours) * 60)
  return `T+ ${wholeHours}h ${minutes}m`
}

function getLiveSourceLabel(telemetry: TelemetryPayload | null) {
  return [telemetry?.trajectory?.source, telemetry?.spaceWeather?.source].filter(Boolean).join(' + ')
}

function getRiskTone(riskLevel: SpaceWeatherRisk) {
  switch (riskLevel) {
    case 'severe':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
    case 'elevated':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
  }
}

export default function Replay() {
  const [mission, setMission] = useState<MissionData | null>(null)
  const [replayHour, setReplayHour] = useState(0)
  const [isLiveMode, setIsLiveMode] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
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
    const interval = setInterval(syncToLive, 1000)
    return () => clearInterval(interval)
  }, [mission, isLiveMode])

  useEffect(() => {
    if (isLiveMode || !isPlaying) return

    const interval = setInterval(() => {
      setReplayHour((current) => Math.min(current + 0.5, 240))
    }, 400)

    return () => clearInterval(interval)
  }, [isLiveMode, isPlaying])

  useEffect(() => {
    if (replayHour >= 240 && isPlaying) {
      setIsPlaying(false)
    }
  }, [isPlaying, replayHour])

  if (!mission) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[color:var(--muted)]">
        Loading replay data...
      </div>
    )
  }

  const activePhase = getReplayPhase(mission.phases, replayHour)
  const briefing = getMissionBriefing(activePhase.name)
  const missionPoint = getTrajectoryPoint(replayHour)
  const distanceFromEarth = getDistanceFromEarthKm(replayHour)
  const velocity = getVelocityKmS(replayHour)
  const visibleEvents = getLatestReplayEvents(replayHour)
  const upcomingEvent = getUpcomingReplayEvent(replayHour)
  const replayProgress = getReplayProgress(replayHour)
  const phaseProgress = getPhaseCompletion(activePhase, replayHour)
  const liveTrajectory = telemetry?.trajectory
  const liveSpaceWeather = telemetry?.spaceWeather
  const liveSourceLabel = getLiveSourceLabel(telemetry)
  const latestFlareClass = liveSpaceWeather?.solarFlares[0]?.classType || 'None'

  return (
    <div className="page">
      <motion.section initial="hidden" animate="show" variants={fadeIn} className="page-header-split">
        <div className="page-header">
          <p className="section-label">Replay</p>
          <h1 className="page-title">Mission replay</h1>
          <p className="page-copy">
            Scrub through Artemis II from launch to splashdown, follow the Earth-to-Moon path, and inspect telemetry at any selected moment.
          </p>
        </div>

        <div className="card p-6">
          <p className="section-label">Selected phase</p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[color:var(--text)]">{activePhase.name}</h2>
          <div className="mt-6 flex items-center justify-between text-sm text-[color:var(--muted)]">
            <span>Replay progress</span>
            <span className="font-mono text-[color:var(--text)]">{Math.round(replayProgress)}%</span>
          </div>
          <div className="mt-3 h-1 rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-1 rounded-full bg-blue-600" style={{ width: `${replayProgress}%` }} />
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-[color:var(--muted)]">
            <span>Phase completion</span>
            <span className="font-mono text-[color:var(--text)]">{Math.round(phaseProgress)}%</span>
          </div>
          <div className="mt-3 h-1 rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-1 rounded-full bg-slate-900 dark:bg-slate-100" style={{ width: `${phaseProgress}%` }} />
          </div>
        </div>
      </motion.section>

      <motion.section initial="hidden" animate="show" variants={fadeIn} className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {mission.phases.filter((phase) => phase.endHour > 0).map((phase) => (
            <button
              key={phase.name}
              type="button"
              onClick={() => {
                setIsLiveMode(false)
                setIsPlaying(false)
                setReplayHour(phase.startHour < 0 ? 0 : phase.startHour)
              }}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                activePhase.name === phase.name
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-[color:var(--border)] text-[color:var(--muted)] hover:text-[color:var(--text)]'
              }`}
            >
              {phase.name}
            </button>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.55fr_0.45fr]">
          <div className="space-y-6">
            <div className="card overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-[color:var(--border)] px-6 py-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="section-label">Trajectory</p>
                  <h2 className="section-title mt-2">Earth to Moon path</h2>
                </div>
                <div className="text-sm text-[color:var(--muted)]">
                  {upcomingEvent ? `Next milestone: ${upcomingEvent.title}` : 'Mission sequence complete'}
                </div>
              </div>

              <div className="border-b border-[color:var(--border)] bg-[#0F1117] p-4 md:p-6">
                <svg viewBox="0 0 720 280" className="w-full">
                  {[120, 240, 360, 480, 600].map((x) => (
                    <line key={`v-${x}`} x1={x} y1="24" x2={x} y2="252" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                  ))}
                  {[80, 140, 200].map((y) => (
                    <line key={`h-${y}`} x1="32" y1={y} x2="688" y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                  ))}

                  <circle cx="110" cy="190" r="30" fill="#FFFFFF" fillOpacity="0.12" />
                  <circle cx="110" cy="190" r="18" fill="#FFFFFF" />
                  <text x="110" y="236" textAnchor="middle" className="fill-white text-[12px]">
                    Earth
                  </text>

                  <circle cx="594" cy="96" r="22" fill="#FFFFFF" fillOpacity="0.12" />
                  <circle cx="594" cy="96" r="14" fill="#FFFFFF" />
                  <text x="594" y="136" textAnchor="middle" className="fill-white text-[12px]">
                    Moon
                  </text>

                  <path
                    d="M 110 190 Q 340 12 594 96"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    strokeDasharray="8 8"
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                  <path
                    d="M 594 96 Q 400 286 152 224"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    strokeDasharray="8 8"
                    strokeLinecap="round"
                    opacity="0.8"
                  />

                  <circle cx="278" cy="79" r="4" fill="#FFFFFF" />
                  <text x="278" y="60" textAnchor="middle" className="fill-white text-[11px]">
                    TLI
                  </text>

                  <circle cx="560" cy="101" r="4" fill="#FFFFFF" />
                  <text x="560" y="76" textAnchor="middle" className="fill-white text-[11px]">
                    Flyby
                  </text>

                  <circle cx="152" cy="224" r="6" fill="#FFFFFF" />
                  <text x="152" y="248" textAnchor="middle" className="fill-white text-[11px]">
                    Splashdown
                  </text>

                  <circle cx={missionPoint.x} cy={missionPoint.y} r="4" fill="#FFFFFF" />
                  <text x={missionPoint.x + 10} y={missionPoint.y - 10} className="fill-white text-[12px]">
                    Orion
                  </text>
                </svg>
              </div>

              <div className="space-y-5 px-6 py-5">
                <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (isLiveMode) setIsLiveMode(false)
                        setIsPlaying((current) => !current)
                      }}
                      className="button-secondary w-10 px-0"
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsLiveMode(true)
                        setIsPlaying(false)
                        setReplayHour(clampMissionHour(getMissionHoursElapsed(mission.launchDate)))
                      }}
                      className="button-secondary"
                    >
                      Jump to live
                    </button>
                  </div>

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
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600 dark:bg-slate-800"
                  />

                  <div className="text-right">
                    <div className="font-mono text-sm text-[color:var(--text)]">{formatReplayClock(replayHour)}</div>
                    <div className="text-xs text-[color:var(--muted)]">{isLiveMode ? 'Live mode' : 'Replay mode'}</div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    ['Distance', `${distanceFromEarth.toLocaleString()} km`],
                    ['Velocity', `${velocity} km/s`],
                    ['Trajectory', getTrajectoryLabel(replayHour)],
                  ].map(([label, value]) => (
                    <div key={label} className="card-muted px-4 py-3">
                      <p className="eyebrow">{label}</p>
                      <p className="mt-1 font-mono text-sm text-[color:var(--text)]">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card p-6 md:p-7">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="section-label">3D trajectory map</p>
                  <h2 className="section-title mt-2">Real-time Orion position from JPL Horizons</h2>
                </div>
                <p className="text-sm text-[color:var(--muted)]">JPL Horizons · updates every 5 min</p>
              </div>
              <div className="mt-6">
                <TrajectoryMap3D
                  position={telemetry?.trajectory?.positionVector ?? null}
                  distanceFromEarthKm={telemetry?.trajectory?.distanceFromEarthKm ?? 0}
                  distanceFromMoonKm={telemetry?.trajectory?.distanceFromMoonKm ?? 0}
                  speedKmS={telemetry?.trajectory?.speedKmS ?? 0}
                  heightPx={620}
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card p-6">
              <p className="section-label">Telemetry</p>
              <h2 className="section-title mt-2">Current snapshot</h2>
              <div className="mt-6 card-muted p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="eyebrow">Live telemetry</p>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">
                      {telemetryLoading
                        ? 'Fetching live data...'
                        : telemetryError
                          ? 'Live data unavailable — using simulation'
                          : 'Live trajectory and space weather data synced for the Replay view.'}
                    </p>
                  </div>
                  {!telemetryLoading && !telemetryError && liveSourceLabel ? (
                    <span className="inline-flex items-center rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-medium text-[color:var(--text)]">
                      {liveSourceLabel}
                    </span>
                  ) : null}
                </div>

                {!telemetryLoading && !telemetryError ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] p-3">
                      <p className="eyebrow">Distance from Earth</p>
                      <p className="mt-1 font-mono text-sm text-[color:var(--text)]">
                        {liveTrajectory ? `${liveTrajectory.distanceFromEarthKm.toLocaleString()} km` : '—'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] p-3">
                      <p className="eyebrow">Distance from Moon</p>
                      <p className="mt-1 font-mono text-sm text-[color:var(--text)]">
                        {liveTrajectory ? `${liveTrajectory.distanceFromMoonKm.toLocaleString()} km` : '—'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] p-3">
                      <p className="eyebrow">Current speed</p>
                      <p className="mt-1 font-mono text-sm text-[color:var(--text)]">
                        {liveTrajectory ? `${liveTrajectory.speedKmS.toLocaleString()} km/s` : '—'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] p-3">
                      <p className="eyebrow">Radiation risk</p>
                      {liveSpaceWeather ? (
                        <span
                          className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getRiskTone(liveSpaceWeather.riskLevel)}`}
                        >
                          {liveSpaceWeather.riskLevel}
                        </span>
                      ) : (
                        <p className="mt-1 font-mono text-sm text-[color:var(--text)]">—</p>
                      )}
                    </div>
                    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] p-3">
                      <p className="eyebrow">Solar flares (72h)</p>
                      <p className="mt-1 font-mono text-sm text-[color:var(--text)]">
                        {liveSpaceWeather ? liveSpaceWeather.solarFlares.length : 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] p-3">
                      <p className="eyebrow">Latest flare class</p>
                      <p className="mt-1 font-mono text-sm text-[color:var(--text)]">{latestFlareClass}</p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-6">
                <p className="eyebrow">Replay simulation</p>
              </div>
              <div className="mt-3 divide-y divide-[color:var(--border)]">
                {[
                  ['Mode', isLiveMode ? 'Live' : 'Replay'],
                  ['Selected phase', activePhase.name],
                  ['Distance from Earth', `${distanceFromEarth.toLocaleString()} km`],
                  ['Velocity', `${velocity} km/s`],
                  ['Trajectory state', getTrajectoryLabel(replayHour)],
                  ['Replay progress', `${Math.round(replayProgress)}%`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 py-3">
                    <span className="text-sm text-[color:var(--muted)]">{label}</span>
                    <span className="font-mono text-sm text-[color:var(--text)]">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <p className="section-label">Brief</p>
              <h2 className="section-title mt-2">{activePhase.name}</h2>
              <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">{briefing.summary}</p>
              <div className="mt-6 space-y-4">
                <div>
                  <p className="eyebrow">Why it matters</p>
                  <p className="mt-1 text-sm text-[color:var(--text)]">{briefing.whyItMatters}</p>
                </div>
                <div>
                  <p className="eyebrow">What comes next</p>
                  <p className="mt-1 text-sm text-[color:var(--text)]">{briefing.whatNext}</p>
                </div>
                <div>
                  <p className="eyebrow">Crew focus</p>
                  <p className="mt-1 text-sm text-[color:var(--text)]">{getCrewFocus(replayHour)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section initial="hidden" animate="show" variants={fadeIn} className="space-y-4">
        <div className="page-header">
          <p className="section-label">Deep Space Network</p>
          <h2 className="section-title">Live antenna tracker</h2>
          <p className="section-copy">
            Monitor the live DSN handoff in a dedicated full-width tracker and see which ground station is carrying the Orion link right now.
          </p>
        </div>
        <DSNTracker />
      </motion.section>

      <motion.section initial="hidden" animate="show" variants={fadeIn} className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-6">
          <div className="card p-6">
            <p className="section-label">Mission context</p>
            <h2 className="section-title mt-2">Reference details</h2>
            <div className="mt-6 space-y-4">
              {[
                ['Launch vehicle', mission.spacecraft.rocket],
                ['Spacecraft', mission.spacecraft.name],
                ['Launch site', mission.spacecraft.launchSite],
                ['Splashdown target', mission.spacecraft.splashdownTarget],
                ['Duration', mission.duration],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="eyebrow">{label}</p>
                  <p className="mt-1 text-sm font-medium text-[color:var(--text)]">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <p className="section-label">Upcoming milestone</p>
            <h2 className="section-title mt-2">{upcomingEvent ? upcomingEvent.title : 'No upcoming event'}</h2>
            <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">
              {upcomingEvent ? upcomingEvent.detail : 'The replay has reached the end of the planned mission sequence.'}
            </p>
          </div>
        </div>

        <div className="card p-6 md:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="section-label">Event log</p>
              <h2 className="section-title mt-2">Mission events</h2>
              <p className="section-copy mt-2">
                The mission moments most relevant to the selected point in time, ordered from newest to oldest.
              </p>
            </div>
            <div className="text-sm text-[color:var(--muted)]">{visibleEvents.length} events visible</div>
          </div>

          <div className="mt-8 space-y-0">
            {visibleEvents.map((event, index) => (
              <div key={`${event.hour}-${event.title}`} className="grid grid-cols-[20px_1fr] gap-4">
                <div className="relative flex justify-center">
                  <span className="mt-2 h-2.5 w-2.5 rounded-full bg-blue-600" />
                  {index !== visibleEvents.length - 1 && (
                    <span className="absolute top-6 h-[calc(100%-8px)] w-px bg-[color:var(--border)]" />
                  )}
                </div>
                <div className={`pb-6 ${index !== visibleEvents.length - 1 ? 'border-b border-[color:var(--border)]' : ''}`}>
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-medium text-[color:var(--text)]">{event.title}</p>
                      <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">{event.detail}</p>
                    </div>
                    <div className="font-mono text-sm text-[color:var(--muted)]">T+ {event.hour}h</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>
    </div>
  )
}
