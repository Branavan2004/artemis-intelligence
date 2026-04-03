import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { io } from 'socket.io-client'
import { ArrowUpRight } from 'lucide-react'
import { api, SOCKET_URL } from '../lib/api'
import { getMissionElapsedTime, getMissionHoursElapsed, getMissionPhase } from '../lib/mission'

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

const fadeIn = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

export default function Dashboard() {
  const [mission, setMission] = useState<MissionData | null>(null)
  const [elapsed, setElapsed] = useState('')
  const [currentPhase, setCurrentPhase] = useState('')
  const [apod, setApod] = useState<{ url: string; title: string; explanation: string } | null>(null)
  const [telemetryState, setTelemetryState] = useState<'connecting' | 'live' | 'offline'>('connecting')
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)

  useEffect(() => {
    api.get('/api/mission').then((response) => setMission(response.data))
    api.get('/api/mission/apod').then((response) => setApod(response.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!mission) return

    const tick = () => {
      setElapsed(getMissionElapsedTime(mission.launchDate))
      setCurrentPhase(getMissionPhase(mission.launchDate))
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [mission])

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
      setCurrentPhase(update.phase)
      setLastSyncAt(update.timestamp)
      setTelemetryState('live')
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  if (!mission) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[color:var(--muted)]">
        Loading mission data...
      </div>
    )
  }

  const hoursElapsed = getMissionHoursElapsed(mission.launchDate)
  const nextPhase = mission.phases.find((phase) => phase.startHour > hoursElapsed)
  const formattedLaunch = new Date(mission.launchDate).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  const telemetryLabel =
    telemetryState === 'live' ? 'Live' : telemetryState === 'connecting' ? 'Connecting' : 'Offline'
  const telemetryDot =
    telemetryState === 'live' ? 'bg-emerald-500' : telemetryState === 'connecting' ? 'bg-amber-500' : 'bg-amber-500'

  return (
    <div className="page">
      <motion.section initial="hidden" animate="show" variants={fadeIn} className="page-header-split">
        <div className="page-header">
          <p className="section-label">Overview</p>
          <h1 className="page-title">A mission desk for Artemis II.</h1>
          <p className="page-copy">
            Track live mission timing, monitor telemetry state, review the flight timeline, and follow key vehicle details from launch through splashdown.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="eyebrow">Launch time</p>
              <p className="mt-1 text-sm font-medium text-[color:var(--text)]">{formattedLaunch}</p>
            </div>
            <div>
              <p className="eyebrow">Next milestone</p>
              <p className="mt-1 text-sm font-medium text-[color:var(--text)]">
                {nextPhase ? nextPhase.name : 'Mission complete'}
              </p>
            </div>
            <div>
              <p className="eyebrow">Vehicle stack</p>
              <p className="mt-1 text-sm font-medium text-[color:var(--text)]">
                {mission.spacecraft.rocket} + {mission.spacecraft.name}
              </p>
            </div>
            <div>
              <p className="eyebrow">Recovery target</p>
              <p className="mt-1 text-sm font-medium text-[color:var(--text)]">{mission.spacecraft.splashdownTarget}</p>
            </div>
          </div>
        </div>

        <div className="card p-6 md:p-7">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="section-label">Current status</p>
              <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[color:var(--text)]">
                {currentPhase}
              </h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-[color:var(--muted)]">
              <span className={`status-dot ${telemetryDot}`} />
              <span>{telemetryLabel}</span>
            </div>
          </div>

          <div className="mt-8">
            <div className="mono-display">{elapsed}</div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              {lastSyncAt ? `Updated ${new Date(lastSyncAt).toLocaleTimeString()}` : 'Waiting for telemetry updates'}
            </p>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between text-sm text-[color:var(--muted)]">
              <span>Mission progress</span>
              <span className="font-mono text-[color:var(--text)]">{mission.progress}%</span>
            </div>
            <div className="mt-3 h-1 rounded-full bg-slate-200 dark:bg-slate-800">
              <div className="h-1 rounded-full bg-blue-600" style={{ width: `${mission.progress}%` }} />
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section initial="hidden" animate="show" variants={fadeIn} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Mission time', elapsed, 'Live mission clock'],
          ['Current phase', currentPhase, 'Mission segment in focus'],
          ['Telemetry', telemetryLabel, lastSyncAt ? `Last sync ${new Date(lastSyncAt).toLocaleTimeString()}` : 'Status from the live stream'],
          ['Progress', `${mission.progress}%`, 'Completion across the planned mission window'],
        ].map(([label, value, note], index) => (
          <div key={label} className="card-plain p-6">
            <p className="section-label">{label}</p>
            <div className={`mt-4 ${index === 0 ? 'mono-display text-[30px]' : 'value-display text-[30px]'}`}>{value}</div>
            <p className="mt-4 text-sm text-[color:var(--muted)]">{note}</p>
          </div>
        ))}
      </motion.section>

      <motion.section initial="hidden" animate="show" variants={fadeIn} className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-6 md:p-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="section-label">Timeline</p>
              <h2 className="section-title mt-2">Mission phases</h2>
            </div>
            <p className="max-w-sm text-right text-sm text-[color:var(--muted)]">
              The current phase is highlighted, with completed and upcoming phases kept in sequence for quick scanning.
            </p>
          </div>

          <div className="mt-8 space-y-0">
            {mission.phases.map((phase, index) => {
              const isComplete = hoursElapsed > phase.endHour
              const isActive = hoursElapsed >= phase.startHour && hoursElapsed < phase.endHour

              return (
                <div key={phase.name} className="grid grid-cols-[20px_1fr] gap-4">
                  <div className="relative flex justify-center">
                    <span
                      className={`mt-2 h-2.5 w-2.5 rounded-full ${
                        isActive ? 'bg-blue-600' : isComplete ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    />
                    {index !== mission.phases.length - 1 && (
                      <span className="absolute top-6 h-[calc(100%-8px)] w-px bg-[color:var(--border)]" />
                    )}
                  </div>
                  <div className={`pb-6 ${index !== mission.phases.length - 1 ? 'border-b border-[color:var(--border)]' : ''}`}>
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <p className={`text-sm font-medium ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-[color:var(--text)]'}`}>
                        {phase.name}
                      </p>
                      <span className="font-mono text-xs text-[color:var(--muted)]">
                        {phase.startHour}h to {phase.endHour}h
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[color:var(--muted)]">
                      {isActive ? 'Current segment' : isComplete ? 'Completed segment' : 'Upcoming segment'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <p className="section-label">Vehicle</p>
            <h2 className="section-title mt-2">Mission details</h2>
            <div className="mt-6 divide-y divide-[color:var(--border)]">
              {[
                ['Spacecraft', mission.spacecraft.name],
                ['Rocket', mission.spacecraft.rocket],
                ['Launch site', mission.spacecraft.launchSite],
                ['Splashdown target', mission.spacecraft.splashdownTarget],
                ['Duration', mission.duration],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-3">
                  <span className="text-sm text-[color:var(--muted)]">{label}</span>
                  <span className="text-sm font-medium text-[color:var(--text)]">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <p className="section-label">Objectives</p>
            <h2 className="section-title mt-2">Mission goals</h2>
            <ol className="mt-6 space-y-4">
              {mission.objectives.map((objective, index) => (
                <li key={objective} className="grid grid-cols-[28px_1fr] gap-3">
                  <span className="font-mono text-sm text-[color:var(--muted)]">{String(index + 1).padStart(2, '0')}</span>
                  <span className="text-sm leading-7 text-[color:var(--text)]">{objective}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </motion.section>

      {apod && apod.url && (
        <motion.section initial="hidden" animate="show" variants={fadeIn} className="card overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[0.88fr_1.12fr]">
            <div className="min-h-[320px] bg-[color:var(--surface-soft)]">
              <img src={apod.url} alt={apod.title} className="h-full w-full object-cover" />
            </div>
            <div className="p-6 md:p-8">
              <p className="section-label">NASA image of the day</p>
              <h2 className="section-title mt-2">{apod.title}</h2>
              <p className="mt-4 text-base leading-8 text-[color:var(--muted)]">{apod.explanation}</p>
              <a
                href={apod.url}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Open image
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </motion.section>
      )}
    </div>
  )
}
