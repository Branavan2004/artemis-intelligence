import { useEffect, useRef, useState } from 'react'
import { metStringToSeconds, LAUNCH_EPOCH_MS } from '../hooks/useReplayClock'

interface MissionTimelineProps {
  metElapsed: string
  compact?: boolean
  onSeek?: (metSeconds: number) => void
}

type TimelineEventType = 'milestone' | 'system' | 'rest' | 'burn' | 'activity' | 'comms' | 'experiment' | 'critical'

interface TimelineEvent {
  time: string
  met: string
  label: string
  icon: string
  type: TimelineEventType
  crew: string
  detail: string
}

const RAW_EVENTS: TimelineEvent[] = [
  { time: '2026-04-01T18:35:00-04:00', met: '00:00:00', label: 'LIFTOFF', icon: '🚀', type: 'milestone', crew: 'All crew', detail: 'SLS ignition, 8.8M lbs thrust' },
  {
    time: '2026-04-01T19:43:00-04:00',
    met: '01:08:00',
    label: 'Solar Array Deploy',
    icon: '⚡',
    type: 'system',
    crew: 'All crew',
    detail: 'All 4 Orion solar array wings deployed',
  },
  { time: '2026-04-01T22:00:00-04:00', met: '03:25:00', label: 'Crew Rest', icon: '😴', type: 'rest', crew: 'All crew', detail: 'First sleep period in Earth orbit' },
  {
    time: '2026-04-02T07:00:00-04:00',
    met: '12:25:00',
    label: 'Perigee Raise Burn',
    icon: '🔥',
    type: 'burn',
    crew: 'Koch',
    detail: 'Engine firing raises orbit apogee to 46,000 miles',
  },
  {
    time: '2026-04-02T10:00:00-04:00',
    met: '15:25:00',
    label: 'Exercise',
    icon: '💪',
    type: 'activity',
    crew: 'Wiseman, Glover',
    detail: 'Flywheel exercise device checkout — life support test',
  },
  {
    time: '2026-04-02T19:49:00-04:00',
    met: '25:14:00',
    label: 'TLI BURN',
    icon: '🌙',
    type: 'milestone',
    crew: 'Koch',
    detail: 'Translunar injection — 5 min 49 sec. Orion breaks Earth orbit toward Moon',
  },
  {
    time: '2026-04-02T20:30:00-04:00',
    met: '25:55:00',
    label: 'Space-to-Ground Video',
    icon: '📡',
    type: 'comms',
    crew: 'All crew',
    detail: 'First live crew video downlink from deep space',
  },
  {
    time: '2026-04-03T09:00:00-04:00',
    met: '38:25:00',
    label: 'Trajectory Burn',
    icon: '🎯',
    type: 'burn',
    crew: 'Hansen',
    detail: 'OTC-1 burn — cancelled, trajectory nominal',
  },
  {
    time: '2026-04-03T14:00:00-04:00',
    met: '43:25:00',
    label: 'Laser Comms Test',
    icon: '💡',
    type: 'system',
    crew: 'Koch',
    detail: 'OCLCS laser system tests — 100GB data downlinked',
  },
  {
    time: '2026-04-04T09:00:00-04:00',
    met: '62:25:00',
    label: 'Acoustics Test',
    icon: '🔊',
    type: 'experiment',
    crew: 'All crew',
    detail: '24-hour sound environment characterization',
  },
  {
    time: '2026-04-04T21:10:00-04:00',
    met: '74:35:00',
    label: 'Manual Control Demo',
    icon: '🕹️',
    type: 'milestone',
    crew: 'Glover',
    detail: 'Victor Glover flies Orion manually in deep space',
  },
  {
    time: '2026-04-05T10:00:00-04:00',
    met: '87:25:00',
    label: 'Spacesuit Tests',
    icon: '👨‍🚀',
    type: 'experiment',
    crew: 'All crew',
    detail: 'Emergency pressurization, eating through helmet port',
  },
  {
    time: '2026-04-05T16:00:00-04:00',
    met: '93:25:00',
    label: 'Lunar Sphere Entry',
    icon: '🌑',
    type: 'milestone',
    crew: 'All crew',
    detail: 'Moon gravity now stronger than Earth — point of no return',
  },
  {
    time: '2026-04-06T13:45:00-04:00',
    met: '115:10:00',
    label: 'DISTANCE RECORD',
    icon: '🏆',
    type: 'milestone',
    crew: 'All crew',
    detail: '406,773 km — breaks Apollo 13 record set 1970',
  },
  {
    time: '2026-04-06T14:45:00-04:00',
    met: '116:10:00',
    label: 'Flyby Window Opens',
    icon: '🌕',
    type: 'milestone',
    crew: 'All crew',
    detail: 'Crew begins lunar observations',
  },
  {
    time: '2026-04-06T17:47:00-04:00',
    met: '119:12:00',
    label: 'SIGNAL BLACKOUT',
    icon: '📵',
    type: 'critical',
    crew: 'All crew',
    detail: 'Orion behind Moon — 40 min comms blackout',
  },
  {
    time: '2026-04-06T19:02:00-04:00',
    met: '120:27:00',
    label: 'CLOSEST APPROACH',
    icon: '🎯',
    type: 'milestone',
    crew: 'All crew',
    detail: '4,066 miles from Moon surface — Moon fills windows',
  },
  {
    time: '2026-04-06T18:27:00-04:00',
    met: '119:52:00',
    label: 'Signal Restored',
    icon: '📡',
    type: 'comms',
    crew: 'All crew',
    detail: 'DSN reacquires Orion — crew emerges from far side',
  },
  {
    time: '2026-04-07T00:00:00-04:00',
    met: '125:25:00',
    label: 'Crew Off Day',
    icon: '🎉',
    type: 'rest',
    crew: 'All crew',
    detail: "Full rest day — crew's only day off the entire mission",
  },
  {
    time: '2026-04-08T09:00:00-04:00',
    met: '158:25:00',
    label: 'Return Burn 1',
    icon: '🔥',
    type: 'burn',
    crew: 'All crew',
    detail: 'First return trajectory correction burn',
  },
  {
    time: '2026-04-09T09:00:00-04:00',
    met: '182:25:00',
    label: 'Return Burn 2',
    icon: '🔥',
    type: 'burn',
    crew: 'All crew',
    detail: 'Second return trajectory correction',
  },
  {
    time: '2026-04-10T06:00:00-04:00',
    met: '203:25:00',
    label: 'Service Module Sep',
    icon: '💥',
    type: 'milestone',
    crew: 'All crew',
    detail: 'Crew module separates from European Service Module',
  },
  {
    time: '2026-04-10T07:00:00-04:00',
    met: '204:25:00',
    label: 'REENTRY',
    icon: '🌊',
    type: 'milestone',
    crew: 'All crew',
    detail: '3,000°F heat shield reentry — skip reentry profile',
  },
  {
    time: '2026-04-10T07:30:00-04:00',
    met: '204:55:00',
    label: 'SPLASHDOWN',
    icon: '🚢',
    type: 'milestone',
    crew: 'All crew',
    detail: 'Pacific Ocean — Navy recovery team retrieval',
  },
]

const TIMELINE_EVENTS = [...RAW_EVENTS].sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime())
const TYPE_STYLES: Record<TimelineEventType, { color: string; background: string; label: string }> = {
  milestone: { color: 'var(--accent-hi)', background: 'rgba(77,139,255,0.12)', label: 'MILESTONE' },
  burn: { color: 'var(--caution)', background: 'rgba(232,160,32,0.12)', label: 'BURN' },
  experiment: { color: 'var(--go)', background: 'rgba(0,184,122,0.12)', label: 'EXPERIMENT' },
  comms: { color: 'var(--text-data)', background: 'rgba(168,196,255,0.12)', label: 'COMMS' },
  rest: { color: 'var(--text-2)', background: 'rgba(255,255,255,0.04)', label: 'REST' },
  critical: { color: 'var(--abort)', background: 'rgba(232,60,60,0.12)', label: 'CRITICAL' },
  system: { color: 'var(--text-data)', background: 'rgba(168,196,255,0.12)', label: 'SYSTEM' },
  activity: { color: 'var(--go)', background: 'rgba(0,184,122,0.12)', label: 'ACTIVITY' },
}

function formatEdtTime(value: string) {
  return `${new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York',
  })} EDT`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export default function MissionTimeline({ metElapsed, compact = false, onSeek }: MissionTimelineProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const isScrubbingRef = useRef(false)
  const trackPadding = compact ? 16 : 24
  const cardWidth = compact ? 136 : 176
  const cardGap = compact ? 14 : 20
  const trackWidth = trackPadding * 2 + TIMELINE_EVENTS.length * cardWidth + (TIMELINE_EVENTS.length - 1) * cardGap
  const missionDurationSeconds = metStringToSeconds(TIMELINE_EVENTS[TIMELINE_EVENTS.length - 1]?.met ?? '00:00:00')
  const metSeconds = clamp(metStringToSeconds(metElapsed), 0, missionDurationSeconds)
  const timelineTotalSeconds = 204 * 3600
  const scrubberFraction = clamp(metStringToSeconds(metElapsed) / timelineTotalSeconds, 0, 1)

  const [liveMetSeconds, setLiveMetSeconds] = useState(() => Math.max(0, Math.floor((Date.now() - LAUNCH_EPOCH_MS) / 1000)))

  useEffect(() => {
    const intervalId = setInterval(() => {
      setLiveMetSeconds(Math.max(0, Math.floor((Date.now() - LAUNCH_EPOCH_MS) / 1000)))
    }, 1000)
    return () => clearInterval(intervalId)
  }, [])

  let activeIndex = -1
  for (let index = 0; index < TIMELINE_EVENTS.length; index += 1) {
    if (metStringToSeconds(TIMELINE_EVENTS[index].met) <= metSeconds) {
      activeIndex = index
    }
  }

  const activeEvent = activeIndex >= 0 ? TIMELINE_EVENTS[activeIndex] : null
  const scrubberLeft = trackPadding + (metSeconds / missionDurationSeconds) * (trackWidth - trackPadding * 2)
  const liveNowLeft = trackPadding + (clamp(liveMetSeconds, 0, missionDurationSeconds) / missionDurationSeconds) * (trackWidth - trackPadding * 2)

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const nextScrollLeft = clamp(scrubberLeft - container.clientWidth / 2, 0, trackWidth - container.clientWidth)
    if (compact) {
      container.scrollLeft = nextScrollLeft
      return
    }

    container.scrollTo({ left: nextScrollLeft, behavior: 'smooth' })
  }, [scrubberLeft, trackWidth, compact])

  const headerPadding = compact ? '10px 16px 8px' : '14px 20px 10px'
  const headerSecondaryMargin = compact ? 3 : 6
  const headerValueSize = compact ? 9 : 10
  const headerMetaSize = compact ? 9 : 10
  const trackMinHeight = compact ? 84 : 118
  const trackPaddingValue = compact ? '10px 16px 14px' : '14px 24px 16px'
  const axisTop = compact ? 44 : 62
  const nowIndicatorTop = compact ? 18 : 10
  const nowIndicatorBottom = compact ? 14 : 14
  const dotSize = compact ? 6 : 8
  const dotTop = compact ? 10 : 8
  const markerHeight = compact ? 24 : 26
  const cardLabelSize = compact ? 10 : 11
  const cardMetaSize = compact ? 9 : 10
  const scrubberPadding = compact ? '8px 16px 6px' : '10px 20px 8px'
  const scrubberThumbSize = compact ? 10 : 12

  const seekToClientX = (clientX: number, target: HTMLDivElement) => {
    if (!onSeek) return
    const rect = target.getBoundingClientRect()
    const clickFrac = clamp((clientX - rect.left) / rect.width, 0, 1)
    onSeek(Math.floor(clickFrac * timelineTotalSeconds))
  }

  return (
    <section
      style={{
        height: '100%',
        background: compact ? 'transparent' : 'var(--deep)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          padding: headerPadding,
          borderBottom: '0.5px solid var(--border)',
        }}
      >
        <div>
          <div className="panel-label">Mission Timeline</div>
          {!compact ? (
            <div style={{ marginTop: headerSecondaryMargin, fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Live Artemis II milestones
            </div>
          ) : null}
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: headerValueSize, color: 'var(--text-data)', letterSpacing: '0.08em' }}>MET {metElapsed}</div>
          <div style={{ marginTop: headerSecondaryMargin, fontSize: headerMetaSize, color: 'var(--text-3)' }}>
            {activeEvent ? formatEdtTime(activeEvent.time) : 'Awaiting first event'}
          </div>
        </div>
      </div>

      <div style={{ padding: scrubberPadding }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 6,
            background: 'var(--border)',
            cursor: onSeek ? 'pointer' : 'default',
            touchAction: 'none',
          }}
          onPointerDown={(event) => {
            if (!onSeek) return
            isScrubbingRef.current = true
            event.currentTarget.setPointerCapture(event.pointerId)
            seekToClientX(event.clientX, event.currentTarget)
          }}
          onPointerMove={(event) => {
            if (!onSeek || !isScrubbingRef.current) return
            seekToClientX(event.clientX, event.currentTarget)
          }}
          onPointerUp={(event) => {
            if (!onSeek) return
            isScrubbingRef.current = false
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
          }}
          onPointerCancel={(event) => {
            isScrubbingRef.current = false
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
          }}
          onLostPointerCapture={() => {
            isScrubbingRef.current = false
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: `${scrubberFraction * 100}%`,
              height: '100%',
              background: 'var(--accent)',
              transition: 'width 0.1s linear',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: `${scrubberFraction * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: scrubberThumbSize,
              height: scrubberThumbSize,
              borderRadius: '50%',
              background: 'var(--accent)',
              border: '2px solid var(--text-1)',
              cursor: onSeek ? 'grab' : 'default',
            }}
          />
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
        <div style={{ position: 'relative', width: trackWidth, minHeight: trackMinHeight, padding: trackPaddingValue }}>
          <div
            style={{
              position: 'absolute',
              top: axisTop,
              left: trackPadding,
              right: trackPadding,
              height: 1,
              background: 'var(--border)',
            }}
          />

          <div
            style={{
              position: 'absolute',
              top: nowIndicatorTop,
              bottom: nowIndicatorBottom,
              left: liveNowLeft,
              width: 1.5,
              background: 'var(--abort)',
            }}
          />

          <div
            style={{
              position: 'absolute',
              top: 0,
              left: liveNowLeft - 12,
              fontSize: compact ? 9 : 10,
              color: 'var(--abort)',
              letterSpacing: '0.12em',
            }}
          >
            NOW
          </div>

          <div style={{ position: 'relative', display: 'flex', gap: cardGap }}>
            {TIMELINE_EVENTS.map((event, index) => {
              const isPast = index < activeIndex
              const isActive = index === activeIndex
              const typeStyle = TYPE_STYLES[event.type]

              return (
                <div
                  key={`${event.time}-${event.label}`}
                  style={{
                    width: cardWidth,
                    flexShrink: 0,
                    opacity: isPast ? 0.4 : 1,
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      minHeight: compact ? 16 : 20,
                      padding: '0 6px',
                      borderRadius: 2,
                      border: `0.5px solid ${typeStyle.color}`,
                      background: typeStyle.background,
                      fontSize: compact ? 8 : 9,
                      letterSpacing: '0.14em',
                      color: typeStyle.color,
                      textTransform: 'uppercase',
                    }}
                  >
                    {typeStyle.label}
                  </div>

                  <div style={{ position: 'relative', height: markerHeight }}>
                    <div
                      style={{
                        position: 'absolute',
                        top: dotTop,
                        left: 0,
                        width: dotSize,
                        height: dotSize,
                        borderRadius: '50%',
                        background: isPast ? 'var(--text-3)' : typeStyle.color,
                      }}
                    />
                  </div>

                  <div style={{ paddingBottom: 8, borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent' }}>
                    <div style={{ fontSize: cardMetaSize, color: 'var(--text-3)', letterSpacing: '0.08em' }}>MET {event.met}</div>
                    <div style={{ marginTop: compact ? 4 : 8, fontSize: cardLabelSize, color: 'var(--text-1)', letterSpacing: '0.04em' }}>
                      {event.label}
                    </div>
                    {!compact ? (
                      <>
                        <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-3)' }}>{event.crew}</div>
                        <div style={{ marginTop: 6, fontSize: 10, lineHeight: 1.6, color: 'var(--text-2)' }}>{event.detail}</div>
                      </>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
