import { useEffect, useState } from 'react'
import axios from 'axios'

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

export default function Dashboard() {
  const [mission, setMission] = useState<MissionData | null>(null)
  const [elapsed, setElapsed] = useState('')
  const [currentPhase, setCurrentPhase] = useState('')

  useEffect(() => {
    axios.get('http://localhost:4000/api/mission').then(r => setMission(r.data))
  }, [])

  useEffect(() => {
    const tick = () => {
      const launch = new Date('2026-04-01T22:24:00Z')
      const now = new Date()
      const diff = now.getTime() - launch.getTime()
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      setElapsed(`T+ ${hours}h ${minutes}m ${seconds}s`)

      if (hours < 24) setCurrentPhase('Earth Orbit & Systems Check')
      else if (hours < 72) setCurrentPhase('Translunar Injection')
      else if (hours < 96) setCurrentPhase('Lunar Flyby')
      else if (hours < 216) setCurrentPhase('Return Trajectory')
      else setCurrentPhase('Reentry & Splashdown')
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [])

  if (!mission) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-artemis-blue font-mono animate-pulse">Loading mission data...</div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-space-900 border border-gray-800 rounded-2xl p-8">
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
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-6">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Mission Progress</span>
            <span>{mission.progress}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-artemis-blue to-artemis-green h-3 rounded-full transition-all duration-1000"
              style={{ width: `${mission.progress}%` }}
            ></div>
          </div>
          <div className="mt-2 text-center text-artemis-blue font-mono text-sm">{currentPhase}</div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Spacecraft', value: mission.spacecraft.name },
          { label: 'Rocket', value: 'SLS Block 1' },
          { label: 'Duration', value: mission.duration },
          { label: 'Crew Size', value: '4 Astronauts' },
        ].map((stat) => (
          <div key={stat.label} className="bg-space-900 border border-gray-800 rounded-xl p-4">
            <div className="text-gray-400 text-xs font-mono uppercase mb-1">{stat.label}</div>
            <div className="text-white font-semibold">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Mission phases */}
      <div className="bg-space-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="font-display text-xl font-bold text-white mb-4">Mission Phases</h2>
        <div className="space-y-3">
          {mission.phases.map((phase) => {
            const launch = new Date('2026-04-01T22:24:00Z')
            const now = new Date()
            const hoursElapsed = (now.getTime() - launch.getTime()) / (1000 * 60 * 60)
            const isComplete = hoursElapsed > phase.endHour
            const isActive = hoursElapsed >= phase.startHour && hoursElapsed < phase.endHour
            return (
              <div key={phase.name} className={`flex items-center gap-4 p-3 rounded-lg ${isActive ? 'bg-artemis-blue/10 border border-artemis-blue/30' : 'bg-gray-800/30'}`}>
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isComplete ? 'bg-artemis-green' : isActive ? 'bg-artemis-blue animate-pulse' : 'bg-gray-600'}`}></div>
                <div className="flex-1">
                  <div className={`font-medium ${isActive ? 'text-artemis-blue' : isComplete ? 'text-gray-300' : 'text-gray-500'}`}>{phase.name}</div>
                </div>
                {isActive && <span className="text-artemis-blue text-xs font-mono">CURRENT</span>}
                {isComplete && <span className="text-artemis-green text-xs font-mono">COMPLETE</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Objectives */}
      <div className="bg-space-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="font-display text-xl font-bold text-white mb-4">Mission Objectives</h2>
        <div className="space-y-2">
          {mission.objectives.map((obj, i) => (
            <div key={i} className="flex items-start gap-3 text-gray-300">
              <span className="text-artemis-blue font-mono text-sm mt-0.5">0{i + 1}</span>
              <span>{obj}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
