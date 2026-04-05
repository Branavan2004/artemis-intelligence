import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import TelemetryMap3D from '../../components/TelemetryMap3D'

// Three.js is fully mocked in src/test/setup.ts

const defaultProps = {
  distanceFromEarthKm: 380000,
  speedKmS: 1.024,
  metElapsed: '083:42:16',
  riskLevel: 'nominal' as const,
}

describe('TelemetryMap3D', () => {
  it('renders without crashing', () => {
    expect(() => render(<TelemetryMap3D {...defaultProps} />)).not.toThrow()
  })

  it('renders a mount div for the Three.js canvas', () => {
    const { container } = render(<TelemetryMap3D {...defaultProps} />)
    expect(container.querySelector('div')).toBeTruthy()
  })

  it('renders EARTH focus button', () => {
    render(<TelemetryMap3D {...defaultProps} />)
    expect(screen.getByText(/EARTH/i)).toBeInTheDocument()
  })

  it('renders MOON focus button', () => {
    render(<TelemetryMap3D {...defaultProps} />)
    expect(screen.getByText(/MOON/i)).toBeInTheDocument()
  })

  it('renders ARTEMIS II focus button', () => {
    render(<TelemetryMap3D {...defaultProps} />)
    expect(screen.getByRole('button', { name: /ARTEMIS II/i })).toBeInTheDocument()
  })

  it('shows MET in the HUD', () => {
    render(<TelemetryMap3D {...defaultProps} />)
    expect(screen.getByText('083:42:16')).toBeInTheDocument()
  })

  it('shows DIST with formatted distance in the HUD', () => {
    render(<TelemetryMap3D {...defaultProps} />)
    expect(screen.getByText(/380,000 km/i)).toBeInTheDocument()
  })

  it('shows VEL with speed in the HUD', () => {
    render(<TelemetryMap3D {...defaultProps} />)
    expect(screen.getByText(/1\.024 km\/s/i)).toBeInTheDocument()
  })

  it('shows NOMINAL risk level indicator', () => {
    render(<TelemetryMap3D {...defaultProps} />)
    expect(screen.getByText(/NOMINAL/i)).toBeInTheDocument()
  })

  it('shows ELEVATED risk level indicator', () => {
    render(<TelemetryMap3D {...defaultProps} riskLevel="elevated" />)
    expect(screen.getByText(/ELEVATED/i)).toBeInTheDocument()
  })

  it('shows SEVERE risk level indicator', () => {
    render(<TelemetryMap3D {...defaultProps} riskLevel="severe" />)
    expect(screen.getByText(/SEVERE/i)).toBeInTheDocument()
  })

  it('shows "LOADING TELEMETRY…" before ready', () => {
    render(<TelemetryMap3D {...defaultProps} />)
    // Loading veil is shown before the 400ms timeout fires
    expect(screen.getByText(/LOADING TELEMETRY/i)).toBeInTheDocument()
  })

  it('renders fullscreen mode without crashing', () => {
    expect(() =>
      render(<TelemetryMap3D {...defaultProps} fullscreen={true} />),
    ).not.toThrow()
  })

  it('hides internal HUD in fullscreen mode', () => {
    render(<TelemetryMap3D {...defaultProps} fullscreen={true} />)
    // showInternalHud = !fullscreen — HUD labels should not be present
    expect(screen.queryByText(/DIST/i)).not.toBeInTheDocument()
  })

  it('handles distanceFromEarthKm = 0 without crashing', () => {
    expect(() =>
      render(<TelemetryMap3D {...defaultProps} distanceFromEarthKm={0} />),
    ).not.toThrow()
  })

  it('handles trajectoryFraction prop without crashing', () => {
    expect(() =>
      render(<TelemetryMap3D {...defaultProps} trajectoryFraction={0.5} />),
    ).not.toThrow()
  })

  it('renders with custom heightPx', () => {
    const { container } = render(
      <TelemetryMap3D {...defaultProps} heightPx={800} />,
    )
    expect(container.querySelector('div')).toBeTruthy()
  })

  it('EARTH button click does not throw', () => {
    render(<TelemetryMap3D {...defaultProps} />)
    const btn = screen.getByText(/EARTH/i).closest('button')
    expect(() => btn && fireEvent.click(btn)).not.toThrow()
  })

  it('MOON button click does not throw', () => {
    render(<TelemetryMap3D {...defaultProps} />)
    const btn = screen.getByText(/MOON/i).closest('button')
    expect(() => btn && fireEvent.click(btn)).not.toThrow()
  })

  it('ARTEMIS II button click does not throw', () => {
    render(<TelemetryMap3D {...defaultProps} />)
    const btn = screen.getByRole('button', { name: /ARTEMIS II/i })
    expect(() => btn && fireEvent.click(btn)).not.toThrow()
  })
})
