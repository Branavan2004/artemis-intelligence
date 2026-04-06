import { useEffect, useId, useMemo, useState } from 'react'

type RiskLevel = 'nominal' | 'elevated' | 'severe'

interface TrajectoryMapFallbackProps {
  progress: number
  riskLevel: RiskLevel
  distanceFromEarthKm: number
  metElapsed: string
}

interface Point {
  x: number
  y: number
}

const VIEWBOX = {
  width: 960,
  height: 540,
}

const EARTH = { x: 206, y: 334, r: 72 }
const MOON = { x: 742, y: 162, r: 28 }
const OUTBOUND_ARC = [
  { x: EARTH.x + EARTH.r * 0.95, y: EARTH.y - 12 },
  { x: 332, y: 82 },
  { x: 596, y: 42 },
  { x: MOON.x - 34, y: MOON.y + 6 },
] as const
const RETURN_ARC = [
  { x: MOON.x - 34, y: MOON.y + 6 },
  { x: 700, y: 318 },
  { x: 436, y: 496 },
  { x: EARTH.x + 46, y: EARTH.y + 18 },
] as const
const PEAK_PROGRESS = 0.56
const STAR_FIELD = [
  { x: 112, y: 74, r: 1.2, opacity: 0.55 },
  { x: 174, y: 154, r: 1.6, opacity: 0.38 },
  { x: 288, y: 64, r: 1.4, opacity: 0.5 },
  { x: 354, y: 196, r: 1.2, opacity: 0.44 },
  { x: 468, y: 84, r: 1.8, opacity: 0.62 },
  { x: 572, y: 114, r: 1.3, opacity: 0.47 },
  { x: 646, y: 60, r: 1.5, opacity: 0.55 },
  { x: 714, y: 232, r: 1.4, opacity: 0.34 },
  { x: 812, y: 122, r: 1.8, opacity: 0.58 },
  { x: 868, y: 72, r: 1.1, opacity: 0.46 },
  { x: 842, y: 264, r: 1.5, opacity: 0.42 },
  { x: 760, y: 402, r: 1.2, opacity: 0.36 },
  { x: 618, y: 454, r: 1.6, opacity: 0.4 },
  { x: 504, y: 384, r: 1.1, opacity: 0.32 },
  { x: 312, y: 446, r: 1.4, opacity: 0.5 },
  { x: 164, y: 414, r: 1.3, opacity: 0.37 },
] as const

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function pointOnBezier(t: number, [p0, p1, p2, p3]: readonly [Point, Point, Point, Point]) {
  const inv = 1 - t
  const x =
    (inv ** 3) * p0.x +
    (3 * inv * inv * t) * p1.x +
    (3 * inv * t * t) * p2.x +
    (t ** 3) * p3.x
  const y =
    (inv ** 3) * p0.y +
    (3 * inv * inv * t) * p1.y +
    (3 * inv * t * t) * p2.y +
    (t ** 3) * p3.y

  return { x, y }
}

function getTrajectoryPoint(progress: number) {
  const safeProgress = clamp(progress)

  if (safeProgress <= PEAK_PROGRESS) {
    return pointOnBezier(safeProgress / PEAK_PROGRESS, OUTBOUND_ARC)
  }

  return pointOnBezier((safeProgress - PEAK_PROGRESS) / (1 - PEAK_PROGRESS), RETURN_ARC)
}

function getRiskColor(riskLevel: RiskLevel) {
  if (riskLevel === 'severe') {
    return '#ff5c6c'
  }

  if (riskLevel === 'elevated') {
    return '#ffb454'
  }

  return '#61b4ff'
}

export function missionElapsedToProgress(metElapsed: string) {
  const [hours = 0, minutes = 0, seconds = 0] = metElapsed.split(':').map(Number)
  const elapsedSeconds = (hours * 3600) + (minutes * 60) + seconds
  return clamp(elapsedSeconds / (204 * 3600))
}

export function supportsWebGL() {
  if (typeof window === 'undefined') {
    return true
  }

  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl'),
    )
  } catch {
    return false
  }
}

export function useStaticTrajectoryFallback() {
  const getShouldFallback = () =>
    typeof window !== 'undefined' &&
    (window.innerWidth < 768 || !supportsWebGL())

  const [shouldFallback, setShouldFallback] = useState(getShouldFallback)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const updateFallback = () => {
      setShouldFallback(getShouldFallback())
    }

    updateFallback()
    window.addEventListener('resize', updateFallback)

    return () => {
      window.removeEventListener('resize', updateFallback)
    }
  }, [])

  return shouldFallback
}

export default function TrajectoryMapFallback({
  progress,
  riskLevel,
  distanceFromEarthKm,
  metElapsed,
}: TrajectoryMapFallbackProps) {
  const gradientId = useId().replace(/:/g, '')
  const riskColor = getRiskColor(riskLevel)
  const progressPoint = useMemo(() => getTrajectoryPoint(progress), [progress])

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 26% 24%, rgba(20, 52, 108, 0.44), rgba(4, 10, 25, 0.96) 58%, rgba(1, 2, 8, 1) 100%)',
      }}
    >
      <svg
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Static Artemis II trajectory map"
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <defs>
          <linearGradient id={`${gradientId}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#08111f" />
            <stop offset="52%" stopColor="#030814" />
            <stop offset="100%" stopColor="#010207" />
          </linearGradient>
          <radialGradient id={`${gradientId}-earthGlow`} cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="#89c3ff" stopOpacity="0.55" />
            <stop offset="58%" stopColor="#1855a6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#061126" stopOpacity="0.05" />
          </radialGradient>
          <radialGradient id={`${gradientId}-earthCore`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#75c1ff" />
            <stop offset="55%" stopColor="#1b5daa" />
            <stop offset="100%" stopColor="#072047" />
          </radialGradient>
          <radialGradient id={`${gradientId}-moonCore`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#f2f3f6" />
            <stop offset="70%" stopColor="#8f97a5" />
            <stop offset="100%" stopColor="#4f5662" />
          </radialGradient>
        </defs>

        <rect width={VIEWBOX.width} height={VIEWBOX.height} fill={`url(#${gradientId}-bg)`} />

        {Array.from({ length: 7 }).map((_, index) => {
          const x = 90 + (index * 120)
          return (
            <line
              key={`grid-x-${x}`}
              x1={x}
              y1="34"
              x2={x}
              y2="498"
              stroke="rgba(93, 133, 192, 0.11)"
              strokeWidth="1"
            />
          )
        })}

        {Array.from({ length: 5 }).map((_, index) => {
          const y = 82 + (index * 92)
          return (
            <line
              key={`grid-y-${y}`}
              x1="58"
              y1={y}
              x2="902"
              y2={y}
              stroke="rgba(93, 133, 192, 0.1)"
              strokeWidth="1"
            />
          )
        })}

        {STAR_FIELD.map((star, index) => (
          <circle
            key={`star-${index}`}
            cx={star.x}
            cy={star.y}
            r={star.r}
            fill={`rgba(201, 226, 255, ${star.opacity})`}
          />
        ))}

        <circle
          cx={EARTH.x}
          cy={EARTH.y}
          r={EARTH.r * 1.32}
          fill={`url(#${gradientId}-earthGlow)`}
          opacity="0.7"
        />
        <circle cx={EARTH.x} cy={EARTH.y} r={EARTH.r} fill={`url(#${gradientId}-earthCore)`} />
        <circle
          cx={EARTH.x - 18}
          cy={EARTH.y - 20}
          r={EARTH.r * 0.34}
          fill="rgba(255, 255, 255, 0.22)"
        />

        <circle
          cx={MOON.x}
          cy={MOON.y}
          r={MOON.r * 1.7}
          fill="rgba(162, 176, 194, 0.08)"
        />
        <circle cx={MOON.x} cy={MOON.y} r={MOON.r} fill={`url(#${gradientId}-moonCore)`} />
        <circle cx={MOON.x - 6} cy={MOON.y - 4} r="4.5" fill="rgba(59, 66, 78, 0.18)" />
        <circle cx={MOON.x + 8} cy={MOON.y + 7} r="3.5" fill="rgba(59, 66, 78, 0.16)" />

        <path
          d={`M ${OUTBOUND_ARC[0].x} ${OUTBOUND_ARC[0].y} C ${OUTBOUND_ARC[1].x} ${OUTBOUND_ARC[1].y}, ${OUTBOUND_ARC[2].x} ${OUTBOUND_ARC[2].y}, ${OUTBOUND_ARC[3].x} ${OUTBOUND_ARC[3].y}`}
          fill="none"
          stroke="rgba(97, 180, 255, 0.9)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d={`M ${RETURN_ARC[0].x} ${RETURN_ARC[0].y} C ${RETURN_ARC[1].x} ${RETURN_ARC[1].y}, ${RETURN_ARC[2].x} ${RETURN_ARC[2].y}, ${RETURN_ARC[3].x} ${RETURN_ARC[3].y}`}
          fill="none"
          stroke="rgba(255, 180, 84, 0.6)"
          strokeWidth="3"
          strokeDasharray="12 10"
          strokeLinecap="round"
        />

        <circle
          cx={progressPoint.x}
          cy={progressPoint.y}
          r="18"
          fill={`${riskColor}18`}
          stroke={`${riskColor}55`}
          strokeWidth="1"
        />
        <circle
          cx={progressPoint.x}
          cy={progressPoint.y}
          r="7.5"
          fill={riskColor}
          stroke="#d8e8fb"
          strokeWidth="2"
        />

        <line
          x1={progressPoint.x}
          y1={progressPoint.y}
          x2={progressPoint.x + 74}
          y2={progressPoint.y - 54}
          stroke={`${riskColor}88`}
          strokeWidth="1.5"
        />
        <text
          x={progressPoint.x + 84}
          y={progressPoint.y - 60}
          fill="#d5e6fb"
          fontSize="11"
          letterSpacing="0.22em"
          fontFamily='"JetBrains Mono", "Fira Code", monospace'
        >
          ORION
        </text>
        <text
          x={progressPoint.x + 84}
          y={progressPoint.y - 40}
          fill="rgba(154, 184, 221, 0.72)"
          fontSize="10"
          letterSpacing="0.12em"
          fontFamily='"JetBrains Mono", "Fira Code", monospace'
        >
          {metElapsed}
        </text>

        <text
          x={EARTH.x - 48}
          y={EARTH.y + EARTH.r + 34}
          fill="rgba(111, 176, 255, 0.86)"
          fontSize="12"
          letterSpacing="0.28em"
          fontFamily='"JetBrains Mono", "Fira Code", monospace'
        >
          EARTH
        </text>
        <text
          x={MOON.x - 28}
          y={MOON.y + MOON.r + 28}
          fill="rgba(214, 221, 232, 0.72)"
          fontSize="12"
          letterSpacing="0.28em"
          fontFamily='"JetBrains Mono", "Fira Code", monospace'
        >
          MOON
        </text>

        <rect
          x="54"
          y="436"
          width="258"
          height="58"
          rx="10"
          fill="rgba(4, 10, 24, 0.84)"
          stroke="rgba(70, 118, 188, 0.24)"
        />
        <text
          x="76"
          y="462"
          fill="rgba(102, 160, 233, 0.88)"
          fontSize="10"
          letterSpacing="0.22em"
          fontFamily='"JetBrains Mono", "Fira Code", monospace'
        >
          STATIC TRAJECTORY
        </text>
        <text
          x="76"
          y="482"
          fill="rgba(205, 223, 244, 0.88)"
          fontSize="11"
          fontFamily='"JetBrains Mono", "Fira Code", monospace'
        >
          {distanceFromEarthKm.toLocaleString()} km from Earth
        </text>
      </svg>
    </div>
  )
}
