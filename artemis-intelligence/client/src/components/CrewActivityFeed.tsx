import { useEffect, useRef, useState } from 'react'

interface Props {
  metElapsed?: string
}

interface LogEntry {
  metSeconds: number
  met: string
  crew: string
  action: string
  type: 'burn' | 'science' | 'comms' | 'rest' | 'milestone' | 'system' | 'personal'
  detail?: string
}

const MISSION_LOG: LogEntry[] = [
  { metSeconds: 0, met: '00:00:00', crew: 'All Crew', type: 'milestone', action: 'Liftoff from Launch Complex 39B', detail: 'SLS ignition — 8.8 million lbs of thrust' },
  { metSeconds: 492, met: '00:08:12', crew: 'All Crew', type: 'milestone', action: 'Orion separates from SLS upper stage', detail: 'ICPS separation confirmed' },
  { metSeconds: 4920, met: '01:22:00', crew: 'All Crew', type: 'system', action: 'All 4 solar array wings fully deployed', detail: '63ft wingspan — Orion drawing full power' },
  { metSeconds: 9000, met: '02:30:00', crew: 'Wiseman', type: 'personal', action: 'Named the spacecraft "Integrity"', detail: 'First crewed Orion gets its name' },
  { metSeconds: 14400, met: '04:00:00', crew: 'All Crew', type: 'rest', action: 'First sleep period in Earth orbit', detail: '8hr rest cycle before departure burn' },
  { metSeconds: 28800, met: '08:00:00', crew: 'Wiseman, Glover', type: 'system', action: 'Flywheel exercise device checked out', detail: 'Life support stress test during workout' },
  { metSeconds: 45240, met: '12:34:00', crew: 'Koch', type: 'burn', action: 'Executed perigee raise burn', detail: 'Raised apogee to 46,000 miles — staging for TLI' },
  {
    metSeconds: 90840,
    met: '25:14:00',
    crew: 'Koch',
    type: 'burn',
    action: 'TRANSLUNAR INJECTION BURN — 5m 49s',
    detail: 'Orion breaks Earth orbit. Crew are the first humans to leave LEO since Apollo 17, 1972',
  },
  { metSeconds: 93600, met: '26:00:00', crew: 'All Crew', type: 'comms', action: 'First space-to-ground video call downlinked', detail: 'Crew speaks to mission control from deep space' },
  {
    metSeconds: 97200,
    met: '27:00:00',
    crew: 'Wiseman',
    type: 'personal',
    action: 'Photographed Earth from Orion window post-TLI',
    detail: 'Captured auroras and zodiacal light — Earth eclipsing Sun',
  },
  { metSeconds: 138600, met: '38:30:00', crew: 'Hansen', type: 'burn', action: 'OTC-1 burn cancelled — trajectory nominal', detail: 'Flight controllers confirmed no correction needed' },
  { metSeconds: 151200, met: '42:00:00', crew: 'Koch', type: 'science', action: 'OCLCS laser comms system activated', detail: 'Infrared laser — faster than radio frequency' },
  { metSeconds: 180000, met: '50:00:00', crew: 'All Crew', type: 'milestone', action: '100 gigabytes downlinked via laser comms', detail: 'First major laser comms data milestone in crewed spaceflight' },
  { metSeconds: 223200, met: '62:00:00', crew: 'All Crew', type: 'science', action: '24-hour acoustics test began', detail: 'Characterizing sound environment for future long-duration missions' },
  { metSeconds: 230400, met: '64:00:00', crew: 'All Crew', type: 'personal', action: 'Woke up to Chappell Roan — "Pink Pony Club"', detail: 'Flight Day 4 wakeup song selected by crew' },
  { metSeconds: 267000, met: '74:10:00', crew: 'Glover', type: 'milestone', action: 'Took manual control of Orion in deep space', detail: 'Testing handling qualities 169,000 miles from Earth — first manual deep space flight' },
  { metSeconds: 316800, met: '88:00:00', crew: 'All Crew', type: 'science', action: 'Emergency spacesuit pressurization tests', detail: 'Practiced donning suits, eating through helmet ports, survival procedures' },
  {
    metSeconds: 338400,
    met: '94:00:00',
    crew: 'All Crew',
    type: 'milestone',
    action: "Entered Moon's gravitational sphere of influence",
    detail: 'Moon gravity now dominant — point of no return',
  },
  { metSeconds: 363000, met: '100:50:00', crew: 'All Crew', type: 'science', action: 'AVATAR bone marrow experiment initiated', detail: 'Studying human immune response to deep space radiation' },
  /* Apollo 13 record entry hidden for demo
  {
    metSeconds: 414600,
    met: '115:10:00',
    crew: 'All Crew',
    type: 'milestone',
    action: 'BROKE APOLLO 13 DISTANCE RECORD — 406,773 km',
    detail: "Humanity's farthest point from Earth — record stood since 1970",
  },
  */
  { metSeconds: 418200, met: '116:10:00', crew: 'All Crew', type: 'comms', action: 'Spoke with ISS crew via audio-only link', detail: 'Deep space to low Earth orbit — two crews in space simultaneously' },
  { metSeconds: 419400, met: '116:30:00', crew: 'Koch', type: 'system', action: 'Orion cabin reconfigured for lunar flyby ops', detail: 'Windows oriented toward Moon, science gear deployed' },
  { metSeconds: 427500, met: '118:45:00', crew: 'All Crew', type: 'milestone', action: 'LUNAR FLYBY WINDOW OPENED — 2:45 PM EDT', detail: 'Orion close enough for Moon observations. Crew at windows.' },
  { metSeconds: 431220, met: '119:47:00', crew: 'All Crew', type: 'comms', action: 'SIGNAL BLACKOUT — behind the Moon', detail: '40 minutes of silence. Crew on far side — no humans in contact with Earth.' },
  { metSeconds: 432720, met: '120:07:00', crew: 'All Crew', type: 'milestone', action: 'CLOSEST APPROACH — 4,066 miles from Moon', detail: 'Moon fills entire window. Crew see full lunar disk including poles.' },
  { metSeconds: 433620, met: '120:22:00', crew: 'All Crew', type: 'comms', action: 'Signal restored — crew emerged from far side', detail: 'DSN reacquires Orion. Crew safe.' },
  { metSeconds: 435600, met: '120:00:00', crew: 'Koch', type: 'science', action: 'Photographed lunar south pole region', detail: 'Target for Artemis III crewed landing — scouting imagery' },
  { metSeconds: 450000, met: '125:00:00', crew: 'All Crew', type: 'rest', action: "Full off-duty day — crew's only rest day", detail: 'Flight Day 7. No scheduled activities. Personal time.' },
  { metSeconds: 568800, met: '158:00:00', crew: 'All Crew', type: 'burn', action: 'Return trajectory correction burn 1', detail: 'Fine-tuning free-return path back to Earth' },
  { metSeconds: 655200, met: '182:00:00', crew: 'All Crew', type: 'burn', action: 'Return trajectory correction burn 2', detail: 'Adjusting reentry corridor — precision matters at 25,000 mph' },
  { metSeconds: 730800, met: '203:00:00', crew: 'All Crew', type: 'milestone', action: 'Service module separation', detail: 'European Service Module jettisoned — burns up in atmosphere' },
  { metSeconds: 734400, met: '204:00:00', crew: 'All Crew', type: 'milestone', action: 'REENTRY — 3,000°F heat shield', detail: 'Skip reentry profile. Crew experience 4G forces.' },
  { metSeconds: 736200, met: '204:30:00', crew: 'All Crew', type: 'milestone', action: 'SPLASHDOWN — Pacific Ocean', detail: '10 days, 0 hours, 30 minutes. Mission complete. Navy recovery underway.' },
]

const TYPE_CONFIG = {
  milestone: { color: 'var(--accent-hi)', bg: 'rgba(77,139,255,0.12)', label: 'MILESTONE' },
  burn: { color: 'var(--caution)', bg: 'rgba(232,160,32,0.12)', label: 'BURN' },
  science: { color: 'var(--go)', bg: 'rgba(0,184,122,0.12)', label: 'SCIENCE' },
  comms: { color: 'var(--text-data)', bg: 'rgba(168,196,255,0.12)', label: 'COMMS' },
  rest: { color: 'var(--text-2)', bg: 'rgba(255,255,255,0.04)', label: 'REST' },
  system: { color: 'var(--text-data)', bg: 'rgba(168,196,255,0.12)', label: 'SYSTEMS' },
  personal: { color: 'var(--text-1)', bg: 'rgba(255,255,255,0.04)', label: 'CREW' },
} as const

function parseMET(met: string): number {
  const parts = (met || '00:00:00').split(':').map(Number)
  return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)
}

function formatMET(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(3, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function CrewActivityFeed({ metElapsed = '00:00:00' }: Props) {
  const currentMET = parseMET(metElapsed)
  const feedRef = useRef<HTMLDivElement | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [autoScroll, setAutoScroll] = useState(false)

  const past = MISSION_LOG.filter((entry) => entry.metSeconds < currentMET - 60)
  const current = MISSION_LOG.filter((entry) => Math.abs(entry.metSeconds - currentMET) <= 1800)
  const future = MISSION_LOG.filter((entry) => entry.metSeconds > currentMET + 1800)
  const recentPast = [...past].sort((left, right) => right.metSeconds - left.metSeconds)
  const activeEntries = [...current].sort((left, right) => right.metSeconds - left.metSeconds)
  const upcomingEntries = [...future].sort((left, right) => left.metSeconds - right.metSeconds)

  useEffect(() => {
    if (!autoScroll || !feedRef.current) return
    const activeEl = feedRef.current.querySelector('[data-active="true"]')
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [metElapsed, autoScroll])

  const nextEvent = future[0]
  const timeToNext = nextEvent ? nextEvent.metSeconds - currentMET : null

  const renderEntry = (entry: LogEntry, status: 'past' | 'active' | 'future') => {
    const cfg = TYPE_CONFIG[entry.type]
    const isOpen = expanded === entry.metSeconds
    const isPast = status === 'past'
    const isActive = status === 'active'

    return (
      <button
        key={entry.metSeconds}
        type="button"
        data-active={isActive}
        onClick={() => setExpanded(isOpen ? null : entry.metSeconds)}
        style={{
          display: 'grid',
          gridTemplateColumns: '72px 1fr',
          gap: 12,
          width: '100%',
          padding: '12px 20px',
          border: 'none',
          borderBottom: '0.5px solid var(--border)',
          background: isActive ? 'rgba(45,107,228,0.06)' : 'transparent',
          opacity: isPast ? 0.45 : 1,
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 150ms ease, opacity 150ms ease',
        }}
        onMouseEnter={(event) => {
          if (!isActive) event.currentTarget.style.background = 'rgba(255,255,255,0.02)'
        }}
        onMouseLeave={(event) => {
          if (!isActive) event.currentTarget.style.background = 'transparent'
        }}
      >
        <div style={{ paddingTop: 2 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: isActive ? 'var(--text-data)' : 'var(--text-3)',
              letterSpacing: '0.08em',
            }}
          >
            T+{entry.met}
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 18,
              marginTop: 8,
              padding: '0 6px',
              borderRadius: 2,
              border: `0.5px solid ${cfg.color}`,
              background: cfg.bg,
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.12em',
              color: cfg.color,
              textTransform: 'uppercase',
            }}
          >
            {cfg.label}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                color: isPast ? 'var(--text-2)' : 'var(--text-1)',
                lineHeight: 1.5,
              }}
            >
              {entry.action}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--text-3)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {entry.crew}
            </div>
          </div>

          {isOpen && entry.detail ? (
            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: '0.5px solid var(--border)',
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                color: 'var(--text-2)',
                lineHeight: 1.6,
              }}
            >
              {entry.detail}
            </div>
          ) : null}
        </div>
      </button>
    )
  }

  return (
    <div
      style={{
        background: 'var(--deep)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '0.5px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="panel-label">Crew Activity Feed</span>
          <span className="panel-live">Live</span>
        </div>

        <button
          type="button"
          onClick={() => setAutoScroll((value) => !value)}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.12em',
            color: autoScroll ? 'var(--accent-hi)' : 'var(--text-3)',
            background: 'transparent',
            border: `0.5px solid ${autoScroll ? 'rgba(77,139,255,0.3)' : 'var(--border)'}`,
            borderRadius: 2,
            padding: '4px 8px',
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          {autoScroll ? 'AUTO' : 'MANUAL'}
        </button>
      </div>

      {nextEvent && timeToNext !== null ? (
        <div
          style={{
            padding: '10px 20px',
            borderBottom: '0.5px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
          }}
        >
          <span style={{ color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Next {nextEvent.action.length > 28 ? `${nextEvent.action.slice(0, 28)}…` : nextEvent.action}
          </span>
          <span style={{ color: TYPE_CONFIG[nextEvent.type].color }}>T-{formatMET(timeToNext)}</span>
        </div>
      ) : null}

      <div
        style={{
          height: 2,
          background: 'var(--border)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: '100%',
            background: 'var(--accent)',
            width: `${Math.min(100, (currentMET / 736200) * 100)}%`,
            transition: 'width 1s linear',
          }}
        />
      </div>

      <div
        ref={feedRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
        onScroll={() => setAutoScroll(false)}
      >
        {upcomingEntries.length > 0 ? (
          <>
            <div
              style={{
                padding: '8px 20px',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.2em',
                color: 'var(--text-3)',
                borderBottom: '0.5px solid var(--border)',
              }}
            >
              UPCOMING
            </div>
            {upcomingEntries.slice(0, 6).map((entry) => renderEntry(entry, 'future'))}
          </>
        ) : null}

        {activeEntries.length > 0 ? (
          <>
            <div
              style={{
                padding: '8px 20px',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.2em',
                color: 'var(--accent-hi)',
                background: 'rgba(45,107,228,0.06)',
                borderBottom: '0.5px solid rgba(45,107,228,0.15)',
              }}
            >
              NOW — T+{metElapsed}
            </div>
            {activeEntries.map((entry) => renderEntry(entry, 'active'))}
          </>
        ) : null}

        {recentPast.length > 0 ? (
          <>
            <div
              style={{
                padding: '8px 20px',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.2em',
                color: 'var(--text-3)',
                borderBottom: '0.5px solid var(--border)',
              }}
            >
              RECENT
            </div>
            {recentPast.map((entry) => renderEntry(entry, 'past'))}
          </>
        ) : null}
      </div>

      <div
        style={{
          padding: '10px 20px',
          borderTop: '0.5px solid var(--border)',
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        {[
          { label: 'COMPLETED', value: past.length + current.filter((entry) => entry.metSeconds <= currentMET).length, color: 'var(--go)' },
          { label: 'ACTIVE', value: current.length, color: 'var(--accent-hi)' },
          { label: 'UPCOMING', value: future.length, color: 'var(--text-3)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color }}>{value}</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--text-3)',
                letterSpacing: '0.14em',
              }}
            >
              {label}
            </span>
          </div>
        ))}

        <div
          style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--text-3)',
            letterSpacing: '0.1em',
          }}
        >
          CLICK ANY ROW FOR DETAIL
        </div>
      </div>
    </div>
  )
}
