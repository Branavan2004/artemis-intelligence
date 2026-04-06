import { useEffect, useRef, type CSSProperties } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import TrajectoryMapFallback, {
  missionElapsedToProgress,
  useStaticTrajectoryFallback,
} from './TrajectoryMapFallback'

type RiskLevel = 'nominal' | 'elevated' | 'severe'

interface TrajectoryMap3DProps {
  position: { x: number; y: number; z: number } | null
  distanceFromEarthKm: number
  distanceFromMoonKm: number
  speedKmS: number
  metElapsed: string
  riskLevel: RiskLevel
  heightPx?: number
}

const ER = 2
const KM = ER / 6371
const MOON_DIST = 384400 * KM
const SUN_DIST = MOON_DIST * 5

function parseMET(met: string): number {
  const [h, m, s] = met.split(':').map(Number)
  return (h * 3600) + (m * 60) + s
}

const DEFAULT_HEIGHT = 600
const HUD_PANEL: CSSProperties = {
  background: 'rgba(2,6,20,0.85)',
  border: '1px solid rgba(68,136,255,0.22)',
  borderRadius: 12,
  padding: '12px 16px',
  fontFamily: 'monospace',
  color: '#c8d8ee',
  fontSize: 11,
  lineHeight: 1.9,
  pointerEvents: 'none',
  backdropFilter: 'blur(12px)',
}

function disposeMaterial(material: THREE.Material) {
  Object.values(material).forEach((value) => {
    if (value instanceof THREE.Texture) {
      value.dispose()
    }
  })
  material.dispose()
}

function disposeObject(object: THREE.Object3D | null) {
  if (!object) {
    return
  }

  object.traverse((child) => {
    const mesh = child as THREE.Mesh & {
      geometry?: THREE.BufferGeometry
      material?: THREE.Material | THREE.Material[]
    }

    if (mesh.geometry) {
      mesh.geometry.dispose()
    }

    if (!mesh.material) {
      return
    }

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(disposeMaterial)
      return
    }

    disposeMaterial(mesh.material)
  })
}

function makeStars(count: number, radiusMin: number, radiusMax: number, bandOnly = false): THREE.Points {
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)

  for (let i = 0; i < count; i += 1) {
    let phi: number
    if (bandOnly) {
      phi = (Math.random() - 0.5) * 0.35 + Math.PI / 2
    } else {
      phi = Math.acos(2 * Math.random() - 1)
    }

    const theta = Math.random() * Math.PI * 2
    const radius = radiusMin + Math.random() * (radiusMax - radiusMin)

    pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
    pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
    pos[i * 3 + 2] = radius * Math.cos(phi)

    const warm = Math.random()
    col[i * 3] = 0.85 + warm * 0.15
    col[i * 3 + 1] = 0.88 + warm * 0.1
    col[i * 3 + 2] = 1
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3))

  const material = new THREE.PointsMaterial({
    size: 0.55,
    vertexColors: true,
    sizeAttenuation: true,
    depthWrite: false,
  })

  return new THREE.Points(geometry, material)
}

export default function TrajectoryMap3D({
  position: _position,
  distanceFromEarthKm,
  distanceFromMoonKm: _distanceFromMoonKm,
  speedKmS,
  metElapsed,
  riskLevel,
  heightPx = DEFAULT_HEIGHT,
}: TrajectoryMap3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const useFallback = useStaticTrajectoryFallback()

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const animIdRef = useRef<number | null>(null)

  const sunRef = useRef<THREE.DirectionalLight | null>(null)
  const ambientRef = useRef<THREE.AmbientLight | null>(null)
  const fillRef = useRef<THREE.DirectionalLight | null>(null)

  const earthRef = useRef<THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial> | null>(null)
  const cloudsRef = useRef<THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial> | null>(null)
  const atmosphereRef = useRef<THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null>(null)
  const moonRef = useRef<THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial> | null>(null)
  const starsRef = useRef<THREE.Points | null>(null)
  const milkyWayRef = useRef<THREE.Points | null>(null)

  const orionRef = useRef<THREE.Group | null>(null)
  const panelLeftRef = useRef<THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> | null>(null)
  const panelRightRef = useRef<THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> | null>(null)
  const pingRingsRef = useRef<Array<{ mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; phase: number }>>([])

  const trajectoryOutRef = useRef<THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> | null>(null)
  const trajectoryReturnRef = useRef<THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial> | null>(null)
  const trailLineRef = useRef<THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> | null>(null)
  const trailPositionsRef = useRef<THREE.Vector3[]>([])

  const moonAngleRef = useRef(0)
  const timeRef = useRef(0)
  const frameRef = useRef(0)
  const latestTelemetryRef = useRef({
    distanceFromEarthKm: 0,
    speedKmS: 0,
    metElapsed: '00:00:00',
    riskLevel: 'nominal' as RiskLevel,
  })

  const safeDistanceFromEarthKm = Number.isFinite(distanceFromEarthKm) ? Math.max(distanceFromEarthKm, 0) : 0
  const safeSpeedKmS = Number.isFinite(speedKmS) ? Math.max(speedKmS, 0) : 0
  const recordProgress = Math.min(100, (safeDistanceFromEarthKm / 400171) * 100)
  const wrapperHeight = Math.max(heightPx, 600)
  const riskTextColor =
    riskLevel === 'severe'
      ? '#ff4444'
      : riskLevel === 'elevated'
        ? '#ffaa44'
        : '#00ff88'

  latestTelemetryRef.current = {
    distanceFromEarthKm: safeDistanceFromEarthKm,
    speedKmS: safeSpeedKmS,
    metElapsed,
    riskLevel,
  }

  useEffect(() => {
    if (useFallback) {
      return
    }

    const container = containerRef.current
    const canvas = canvasRef.current

    if (!container || !canvas) {
      return
    }

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    renderer.outputColorSpace = THREE.SRGBColorSpace
    rendererRef.current = renderer

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.01, 2000)
    camera.position.set(0, ER * 2.5, ER * 8)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.minDistance = ER * 1.5
    controls.maxDistance = ER * 80
    controls.autoRotate = false
    controls.autoRotateSpeed = 0.3
    controlsRef.current = controls

    const sun = new THREE.DirectionalLight(0xfff5e0, 2.8)
    sun.position.set(-SUN_DIST, SUN_DIST * 0.1, 0)
    sun.castShadow = true
    scene.add(sun)
    sunRef.current = sun

    const ambient = new THREE.AmbientLight(0x090915, 1)
    scene.add(ambient)
    ambientRef.current = ambient

    const fill = new THREE.DirectionalLight(0x111133, 0.15)
    fill.position.set(SUN_DIST, 0, 0)
    scene.add(fill)
    fillRef.current = fill

    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')

    const tryLoad = (url: string, fallbackColor: number): THREE.Texture => {
      let texture: THREE.Texture
      texture = loader.load(
        url,
        undefined,
        undefined,
        () => {
          const fallbackCanvas = document.createElement('canvas')
          fallbackCanvas.width = 2
          fallbackCanvas.height = 2
          const ctx = fallbackCanvas.getContext('2d')
          if (ctx) {
            ctx.fillStyle = `#${fallbackColor.toString(16).padStart(6, '0')}`
            ctx.fillRect(0, 0, 2, 2)
            texture.image = fallbackCanvas
            texture.needsUpdate = true
          }
        },
      )

      return texture
    }

    const dayTex = tryLoad('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg', 0x1a4a8a)
    const nightTex = tryLoad('https://unpkg.com/three-globe/example/img/earth-night.jpg', 0x000511)
    const specTex = tryLoad('https://unpkg.com/three-globe/example/img/earth-water.png', 0x333333)
    const cloudTex = tryLoad('https://unpkg.com/three-globe/example/img/earth-clouds.png', 0xffffff)
    const moonTex = tryLoad('https://unpkg.com/three-globe/example/img/lunar_surface.jpg', 0x888877)

    dayTex.colorSpace = THREE.SRGBColorSpace
    nightTex.colorSpace = THREE.SRGBColorSpace
    cloudTex.colorSpace = THREE.SRGBColorSpace
    moonTex.colorSpace = THREE.SRGBColorSpace

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy()
    dayTex.anisotropy = maxAnisotropy
    nightTex.anisotropy = maxAnisotropy
    specTex.anisotropy = maxAnisotropy
    cloudTex.anisotropy = maxAnisotropy
    moonTex.anisotropy = maxAnisotropy

    const earthGeo = new THREE.SphereGeometry(ER, 64, 64)
    const earthMat = new THREE.MeshPhongMaterial({
      map: dayTex,
      specularMap: specTex,
      specular: new THREE.Color(0x222233),
      emissiveMap: nightTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.7,
      shininess: 20,
    })
    const earth = new THREE.Mesh(earthGeo, earthMat)
    earth.rotation.z = 23.5 * Math.PI / 180
    earth.castShadow = true
    earth.receiveShadow = true
    scene.add(earth)
    earthRef.current = earth

    const cloudGeo = new THREE.SphereGeometry(ER * 1.003, 64, 64)
    const cloudMat = new THREE.MeshPhongMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    })
    const clouds = new THREE.Mesh(cloudGeo, cloudMat)
    clouds.rotation.z = earth.rotation.z
    scene.add(clouds)
    cloudsRef.current = clouds

    const atmoGeo = new THREE.SphereGeometry(ER * 1.025, 64, 64)
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x3366ff,
      transparent: true,
      opacity: 0.055,
      side: THREE.BackSide,
      depthWrite: false,
    })
    const atmosphere = new THREE.Mesh(atmoGeo, atmoMat)
    atmosphere.rotation.z = earth.rotation.z
    scene.add(atmosphere)
    atmosphereRef.current = atmosphere

    const moonRadius = ER * 0.272
    const moonGeo = new THREE.SphereGeometry(moonRadius, 48, 48)
    const moonMat = new THREE.MeshPhongMaterial({
      map: moonTex,
      bumpMap: moonTex,
      bumpScale: 0.04,
      shininess: 2,
      color: 0xaaaaaa,
    })
    const moon = new THREE.Mesh(moonGeo, moonMat)
    moon.castShadow = true
    moon.receiveShadow = true
    scene.add(moon)
    moonRef.current = moon

    const starField = makeStars(6000, 800, 1000)
    scene.add(starField)
    starsRef.current = starField

    const milkyWay = makeStars(2500, 820, 980, true)
    scene.add(milkyWay)
    milkyWayRef.current = milkyWay

    const orionGroup = new THREE.Group()
    scene.add(orionGroup)
    orionRef.current = orionGroup

    const capsuleGeo = new THREE.IcosahedronGeometry(ER * 0.038, 2)
    const capsuleMat = new THREE.MeshStandardMaterial({
      color: 0xd0dff0,
      metalness: 0.82,
      roughness: 0.18,
      emissive: 0x112244,
      emissiveIntensity: 0.15,
    })
    const capsule = new THREE.Mesh(capsuleGeo, capsuleMat)
    capsule.castShadow = true
    capsule.receiveShadow = true
    orionGroup.add(capsule)

    const panelGeo = new THREE.BoxGeometry(ER * 0.18, ER * 0.002, ER * 0.07)
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x1a3a7a,
      metalness: 0.6,
      roughness: 0.4,
    })
    const panelL = new THREE.Mesh(panelGeo, panelMat)
    const panelR = new THREE.Mesh(panelGeo, panelMat.clone())
    panelL.position.x = -ER * 0.12
    panelR.position.x = ER * 0.12
    orionGroup.add(panelL, panelR)
    panelLeftRef.current = panelL
    panelRightRef.current = panelR

    const ringColors = { nominal: 0x4488ff, elevated: 0xffaa44, severe: 0xff3333 } as const
    const pingRings: Array<{ mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; phase: number }> = []

    for (let i = 0; i < 3; i += 1) {
      const ringGeo = new THREE.RingGeometry(ER * 0.04, ER * 0.048, 32)
      const ringMat = new THREE.MeshBasicMaterial({
        color: ringColors.nominal,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.rotation.x = Math.PI / 2
      orionGroup.add(ring)
      pingRings.push({ mesh: ring, phase: i / 3 })
    }
    pingRingsRef.current = pingRings

    const trajectoryPoints = [
      new THREE.Vector3(ER * 1.4, 0, 0),
      new THREE.Vector3(MOON_DIST * 0.25, MOON_DIST * 0.08, 0),
      new THREE.Vector3(MOON_DIST * 0.55, MOON_DIST * 0.14, 0),
      new THREE.Vector3(MOON_DIST * 0.85, MOON_DIST * 0.16, 0),
      new THREE.Vector3(MOON_DIST * 1.08, MOON_DIST * 0.04, 0),
      new THREE.Vector3(MOON_DIST * 1.02, -MOON_DIST * 0.10, 0),
      new THREE.Vector3(MOON_DIST * 0.75, -MOON_DIST * 0.18, 0),
      new THREE.Vector3(MOON_DIST * 0.45, -MOON_DIST * 0.14, 0),
      new THREE.Vector3(MOON_DIST * 0.20, -MOON_DIST * 0.06, 0),
      new THREE.Vector3(ER * 1.6, 0, 0),
    ]

    const trajCurve = new THREE.CatmullRomCurve3(trajectoryPoints, false, 'catmullrom', 0.5)
    const trajPts = trajCurve.getPoints(200)

    const outGeo = new THREE.BufferGeometry().setFromPoints(trajPts.slice(0, 100))
    const outMat = new THREE.LineBasicMaterial({
      color: 0x4488ff,
      opacity: 0.7,
      transparent: true,
    })
    const outLine = new THREE.Line(outGeo, outMat)
    scene.add(outLine)
    trajectoryOutRef.current = outLine

    const retGeo = new THREE.BufferGeometry().setFromPoints(trajPts.slice(100))
    const retMat = new THREE.LineDashedMaterial({
      color: 0xffaa44,
      dashSize: 0.08,
      gapSize: 0.05,
      opacity: 0.5,
      transparent: true,
    })
    const retLine = new THREE.Line(retGeo, retMat)
    retLine.computeLineDistances()
    scene.add(retLine)
    trajectoryReturnRef.current = retLine

    const onResize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    const animate = () => {
      animIdRef.current = requestAnimationFrame(animate)
      timeRef.current += 0.016
      frameRef.current += 1

      if (earthRef.current) {
        earthRef.current.rotation.y += 0.0004
      }

      if (cloudsRef.current) {
        cloudsRef.current.rotation.y += 0.00046
      }

      moonAngleRef.current += 0.00008
      if (moonRef.current) {
        moonRef.current.position.set(
          Math.cos(moonAngleRef.current) * MOON_DIST,
          Math.sin(moonAngleRef.current) * MOON_DIST * 0.05,
          Math.sin(moonAngleRef.current) * MOON_DIST,
        )
      }

      const telemetry = latestTelemetryRef.current
      if (orionRef.current) {
        const metSec = parseMET(telemetry.metElapsed)
        const dist = telemetry.distanceFromEarthKm * KM
        const angle = (metSec / 800000) * Math.PI * 2
        orionRef.current.position.set(
          Math.cos(angle) * dist,
          Math.sin(angle * 0.3) * dist * 0.06,
          Math.sin(angle) * dist,
        )
      }

      pingRingsRef.current.forEach(({ mesh, phase }) => {
        const p = ((timeRef.current * 0.5 + phase) % 1)
        mesh.scale.setScalar(1 + p * 3.5)
        mesh.material.opacity = (1 - p) * 0.7
        mesh.material.color.set(
          telemetry.riskLevel === 'severe' ? 0xff3333 : telemetry.riskLevel === 'elevated' ? 0xffaa44 : 0x4488ff,
        )
      })

      if (orionRef.current && frameRef.current % 3 === 0) {
        trailPositionsRef.current.push(orionRef.current.position.clone())
        if (trailPositionsRef.current.length > 80) {
          trailPositionsRef.current.shift()
        }

        if (trailPositionsRef.current.length > 2) {
          if (trailLineRef.current) {
            scene.remove(trailLineRef.current)
            trailLineRef.current.geometry.dispose()
            trailLineRef.current.material.dispose()
          }

          const trailCurve = new THREE.CatmullRomCurve3(trailPositionsRef.current)
          const trailGeo = new THREE.BufferGeometry().setFromPoints(trailCurve.getPoints(100))
          const trailMat = new THREE.LineBasicMaterial({
            color: 0x4488ff,
            opacity: 0.5,
            transparent: true,
          })
          const trailLine = new THREE.Line(trailGeo, trailMat)
          trailLineRef.current = trailLine
          scene.add(trailLine)
        }
      }

      controls.update()
      renderer.render(scene, camera)
    }

    window.addEventListener('resize', onResize)
    animate()

    return () => {
      if (animIdRef.current !== null) {
        cancelAnimationFrame(animIdRef.current)
      }

      window.removeEventListener('resize', onResize)
      controls.dispose()
      renderer.dispose()
      disposeObject(scene)

      rendererRef.current = null
      sceneRef.current = null
      cameraRef.current = null
      controlsRef.current = null
      sunRef.current = null
      ambientRef.current = null
      fillRef.current = null
      earthRef.current = null
      cloudsRef.current = null
      atmosphereRef.current = null
      moonRef.current = null
      starsRef.current = null
      milkyWayRef.current = null
      orionRef.current = null
      panelLeftRef.current = null
      panelRightRef.current = null
      pingRingsRef.current = []
      trajectoryOutRef.current = null
      trajectoryReturnRef.current = null
      trailLineRef.current = null
      trailPositionsRef.current = []
      moonAngleRef.current = 0
      timeRef.current = 0
      frameRef.current = 0
    }
  }, [useFallback])

  const fallbackProgress = missionElapsedToProgress(metElapsed)

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: `${wrapperHeight}px`,
        minHeight: 600,
        overflow: 'hidden',
        borderRadius: 24,
        background: 'radial-gradient(circle at top, rgba(12,20,40,0.85), rgba(0,0,0,0.98))',
        border: '1px solid rgba(68,136,255,0.12)',
      }}
    >
      {useFallback ? (
        <TrajectoryMapFallback
          progress={fallbackProgress}
          riskLevel={riskLevel}
          distanceFromEarthKm={Math.max(0, Math.round(safeDistanceFromEarthKm))}
          metElapsed={metElapsed}
        />
      ) : (
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
          }}
        />
      )}

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ ...HUD_PANEL, position: 'absolute', top: 12, left: 12, minWidth: 220 }}>
          <div style={{ color: '#4488ff', letterSpacing: '0.16em', fontSize: 9, marginBottom: 6 }}>
            ARTEMIS II · MISSION CONTROL
          </div>
          <div>MET &nbsp;&nbsp;&nbsp;&nbsp;{metElapsed}</div>
          <div>DIST &nbsp;&nbsp;&nbsp;{safeDistanceFromEarthKm.toLocaleString()} km</div>
          <div>SPEED &nbsp;&nbsp;{safeSpeedKmS.toFixed(3)} km/s</div>
          <div style={{ color: riskTextColor }}>RAD &nbsp;&nbsp;&nbsp;&nbsp;{riskLevel.toUpperCase()} ●</div>
          {/* Record broken badge hidden for demo
          {safeDistanceFromEarthKm > 400171 ? (
            <div style={{ color: '#00ff88', marginTop: 6, fontSize: 10 }}>
              ★ HUMAN RECORD BROKEN
            </div>
          ) : null}
          */}
        </div>

        {/* HUMAN DISTANCE RECORD panel hidden for demo
        <div style={{ ...HUD_PANEL, position: 'absolute', top: 12, right: 12, minWidth: 200, fontSize: 10 }}>
          <div style={{ color: '#4488ff', letterSpacing: '0.14em', fontSize: 9, marginBottom: 8 }}>
            HUMAN DISTANCE RECORD
          </div>
          <div style={{ marginBottom: 4 }}>Apollo 13 &nbsp; 400,171 km</div>
          <div
            style={{
              height: 4,
              background: '#1a2a4a',
              borderRadius: 2,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                height: '100%',
                borderRadius: 2,
                width: `${recordProgress}%`,
                background: safeDistanceFromEarthKm > 400171 ? '#00ff88' : '#4488ff',
                transition: 'width 1s linear',
              }}
            />
          </div>
          <div>Artemis II &nbsp;{safeDistanceFromEarthKm.toLocaleString()} km</div>
          <div style={{ color: '#888', marginTop: 4 }}>
            {safeDistanceFromEarthKm >= 400171
              ? `★ NEW RECORD +${(safeDistanceFromEarthKm - 400171).toLocaleString()} km`
              : `${(400171 - safeDistanceFromEarthKm).toLocaleString()} km to record`}
          </div>
        </div>
        */}
      </div>
    </div>
  )
}
