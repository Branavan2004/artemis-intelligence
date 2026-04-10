export const MISSION_COMPLETE_FALLBACK = {
  telemetry: {
    trajectory: {
      distanceFromEarthKm: 0,
      distanceFromMoonKm: 0,
      speedKmS: 0,
      positionVector: { x: 0, y: 0, z: 0 },
      source: 'JPL Horizons (Fallback)',
      timestamp: new Date().toISOString()
    },
    spaceWeather: {
      riskLevel: 'nominal',
      solarFlares: [],
      coronalMassEjections: [],
      geomagneticStorms: [],
      source: 'NASA DONKI (Fallback)',
      timestamp: new Date().toISOString()
    },
    missionStatus: 'Complete',
    isLive: false,
    splashdownDate: '2024-03-10',
    crewStatus: 'Recovered',
    signalDelay: 0
  },
  dsn: {
    stations: [],
    orionInContact: false,
    missionStatus: 'Mission Complete - Splashdown Confirmed',
    isLive: false,
    fetchedAt: new Date().toISOString(),
    source: 'NASA DSN Now (Fallback)'
  },
  mission: {
    name: 'Artemis II',
    currentPhase: 'Post-Mission',
    progress: 100,
    status: 'Complete',
    isLive: false,
    launchDate: '2026-04-01T22:35:00Z',
    duration: '10 days'
  }
};
