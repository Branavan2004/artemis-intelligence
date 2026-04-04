import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

interface TrajectoryMap3DProps {
  position: { x: number; y: number; z: number } | null
  distanceFromEarthKm: number
  distanceFromMoonKm: number
  speedKmS: number
  heightPx?: number
}

const DEFAULT_HEIGHT = 540
const POSITION_SCALE = 0.12
const EARTH_RADIUS_KM = 6371
const MOON_RADIUS_VISUAL_KM = 3474
const MOON_RADIUS_REAL_KM = 1737
const DEFAULT_ORION_POSITION = new THREE.Vector3(55000, 8000, -38000)
const MOON_POSITION_KM = new THREE.Vector3(330000, 18000, -215000)
const SUN_POSITION = new THREE.Vector3(150000, 60000, 100000)
const SUN_DIRECTION = SUN_POSITION.clone().normalize()
const LAUNCH_TIME_MS = Date.UTC(2026, 3, 1, 18, 34, 0)
const MONO_FONT = '"SFMono-Regular", "SF Mono", "Cascadia Code", "Roboto Mono", "Courier New", monospace'
const HUD_PANEL_BG = 'rgba(2, 8, 24, 0.88)'
const HUD_PANEL_BORDER = '1px solid rgba(68, 136, 255, 0.22)'

const FREE_RETURN_POINTS_KM = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(8000, 1000, 2000),
  new THREE.Vector3(40000, 5000, -10000),
  new THREE.Vector3(100000, 10000, -50000),
  new THREE.Vector3(200000, 18000, -130000),
  new THREE.Vector3(290000, 22000, -200000),
  new THREE.Vector3(330000, 18000, -215000),
  new THREE.Vector3(360000, 8000, -200000),
  new THREE.Vector3(380000, -10000, -160000),
  new THREE.Vector3(300000, -20000, -80000),
  new THREE.Vector3(150000, -15000, -20000),
  new THREE.Vector3(0, 0, 0),
]

const SLS_STATS = [
  ['TOTAL HEIGHT', '98.1 m (322 ft)'],
  ['TOTAL MASS (fueled)', '2,608,000 kg'],
  ['PAYLOAD TO TLI', '~27,000 kg'],
  ['CORE STAGE ENGINE', 'RS-25 x 4'],
  ['CORE STAGE THRUST', '7,440 kN vac'],
  ['SRB THRUST (x2)', '16,000 kN ea'],
  ['TOTAL LIFTOFF THRUST', '39,144 kN'],
  ['CORE BURN TIME', '~499 seconds'],
  ['SRB BURN TIME', '~126 seconds'],
  ['UPPER STAGE', 'ICPS (Boeing)'],
  ['ICPS ENGINE', 'RL-10B-2 x 1'],
  ['ICPS THRUST', '110.1 kN'],
  ['LAUNCH PAD', 'LC-39B, KSC'],
  ['LAUNCH DATE', 'Apr 1 2026'],
  ['TLI BURN DURATION', '5 min 55 sec'],
  ['MISSION DURATION', '~10 days'],
] as const

type TrajectoryLine = THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial | THREE.LineDashedMaterial>

function toScenePosition(vector: THREE.Vector3) {
  return vector.clone().multiplyScalar(POSITION_SCALE)
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const maybeRoundRect = (ctx as CanvasRenderingContext2D & {
    roundRect?: (x: number, y: number, width: number, height: number, radius: number) => void
  }).roundRect

  ctx.beginPath()

  if (maybeRoundRect) {
    maybeRoundRect.call(ctx, x, y, width, height, radius)
    return
  }

  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function createLabelTexture(text: string, subtext = '', color = '#ffffff') {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 140
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return new THREE.CanvasTexture(canvas)
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = 'rgba(2, 8, 26, 0.8)'
  drawRoundedRect(ctx, 8, 8, 496, 124, 18)
  ctx.fill()
  ctx.strokeStyle = 'rgba(68, 136, 255, 0.45)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.shadowColor = color
  ctx.shadowBlur = 18
  ctx.fillStyle = color
  ctx.font = 'bold 40px system-ui'
  ctx.fillText(text, 256, 72)

  if (subtext) {
    ctx.shadowBlur = 10
    ctx.fillStyle = 'rgba(150, 180, 220, 0.85)'
    ctx.font = '24px system-ui'
    ctx.fillText(subtext, 256, 104)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeLabel(
  text: string,
  subtext = '',
  color = '#ffffff',
  scale: [number, number, number] = [6000, 1600, 1],
  opacity = 1,
) {
  const texture = createLabelTexture(text, subtext, color)
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity,
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(scale[0], scale[1], scale[2])
  return sprite
}

function updateLabel(
  sprite: THREE.Sprite,
  text: string,
  subtext = '',
  color = '#ffffff',
  opacity = 1,
) {
  const material = sprite.material as THREE.SpriteMaterial
  if (material.map) {
    material.map.dispose()
  }
  material.map = createLabelTexture(text, subtext, color)
  material.opacity = opacity
  material.needsUpdate = true
}

function createStarfieldTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 2048
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return new THREE.CanvasTexture(canvas)
  }

  ctx.fillStyle = '#000008'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const paintStars = (count: number, color: string, minRadius: number, maxRadius: number, minOpacity: number, maxOpacity: number) => {
    for (let index = 0; index < count; index += 1) {
      const x = Math.random() * canvas.width
      const y = Math.random() * canvas.height
      const radius = minRadius + Math.random() * (maxRadius - minRadius)
      const opacity = minOpacity + Math.random() * (maxOpacity - minOpacity)
      ctx.beginPath()
      ctx.fillStyle = color
      ctx.globalAlpha = opacity
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  paintStars(3000, '#ffffff', 0.5, 1.2, 0.55, 1)
  paintStars(2000, '#ccd8ff', 0.8, 1.8, 0.3, 0.7)
  paintStars(1000, '#fff3cc', 1.2, 2.8, 0.2, 0.55)

  for (let index = 0; index < 800; index += 1) {
    const t = Math.random()
    const baseX = t * canvas.width
    const baseY = 600 + t * 848
    const offset = (Math.random() - 0.5) * 120
    const angle = Math.atan2(848, 2048) + Math.PI / 2
    const x = baseX + Math.cos(angle) * offset
    const y = baseY + Math.sin(angle) * offset
    const radius = 0.3 + Math.random() * 0.7
    const opacity = 0.1 + Math.random() * 0.15
    ctx.beginPath()
    ctx.fillStyle = Math.random() > 0.6 ? '#cfd8ff' : '#fff4d8'
    ctx.globalAlpha = opacity
    ctx.shadowColor = '#ffffff'
    ctx.shadowBlur = 6
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }

  ctx.globalAlpha = 1

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
}

function createMoonTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 2048
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return new THREE.CanvasTexture(canvas)
  }

  ctx.fillStyle = '#b5b0a0'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const drawEllipse = (x: number, y: number, radiusX: number, radiusY: number, opacity: number) => {
    ctx.beginPath()
    ctx.fillStyle = `rgba(90, 85, 78, ${opacity})`
    ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  drawEllipse(800, 600, 340, 240, 0.4)
  drawEllipse(920, 400, 220, 180, 0.35)
  drawEllipse(550, 450, 280, 220, 0.38)
  drawEllipse(1300, 480, 130, 110, 0.32)
  drawEllipse(480, 700, 380, 500, 0.28)

  for (let index = 0; index < 2200; index += 1) {
    const x = Math.random() * canvas.width
    const y = Math.random() * canvas.height
    const radius = 0.5 + Math.random() * 3.2
    const opacity = 0.05 + Math.random() * 0.08
    ctx.beginPath()
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function disposeMaterial(material: THREE.Material) {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) {
      value.dispose()
    }
  }
  material.dispose()
}

function disposeObject(object: THREE.Object3D | null) {
  if (!object) {
    return
  }

  object.traverse((child) => {
    const maybeGeometry = child as THREE.Mesh & { geometry?: THREE.BufferGeometry }
    if (maybeGeometry.geometry) {
      maybeGeometry.geometry.dispose()
    }

    const maybeMaterial = child as THREE.Mesh & { material?: THREE.Material | THREE.Material[] }
    if (!maybeMaterial.material) {
      return
    }

    if (Array.isArray(maybeMaterial.material)) {
      maybeMaterial.material.forEach(disposeMaterial)
      return
    }

    disposeMaterial(maybeMaterial.material)
  })
}

function formatMet(timestampMs: number) {
  const totalSeconds = Math.max(0, Math.floor(timestampMs / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [days, hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}

function buildTrajectoryCurve(orionPositionKm: THREE.Vector3) {
  const curve = new THREE.CatmullRomCurve3(FREE_RETURN_POINTS_KM.map(toScenePosition))
  const points = curve.getPoints(600)
  const orionScenePosition = toScenePosition(orionPositionKm)

  let closestIndex = 0
  let closestDistance = Number.POSITIVE_INFINITY

  points.forEach((point, index) => {
    const distance = point.distanceToSquared(orionScenePosition)
    if (distance < closestDistance) {
      closestDistance = distance
      closestIndex = index
    }
  })

  return {
    curve,
    points,
    closestIndex,
  }
}

function metricValue(value: number, digits = 0) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function HudMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          color: '#3a5570',
          fontSize: 10,
          letterSpacing: '0.1em',
          fontFamily: MONO_FONT,
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: '#ddeeff',
          fontSize: 14,
          fontWeight: 700,
          fontFamily: MONO_FONT,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function SlidePanel({
  title,
  subtitle,
  accentColor,
  width,
  visible,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  accentColor: string
  width: number
  visible: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      onClick={(event) => event.stopPropagation()}
      style={{
        position: 'absolute',
        top: '50%',
        right: 16,
        width,
        maxHeight: 'calc(100% - 32px)',
        overflowY: 'auto',
        background: 'rgba(2, 8, 24, 0.95)',
        borderLeft: `1px solid ${accentColor}`,
        borderRadius: 20,
        padding: 20,
        backdropFilter: 'blur(16px)',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
        transform: visible ? 'translate(0, -50%)' : 'translate(100%, -50%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.3s ease, opacity 0.3s ease',
        pointerEvents: visible ? 'auto' : 'none',
        zIndex: 5,
      }}
    >
      <button
        type="button"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          width: 28,
          height: 28,
          borderRadius: 999,
          border: '1px solid rgba(255, 255, 255, 0.12)',
          background: 'rgba(255, 255, 255, 0.04)',
          color: '#e6f2ff',
          cursor: 'pointer',
        }}
      >
        ×
      </button>
      <div
        style={{
          color: accentColor,
          fontSize: 11,
          fontFamily: MONO_FONT,
          letterSpacing: '0.18em',
          fontWeight: 700,
          marginBottom: subtitle ? 6 : 16,
          paddingRight: 28,
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            color: '#334455',
            fontSize: 10,
            fontFamily: MONO_FONT,
            letterSpacing: '0.12em',
            marginBottom: 16,
          }}
        >
          {subtitle}
        </div>
      ) : null}
      {children}
    </div>
  )
}

function DetailRow({ label, value, alternate = false }: { label: string; value: string; alternate?: boolean }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 12,
        alignItems: 'center',
        padding: '10px 12px',
        background: alternate ? 'rgba(68, 136, 255, 0.03)' : 'transparent',
        borderRadius: 10,
      }}
    >
      <div
        style={{
          color: '#334466',
          fontSize: 10,
          fontFamily: MONO_FONT,
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: '#ddeeff',
          fontSize: 13,
          fontFamily: MONO_FONT,
          fontWeight: 600,
          textAlign: 'right',
        }}
      >
        {value}
      </div>
    </div>
  )
}

export default function TrajectoryMap3D({
  position,
  distanceFromEarthKm,
  distanceFromMoonKm,
  speedKmS,
  heightPx = DEFAULT_HEIGHT,
}: TrajectoryMap3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const resizeHandlerRef = useRef<(() => void) | null>(null)
  const rebuildTrajectoryRef = useRef<((orionPositionKm: THREE.Vector3) => void) | null>(null)

  const earthGroupRef = useRef<THREE.Group | null>(null)
  const earthMeshRef = useRef<THREE.Mesh | null>(null)
  const cloudMeshRef = useRef<THREE.Mesh | null>(null)
  const auroraMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null)

  const moonGroupRef = useRef<THREE.Group | null>(null)
  const moonMeshRef = useRef<THREE.Mesh | null>(null)

  const orionGroupRef = useRef<THREE.Group | null>(null)
  const orionCoreRef = useRef<THREE.Mesh | null>(null)

  const earthLabelRef = useRef<THREE.Sprite | null>(null)
  const moonLabelRef = useRef<THREE.Sprite | null>(null)
  const orionLabelRef = useRef<THREE.Sprite | null>(null)
  const pathMarkerRef = useRef<THREE.Group | null>(null)

  const outboundLineRef = useRef<TrajectoryLine | null>(null)
  const returnLineRef = useRef<TrajectoryLine | null>(null)
  const curveRef = useRef<THREE.CatmullRomCurve3 | null>(null)
  const trajectoryTargetsRef = useRef<THREE.Object3D[]>([])

  const raycasterRef = useRef(new THREE.Raycaster())
  const autoRotateRef = useRef(true)
  const introStartRef = useRef(0)
  const cameraAngleRef = useRef(0)
  const cameraRadiusRef = useRef(0)
  const cameraHeightRef = useRef(0)

  const [showEarthPanel, setShowEarthPanel] = useState(false)
  const [showMoonPanel, setShowMoonPanel] = useState(false)
  const [showOrionPanel, setShowOrionPanel] = useState(false)
  const [showRocketPanel, setShowRocketPanel] = useState(false)
  const [metClock, setMetClock] = useState(() => formatMet(Date.now() - LAUNCH_TIME_MS))

  const resolvedPosition = useMemo(
    () => (position ? new THREE.Vector3(position.x, position.y, position.z) : DEFAULT_ORION_POSITION.clone()),
    [position],
  )

  const closeAllPanels = () => {
    setShowEarthPanel(false)
    setShowMoonPanel(false)
    setShowOrionPanel(false)
    setShowRocketPanel(false)
  }

  const openPanel = (panel: 'earth' | 'moon' | 'orion' | 'rocket') => {
    setShowEarthPanel(panel === 'earth')
    setShowMoonPanel(panel === 'moon')
    setShowOrionPanel(panel === 'orion')
    setShowRocketPanel(panel === 'rocket')
  }

  const anyPanelOpen = showEarthPanel || showMoonPanel || showOrionPanel || showRocketPanel

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMetClock(formatMet(Date.now() - LAUNCH_TIME_MS))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) {
      return
    }

    const container = containerRef.current
    const canvas = canvasRef.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000008)
    sceneRef.current = scene

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    })
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.85
    renderer.outputColorSpace = THREE.SRGBColorSpace
    rendererRef.current = renderer

    const camera = new THREE.PerspectiveCamera(45, 1, 100, 900000)
    camera.position.set(20000, 14000, 48000)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.enablePan = false
    controls.minDistance = 8000
    controls.maxDistance = 150000
    controls.target.set(0, 0, 0)
    controlsRef.current = controls

    raycasterRef.current.params.Line = { threshold: 500 }

    introStartRef.current = performance.now()
    cameraAngleRef.current = Math.atan2(camera.position.x, camera.position.z)
    cameraRadiusRef.current = Math.sqrt(camera.position.x ** 2 + camera.position.z ** 2)
    cameraHeightRef.current = camera.position.y
    autoRotateRef.current = true

    const handleControlsStart = () => {
      autoRotateRef.current = false
    }

    controls.addEventListener('start', handleControlsStart)

    const resize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(width, height, false)
    }

    resize()
    resizeHandlerRef.current = resize
    window.addEventListener('resize', resize)

    const starSphere = new THREE.Mesh(
      new THREE.SphereGeometry(860000, 64, 64),
      new THREE.MeshBasicMaterial({
        map: createStarfieldTexture(),
        side: THREE.BackSide,
        depthWrite: false,
      }),
    )
    scene.add(starSphere)

    const sunLight = new THREE.DirectionalLight('#fff8e0', 3.2)
    sunLight.position.copy(SUN_POSITION)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.set(4096, 4096)
    sunLight.shadow.camera.left = -18000
    sunLight.shadow.camera.right = 18000
    sunLight.shadow.camera.top = 18000
    sunLight.shadow.camera.bottom = -18000
    sunLight.shadow.camera.near = 1000
    sunLight.shadow.camera.far = 500000
    sunLight.shadow.bias = -0.001
    scene.add(sunLight)

    const fillLight = new THREE.DirectionalLight('#1a4080', 0.18)
    fillLight.position.set(-100000, -30000, -80000)
    scene.add(fillLight)

    scene.add(new THREE.AmbientLight('#04060f', 0.6))

    const sunShaft = new THREE.Mesh(
      new THREE.PlaneGeometry(80000, 80000),
      new THREE.MeshBasicMaterial({
        color: '#fff5cc',
        transparent: true,
        opacity: 0.04,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    sunShaft.position.set(160000, 65000, 108000)
    scene.add(sunShaft)

    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')

    const dayTexture = loader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
    dayTexture.colorSpace = THREE.SRGBColorSpace
    const nightTexture = loader.load('https://unpkg.com/three-globe/example/img/earth-night.jpg')
    nightTexture.colorSpace = THREE.SRGBColorSpace
    const cloudTexture = loader.load('https://unpkg.com/three-globe/example/img/earth-clouds.png')
    cloudTexture.colorSpace = THREE.SRGBColorSpace
    const waterTexture = loader.load('https://unpkg.com/three-globe/example/img/earth-water.png')

    const earthGroup = new THREE.Group()
    scene.add(earthGroup)
    earthGroupRef.current = earthGroup

    const earthMaterial = new THREE.MeshStandardMaterial({
      map: dayTexture,
      emissiveMap: nightTexture,
      emissive: new THREE.Color('#ff9944'),
      emissiveIntensity: 0.9,
      roughnessMap: waterTexture,
      roughness: 0.65,
      metalness: 0.08,
    })

    earthMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.sunDirection = { value: SUN_DIRECTION.clone() }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldNormal;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvWorldNormal = normalize(mat3(modelMatrix) * normal);')

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 sunDirection;\nvarying vec3 vWorldNormal;')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float sd = dot(vWorldNormal, sunDirection);
          float nb = smoothstep(0.08, -0.25, sd);
          vec4 nt = texture2D(emissiveMap, vEmissiveMapUv);
          totalEmissiveRadiance = nt.rgb * nb * 2.2;`,
        )
    }

    const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS_KM, 128, 64), earthMaterial)
    earthMesh.castShadow = true
    earthMesh.receiveShadow = true
    earthGroup.add(earthMesh)
    earthMeshRef.current = earthMesh

    const capMaterial = new THREE.MeshStandardMaterial({
      color: '#ddeeff',
      roughness: 0.9,
      metalness: 0.05,
    })
    earthGroup.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(6380, 32, 8, 0, Math.PI * 2, 0, 0.18),
        capMaterial.clone(),
      ),
    )
    earthGroup.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(6380, 32, 8, 0, Math.PI * 2, 2.96, 0.18),
        capMaterial.clone(),
      ),
    )

    const auroraMaterial = new THREE.MeshBasicMaterial({
      color: '#44ff88',
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const auroraRing = new THREE.Mesh(new THREE.TorusGeometry(7200, 120, 8, 80), auroraMaterial)
    auroraRing.rotation.z = THREE.MathUtils.degToRad(23.5)
    earthGroup.add(auroraRing)
    auroraMaterialRef.current = auroraMaterial

    const oceanGlowMaterial = new THREE.MeshBasicMaterial({
      color: '#88ccff',
      transparent: true,
      opacity: 0.05,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    oceanGlowMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.sunDirection = { value: SUN_DIRECTION.clone() }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldNormal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldNormal = normalize(mat3(modelMatrix) * normal);')

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 sunDirection;\nvarying vec3 vWorldNormal;')
        .replace(
          'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
          `float highlight = pow(max(dot(normalize(vWorldNormal), sunDirection), 0.0), 12.0);
          gl_FragColor = vec4(outgoingLight * (0.25 + highlight * 1.8), diffuseColor.a * highlight);`,
        )
    }
    earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(6380, 64, 64), oceanGlowMaterial))

    const atmosphereMaterial = new THREE.ShaderMaterial({
      uniforms: {
        sunDir: { value: SUN_DIRECTION.clone() },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPos;
        void main() {
          vNormal = normalMatrix * normal;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPos = mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 sunDir;
        varying vec3 vNormal;
        varying vec3 vViewPos;
        void main() {
          float rim = pow(1.0 - dot(normalize(-vViewPos), normalize(vNormal)), 2.8);
          float sf = max(dot(normalize(vNormal), sunDir), 0.0);
          vec3 col = mix(vec3(0.05, 0.18, 0.9), vec3(0.35, 0.65, 1.0), sf);
          gl_FragColor = vec4(col, rim * 0.75);
        }
      `,
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(6560, 64, 64), atmosphereMaterial))

    const cloudMesh = new THREE.Mesh(
      new THREE.SphereGeometry(6440, 64, 64),
      new THREE.MeshStandardMaterial({
        map: cloudTexture,
        alphaMap: cloudTexture,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        roughness: 1,
        metalness: 0,
      }),
    )
    earthGroup.add(cloudMesh)
    cloudMeshRef.current = cloudMesh

    const earthLabel = makeLabel('EARTH', '', '#88ccff', [8000, 2200, 1])
    earthLabel.position.set(0, 9500, 0)
    scene.add(earthLabel)
    earthLabelRef.current = earthLabel

    const moonGroup = new THREE.Group()
    moonGroup.position.copy(toScenePosition(MOON_POSITION_KM))
    scene.add(moonGroup)
    moonGroupRef.current = moonGroup

    const moonMaterial = new THREE.MeshStandardMaterial({
      map: createMoonTexture(),
      color: '#c2bdb0',
      roughness: 0.96,
      metalness: 0,
      emissive: new THREE.Color('#0d0d14'),
      emissiveIntensity: 0.8,
    })
    const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(MOON_RADIUS_VISUAL_KM, 128, 64), moonMaterial)
    moonMesh.castShadow = true
    moonMesh.receiveShadow = true
    moonGroup.add(moonMesh)
    moonMeshRef.current = moonMesh

    moonGroup.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(3620, 32, 32),
        new THREE.MeshBasicMaterial({
          color: '#223355',
          transparent: true,
          opacity: 0.04,
          side: THREE.BackSide,
          depthWrite: false,
        }),
      ),
    )

    const terminator = new THREE.Mesh(
      new THREE.TorusGeometry(3490, 30, 8, 64, Math.PI),
      new THREE.MeshBasicMaterial({
        color: '#334466',
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    )
    terminator.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), SUN_DIRECTION.clone())
    moonGroup.add(terminator)

    const craterMaterial = new THREE.MeshStandardMaterial({
      color: '#9a9590',
      roughness: 1,
      metalness: 0,
    })
    const craterFloorMaterial = new THREE.MeshStandardMaterial({
      color: '#8a8580',
      roughness: 1,
      metalness: 0,
    })
    const craterData = [
      ['TYCHO', new THREE.Vector3(0.2, -0.6, 0.8).normalize(), 180],
      ['COPERNICUS', new THREE.Vector3(-0.1, 0.2, 0.97).normalize(), 150],
      ['KEPLER', new THREE.Vector3(-0.4, 0.1, 0.91).normalize(), 100],
      ['PLATO', new THREE.Vector3(0, 0.7, 0.71).normalize(), 120],
      ['CLAVIUS', new THREE.Vector3(0.1, -0.75, 0.65).normalize(), 200],
      ['GRIMALDI', new THREE.Vector3(-0.7, 0, 0.71).normalize(), 130],
      ['ARISTARCHUS', new THREE.Vector3(-0.5, 0.3, 0.81).normalize(), 90],
      ['SCHICKARD', new THREE.Vector3(-0.3, -0.6, 0.74).normalize(), 160],
      ['PETAVIUS', new THREE.Vector3(0.6, -0.5, 0.62).normalize(), 140],
      ['LANGRENUS', new THREE.Vector3(0.7, -0.3, 0.65).normalize(), 120],
    ] as const

    craterData.forEach(([name, direction, radius]) => {
      const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction)
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(radius, radius * 0.08, 8, 40),
        craterMaterial.clone(),
      )
      torus.position.copy(direction.clone().multiplyScalar(MOON_RADIUS_VISUAL_KM))
      torus.quaternion.copy(orientation)
      moonGroup.add(torus)

      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(radius * 0.85, 32),
        craterFloorMaterial.clone(),
      )
      floor.position.copy(direction.clone().multiplyScalar(MOON_RADIUS_VISUAL_KM - 8))
      floor.quaternion.copy(orientation)
      moonGroup.add(floor)

      if (name === 'TYCHO' || name === 'COPERNICUS') {
        const craterLabel = makeLabel(name, '', '#aaaacc', [3500, 900, 1])
        craterLabel.position.copy(direction.clone().multiplyScalar(MOON_RADIUS_VISUAL_KM + 200))
        moonGroup.add(craterLabel)
      }
    })

    const mareLabel = makeLabel('MARE TRANQ.', '', '#aaaacc', [3500, 900, 1])
    mareLabel.position.copy(new THREE.Vector3(0.25, 0.12, 0.96).normalize().multiplyScalar(MOON_RADIUS_VISUAL_KM + 200))
    moonGroup.add(mareLabel)

    const moonLabel = makeLabel('MOON', '', '#bbbbcc', [6000, 1650, 1])
    moonLabel.position.copy(moonGroup.position.clone().add(new THREE.Vector3(0, 3500, 0)))
    scene.add(moonLabel)
    moonLabelRef.current = moonLabel

    const orionGroup = new THREE.Group()
    orionGroup.position.copy(toScenePosition(resolvedPosition))
    scene.add(orionGroup)
    orionGroupRef.current = orionGroup

    const orionCoreMaterial = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 1,
      depthWrite: false,
      depthTest: false,
    })
    const orionCore = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 24), orionCoreMaterial)
    orionCore.renderOrder = 30
    orionGroup.add(orionCore)
    orionCoreRef.current = orionCore

    const orionGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1800, 24, 24),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        depthTest: false,
      }),
    )
    orionGlow.renderOrder = 28
    orionGroup.add(orionGlow)

    orionGroup.add(new THREE.PointLight('#88aaff', 2.2, 14000, 2))

    const orionLabel = makeLabel(
      'ORION',
      `${Math.round(distanceFromEarthKm).toLocaleString()} KM FROM EARTH`,
      '#ffffff',
      [9000, 2500, 1],
    )
    orionLabel.position.copy(toScenePosition(resolvedPosition).add(new THREE.Vector3(0, 2800, 0)))
    orionLabel.renderOrder = 31
    const orionLabelMaterial = orionLabel.material as THREE.SpriteMaterial
    orionLabelMaterial.depthTest = false
    scene.add(orionLabel)
    orionLabelRef.current = orionLabel

    const sunLabel = makeLabel('▶ SUN', '', '#ffeeaa', [7000, 1800, 1], 0.5)
    sunLabel.position.set(75000, 28000, 50000)
    scene.add(sunLabel)

    const pathMarker = new THREE.Group()
    const pathMarkerGlow = new THREE.Mesh(
      new THREE.SphereGeometry(2200, 24, 24),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        depthTest: false,
      }),
    )
    pathMarkerGlow.renderOrder = 18
    pathMarker.add(pathMarkerGlow)

    const pathMarkerCore = new THREE.Mesh(
      new THREE.SphereGeometry(1200, 24, 24),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        depthWrite: false,
        depthTest: false,
      }),
    )
    pathMarkerCore.renderOrder = 19
    pathMarker.add(pathMarkerCore)
    scene.add(pathMarker)
    pathMarkerRef.current = pathMarker

    const removeTrajectoryLine = (line: TrajectoryLine | null) => {
      if (!line) {
        return
      }
      scene.remove(line)
      line.geometry.dispose()
      disposeMaterial(line.material)
    }

    rebuildTrajectoryRef.current = (orionPositionKm) => {
      removeTrajectoryLine(outboundLineRef.current)
      removeTrajectoryLine(returnLineRef.current)

      const { curve, points, closestIndex } = buildTrajectoryCurve(orionPositionKm)
      curveRef.current = curve

      if (pathMarkerRef.current) {
        pathMarkerRef.current.position.copy(curve.getPoint(0.5))
      }

      const outboundPoints = points.slice(0, Math.max(closestIndex + 1, 2))
      const returnPoints = points.slice(Math.max(closestIndex, 0))

      const outboundLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(outboundPoints),
        new THREE.LineBasicMaterial({
          color: '#4488ff',
          transparent: true,
          opacity: 0.9,
        }),
      ) as TrajectoryLine

      const returnLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(returnPoints),
        new THREE.LineDashedMaterial({
          color: '#ffaa44',
          dashSize: 3000,
          gapSize: 2000,
          transparent: true,
          opacity: 0.5,
        }),
      ) as TrajectoryLine
      returnLine.computeLineDistances()

      outboundLineRef.current = outboundLine
      returnLineRef.current = returnLine
      trajectoryTargetsRef.current = [outboundLine, returnLine]

      scene.add(outboundLine, returnLine)
    }

    rebuildTrajectoryRef.current(resolvedPosition)

    const handleCanvasClick = (event: MouseEvent) => {
      if (!rendererRef.current || !cameraRef.current) {
        return
      }

      const rect = rendererRef.current.domElement.getBoundingClientRect()
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )

      const raycaster = raycasterRef.current
      raycaster.setFromCamera(pointer, cameraRef.current)

      const orionHit = orionCoreRef.current ? raycaster.intersectObject(orionCoreRef.current, true) : []
      const moonHit = moonMeshRef.current ? raycaster.intersectObject(moonMeshRef.current, true) : []
      const earthHit = earthMeshRef.current ? raycaster.intersectObject(earthMeshRef.current, true) : []
      const trajectoryHit = trajectoryTargetsRef.current.flatMap((object) => raycaster.intersectObject(object, true))

      if (orionHit.length > 0 || trajectoryHit.length > 0) {
        openPanel('orion')
        return
      }

      if (moonHit.length > 0) {
        openPanel('moon')
        return
      }

      if (earthHit.length > 0) {
        openPanel('earth')
        return
      }

      closeAllPanels()
    }

    renderer.domElement.addEventListener('click', handleCanvasClick)

    const animate = () => {
      animationFrameRef.current = window.requestAnimationFrame(animate)

      const now = performance.now()
      controls.update()

      if (earthGroupRef.current) {
        earthGroupRef.current.rotation.y += 0.00055
      }

      if (cloudMeshRef.current) {
        cloudMeshRef.current.rotation.y += 0.00022
      }

      if (moonGroupRef.current) {
        moonGroupRef.current.rotation.y += 0.00006
      }

      if (orionCoreRef.current) {
        const pulse = 1 + Math.sin(Date.now() * 0.002) * 0.06
        orionCoreRef.current.scale.setScalar(pulse)
      }

      if (autoRotateRef.current) {
        const elapsed = now - introStartRef.current
        if (elapsed <= 10000) {
          const angle = cameraAngleRef.current + elapsed * 0.00012
          camera.position.x = Math.sin(angle) * cameraRadiusRef.current
          camera.position.z = Math.cos(angle) * cameraRadiusRef.current
          camera.position.y = cameraHeightRef.current
          camera.lookAt(0, 0, 0)
          controls.target.set(0, 0, 0)
        } else {
          autoRotateRef.current = false
        }
      }

      sunShaft.lookAt(camera.position)

      if (auroraMaterialRef.current) {
        auroraMaterialRef.current.opacity = Math.sin(Date.now() * 0.0008) * 0.03 + 0.05
      }

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }

      renderer.domElement.removeEventListener('click', handleCanvasClick)
      controls.removeEventListener('start', handleControlsStart)
      controls.dispose()
      window.removeEventListener('resize', resize)

      disposeObject(scene)
      renderer.dispose()

      rendererRef.current = null
      sceneRef.current = null
      cameraRef.current = null
      controlsRef.current = null
      earthGroupRef.current = null
      earthMeshRef.current = null
      cloudMeshRef.current = null
      auroraMaterialRef.current = null
      moonGroupRef.current = null
      moonMeshRef.current = null
      orionGroupRef.current = null
      orionCoreRef.current = null
      earthLabelRef.current = null
      moonLabelRef.current = null
      orionLabelRef.current = null
      pathMarkerRef.current = null
      outboundLineRef.current = null
      returnLineRef.current = null
      curveRef.current = null
      trajectoryTargetsRef.current = []
      rebuildTrajectoryRef.current = null
      resizeHandlerRef.current = null
    }
  }, [])

  useEffect(() => {
    const scenePosition = toScenePosition(resolvedPosition)

    if (orionGroupRef.current) {
      orionGroupRef.current.position.copy(scenePosition)
    }

    if (orionLabelRef.current) {
      orionLabelRef.current.position.copy(scenePosition.clone().add(new THREE.Vector3(0, 2800, 0)))
    }

    rebuildTrajectoryRef.current?.(resolvedPosition)
  }, [resolvedPosition])

  useEffect(() => {
    if (!orionLabelRef.current) {
      return
    }

    updateLabel(
      orionLabelRef.current,
      'ORION',
      `${Math.round(distanceFromEarthKm).toLocaleString()} KM FROM EARTH`,
      '#ffffff',
    )
  }, [distanceFromEarthKm])

  useEffect(() => {
    resizeHandlerRef.current?.()
  }, [heightPx])

  const lightTimeSeconds = distanceFromEarthKm > 0 ? (distanceFromEarthKm / 299792).toFixed(1) : '0.0'

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: `${heightPx}px`,
        overflow: 'hidden',
        borderRadius: 24,
        background: 'radial-gradient(circle at top, rgba(18, 31, 70, 0.55), rgba(0, 0, 8, 0.94))',
        border: '1px solid rgba(68, 136, 255, 0.16)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 24px 48px rgba(3, 8, 24, 0.38)',
      }}
    >
      <style>
        {`
          @keyframes trajectoryHudPulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.3; transform: scale(0.88); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}
      </style>

      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor: 'grab',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            width: 256,
            background: HUD_PANEL_BG,
            border: HUD_PANEL_BORDER,
            borderRadius: 16,
            padding: 20,
            paddingLeft: 24,
            backdropFilter: 'blur(16px)',
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: 3,
              background: '#4488ff',
              borderRadius: 2,
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#00ff88',
                animation: 'trajectoryHudPulse 2s ease-in-out infinite',
              }}
            />
            <span
              style={{
                color: '#4488ff',
                fontSize: 10,
                letterSpacing: '0.18em',
                fontWeight: 700,
                fontFamily: MONO_FONT,
              }}
            >
              LIVE TELEMETRY
            </span>
          </div>

          <div
            style={{
              height: 1,
              background: 'rgba(68, 136, 255, 0.12)',
              margin: '12px 0',
            }}
          />

          <HudMetric label="DISTANCE FROM EARTH" value={`${metricValue(distanceFromEarthKm)} km`} />
          <HudMetric label="DISTANCE FROM MOON" value={`${metricValue(distanceFromMoonKm)} km`} />
          <HudMetric label="VELOCITY" value={`${speedKmS.toLocaleString()} km/s`} />
          <HudMetric label="POSITION X" value={`${metricValue(Math.round(resolvedPosition.x))} km`} />
          <HudMetric
            label="POSITION Y · Z"
            value={`${metricValue(Math.round(resolvedPosition.y))} · ${metricValue(Math.round(resolvedPosition.z))}`}
          />

          <div
            style={{
              color: '#2a3d52',
              fontSize: 9,
              letterSpacing: '0.1em',
              fontFamily: MONO_FONT,
              marginTop: 14,
            }}
          >
            SOURCE: JPL HORIZONS
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: HUD_PANEL_BG,
            border: HUD_PANEL_BORDER,
            borderRadius: 16,
            padding: '16px 24px',
            textAlign: 'center',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div
            style={{
              color: '#4488ff',
              fontSize: 9,
              letterSpacing: '0.18em',
              fontFamily: MONO_FONT,
              marginBottom: 6,
            }}
          >
            MISSION ELAPSED TIME
          </div>
          <div
            style={{
              color: '#ffffff',
              fontSize: 30,
              fontWeight: 700,
              fontFamily: '"Courier New", monospace',
              letterSpacing: '0.05em',
            }}
          >
            {metClock}
          </div>
          <div
            style={{
              color: '#2a3a52',
              fontSize: 10,
              fontFamily: MONO_FONT,
              marginTop: 4,
            }}
          >
            ARTEMIS II · ORION
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(2, 8, 24, 0.55)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: 20,
            padding: '7px 20px',
            color: 'rgba(255, 255, 255, 0.28)',
            fontSize: 11,
            letterSpacing: '0.1em',
            fontFamily: MONO_FONT,
            whiteSpace: 'nowrap',
          }}
        >
          DRAG TO ROTATE · SCROLL TO ZOOM · REAL-TIME DATA
        </div>

        <div
          style={{
            position: 'absolute',
            left: 16,
            bottom: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{
              background: 'rgba(2, 8, 24, 0.75)',
              border: '1px solid rgba(0, 255, 136, 0.18)',
              borderRadius: 12,
              padding: '12px 16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#00ff88',
                fontSize: 10,
                letterSpacing: '0.15em',
                fontFamily: MONO_FONT,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#00ff88',
                  animation: 'trajectoryHudPulse 2s ease-in-out infinite',
                }}
              />
              DSN LINK ACTIVE
            </div>
            <div
              style={{
                color: '#2a4433',
                fontSize: 10,
                fontFamily: MONO_FONT,
                marginTop: 5,
              }}
            >
              CANBERRA · DSS-43
            </div>
          </div>

          <button
            type="button"
            onClick={() => openPanel('rocket')}
            style={{
              pointerEvents: 'auto',
              alignSelf: 'flex-start',
              background: 'rgba(2, 8, 24, 0.75)',
              border: '1px solid rgba(255, 136, 68, 0.2)',
              borderRadius: 999,
              padding: '10px 14px',
              color: '#ff8844',
              fontSize: 10,
              letterSpacing: '0.15em',
              fontFamily: MONO_FONT,
              cursor: 'pointer',
            }}
          >
            SLS ROCKET ↑
          </button>
        </div>

        {anyPanelOpen ? (
          <div
            onClick={closeAllPanels}
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'auto',
              zIndex: 4,
            }}
          />
        ) : null}

        <SlidePanel title="EARTH STATS" accentColor="rgba(68, 136, 255, 0.25)" width={280} visible={showEarthPanel} onClose={closeAllPanels}>
          <div style={{ display: 'grid', gap: 6 }}>
            <DetailRow label="Radius" value="6,371 km" alternate />
            <DetailRow label="Mass" value="5.97 × 10²⁴ kg" />
            <DetailRow label="Surface gravity" value="9.81 m/s²" alternate />
            <DetailRow label="Atmosphere" value="78% N₂, 21% O₂" />
            <DetailRow label="Rotation" value="23h 56m 4s" alternate />
            <DetailRow label="Distance from Orion" value={`${metricValue(distanceFromEarthKm)} km`} />
          </div>
        </SlidePanel>

        <SlidePanel title="MOON STATS" accentColor="rgba(170, 170, 204, 0.35)" width={300} visible={showMoonPanel} onClose={closeAllPanels}>
          <div style={{ display: 'grid', gap: 6 }}>
            <DetailRow label="Surface gravity" value="1.62 m/s² (16.5% of Earth)" alternate />
            <DetailRow label="Radius" value={`${metricValue(MOON_RADIUS_REAL_KM)} km`} />
            <DetailRow label="Distance from Earth" value="384,400 km avg" alternate />
            <DetailRow label="Distance from Orion now" value={`${metricValue(distanceFromMoonKm)} km`} />
            <DetailRow label="Craters" value="~300,000 visible craters" alternate />
            <DetailRow label="Temperature" value="-173°C to +127°C" />
            <DetailRow label="Water ice" value="Confirmed at poles" alternate />
            <DetailRow label="Named craters visible" value="Tycho, Copernicus, Plato..." />
          </div>
        </SlidePanel>

        <SlidePanel title="ORION SPACECRAFT" accentColor="rgba(136, 187, 255, 0.35)" width={320} visible={showOrionPanel} onClose={closeAllPanels}>
          <div style={{ display: 'grid', gap: 6 }}>
            <DetailRow label="Distance from Earth" value={`${metricValue(distanceFromEarthKm)} km`} alternate />
            <DetailRow label="Distance from Moon" value={`${metricValue(distanceFromMoonKm)} km`} />
            <DetailRow label="Current velocity" value={`${speedKmS.toLocaleString()} km/s`} alternate />
            <DetailRow label="Position X" value={`${metricValue(resolvedPosition.x)} km`} />
            <DetailRow label="Position Y" value={`${metricValue(resolvedPosition.y)} km`} alternate />
            <DetailRow label="Position Z" value={`${metricValue(resolvedPosition.z)} km`} />
            <DetailRow label="Light time" value={`${lightTimeSeconds} seconds`} alternate />
            <DetailRow label="Crew" value="Wiseman · Glover · Koch · Hansen" />
            <DetailRow label="Source" value="JPL Horizons" alternate />
          </div>
        </SlidePanel>

        <SlidePanel
          title="SPACE LAUNCH SYSTEM"
          subtitle="BLOCK 1 · ARTEMIS II"
          accentColor="rgba(255, 136, 68, 0.3)"
          width={300}
          visible={showRocketPanel}
          onClose={closeAllPanels}
        >
          <div style={{ display: 'grid', gap: 4 }}>
            {SLS_STATS.map(([label, value], index) => (
              <DetailRow key={label} label={label} value={value} alternate={index % 2 === 0} />
            ))}
          </div>
          <div
            style={{
              marginTop: 16,
              borderRadius: 12,
              background: 'rgba(255, 136, 68, 0.08)',
              color: '#ff8844',
              padding: '12px 14px',
              fontSize: 11,
              letterSpacing: '0.12em',
              fontFamily: MONO_FONT,
            }}
          >
            ARTEMIS II · FIRST CREWED ORION MISSION
          </div>
        </SlidePanel>
      </div>
    </div>
  )
}
