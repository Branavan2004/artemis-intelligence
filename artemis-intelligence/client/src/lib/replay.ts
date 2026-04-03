export interface MissionPhaseWindow {
  name: string
  startHour: number
  endHour: number
}

export interface MissionBriefing {
  signal: string
  summary: string
  whyItMatters: string
  whatNext: string
  apolloComparison: string
  riskWindow: string
  watchItems: string[]
}

export interface MissionEvent {
  hour: number
  title: string
  detail: string
  category: 'launch' | 'systems' | 'trajectory' | 'lunar' | 'return'
}

const MAX_MISSION_HOURS = 240
const MAX_DISTANCE_KM = 432000

const BRIEFINGS: Record<string, MissionBriefing> = {
  'Pre-Launch': {
    signal: 'Vehicle stack in countdown posture',
    summary: 'Ground teams are finalizing the launch commit criteria, validating the crew vehicle, and closing the last operational loops before liftoff.',
    whyItMatters: 'The pre-launch window is where every system, weather input, and crew procedure must converge into one clean go/no-go decision.',
    whatNext: 'Once constraints are cleared, Artemis II transitions into ascent, parking orbit, and initial spacecraft activation.',
    apolloComparison: 'Apollo had similar launch-commit discipline, but Artemis pairs it with far more digital monitoring and system redundancy.',
    riskWindow: 'Weather, ground systems, and late constraints can still reshape the exact launch sequence.',
    watchItems: ['Launch readiness polls', 'Crew ingress milestones', 'Ground weather constraints'],
  },
  'Earth Orbit & Systems Check': {
    signal: 'Orion is alive in orbit and the crew is validating the spacecraft.',
    summary: 'The first mission day is about making sure the crew cabin, life support, guidance, and communications all behave as expected before committing to deep space.',
    whyItMatters: 'This is the last comparatively forgiving environment before translunar injection. Problems found here can still be assessed close to Earth.',
    whatNext: 'After systems are cleared, the mission sets up for the burn that sends Orion toward the Moon.',
    apolloComparison: 'Apollo also used early-orbit checkout, but Artemis is validating a spacecraft architecture meant to support longer and more sustainable lunar operations.',
    riskWindow: 'Teams are watching propulsion health, cabin systems, and overall readiness for translunar injection.',
    watchItems: ['Life support validation', 'Navigation alignment', 'Translunar injection readiness'],
  },
  'Translunar Injection': {
    signal: 'The mission is moving from Earth-bound operations into true cislunar travel.',
    summary: 'Artemis II executes and then rides the energy of the translunar profile, leaving low Earth orbit and beginning the long outbound coast.',
    whyItMatters: 'This is the transition that proves Orion and the crew can operate beyond low Earth orbit, which is the whole point of the mission.',
    whatNext: 'The spacecraft settles into deep-space operations as navigation, communications, and crew procedures are exercised far from Earth.',
    apolloComparison: 'The same strategic idea existed in Apollo, but Artemis is validating systems for a program designed around repeatable lunar access rather than a one-off race.',
    riskWindow: 'Trajectory fidelity, propulsion performance, and long-duration systems confidence matter most here.',
    watchItems: ['Burn completion', 'Trajectory corridor', 'Deep-space comms stability'],
  },
  'Lunar Flyby': {
    signal: 'Orion is in the most visually dramatic and strategically important segment of the mission.',
    summary: 'The spacecraft swings through the lunar vicinity on a free-return path, gathering the mission’s highest-profile moment while proving deep-space operations with crew on board.',
    whyItMatters: 'This is the clearest demonstration that Artemis can safely send humans to lunar distance and bring them back without committing to landing.',
    whatNext: 'Once closest approach is complete, the return leg becomes the focus, with navigation and energy management taking priority.',
    apolloComparison: 'Apollo made lunar flybys famous, but Artemis ties this pass directly to the architecture for future surface landings and sustained lunar infrastructure.',
    riskWindow: 'Navigation precision, crew workload, and communication timing are most important around lunar operations.',
    watchItems: ['Closest approach timing', 'Free-return confirmation', 'High-value crew imagery'],
  },
  'Return Trajectory': {
    signal: 'The mission is proving that deep-space operations remain stable over the long ride home.',
    summary: 'The return coast is about endurance, nominal systems behavior, crew operations, and validating that Orion can remain healthy through the full mission arc.',
    whyItMatters: 'A Moon mission is only successful if the spacecraft stays reliable all the way back to Earth recovery operations.',
    whatNext: 'Attention narrows toward reentry prep, recovery coordination, and final thermal protection readiness.',
    apolloComparison: 'Apollo return legs proved basic operational success. Artemis is extending that logic into a program intended to support the next generation of lunar missions.',
    riskWindow: 'Teams are tracking consumables, crew tempo, thermal environments, and reentry setup discipline.',
    watchItems: ['Consumables margins', 'Midcourse checks', 'Reentry prep packages'],
  },
  'Reentry & Splashdown': {
    signal: 'Mission success now depends on a clean atmospheric return and coordinated recovery.',
    summary: 'The final phase compresses months of preparation into the high-consequence sequence of reentry, descent, splashdown, and crew recovery.',
    whyItMatters: 'This is where all the earlier mission success must translate into a safe return of astronauts and spacecraft data.',
    whatNext: 'After splashdown, the program shifts into post-flight analysis and lessons that shape Artemis III.',
    apolloComparison: 'The splashdown heritage is familiar, but Orion’s systems and mission data feed a modern lunar campaign rather than the end of one.',
    riskWindow: 'Thermal protection, recovery timing, and final crew procedures define the closing minutes.',
    watchItems: ['Entry interface', 'Peak heating window', 'Recovery handoff'],
  },
}

const EVENTS: MissionEvent[] = [
  { hour: 0, title: 'Liftoff', detail: 'SLS clears the tower and begins the crewed Artemis II ascent sequence.', category: 'launch' },
  { hour: 2, title: 'Parking orbit established', detail: 'Initial ascent is complete and Orion begins early spacecraft checks.', category: 'systems' },
  { hour: 6, title: 'Crew systems review', detail: 'Life support, comms, and vehicle configuration are reviewed with the crew on board.', category: 'systems' },
  { hour: 24, title: 'Translunar injection window', detail: 'Mission operations complete the handoff from orbital checkout to outbound lunar transfer.', category: 'trajectory' },
  { hour: 36, title: 'Deep-space handover', detail: 'Orion transitions into a steadier cislunar cruise posture.', category: 'trajectory' },
  { hour: 60, title: 'Navigation corridor update', detail: 'Guidance teams confirm the vehicle remains within its planned lunar approach corridor.', category: 'trajectory' },
  { hour: 78, title: 'Lunar approach', detail: 'The spacecraft enters the high-attention period leading into the flyby.', category: 'lunar' },
  { hour: 84, title: 'Closest lunar approach', detail: 'Artemis II reaches its signature moment near the Moon and validates the crewed free-return path.', category: 'lunar' },
  { hour: 96, title: 'Return trajectory confirmed', detail: 'The mission exits the lunar vicinity and commits fully to the return leg.', category: 'return' },
  { hour: 132, title: 'Midcourse systems check', detail: 'Teams review consumables, cabin state, and guidance performance for the long ride home.', category: 'return' },
  { hour: 180, title: 'Recovery planning sync', detail: 'Return operations shift toward Earth-interface procedures and recovery coordination.', category: 'return' },
  { hour: 216, title: 'Reentry prep', detail: 'Crew and ground teams align for the final atmospheric return sequence.', category: 'return' },
  { hour: 236, title: 'Entry corridor lock', detail: 'Orion is aligned for the final high-energy return through Earth’s atmosphere.', category: 'return' },
  { hour: 240, title: 'Splashdown', detail: 'The spacecraft completes the mission with ocean recovery and post-flight handoff.', category: 'return' },
]

function getBriefingFallback(name: string): MissionBriefing {
  return BRIEFINGS[name] || BRIEFINGS['Return Trajectory']
}

function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function quadraticPoint(start: { x: number; y: number }, control: { x: number; y: number }, end: { x: number; y: number }, t: number) {
  const inverse = 1 - t

  return {
    x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
    y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
  }
}

export function clampMissionHour(hour: number) {
  return clamp(hour, 0, MAX_MISSION_HOURS)
}

export function getReplayProgress(hour: number) {
  return (clampMissionHour(hour) / MAX_MISSION_HOURS) * 100
}

export function getReplayPhase(phases: MissionPhaseWindow[], hour: number) {
  const clamped = clampMissionHour(hour)
  return (
    phases.find((phase) => clamped >= phase.startHour && clamped < phase.endHour) ||
    phases[phases.length - 1] ||
    { name: 'Return Trajectory', startHour: 96, endHour: 216 }
  )
}

export function getPhaseCompletion(phase: MissionPhaseWindow, hour: number) {
  return clamp(((clampMissionHour(hour) - phase.startHour) / (phase.endHour - phase.startHour)) * 100, 0, 100)
}

export function getDistanceFromEarthKm(hour: number) {
  const currentHour = clampMissionHour(hour)

  if (currentHour <= 24) return Math.round(lerp(400, 18000, currentHour / 24))
  if (currentHour <= 72) return Math.round(lerp(18000, MAX_DISTANCE_KM, (currentHour - 24) / 48))
  if (currentHour <= 96) return Math.round(lerp(MAX_DISTANCE_KM, 390000, (currentHour - 72) / 24))
  if (currentHour <= 216) return Math.round(lerp(390000, 12000, (currentHour - 96) / 120))
  return Math.round(lerp(12000, 0, (currentHour - 216) / 24))
}

export function getVelocityKmS(hour: number) {
  const currentHour = clampMissionHour(hour)

  if (currentHour <= 24) return Number(lerp(7.8, 8.4, currentHour / 24).toFixed(1))
  if (currentHour <= 72) return Number(lerp(8.4, 1.1, (currentHour - 24) / 48).toFixed(1))
  if (currentHour <= 96) return Number(lerp(1.1, 1.6, (currentHour - 72) / 24).toFixed(1))
  if (currentHour <= 216) return Number(lerp(1.6, 7.4, (currentHour - 96) / 120).toFixed(1))
  return Number(lerp(7.4, 11.0, (currentHour - 216) / 24).toFixed(1))
}

export function getTrajectoryLabel(hour: number) {
  const currentHour = clampMissionHour(hour)

  if (currentHour < 24) return 'Earth orbital checkout'
  if (currentHour < 72) return 'Outbound translunar cruise'
  if (currentHour < 96) return 'Lunar flyby corridor'
  if (currentHour < 216) return 'Inbound free-return arc'
  return 'Earth reentry corridor'
}

export function getReplayEvents() {
  return EVENTS
}

export function getLatestReplayEvents(hour: number, count = 6) {
  return EVENTS.filter((event) => event.hour <= clampMissionHour(hour)).slice(-count).reverse()
}

export function getUpcomingReplayEvent(hour: number) {
  return EVENTS.find((event) => event.hour > clampMissionHour(hour)) || null
}

export function getMissionBriefing(name: string) {
  return getBriefingFallback(name)
}

export function getCrewFocus(hour: number) {
  const currentHour = clampMissionHour(hour)

  if (currentHour < 24) return 'Crew is validating cockpit procedures, life support, and mission rhythm.'
  if (currentHour < 72) return 'Crew operations shift to deep-space navigation, systems confidence, and outbound mission tempo.'
  if (currentHour < 96) return 'Crew is focused on precision operations, observation, and the signature lunar flyby sequence.'
  if (currentHour < 216) return 'Crew maintains long-duration discipline while preparing for the return architecture to pay off safely.'
  return 'Crew transitions into a tightly choreographed reentry and recovery posture.'
}

export function getTrajectoryPoint(hour: number) {
  const currentHour = clampMissionHour(hour)
  const earth = { x: 110, y: 190 }
  const moon = { x: 594, y: 96 }
  const splashdown = { x: 152, y: 224 }

  if (currentHour <= 96) {
    return quadraticPoint(earth, { x: 340, y: 12 }, moon, currentHour / 96)
  }

  return quadraticPoint(moon, { x: 400, y: 286 }, splashdown, (currentHour - 96) / 144)
}
