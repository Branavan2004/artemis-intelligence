import { useEffect, useRef } from 'react'

interface WindowViewProps {
  distanceFromEarthKm: number
  distanceFromMoonKm?: number
  metElapsed: string
}

interface StarPoint {
  x: number
  y: number
  radius: number
  alpha: number
  phase: number
}

interface EllipseMark {
  x: number
  y: number
  rx: number
  ry: number
  rotation: number
}

function createSeededRandom(seed: number) {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

const random = createSeededRandom(42)
const CANVAS_SIZE = 320
const DISPLAY_SIZE = 260
const CENTER = CANVAS_SIZE / 2
const BEZEL_WIDTH = 24
const VIEW_RADIUS = CENTER - BEZEL_WIDTH - 2
const VIEW_DIAMETER = VIEW_RADIUS * 2
const MOON_RADIUS_KM = 1737
const EARTH_RADIUS_KM = 6371
const FLYBY_START_SECONDS = 116 * 3600 + 10 * 60
const FLYBY_END_SECONDS = 123 * 3600 + 5 * 60
const BLACKOUT_START_SECONDS = 119 * 3600 + 12 * 60
const BLACKOUT_END_SECONDS = 119 * 3600 + 52 * 60

const STARS: StarPoint[] = Array.from({ length: 200 }, () => ({
  x: random() * CANVAS_SIZE,
  y: random() * CANVAS_SIZE,
  radius: 0.5 + random(),
  alpha: 0.25 + random() * 0.75,
  phase: random() * Math.PI * 2,
}))

const MOON_CRATERS: EllipseMark[] = Array.from({ length: 10 }, () => ({
  x: -0.42 + random() * 0.84,
  y: -0.36 + random() * 0.72,
  rx: 0.05 + random() * 0.08,
  ry: 0.04 + random() * 0.08,
  rotation: random() * Math.PI,
}))

const MOON_MARIA: EllipseMark[] = Array.from({ length: 4 }, () => ({
  x: -0.32 + random() * 0.64,
  y: -0.28 + random() * 0.56,
  rx: 0.12 + random() * 0.14,
  ry: 0.08 + random() * 0.14,
  rotation: random() * Math.PI,
}))

function parseMetSeconds(value: string) {
  if (/^\d{1,3}:\d{2}:\d{2}$/.test(value)) {
    const [hours, minutes, seconds] = value.split(':').map(Number)
    return hours * 3600 + minutes * 60 + seconds
  }

  const hours = Number(value.match(/(\d+)\s*h/i)?.[1] ?? 0)
  const minutes = Number(value.match(/(\d+)\s*m/i)?.[1] ?? 0)
  const seconds = Number(value.match(/(\d+)\s*s/i)?.[1] ?? 0)
  return hours * 3600 + minutes * 60 + seconds
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function apparentAngularSize(radiusKm: number, distanceKm: number) {
  return (2 * Math.atan(radiusKm / Math.max(distanceKm, 1)) * 180) / Math.PI
}

function drawStars(context: CanvasRenderingContext2D, time: number, brightness: number) {
  for (const star of STARS) {
    const twinkle = 0.55 + 0.45 * Math.sin((time / 3000) * Math.PI * 2 + star.phase)
    context.beginPath()
    context.fillStyle = `rgba(255, 255, 255, ${star.alpha * twinkle * brightness})`
    context.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
    context.fill()
  }
}

function drawEarth(context: CanvasRenderingContext2D, x: number, y: number, diameter: number, time: number) {
  const radius = diameter / 2
  const gradient = context.createRadialGradient(x - radius * 0.32, y - radius * 0.34, radius * 0.18, x, y, radius)
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(0.34, '#80c9ff')
  gradient.addColorStop(0.7, '#1f5bff')
  gradient.addColorStop(1, '#03204e')

  context.save()
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.clip()
  context.fillStyle = gradient
  context.fillRect(x - radius, y - radius, diameter, diameter)

  const rotation = (time / 14000) % (Math.PI * 2)

  for (let index = 0; index < 3; index += 1) {
    const offset = Math.sin(rotation + index * 1.5) * radius * 0.4
    context.fillStyle = index === 1 ? 'rgba(255, 255, 255, 0.16)' : 'rgba(232, 246, 255, 0.22)'
    context.beginPath()
    context.ellipse(x + offset, y - radius * 0.34 + index * radius * 0.34, radius * 0.9, radius * 0.17, rotation * 0.18, 0, Math.PI * 2)
    context.fill()
  }

  context.fillStyle = 'rgba(0, 16, 30, 0.28)'
  context.beginPath()
  context.ellipse(x - radius * 0.12 + Math.cos(rotation) * radius * 0.1, y - radius * 0.18, radius * 0.3, radius * 0.18, 0.6, 0, Math.PI * 2)
  context.fill()
  context.beginPath()
  context.ellipse(x + radius * 0.16 - Math.sin(rotation) * radius * 0.12, y + radius * 0.18, radius * 0.28, radius * 0.15, -0.5, 0, Math.PI * 2)
  context.fill()

  context.restore()
}

function drawMoon(context: CanvasRenderingContext2D, x: number, y: number, diameter: number, time: number, flyby: boolean) {
  const radius = diameter / 2
  const gradient = context.createRadialGradient(x - radius * 0.28, y - radius * 0.3, radius * 0.12, x, y, radius)
  gradient.addColorStop(0, '#d6d1c0')
  gradient.addColorStop(0.58, '#9b9686')
  gradient.addColorStop(1, '#444433')

  context.save()
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.clip()
  context.fillStyle = gradient
  context.fillRect(x - radius, y - radius, diameter, diameter)

  context.fillStyle = 'rgba(34, 36, 31, 0.24)'
  for (const maria of MOON_MARIA) {
    if (!flyby) break
    context.beginPath()
    context.ellipse(
      x + maria.x * radius,
      y + maria.y * radius,
      maria.rx * radius,
      maria.ry * radius,
      maria.rotation,
      0,
      Math.PI * 2,
    )
    context.fill()
  }

  context.fillStyle = 'rgba(20, 20, 17, 0.24)'
  for (const crater of MOON_CRATERS) {
    context.beginPath()
    context.ellipse(
      x + crater.x * radius,
      y + crater.y * radius,
      crater.rx * radius,
      crater.ry * radius,
      crater.rotation,
      0,
      Math.PI * 2,
    )
    context.fill()
  }

  const shadowGradient = context.createLinearGradient(x - radius, y, x + radius, y)
  const shadowShift = 0.1 + 0.1 * Math.sin(time / 9000)
  shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.72)')
  shadowGradient.addColorStop(clamp(0.45 + shadowShift, 0.2, 0.7), 'rgba(0, 0, 0, 0.22)')
  shadowGradient.addColorStop(1, 'rgba(255, 248, 218, 0.04)')
  context.fillStyle = shadowGradient
  context.fillRect(x - radius, y - radius, diameter, diameter)

  if (flyby) {
    context.strokeStyle = 'rgba(255, 146, 78, 0.55)'
    context.lineWidth = 4
    context.beginPath()
    context.arc(x, y, radius - 2, -0.4, 1.15)
    context.stroke()
  }

  context.restore()
}

function drawStaticNoise(context: CanvasRenderingContext2D, time: number) {
  const noiseRandom = createSeededRandom(Math.floor(time / 120) + 7)
  for (let index = 0; index < 120; index += 1) {
    const x = noiseRandom() * CANVAS_SIZE
    const y = noiseRandom() * CANVAS_SIZE
    const alpha = 0.02 + noiseRandom() * 0.05
    context.fillStyle = `rgba(255, 255, 255, ${alpha})`
    context.fillRect(x, y, 2, 2)
  }
}

function formatDistance(distanceKm: number) {
  return `${Math.round(distanceKm).toLocaleString()} km`
}

export default function WindowView({ distanceFromEarthKm, distanceFromMoonKm, metElapsed }: WindowViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const moonDistanceKm = distanceFromMoonKm ?? Math.abs(384400 - distanceFromEarthKm)
  const metSeconds = parseMetSeconds(metElapsed)
  const inFlybyWindow = metSeconds >= FLYBY_START_SECONDS && metSeconds <= FLYBY_END_SECONDS
  const inBlackoutWindow = metSeconds >= BLACKOUT_START_SECONDS && metSeconds <= BLACKOUT_END_SECONDS
  const closestApproach = moonDistanceKm <= 8000

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    let frameId = 0

    const renderFrame = (time: number) => {
      context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      context.save()
      context.beginPath()
      context.arc(CENTER, CENTER, VIEW_RADIUS, 0, Math.PI * 2)
      context.clip()

      context.fillStyle = inBlackoutWindow ? '#020305' : '#010208'
      context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      drawStars(context, time, inBlackoutWindow ? 0.24 : 1)

      if (inBlackoutWindow) {
        drawStaticNoise(context, time)
        const blink = Math.sin(time / 220) > 0 ? 1 : 0.35
        context.fillStyle = `rgba(255, 72, 72, ${blink})`
        context.textAlign = 'center'
        context.font = "500 18px 'JetBrains Mono', monospace"
        context.fillText('SIGNAL LOST', CENTER, CENTER - 2)
        context.fillStyle = 'rgba(255, 201, 201, 0.7)'
        context.font = "400 11px 'JetBrains Mono', monospace"
        context.fillText('Far-side lunar comms blackout', CENTER, CENTER + 18)
      } else {
        const earthAngle = apparentAngularSize(EARTH_RADIUS_KM, Math.max(distanceFromEarthKm, 1))
        const earthDiameter = clamp((VIEW_DIAMETER * earthAngle) / 60, 0, VIEW_DIAMETER * 0.68)

        if (earthDiameter > 2) {
          drawEarth(context, CENTER - VIEW_RADIUS * 0.4, CENTER + VIEW_RADIUS * 0.22, earthDiameter, time)
        }

        const moonAngle = apparentAngularSize(MOON_RADIUS_KM, Math.max(moonDistanceKm, 1))
        const flybyMultiplier = inFlybyWindow ? 1.7 : 1
        const moonDiameter = clamp(((VIEW_DIAMETER * moonAngle) / 60) * flybyMultiplier, 6, VIEW_DIAMETER * 0.92)
        const moonX = inFlybyWindow ? CENTER : CENTER + VIEW_RADIUS * 0.16
        const moonY = inFlybyWindow ? CENTER - 4 : CENTER - VIEW_RADIUS * 0.1

        drawMoon(context, moonX, moonY, moonDiameter, time, inFlybyWindow)

        if (closestApproach) {
          context.fillStyle = 'rgba(3, 10, 24, 0.78)'
          context.strokeStyle = 'rgba(255, 166, 0, 0.35)'
          context.lineWidth = 1
          const badgeWidth = 148
          const badgeHeight = 26
          const badgeX = CENTER - badgeWidth / 2
          const badgeY = CANVAS_SIZE - 48
          context.beginPath()
          context.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 2)
          context.fill()
          context.stroke()
          context.fillStyle = '#ffc772'
          context.textAlign = 'center'
          context.font = "500 11px 'JetBrains Mono', monospace"
          context.fillText('CLOSEST APPROACH', CENTER, badgeY + 17)
        }
      }

      context.restore()
      frameId = window.requestAnimationFrame(renderFrame)
    }

    frameId = window.requestAnimationFrame(renderFrame)

    return () => window.cancelAnimationFrame(frameId)
  }, [closestApproach, distanceFromEarthKm, inBlackoutWindow, inFlybyWindow, moonDistanceKm])

  return (
    <div
      style={{
        display: 'grid',
        justifyItems: 'center',
        width: '100%',
        background: 'var(--deep)',
      }}
    >
      <div style={{ position: 'relative', width: DISPLAY_SIZE, height: DISPLAY_SIZE }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          style={{
            width: DISPLAY_SIZE,
            height: DISPLAY_SIZE,
            borderRadius: '50%',
            display: 'block',
            background: 'var(--void)',
          }}
        />

        <svg
          width={DISPLAY_SIZE}
          height={DISPLAY_SIZE}
          viewBox={`0 0 ${DISPLAY_SIZE} ${DISPLAY_SIZE}`}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          <circle cx={130} cy={130} r={122} fill="none" stroke="var(--border-2)" strokeWidth="20" />
          <circle cx={130} cy={130} r={112} fill="none" stroke="var(--border-2)" strokeWidth="1" />
          <circle cx={130} cy={130} r={102} fill="none" stroke="var(--border)" strokeWidth="1" />

          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
            const radians = (angle * Math.PI) / 180
            const x = 130 + Math.cos(radians) * 103
            const y = 130 + Math.sin(radians) * 103

            return (
              <g key={angle}>
                <circle cx={x} cy={y} r="6" fill="var(--surface)" stroke="var(--border-2)" strokeWidth="1" />
                <circle cx={x} cy={y} r="2" fill="var(--border-2)" />
              </g>
            )
          })}
        </svg>
      </div>

      <div
        style={{
          marginTop: 12,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-3)',
          textAlign: 'center',
          letterSpacing: '0.08em',
        }}
      >
        Moon: {formatDistance(moonDistanceKm)}
      </div>
    </div>
  )
}
