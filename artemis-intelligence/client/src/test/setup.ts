import '@testing-library/jest-dom'
import { vi } from 'vitest'

// ── scrollTo & pointer capture — jsdom stubs ─────────────────────────────────
window.HTMLElement.prototype.scrollTo = vi.fn() as typeof window.HTMLElement.prototype.scrollTo
window.HTMLElement.prototype.scrollIntoView = vi.fn() as typeof window.HTMLElement.prototype.scrollIntoView
window.HTMLElement.prototype.setPointerCapture = vi.fn() as typeof window.HTMLElement.prototype.setPointerCapture
window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => true) as typeof window.HTMLElement.prototype.hasPointerCapture
window.HTMLElement.prototype.releasePointerCapture = vi.fn() as typeof window.HTMLElement.prototype.releasePointerCapture

// ── Canvas API — minimal 2D context for texture/text sprite helpers ─────────
const mockCanvasGradient = {
  addColorStop: vi.fn(),
}

const mockCanvasContext = {
  createRadialGradient: vi.fn(() => mockCanvasGradient),
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
  fillStyle: '',
  font: '',
  globalAlpha: 1,
  textAlign: 'left' as CanvasTextAlign,
}

HTMLCanvasElement.prototype.getContext = vi.fn(
  (contextId: string) => (contextId === '2d' ? mockCanvasContext : null),
) as typeof HTMLCanvasElement.prototype.getContext

// ── Mock rAF ──────────────────────────────────────────────────────────────────
window.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16)) as unknown as typeof requestAnimationFrame
window.cancelAnimationFrame  = vi.fn((id) => clearTimeout(id))  as unknown as typeof cancelAnimationFrame

// ── Mock ResizeObserver ───────────────────────────────────────────────────────
window.ResizeObserver = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
  this.observe = vi.fn()
  this.unobserve = vi.fn()
  this.disconnect = vi.fn()
}) as unknown as typeof ResizeObserver

// ── Mock Three.js — all classes must use mockImplementation so `new` works ───
vi.mock('three', () => {
  const mockDomElement = document.createElement('canvas')
  const mockCtor = (factory: () => Record<string, unknown>) =>
    vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      Object.assign(this, factory())
    })

  // ── Math / value types ──────────────────────────────────────────────────────
  const Vector3 = vi.fn().mockImplementation(function (this: Record<string, unknown>, x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z
    this.set      = vi.fn()
    this.copy     = vi.fn()
    this.add      = vi.fn(() => this)
    this.sub      = vi.fn(() => this)
    this.lerpVectors   = vi.fn()
    this.setFromSpherical = vi.fn()
    this.clone    = vi.fn(() => ({
      x: 0, y: 0, z: 0,
      add: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
      sub: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
    }))
    this.distanceTo = vi.fn(() => 10)
  })

  const Spherical = vi.fn().mockImplementation(function (this: Record<string, unknown>, r = 10, phi = Math.PI / 2, theta = 0) {
    this.radius = r; this.phi = phi; this.theta = theta
    this.setFromVector3 = vi.fn()
  })

  const Color = vi.fn().mockImplementation(function () {})

  // ── Geometry ────────────────────────────────────────────────────────────────
  const mkGeo = () => ({
    setAttribute: vi.fn(),
    setFromPoints: vi.fn(),
  })
  const SphereGeometry    = mockCtor(mkGeo)
  const RingGeometry      = mockCtor(mkGeo)
  const BufferGeometry    = mockCtor(mkGeo)

  // ── Materials ───────────────────────────────────────────────────────────────
  const mkMat = () => ({ needsUpdate: false, map: null, opacity: 0.35, color: 0xffffff })
  const MeshPhongMaterial  = mockCtor(mkMat)
  const MeshBasicMaterial  = mockCtor(mkMat)
  const PointsMaterial     = mockCtor(mkMat)
  const LineBasicMaterial  = mockCtor(mkMat)
  const LineDashedMaterial = mockCtor(mkMat)
  const SpriteMaterial     = mockCtor(() => ({ map: null, transparent: true, depthWrite: false }))

  // ── 3D objects ──────────────────────────────────────────────────────────────
  const mkPos = () => ({ set: vi.fn(), copy: vi.fn(), x: 0, y: 0, z: 0 })
  const mkObj = () => ({
    position:   mkPos(),
    rotation:   { x: 0, y: 0, z: 0 },
    scale:      { set: vi.fn(), setScalar: vi.fn() },
    quaternion: { copy: vi.fn() },
    geometry:   { setFromPoints: vi.fn(), setAttribute: vi.fn() },
  })

  const Mesh   = mockCtor(mkObj)
  const Points = mockCtor(mkObj)
  const Group  = mockCtor(() => ({ ...mkObj(), add: vi.fn() }))
  const Line   = mockCtor(() => ({ ...mkObj(), computeLineDistances: vi.fn() }))

  const Sprite = mockCtor(() => ({
    scale:      { set: vi.fn(), setScalar: vi.fn() },
    position:   mkPos(),
    quaternion: { copy: vi.fn() },
  }))

  // ── Lights ──────────────────────────────────────────────────────────────────
  const AmbientLight     = mockCtor(() => ({}))
  const DirectionalLight = mockCtor(() => ({ position: { set: vi.fn() } }))
  const PointLight       = mockCtor(() => ({ position: { set: vi.fn() } }))

  // ── Core scene graph ────────────────────────────────────────────────────────
  const Scene = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.add        = vi.fn()
    this.remove     = vi.fn()
    this.background = null
    this.fog        = null
  })

  const PerspectiveCamera = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.position          = { set: vi.fn(), copy: vi.fn(), clone: vi.fn(() => ({ x: 0, y: 0, z: 0, sub: vi.fn(() => {}) })), distanceTo: vi.fn(() => 10), lerpVectors: vi.fn() }
    this.lookAt            = vi.fn()
    this.aspect            = 1
    this.updateProjectionMatrix = vi.fn()
    this.quaternion        = { copy: vi.fn() }
  })

  const WebGLRenderer = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.setSize              = vi.fn()
    this.setPixelRatio        = vi.fn()
    this.render               = vi.fn()
    this.dispose              = vi.fn()
    this.shadowMap            = { enabled: false }
    this.toneMapping          = 0
    this.toneMappingExposure  = 1
    this.domElement           = mockDomElement
  })

  // ── Texture ─────────────────────────────────────────────────────────────────
  const TextureLoader = mockCtor(() => ({
    load:        vi.fn(),
    crossOrigin: '',
  }))
  const CanvasTexture  = mockCtor(() => ({}))
  const BufferAttribute = mockCtor(() => ({}))

  // ── Fog ─────────────────────────────────────────────────────────────────────
  const FogExp2 = mockCtor(() => ({}))

  return {
    WebGLRenderer, Scene, PerspectiveCamera,
    SphereGeometry, RingGeometry, BufferGeometry, BufferAttribute,
    MeshPhongMaterial, MeshBasicMaterial, SpriteMaterial,
    PointsMaterial, LineBasicMaterial, LineDashedMaterial,
    Mesh, Points, Group, Line, Sprite,
    AmbientLight, DirectionalLight, PointLight,
    TextureLoader, CanvasTexture,
    Vector3, Spherical, Color, FogExp2,
    // Constants
    BackSide:              1,
    FrontSide:             0,
    DoubleSide:            2,
    AdditiveBlending:      2,
    ACESFilmicToneMapping: 4,
    MathUtils: { degToRad: (d: number) => (d * Math.PI) / 180 },
  }
})
