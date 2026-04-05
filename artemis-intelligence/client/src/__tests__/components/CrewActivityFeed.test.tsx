import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CrewActivityFeed from '../../components/CrewActivityFeed'

describe('CrewActivityFeed', () => {
  it('renders without crashing', () => {
    render(<CrewActivityFeed metElapsed="083:42:16" />)
    expect(document.body).toBeTruthy()
  })

  it('renders with no props (metElapsed defaults to 00:00:00)', () => {
    expect(() => render(<CrewActivityFeed />)).not.toThrow()
  })

  it('shows "Crew Activity Feed" header', () => {
    render(<CrewActivityFeed metElapsed="083:42:16" />)
    expect(screen.getByText(/Crew Activity Feed/i)).toBeInTheDocument()
  })

  it('shows "Live" badge', () => {
    render(<CrewActivityFeed metElapsed="083:42:16" />)
    expect(screen.getByText(/Live/i)).toBeInTheDocument()
  })

  it('shows liftoff action text at MET 083h (past event)', () => {
    render(<CrewActivityFeed metElapsed="083:42:16" />)
    // "Liftoff from Launch Complex 39B" is a past entry at this MET
    expect(screen.getByText(/Liftoff from Launch Complex 39B/i)).toBeInTheDocument()
  })

  it('shows UPCOMING section when there are future events', () => {
    // At MET 000:00:01 almost everything is upcoming
    render(<CrewActivityFeed metElapsed="000:00:01" />)
    expect(screen.getAllByText(/UPCOMING/i).length).toBeGreaterThan(0)
  })

  it('shows RECENT section when there are past events', () => {
    // At MET 083h many events are past
    render(<CrewActivityFeed metElapsed="083:42:16" />)
    expect(screen.getByText(/RECENT/i)).toBeInTheDocument()
  })

  it('shows COMPLETED count label', () => {
    render(<CrewActivityFeed metElapsed="083:42:16" />)
    expect(screen.getByText(/COMPLETED/i)).toBeInTheDocument()
  })

  it('shows UPCOMING count label', () => {
    render(<CrewActivityFeed metElapsed="083:42:16" />)
    expect(screen.getAllByText(/UPCOMING/i).length).toBeGreaterThan(0)
  })

  it('shows ACTIVE count label', () => {
    render(<CrewActivityFeed metElapsed="083:42:16" />)
    expect(screen.getByText(/ACTIVE/i)).toBeInTheDocument()
  })

  it('shows "CLICK ANY ROW FOR DETAIL" hint', () => {
    render(<CrewActivityFeed metElapsed="083:42:16" />)
    expect(screen.getByText(/CLICK ANY ROW FOR DETAIL/i)).toBeInTheDocument()
  })

  it('AUTO/MANUAL scroll toggle button exists', () => {
    render(<CrewActivityFeed metElapsed="083:42:16" />)
    expect(screen.getByText(/AUTO/i)).toBeInTheDocument()
  })

  it('clicking scroll toggle switches AUTO → MANUAL', () => {
    render(<CrewActivityFeed metElapsed="083:42:16" />)
    const toggleBtn = screen.getByText(/AUTO/i)
    fireEvent.click(toggleBtn)
    expect(screen.getByText(/^MANUAL$/)).toBeInTheDocument()
  })

  it('clicking an entry row expands its detail', () => {
    render(<CrewActivityFeed metElapsed="083:42:16" />)
    const entryBtn = screen
      .getByText(/Liftoff from Launch Complex 39B/i)
      .closest('button')

    expect(entryBtn).toBeTruthy()

    if (entryBtn) {
      fireEvent.click(entryBtn)
      expect(document.body.textContent).toContain('SLS ignition')
    }
  })

  it('shows TLI burn action at low MET', () => {
    // At MET 000:00:01, TLI burn is a future event
    render(<CrewActivityFeed metElapsed="000:00:01" />)
    expect(screen.getByText(/TRANSLUNAR INJECTION BURN/i)).toBeInTheDocument()
  })

  it('renders correctly at mission end MET 204:30:00', () => {
    expect(() => render(<CrewActivityFeed metElapsed="204:30:00" />)).not.toThrow()
  })

  it('shows SPLASHDOWN at mission end', () => {
    render(<CrewActivityFeed metElapsed="204:30:00" />)
    expect(screen.getByText(/SPLASHDOWN/i)).toBeInTheDocument()
  })
})
