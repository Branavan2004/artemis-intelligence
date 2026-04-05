import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import WindowView from '../../components/WindowView'

// ── Mock canvas 2D context (jsdom has no canvas drawing) ─────────────────────
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () =>
      ({
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        font: '',
        textAlign: 'start',
        globalAlpha: 1,
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        ellipse: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        fillText: vi.fn(),
        clip: vi.fn(),
        roundRect: vi.fn(),
        createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      }) as unknown as CanvasRenderingContext2D,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext
})

describe('WindowView', () => {
  const defaultProps = {
    distanceFromEarthKm: 380000,
    metElapsed: '083:42:16',
  }

  it('renders without crashing', () => {
    render(<WindowView {...defaultProps} />)
    expect(document.body).toBeTruthy()
  })

  it('renders a <canvas> element', () => {
    const { container } = render(<WindowView {...defaultProps} />)
    expect(container.querySelector('canvas')).toBeTruthy()
  })

  it('renders an <svg> overlay (porthole bezel)', () => {
    const { container } = render(<WindowView {...defaultProps} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('shows Moon distance label', () => {
    render(<WindowView {...defaultProps} />)
    expect(screen.getByText(/Moon:/i)).toBeInTheDocument()
  })

  it('displays distanceFromMoonKm when provided', () => {
    render(
      <WindowView distanceFromEarthKm={380000} distanceFromMoonKm={6500} metElapsed="120:27:00" />,
    )
    // Should display "6,500 km" (or similar formatted distance)
    expect(screen.getByText(/6,500 km/i)).toBeInTheDocument()
  })

  it('calculates moonDistanceKm from distanceFromEarthKm when not provided', () => {
    // 384400 - 380000 = 4400
    render(<WindowView distanceFromEarthKm={380000} metElapsed="083:42:16" />)
    expect(screen.getByText(/4,400 km/i)).toBeInTheDocument()
  })

  it('renders during blackout window without crashing (MET 119:12:00)', () => {
    expect(() =>
      render(<WindowView distanceFromEarthKm={406000} metElapsed="119:12:00" />),
    ).not.toThrow()
  })

  it('renders during flyby window without crashing (MET 116:30:00)', () => {
    expect(() =>
      render(<WindowView distanceFromEarthKm={401000} metElapsed="116:30:00" />),
    ).not.toThrow()
  })

  it('renders at distanceFromEarthKm = 0 without crashing (boundary)', () => {
    expect(() =>
      render(<WindowView distanceFromEarthKm={0} metElapsed="000:00:00" />),
    ).not.toThrow()
  })

  it('renders at very large distance without crashing', () => {
    expect(() =>
      render(<WindowView distanceFromEarthKm={406773} metElapsed="115:10:00" />),
    ).not.toThrow()
  })

  it('renders at mission end MET 204:55:00 without crashing', () => {
    expect(() =>
      render(<WindowView distanceFromEarthKm={100} metElapsed="204:55:00" />),
    ).not.toThrow()
  })
})
