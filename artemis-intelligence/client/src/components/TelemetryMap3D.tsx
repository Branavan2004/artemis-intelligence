import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { metStringToSeconds } from '../hooks/useReplayClock'

// ═══════════════════════════════════════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════════════════════════════════════
interface TelemetryMap3DProps {
  distanceFromEarthKm?: number
  speedKmS?: number
  metElapsed?: string
  trajectoryFraction?: number
  riskLevel?: 'nominal' | 'elevated' | 'severe'
  heightPx?: number
  fullscreen?: boolean
}

type FocusTarget = 'earth' | 'shuttle' | 'moon'

// ═══════════════════════════════════════════════════════════════════════════════
// SCALE CONSTANTS
// All distances in "scene units" where 1 SU = Earth radius (6,371 km)
// ═══════════════════════════════════════════════════════════════════════════════
const ER       = 1                      // Earth radius
const MOON_R   = ER * 0.2724            // Moon radius (1,737 km)
const KM       = 1 / 6371               // 1 km in scene units
const MOON_D   = 384400 * KM            // Moon orbital distance (~60.3 SU)
const ORION_MOON_DIST = 60.27
const STAR_MIN = MOON_D * 8
const STAR_MAX = MOON_D * 20
const ORION_TRAJECTORY_TOTAL_S = 204 * 3600
const TLI_FRAC = 25 / 204
const ORION_PEAK_TRAJECTORY_FRAC = TLI_FRAC + (1 - TLI_FRAC) * 0.5

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════
function easeInOutCubic(t: number): number {
  t = Math.min(1, Math.max(0, t))
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function computeTrajectoryFraction(met: string): number {
  return Math.min(Math.max(metStringToSeconds(met) / ORION_TRAJECTORY_TOTAL_S, 0), 1)
}

function getOrionArcPosition(frac: number): THREE.Vector3 {
  const clampedFrac = Math.min(Math.max(frac, 0), 1)

  let orionDist: number
  if (clampedFrac < TLI_FRAC) {
    orionDist = (400 + (10000 - 400) * (clampedFrac / TLI_FRAC)) / 6371
  } else {
    const arcFrac = (clampedFrac - TLI_FRAC) / (1 - TLI_FRAC)
    orionDist = (400 + (406773 - 400) * Math.sin(arcFrac * Math.PI)) / 6371
  }

  const angle = clampedFrac * Math.PI * 1.95 - 0.1
  const y = ORION_MOON_DIST * 0.07 * Math.sin(clampedFrac * Math.PI)

  return new THREE.Vector3(
    Math.cos(angle) * orionDist,
    y,
    Math.sin(angle) * orionDist,
  )
}

// Load texture with canvas fallback so scene never goes black
function makeTex(url: string, fallback: string, size = 128): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2)
  const colors = fallback === 'earth'
    ? ['#3a7abf', '#1a5fa8', '#0d3d6e']
    : fallback === 'moon'
    ? ['#ccccbb', '#999988', '#555544']
    : ['#ffffff', '#aaaaaa', '#444444']
  grad.addColorStop(0, colors[0])
  grad.addColorStop(0.5, colors[1])
  grad.addColorStop(1, colors[2])
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2)
  ctx.fill()
  return new THREE.CanvasTexture(c)
}

// Canvas sprite label
function makeTextSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 320; canvas.height = 48
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 320, 48)
  ctx.font = '600 13px "JetBrains Mono", "Courier New", monospace'
  ctx.fillStyle = color
  ctx.globalAlpha = 0.75
  ctx.textAlign = 'center'
  ctx.fillText(text, 160, 30)
  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(MOON_D * 0.18, MOON_D * 0.027, 1)
  return sprite
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const TelemetryMap3D: React.FC<TelemetryMap3DProps> = ({
  distanceFromEarthKm = 380000,
  speedKmS            = 1.0,
  metElapsed          = '00:00:00',
  trajectoryFraction,
  riskLevel           = 'nominal',
  heightPx            = 560,
  fullscreen          = false,
}) => {
  const mountRef    = useRef<HTMLDivElement>(null)
  const [focus, setFocus]       = useState<FocusTarget>('earth')
  const [showPanel, setShowPanel] = useState(false)
  const [ready, setReady]       = useState(false)
  const [hovered, setHovered]   = useState<FocusTarget | null>(null)

  // Scene refs — stable across renders
  const rendRef   = useRef<THREE.WebGLRenderer | null>(null)
  const camRef    = useRef<THREE.PerspectiveCamera | null>(null)
  const sceneRef  = useRef<THREE.Scene | null>(null)
  const rafRef    = useRef<number>(0)

  // Orbit state
  const targetPos  = useRef(new THREE.Vector3(0, 0, 0))  // orbit pivot
  const isDragging = useRef(false)
  const lastMouse  = useRef({ x: 0, y: 0 })
  const sph        = useRef(new THREE.Spherical(MOON_D * 1.85, Math.PI / 2.4, 0.6))

  // Camera ease
  const ease = useRef({
    active: false, t: 0, speed: 0.022,
    fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(),
    fromTgt: new THREE.Vector3(), toTgt: new THREE.Vector3(),
  })

  // World positions (set during setup, read by focus fn)
  const moonWorldPos   = useRef(new THREE.Vector3())
  const orionWorldPos  = useRef(new THREE.Vector3())
  const focusRef       = useRef<FocusTarget>('earth')
  const trajectoryFractionRef = useRef<number | undefined>(trajectoryFraction)

  // Focus fn stored in ref so buttons can call it after setup
  const focusFn = useRef<(t: FocusTarget) => void>(() => {})

  // Prop refs — readable inside the animation loop without re-init
  const metRef   = useRef(metElapsed)
  useEffect(() => { trajectoryFractionRef.current = trajectoryFraction }, [trajectoryFraction])
  useEffect(() => { metRef.current   = metElapsed          }, [metElapsed])
  useEffect(() => { focusRef.current = focus }, [focus])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // ── Renderer ─────────────────────────────────────────────────────────────
    const W = mount.clientWidth || 900
    const H = mount.clientHeight || 600

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    renderer.setSize(mount.clientWidth || W, mount.clientHeight || H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.shadowMap.enabled = false
    mount.appendChild(renderer.domElement)
    rendRef.current = renderer

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    sceneRef.current = scene

    // Deep space — very dark navy, not pure black
    scene.background = new THREE.Color(fullscreen ? 0x000000 : 0x00010e)
    scene.fog = new THREE.FogExp2(fullscreen ? 0x000000 : 0x00010e, 0.0006)

    // ── Camera ────────────────────────────────────────────────────────────────
    const cam = new THREE.PerspectiveCamera(52, W / H, ER * 0.01, STAR_MAX * 2)
    // Start position: wide shot showing Earth left, Moon right, stars everywhere
    const initPos = new THREE.Vector3(
      MOON_D * 0.22,
      MOON_D * 0.52,
      MOON_D * 1.78
    )
    cam.position.copy(initPos)
    cam.lookAt(MOON_D * 0.22, 0, 0)
    sph.current.setFromVector3(initPos.clone().sub(new THREE.Vector3(MOON_D * 0.22, 0, 0)))
    targetPos.current.set(MOON_D * 0.22, 0, 0)
    camRef.current = cam

    // ── Lighting ──────────────────────────────────────────────────────────────
    // Dim ambient — deep space
    scene.add(new THREE.AmbientLight(0x0d1a2e, 2.0))

    // Sun — far left, bright, warm
    const sun = new THREE.DirectionalLight(0xfff4e0, 4.5)
    sun.position.set(-MOON_D * 8, MOON_D * 1.2, MOON_D * 0.5)
    scene.add(sun)

    // Subtle fill light from opposite side (bounce light)
    const fill = new THREE.DirectionalLight(0x112244, 0.4)
    fill.position.set(MOON_D * 3, -MOON_D * 0.5, -MOON_D * 2)
    scene.add(fill)

    // ── Stars — 5 depth layers ────────────────────────────────────────────────
    const starLayers = [
      { count: 12000, rMin: STAR_MIN * 0.3, rMax: STAR_MIN * 0.7, size: 0.55, opacity: 0.95, color: 0xffffff },
      { count: 8000,  rMin: STAR_MIN * 0.7, rMax: STAR_MIN,       size: 0.7,  opacity: 0.75, color: 0xeeeeff },
      { count: 5000,  rMin: STAR_MIN,       rMax: STAR_MAX * 0.5, size: 0.9,  opacity: 0.5,  color: 0xddddff },
      { count: 3000,  rMin: STAR_MAX * 0.5, rMax: STAR_MAX,       size: 1.1,  opacity: 0.3,  color: 0xffffff },
      // Warm orange/yellow stars sprinkled in
      { count: 800,   rMin: STAR_MIN * 0.4, rMax: STAR_MIN * 0.9, size: 0.65, opacity: 0.6,  color: 0xffddaa },
    ]

    starLayers.forEach(({ count, rMin, rMax, size, opacity, color }) => {
      const geo = new THREE.BufferGeometry()
      const pos = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2
        const phi   = Math.acos(2 * Math.random() - 1)
        const r     = rMin + Math.random() * (rMax - rMin)
        pos[i*3]   = r * Math.sin(phi) * Math.cos(theta)
        pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta)
        pos[i*3+2] = r * Math.cos(phi)
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
        color, size, sizeAttenuation: false,
        transparent: true, opacity,
      })))
    })

    // Milky Way band — concentrated near galactic plane
    const mwGeo = new THREE.BufferGeometry()
    const mwPos = new Float32Array(8000 * 3)
    for (let i = 0; i < 8000; i++) {
      const theta    = Math.random() * Math.PI * 2
      const bandFrac = Math.pow(Math.random(), 2) * (Math.random() > 0.5 ? 1 : -1) * 0.28
      const r        = STAR_MIN * 0.5 + Math.random() * STAR_MIN * 0.8
      mwPos[i*3]   = r * Math.cos(theta)
      mwPos[i*3+1] = r * Math.sin(bandFrac * Math.PI)
      mwPos[i*3+2] = r * Math.sin(theta)
    }
    mwGeo.setAttribute('position', new THREE.BufferAttribute(mwPos, 3))
    scene.add(new THREE.Points(mwGeo, new THREE.PointsMaterial({
      color: 0x88aadd, size: 0.5, sizeAttenuation: false,
      transparent: true, opacity: 0.28,
    })))

    // ── Earth ─────────────────────────────────────────────────────────────────
    const earthGeo = new THREE.SphereGeometry(ER, 80, 80)

    const earthMat = new THREE.MeshPhongMaterial({
      map:         makeTex('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg', 'earth', 256),
      specularMap: makeTex('https://unpkg.com/three-globe/example/img/earth-water.png', 'water', 128),
      specular:    new THREE.Color(0x224466),
      shininess:   30,
    })

    // Also try to load the real texture asynchronously
    const earthLoader = new THREE.TextureLoader()
    earthLoader.crossOrigin = 'anonymous'
    earthLoader.load(
      'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
      (tex) => { earthMat.map = tex; earthMat.needsUpdate = true }
    )

    const earth = new THREE.Mesh(earthGeo, earthMat)
    scene.add(earth)

    // Cloud layer
    const cloudMat = new THREE.MeshPhongMaterial({
      transparent: true, opacity: 0.35, depthWrite: false,
      map: makeTex('', 'white', 64),
    })
    const cloudLoader = new THREE.TextureLoader()
    cloudLoader.crossOrigin = 'anonymous'
    cloudLoader.load(
      'https://unpkg.com/three-globe/example/img/earth-clouds.png',
      (tex) => { cloudMat.map = tex; cloudMat.opacity = 0.38; cloudMat.needsUpdate = true }
    )
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(ER * 1.006, 60, 60), cloudMat)
    scene.add(clouds)

    // Atmosphere glow — outer ring
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(ER * 1.04, 32, 32),
      new THREE.MeshPhongMaterial({
        color: 0x3388ff, transparent: true, opacity: 0.07,
        side: THREE.BackSide, depthWrite: false,
      })
    ))

    // Atmosphere inner
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(ER * 1.015, 32, 32),
      new THREE.MeshPhongMaterial({
        color: 0x4499ff, transparent: true, opacity: 0.04,
        side: THREE.FrontSide, depthWrite: false,
      })
    ))

    // Earth label
    const eLabel = makeTextSprite('EARTH', '#4488ff')
    eLabel.position.set(0, ER * 1.85, 0)
    scene.add(eLabel)

    // ── Moon ──────────────────────────────────────────────────────────────────
    // Keep the Moon aligned with the peak of Orion's free-return arc.
    const moonPos = getOrionArcPosition(ORION_PEAK_TRAJECTORY_FRAC)
    moonWorldPos.current.copy(moonPos)

    const moonMat = new THREE.MeshPhongMaterial({
      map: makeTex('https://unpkg.com/three-globe/example/img/lunar_surface.jpg', 'moon', 128),
      shininess: 3,
    })
    const moonLoader = new THREE.TextureLoader()
    moonLoader.crossOrigin = 'anonymous'
    moonLoader.load(
      'https://unpkg.com/three-globe/example/img/lunar_surface.jpg',
      (tex) => { moonMat.map = tex; moonMat.needsUpdate = true }
    )

    const moon = new THREE.Mesh(new THREE.SphereGeometry(MOON_R, 48, 48), moonMat)
    moon.position.copy(moonPos)
    scene.add(moon)

    // Moon label
    const mLabel = makeTextSprite('MOON', '#9999aa')
    mLabel.position.set(moonPos.x, moonPos.y + MOON_R * 3.2, moonPos.z)
    scene.add(mLabel)

    // ── Artemis II shuttle position ────────────────────────────────────────────
    const initialTrajectoryFraction =
      trajectoryFractionRef.current ?? computeTrajectoryFraction(metRef.current)
    const initialOrionPos = getOrionArcPosition(initialTrajectoryFraction)
    orionWorldPos.current.copy(initialOrionPos)

    // Shuttle group
    const orionGroup = new THREE.Group()
    orionGroup.position.copy(initialOrionPos)
    orionWorldPos.current.copy(initialOrionPos)

    scene.add(orionGroup)

    const coreMat  = new THREE.MeshBasicMaterial({ color: 0x55ccff })
    const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), coreMat)
    orionGroup.add(coreMesh)

    // Halo ring (no Sprite — avoids blob glitch)
    const haloRing = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 2.0, 32),
      new THREE.MeshBasicMaterial({
        color: 0x33aaff, side: THREE.DoubleSide,
        transparent: true, opacity: 0.45, depthWrite: false,
      })
    )
    orionGroup.add(haloRing)

    // Engine point light
    orionGroup.add(new THREE.PointLight(0x33aaff, 2.5, MOON_D * 0.12))

    // Shuttle label
    const sLabel = makeTextSprite('ARTEMIS II', '#44bbff')
    sLabel.position.set(initialOrionPos.x, initialOrionPos.y + MOON_D * 0.022, initialOrionPos.z)
    scene.add(sLabel)

    // ── Trajectory arc ────────────────────────────────────────────────────────
    const TRAJ_STEPS = 300
    const outPts: THREE.Vector3[] = []
    const retPts: THREE.Vector3[] = []

    for (let i = 0; i <= TRAJ_STEPS; i++) {
      const f = i / TRAJ_STEPS
      const point = getOrionArcPosition(f)
      if (f <= ORION_PEAK_TRAJECTORY_FRAC) outPts.push(point)
      else retPts.push(point)
    }

    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(outPts),
      new THREE.LineBasicMaterial({ color: 0x2255cc, transparent: true, opacity: 0.7 })
    ))

    const retLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(retPts),
      new THREE.LineDashedMaterial({
        color: 0xff8822,
        dashSize: MOON_D * 0.01,
        gapSize:  MOON_D * 0.007,
        transparent: true, opacity: 0.55,
      })
    )
    retLine.computeLineDistances()
    scene.add(retLine)

    // Position dot on arc
    const posDot = new THREE.Mesh(
      new THREE.RingGeometry(MOON_D * 0.0018, MOON_D * 0.003, 32),
      new THREE.MeshBasicMaterial({
        color: 0x55ccff, side: THREE.DoubleSide, transparent: true, opacity: 0.65,
      })
    )
    posDot.position.copy(initialOrionPos)
    scene.add(posDot)

    // Progress line
    const buildProgressPoints = (fraction: number): THREE.Vector3[] => {
      const clampedFraction = Math.min(Math.max(fraction, 0), 1)
      const steps = Math.max(2, Math.ceil(clampedFraction * TRAJ_STEPS))
      const points: THREE.Vector3[] = []

      for (let index = 0; index <= steps; index += 1) {
        const pointFraction = (index / steps) * clampedFraction
        points.push(getOrionArcPosition(pointFraction))
      }

      return points
    }

    const progressLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(buildProgressPoints(initialTrajectoryFraction)),
      new THREE.LineBasicMaterial({ color: 0x55ccff, transparent: true, opacity: 0.9 })
    )
    scene.add(progressLine)

    // ── Focus function ─────────────────────────────────────────────────────────
    const doFocus = (target: FocusTarget) => {
      const c = camRef.current!
      let toPos: THREE.Vector3
      let toTgt: THREE.Vector3

      if (target === 'earth') {
        toTgt = new THREE.Vector3(MOON_D * 0.20, 0, 0)
        toPos = new THREE.Vector3(MOON_D * 0.20, MOON_D * 0.52, MOON_D * 1.78)
      } else if (target === 'moon') {
        const mp = moonWorldPos.current
        toTgt = mp.clone()
        toPos = mp.clone().add(new THREE.Vector3(-MOON_R * 3, MOON_R * 4, MOON_R * 14))
      } else {
        const op = orionWorldPos.current
        toTgt = op.clone()
        toPos = op.clone().add(new THREE.Vector3(0, MOON_D * 0.05, MOON_D * 0.18))
      }

      ease.current = {
        active: true, t: 0, speed: 0.020,
        fromPos: c.position.clone(), toPos,
        fromTgt: targetPos.current.clone(), toTgt,
      }
      setFocus(target)
      setShowPanel(target === 'shuttle' && !fullscreen)
    }

    focusFn.current = doFocus

    // ── Mouse / Touch orbit controls ──────────────────────────────────────────
    const el = renderer.domElement

    const onDown = (x: number, y: number) => {
      if (ease.current.active) return
      isDragging.current = true
      lastMouse.current = { x, y }
    }
    const onMove = (x: number, y: number) => {
      if (!isDragging.current) return
      const dx = (x - lastMouse.current.x) * 0.004
      const dy = (y - lastMouse.current.y) * 0.004
      lastMouse.current = { x, y }
      sph.current.theta -= dx
      sph.current.phi    = Math.max(0.08, Math.min(Math.PI - 0.08, sph.current.phi + dy))
    }
    const onUp = () => { isDragging.current = false }

    const onMouseDown = (e: MouseEvent) => onDown(e.clientX, e.clientY)
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY)
    const onMouseUp   = ()               => onUp()
    const onWheel     = (e: WheelEvent)  => {
      e.preventDefault()
      const factor = 1 + e.deltaY * 0.0008
      sph.current.radius = Math.max(ER * 1.3, Math.min(MOON_D * 4, sph.current.radius * factor))
    }

    let pinchDist = 0
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) onDown(e.touches[0].clientX, e.touches[0].clientY)
      else if (e.touches.length === 2) {
        pinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        )
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 1) onMove(e.touches[0].clientX, e.touches[0].clientY)
      else if (e.touches.length === 2) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        )
        sph.current.radius = Math.max(ER * 1.3, Math.min(MOON_D * 4, sph.current.radius * (pinchDist / d)))
        pinchDist = d
      }
    }
    const onTouchEnd = () => onUp()

    el.addEventListener('mousedown',  onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)
    el.addEventListener('wheel',      onWheel,      { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd)

    // ── Resize ────────────────────────────────────────────────────────────────
    const onResize = () => {
      const w = Math.max(1, mount.clientWidth)
      const h = Math.max(1, mount.clientHeight)
      cam.aspect = w / h
      cam.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    const resizeObserver = new ResizeObserver(() => {
      onResize()
    })
    resizeObserver.observe(mount)

    // ── Animation loop ────────────────────────────────────────────────────────
    let tick = 0
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate)
      tick += 0.004

      earth.rotation.y  = tick * 0.10
      clouds.rotation.y = tick * 0.115
      moon.rotation.y   = tick * 0.018

      const currentTrajectoryFraction =
        trajectoryFractionRef.current ?? computeTrajectoryFraction(metRef.current)
      const currentOrionPos = getOrionArcPosition(currentTrajectoryFraction)
      orionGroup.position.copy(currentOrionPos)
      orionWorldPos.current.copy(currentOrionPos)
      sLabel.position.set(currentOrionPos.x, currentOrionPos.y + MOON_D * 0.022, currentOrionPos.z)
      posDot.position.copy(currentOrionPos)
      ;(progressLine.geometry as THREE.BufferGeometry).setFromPoints(buildProgressPoints(currentTrajectoryFraction))

      // Labels always face camera
      eLabel.quaternion.copy(cam.quaternion)
      mLabel.quaternion.copy(cam.quaternion)
      sLabel.quaternion.copy(cam.quaternion)
      posDot.quaternion.copy(cam.quaternion)

      // Scale shuttle visuals with camera distance so always visible
      const d2shuttle = cam.position.distanceTo(currentOrionPos)
      const s = Math.max(MOON_D * 0.005, d2shuttle * 0.010)
      coreMesh.scale.setScalar(s)
      haloRing.scale.setScalar(s)
      haloRing.quaternion.copy(cam.quaternion)

      // Camera ease animation
      const e = ease.current
      if (e.active) {
        e.t += e.speed
        const ef = easeInOutCubic(e.t)
        cam.position.lerpVectors(e.fromPos, e.toPos, ef)
        targetPos.current.lerpVectors(e.fromTgt, e.toTgt, ef)
        sph.current.setFromVector3(
          cam.position.clone().sub(targetPos.current)
        )
        if (e.t >= 1) e.active = false
      } else if (!isDragging.current) {
        if (focusRef.current === 'shuttle') {
          targetPos.current.copy(currentOrionPos)
        }
        const newPos = new THREE.Vector3()
        newPos.setFromSpherical(sph.current)
        newPos.add(targetPos.current)
        cam.position.copy(newPos)
      }

      cam.lookAt(targetPos.current)
      renderer.render(scene, cam)
    }

    setTimeout(() => setReady(true), 400)
    animate()

    return () => {
      cancelAnimationFrame(rafRef.current)
      el.removeEventListener('mousedown',  onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',   onMouseUp)
      el.removeEventListener('wheel',      onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
      resizeObserver.disconnect()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, []) // scene built ONCE

  // ── Styles ──────────────────────────────────────────────────────────────────
  const riskColor = riskLevel === 'severe'
    ? '#ff3333'
    : riskLevel === 'elevated'
    ? '#ffaa00'
    : '#00ee77'
  const showInternalHud = !fullscreen

  const MONO = '"JetBrains Mono", "Fira Code", "Courier New", monospace'

  const btnStyle = (f: FocusTarget): React.CSSProperties => ({
    display:        'flex',
    alignItems:     'center',
    gap:            6,
    padding:        '8px 18px',
    border:         focus === f
      ? '0.5px solid rgba(77,139,255,0.65)'
      : '0.5px solid rgba(255,255,255,0.13)',
    borderRadius:   3,
    background:     focus === f
      ? 'rgba(45,107,228,0.16)'
      : hovered === f
      ? 'rgba(255,255,255,0.04)'
      : 'rgba(10,13,24,0.94)',
    color:          focus === f ? '#ffffff' : 'rgba(255,255,255,0.42)',
    fontFamily:     MONO,
    fontSize:       10,
    fontWeight:     400,
    letterSpacing:  '0.14em',
    cursor:         'pointer',
    transition:     'all 0.18s ease',
    whiteSpace:     'nowrap',
    userSelect:     'none',
    textTransform:  'uppercase',
  })

  const dotStyle = (f: FocusTarget): React.CSSProperties => ({
    width:        6,
    height:       6,
    borderRadius: '50%',
    background:   focus === f
      ? f === 'earth' ? '#3399ff'
        : f === 'moon' ? '#aabbcc'
        : '#55ccff'
      : '#223344',
    transition:   'all 0.18s ease',
  })

  return (
    <div style={{
      position:     fullscreen ? 'absolute' : 'relative',
      inset:        fullscreen ? 0 : undefined,
      width:        '100%',
      height:       fullscreen ? '100%' : heightPx,
      borderRadius: fullscreen ? 0 : 4,
      overflow:     'hidden',
      background:   '#000000',
      userSelect:   'none',
      cursor:       isDragging.current ? 'grabbing' : 'grab',
    }}>

      {/* ── Three.js canvas (background layer) ── */}
      <div
        ref={mountRef}
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
      />

      {/* ── Loading veil ── */}
      {!ready && (
        <div style={{
          position:   'absolute', inset: 0, zIndex: 50,
          background: '#00010e',
          display:    'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          <div style={{
            width: 32, height: 32, border: '2px solid rgba(68,136,255,0.2)',
            borderTop: '2px solid #4488ff', borderRadius: '50%',
            animation: 'spin 0.9s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <span style={{
            fontFamily: MONO, fontSize: 10, color: 'rgba(68,136,255,0.5)',
            letterSpacing: '0.18em',
          }}>
            LOADING TELEMETRY…
          </span>
        </div>
      )}

      {showInternalHud ? (
        <>
          {/* ── HUD top-left ── */}
          <div style={{
            position:        'absolute', top: 16, left: 16, zIndex: 10,
            pointerEvents:   'none',
            fontFamily:      MONO,
            fontSize:        10,
            color:           'rgba(255,255,255,0.46)',
            background:      'rgba(10,13,24,0.92)',
            border:          '0.5px solid rgba(255,255,255,0.08)',
            borderRadius:    4,
            padding:         '10px 14px',
            lineHeight:      2.0,
            minWidth:        170,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, letterSpacing: '0.18em' }}>ARTEMIS II</span>
              <span style={{ color: riskColor, fontSize: 9, letterSpacing: '0.08em' }}>
                ● {riskLevel.toUpperCase()}
              </span>
            </div>
            {([
              { label: 'MET',  value: metElapsed },
              { label: 'DIST', value: `${Math.round(distanceFromEarthKm).toLocaleString()} km` },
              { label: 'VEL',  value: `${speedKmS.toFixed(3)} km/s` },
            ] as const).map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
                <span style={{ color: 'rgba(255,255,255,0.22)' }}>{label}</span>
                <span style={{ color: '#a8c4ff', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* ── Top-right badge ── */}
          <div style={{
            position:      'absolute', top: 16, right: 16, zIndex: 10,
            pointerEvents: 'none',
            fontFamily:    MONO, fontSize: 9,
            color:         'rgba(68,120,200,0.35)',
            letterSpacing: '0.14em',
            textAlign:     'right',
            lineHeight:    1.8,
          }}>
            <div>JPL HORIZONS</div>
            <div style={{ color: 'rgba(68,120,200,0.2)' }}>LIVE · 5 MIN</div>
          </div>
        </>
      ) : null}

      {/* ── Focus buttons bottom-center ── */}
      <div style={{
        position:      'absolute',
        bottom:        fullscreen ? 'calc(var(--replay-timeline-height, 136px) + 8px)' : 22,
        left:          '50%',
        transform:     'translateX(-50%)',
        zIndex:        fullscreen ? 30 : 20,
        display:       'flex',
        gap:           8,
        pointerEvents: 'auto',
      }}>
        {([
          { id: 'earth'   as FocusTarget, label: 'EARTH',     icon: '⊕' },
          { id: 'shuttle' as FocusTarget, label: 'ARTEMIS II', icon: '◈' },
          { id: 'moon'    as FocusTarget, label: 'MOON',       icon: '◯' },
        ] as const).map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => focusFn.current(id)}
            onMouseEnter={() => setHovered(id)}
            onMouseLeave={() => setHovered(null)}
            style={btnStyle(id)}
          >
            <span style={dotStyle(id)} />
            <span>{icon} {label}</span>
          </button>
        ))}
      </div>

      {/* ── Shuttle Detail Panel ── */}
      {!fullscreen && showPanel ? (
        <div style={{
          position:        'absolute',
          top:             16,
          right:           16,
          zIndex:          15,
          width:           240,
          background:      'rgba(10,13,24,0.96)',
          border:          '0.5px solid rgba(255,255,255,0.08)',
          borderRadius:    4,
          overflow:        'hidden',
          fontFamily:      '"JetBrains Mono", "Fira Code", "Courier New", monospace',
          animation:       'panelIn 0.22s ease',
        }}>
          <style>{`
            @keyframes panelIn {
              from { opacity: 0; transform: translateY(-8px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* Panel header */}
          <div style={{
            padding:         '10px 14px 8px',
            borderBottom:    '1px solid rgba(40,80,160,0.25)',
            display:         'flex',
            justifyContent:  'space-between',
            alignItems:      'center',
          }}>
            <div>
              <div style={{ color: '#55ccff', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em' }}>
                ◈ ARTEMIS II
              </div>
              <div style={{ color: '#334455', fontSize: 8.5, letterSpacing: '0.10em', marginTop: 2 }}>
                ORION SPACECRAFT
              </div>
            </div>
            <button
              onClick={() => setShowPanel(false)}
              style={{
                background: 'none', border: 'none', color: '#334455',
                cursor: 'pointer', fontSize: 14, lineHeight: 1,
                padding: '2px 4px',
              }}
            >
              ×
            </button>
          </div>

          {/* Status badge */}
          <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(40,80,160,0.15)' }}>
            <span style={{
              display:       'inline-block',
              padding:       '3px 10px',
              borderRadius:  3,
              border:        `0.5px solid ${riskColor}44`,
              background:    `${riskColor}11`,
              color:         riskColor,
              fontSize:      8.5,
              letterSpacing: '0.12em',
            }}>
              ● {riskLevel.toUpperCase()} RADIATION
            </span>
          </div>

          {/* Telemetry rows */}
          <div style={{ padding: '8px 14px 12px' }}>
            {[
              { label: 'MISSION ELAPSED',  value: metElapsed,                              unit: '' },
              { label: 'DIST FROM EARTH',  value: (distanceFromEarthKm / 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + 'k', unit: 'km' },
              { label: 'VELOCITY',         value: speedKmS.toFixed(3),                     unit: 'km/s' },
              { label: 'PHASE',            value: 'LUNAR FLYBY',                           unit: '' },
              { label: 'CREW',             value: '4 ASTRONAUTS',                          unit: '' },
              { label: 'VEHICLE',          value: 'SLS BLOCK 1',                           unit: '' },
              { label: 'DESTINATION',      value: 'LUNAR ORBIT',                           unit: '' },
              { label: 'RETURN ETA',       value: 'T+10 DAYS',                             unit: '' },
            ].map(({ label, value, unit }) => (
              <div key={label} style={{
                display:       'flex',
                justifyContent: 'space-between',
                alignItems:    'baseline',
                padding:       '4px 0',
                borderBottom:  '1px solid rgba(30,50,80,0.3)',
                gap:           8,
              }}>
                <span style={{ color: '#2a3a4a', fontSize: 8, letterSpacing: '0.08em', flexShrink: 0 }}>
                  {label}
                </span>
                <span style={{
                  color: '#88aacc', fontSize: 9.5, fontVariantNumeric: 'tabular-nums',
                  textAlign: 'right',
                }}>
                  {value}
                  {unit && <span style={{ color: '#334455', marginLeft: 3, fontSize: 8 }}>{unit}</span>}
                </span>
              </div>
            ))}
          </div>

          {/* Mission progress bar */}
          <div style={{ padding: '0 14px 12px' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              marginBottom: 5, fontSize: 8, color: '#2a3a4a', letterSpacing: '0.08em',
            }}>
              <span>MISSION PROGRESS</span>
              <span style={{ color: '#556677' }}>
                {Math.round((metStringToSeconds(metElapsed) / 864000) * 100)}%
              </span>
            </div>
            <div style={{
              height: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width:  `${Math.min(100, Math.round((metStringToSeconds(metElapsed) / 864000) * 100))}%`,
                background: '#2d6be4',
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              marginTop: 4, fontSize: 7.5, color: '#1a2a3a', letterSpacing: '0.06em',
            }}>
              <span>LAUNCH</span>
              <span>LUNAR FLYBY</span>
              <span>SPLASHDOWN</span>
            </div>
          </div>

        </div>
      ) : null}

      {showInternalHud ? (
        <>
          {/* ── Drag hint ── */}
          <div style={{
            position:      'absolute', bottom: 66, left: '50%',
            transform:     'translateX(-50%)',
            zIndex:        10, pointerEvents: 'none',
            fontFamily:    MONO, fontSize: 9,
            color:         'rgba(50,80,140,0.4)',
            letterSpacing: '0.12em', whiteSpace: 'nowrap',
          }}>
            DRAG TO ORBIT · SCROLL TO ZOOM · PINCH TO SCALE
          </div>

          {/* ── Legend ── */}
          <div style={{
            position:      'absolute', bottom: 22, left: 16,
            zIndex:        10, pointerEvents: 'none',
            fontFamily:    MONO, fontSize: 8.5,
            color:         'rgba(50,80,130,0.55)',
            lineHeight:    2.2,
            letterSpacing: '0.06em',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 18, height: 1, background: 'rgba(30,80,200,0.7)' }} />
              <span style={{ color: 'rgba(70,110,220,0.55)' }}>OUTBOUND</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{
                width: 18, height: 1,
                backgroundImage: 'repeating-linear-gradient(90deg, rgba(220,130,30,0.7) 0, rgba(220,130,30,0.7) 5px, transparent 5px, transparent 8px)'
              }} />
              <span style={{ color: 'rgba(200,120,30,0.55)' }}>RETURN</span>
            </div>
          </div>
        </>
      ) : null}

    </div>
  )
}

export default TelemetryMap3D
