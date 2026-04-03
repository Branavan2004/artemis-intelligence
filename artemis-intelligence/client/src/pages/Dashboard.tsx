import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { io } from 'socket.io-client'
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

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export default function Dashboard() {
  const [mission, setMission] = useState<MissionData | null>(null)
  const [elapsed, setElapsed] = useState('')
  const [currentPhase, setCurrentPhase] = useState('')
  const [apod, setApod] = useState<{ url: string; title: string; explanation: string } | null>(null)
  const [telemetryState, setTelemetryState] = useState<'connecting' | 'live' | 'offline'>('connecting')
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)

  useEffect(() => {
    api.get('/api/mission').then(r => setMission(r.data))
    api.get('/api/mission/apod').then(r => setApod(r.data)).catch(() => {})
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
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  if (!mission) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-artemis-blue font-mono animate-pulse">Loading mission data...</div>
    </div>
  )

  const hoursElapsed = getMissionHoursElapsed(mission.launchDate)

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.1 } } }}
    >
      {/* Hero */}
      <motion.div variants={fadeUp} className="bg-space-900 border border-gray-800 rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-artemis-blue/5 to-transparent pointer-events-none" />
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 rounded-full bg-artemis-green animate-pulse"></div>
              <span className="text-artemis-green font-mono text-sm">MISSION ACTIVE</span>
            </div>
            <h1 className="font-display text-5xl font-black text-white mb-2">ARTEMIS II</h1>
            <p className="text-gray-400 text-lg">First crewed lunar mission since Apollo 17 · 1972</p>
          </div>
          <div className="text-right">
            <div className="font-mono text-artemis-blue text-3xl font-bold">{elapsed}</div>
            <div className="text-gray-400 text-sm mt-1">Mission Elapsed Time</div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <div className={`h-2 w-2 rounded-full ${telemetryState === 'live' ? 'bg-artemis-green animate-pulse' : telemetryState === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-500'}`}></div>
              <span className={`text-xs font-mono ${telemetryState === 'live' ? 'text-artemis-green' : telemetryState === 'connecting' ? 'text-yellow-300' : 'text-red-400'}`}>
                {telemetryState === 'live' ? 'LIVE TELEMETRY' : telemetryState === 'connecting' ? 'CONNECTING' : 'OFFLINE'}
              </span>
            </div>
            {lastSyncAt && (
              <div className="text-gray-500 text-xs mt-1">
                Last sync {new Date(lastSyncAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
        <div className="mt-6">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Mission Progress</span>
            <span>{mission.progress}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3">
            <motion.div
              className="bg-gradient-to-r from-artemis-blue to-artemis-green h-3 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${mission.progress}%` }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />
          </div>
          <div className="mt-2 text-center text-artemis-blue font-mono text-sm">{currentPhase}</div>
        </div>
      </motion.div>

      {/* Stats grid */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Spacecraft', value: mission.spacecraft.name },
          { label: 'Rocket', value: 'SLS Block 1' },
          { label: 'Duration', value: mission.duration },
          { label: 'Crew Size', value: '4 Astronauts' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            whileHover={{ scale: 1.03, borderColor: '#1d9bf0' }}
            className="bg-space-900 border border-gray-800 rounded-xl p-4 transition-colors"
          >
            <div className="text-gray-400 text-xs font-mono uppercase mb-1">{stat.label}</div>
            <div className="text-white font-semibold">{stat.value}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* APOD */}
      {apod && apod.url && (
        <motion.div variants={fadeUp} className="bg-space-900 border border-gray-800 rounded-2xl overflow-hidden">
          <img src={apod.url} alt={apod.title} className="w-full h-64 object-cover" />
          <div className="p-5">
            <div className="text-artemis-blue text-xs font-mono uppercase mb-1">NASA · Astronomy Picture of the Day</div>
            <h3 className="text-white font-semibold text-lg mb-2">{apod.title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed line-clamp-3">{apod.explanation}</p>
          </div>
        </motion.div>
      )}

      {/* Phases + Objectives side by side */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mission phases */}
        <div className="bg-space-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="font-display text-xl font-bold text-white mb-4">Mission Phases</h2>
          <div className="space-y-3">
            {mission.phases.map((phase) => {
              const isComplete = hoursElapsed > phase.endHour
              const isActive = hoursElapsed >= phase.startHour && hoursElapsed < phase.endHour
              return (
                <div key={phase.name} className={`flex items-center gap-4 p-3 rounded-lg transition-all ${isActive ? 'bg-artemis-blue/10 border border-artemis-blue/30' : 'bg-gray-800/30'}`}>
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isComplete ? 'bg-artemis-green' : isActive ? 'bg-artemis-blue animate-pulse' : 'bg-gray-600'}`}></div>
                  <div className={`flex-1 font-medium ${isActive ? 'text-artemis-blue' : isComplete ? 'text-gray-300' : 'text-gray-500'}`}>{phase.name}</div>
                  {isActive && <span className="text-artemis-blue text-xs font-mono">CURRENT</span>}
                  {isComplete && <span className="text-artemis-green text-xs font-mono">✓</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Objectives */}
        <div className="bg-space-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="font-display text-xl font-bold text-white mb-4">Mission Objectives</h2>
          <div className="space-y-3">
            {mission.objectives.map((obj, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-3 text-gray-300"
              >
                <span className="text-artemis-blue font-mono text-sm mt-0.5 flex-shrink-0">0{i + 1}</span>
                <span className="text-sm">{obj}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
