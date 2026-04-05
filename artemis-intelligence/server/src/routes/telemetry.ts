import { Router, Request, Response } from 'express';
import { getRedis } from '../services/redis';

const HORIZONS_API_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const DONKI_API_BASE_URL = 'https://api.nasa.gov/DONKI';
const TELEMETRY_CACHE_KEY = 'telemetry:replay:live';
const EARTH_MOON_DISTANCE_KM = 384400;
// Max plausible geocentric distance for a lunar-vicinity mission (km).
// If JPL returns beyond this, the ephemeris is for the wrong object.
const MAX_LUNAR_MISSION_DISTANCE_KM = 500_000;
const THREE_DAYS_IN_MS = 3 * 24 * 60 * 60 * 1000;

type RiskLevel = 'nominal' | 'elevated' | 'severe';

interface PositionVector {
  x: number;
  y: number;
  z: number;
}

interface TrajectoryData {
  distanceFromEarthKm: number;
  distanceFromMoonKm: number;
  speedKmS: number;
  positionVector: PositionVector;
  source: 'JPL Horizons';
  timestamp: string;
}

interface SolarFlareSummary {
  classType: string | null;
  beginTime: string | null;
  peakTime: string | null;
  sourceLocation: string | null;
}

interface CoronalMassEjectionSummary {
  activityID: string | null;
  startTime: string | null;
  sourceLocation: string | null;
  speedKmS: number | null;
}

interface GeomagneticStormSummary {
  startTime: string | null;
  maxKpIndex: number | null;
  source: string | null;
}

interface SpaceWeatherData {
  riskLevel: RiskLevel;
  solarFlares: SolarFlareSummary[];
  coronalMassEjections: CoronalMassEjectionSummary[];
  geomagneticStorms: GeomagneticStormSummary[];
  source: 'NASA DONKI';
  timestamp: string;
}

interface TelemetryPayload {
  trajectory: TrajectoryData | null;
  spaceWeather: SpaceWeatherData | null;
}

interface HorizonsApiResponse {
  result?: string;
  error?: string;
  signature?: {
    source?: string;
    version?: string;
  };
}

interface DonkiSolarFlareResponse {
  classType?: string;
  beginTime?: string;
  peakTime?: string;
  sourceLocation?: string;
}

interface DonkiCmeAnalysis {
  speed?: number | null;
}

interface DonkiCoronalMassEjectionResponse {
  activityID?: string;
  startTime?: string;
  sourceLocation?: string;
  cmeAnalyses?: DonkiCmeAnalysis[];
}

interface DonkiGeomagneticStormKp {
  kpIndex?: number | null;
  source?: string;
}

interface DonkiGeomagneticStormResponse {
  startTime?: string;
  allKpIndex?: DonkiGeomagneticStormKp[];
}

function formatDateForDonki(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDateForHorizons(date: Date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function magnitude(values: number[]) {
  return Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0));
}

function extractEphemerisLines(result: string) {
  const match = result.match(/\$\$SOE([\s\S]*?)\$\$EOE/);

  if (!match) {
    throw new Error('Horizons response did not include an ephemeris block');
  }

  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseCsvRow(line: string) {
  return line
    .split(',')
    .map((value) => value.trim())
    .filter((value, index, values) => value !== '' || index < values.length - 1);
}

function parseTrajectoryFromHorizons(result: string, requestedAt: Date): TrajectoryData {
  const dataLine = extractEphemerisLines(result).find((line) => /^\d/.test(line));

  if (!dataLine) {
    throw new Error('Horizons ephemeris block did not include a data row');
  }

  const columns = parseCsvRow(dataLine);

  if (columns.length < 8) {
    throw new Error('Horizons ephemeris row was shorter than expected');
  }

  const numericVector = columns.slice(-6).map((value) => Number(value));

  if (numericVector.some((value) => Number.isNaN(value))) {
    throw new Error('Horizons ephemeris row contained invalid numeric vector data');
  }

  const [x, y, z, vx, vy, vz] = numericVector;
  const distanceFromEarthKm = magnitude([x, y, z]);
  const speedKmS = magnitude([vx, vy, vz]);

  // Sanity-check: if the distance is implausibly large for a lunar-vicinity
  // mission, JPL returned data for the wrong object. Throw so the caller
  // falls back to simulation data.
  if (distanceFromEarthKm > MAX_LUNAR_MISSION_DISTANCE_KM) {
    throw new Error(
      `JPL Horizons returned implausible geocentric distance: ${Math.round(distanceFromEarthKm).toLocaleString()} km — ` +
      'likely wrong spacecraft ID. Falling back to simulation.'
    );
  }

  return {
    distanceFromEarthKm: Math.round(distanceFromEarthKm),
    distanceFromMoonKm: Math.round(Math.abs(EARTH_MOON_DISTANCE_KM - distanceFromEarthKm)),
    speedKmS: Number(speedKmS.toFixed(2)),
    positionVector: {
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      z: Number(z.toFixed(2)),
    },
    source: 'JPL Horizons',
    timestamp: requestedAt.toISOString(),
  };
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchTrajectoryTelemetry(): Promise<TrajectoryData> {
  const requestedAt = new Date();
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: "'-64'",
    MAKE_EPHEM: "'YES'",
    OBJ_DATA: "'NO'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@399'",
    OUT_UNITS: "'KM-S'",
    CSV_FORMAT: "'YES'",
    VEC_TABLE: "'2'",
    VEC_LABELS: "'NO'",
    TIME_TYPE: "'UT'",
    TLIST: `'${formatDateForHorizons(requestedAt)}'`,
  });

  const payload = await fetchJson<HorizonsApiResponse>(`${HORIZONS_API_URL}?${params.toString()}`, {
    signal: AbortSignal.timeout(8000),
  });

  if (payload.error) {
    throw new Error(payload.error);
  }

  if (!payload.result) {
    throw new Error('Horizons returned an empty result payload');
  }

  return parseTrajectoryFromHorizons(payload.result, requestedAt);
}

function sortByDateDesc<T>(items: T[], getValue: (item: T) => string | undefined) {
  return [...items].sort((a, b) => {
    const aTime = getValue(a) ? new Date(getValue(a) as string).getTime() : 0;
    const bTime = getValue(b) ? new Date(getValue(b) as string).getTime() : 0;
    return bTime - aTime;
  });
}

function getMaxKpIndex(storm: DonkiGeomagneticStormResponse) {
  return storm.allKpIndex?.reduce((highest, item) => {
    const value = item.kpIndex ?? 0;
    return value > highest ? value : highest;
  }, 0) ?? 0;
}

async function fetchSpaceWeatherTelemetry(): Promise<SpaceWeatherData> {
  const apiKey = process.env.NASA_API_KEY || 'DEMO_KEY';
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - THREE_DAYS_IN_MS);
  const startDateParam = formatDateForDonki(startDate);
  const endDateParam = formatDateForDonki(endDate);
  const timestamp = endDate.toISOString();

  const buildDonkiUrl = (endpoint: string) =>
    `${DONKI_API_BASE_URL}/${endpoint}?startDate=${startDateParam}&endDate=${endDateParam}&api_key=${apiKey}`;

  const [solarFlaresResult, cmesResult, stormsResult] = await Promise.allSettled([
    fetchJson<DonkiSolarFlareResponse[]>(buildDonkiUrl('FLR')),
    fetchJson<DonkiCoronalMassEjectionResponse[]>(buildDonkiUrl('CME')),
    fetchJson<DonkiGeomagneticStormResponse[]>(buildDonkiUrl('GST')),
  ]);

  const solarFlareFeed = solarFlaresResult.status === 'fulfilled' ? solarFlaresResult.value : [];
  const cmeFeed = cmesResult.status === 'fulfilled' ? cmesResult.value : [];
  const stormFeed = stormsResult.status === 'fulfilled' ? stormsResult.value : [];

  if (
    solarFlaresResult.status === 'rejected' &&
    cmesResult.status === 'rejected' &&
    stormsResult.status === 'rejected'
  ) {
    throw new Error('NASA DONKI data was unavailable');
  }

  const sortedFlares = sortByDateDesc(solarFlareFeed, (flare) => flare.peakTime || flare.beginTime);
  const sortedCmes = sortByDateDesc(cmeFeed, (cme) => cme.startTime);
  const sortedStorms = sortByDateDesc(stormFeed, (storm) => storm.startTime);

  const hasSevereFlare = solarFlareFeed.some((flare) => flare.classType?.toUpperCase().startsWith('X'));
  const hasSevereStorm = stormFeed.some((storm) => getMaxKpIndex(storm) >= 7);
  const mClassFlares = solarFlareFeed.filter((flare) => flare.classType?.toUpperCase().startsWith('M')).length;
  const cmeCount = cmeFeed.length;

  const riskLevel: RiskLevel =
    hasSevereFlare || hasSevereStorm ? 'severe' : mClassFlares >= 2 || cmeCount >= 3 ? 'elevated' : 'nominal';

  return {
    riskLevel,
    solarFlares: sortedFlares.slice(0, 5).map((flare) => ({
      classType: flare.classType || null,
      beginTime: flare.beginTime || null,
      peakTime: flare.peakTime || null,
      sourceLocation: flare.sourceLocation || null,
    })),
    coronalMassEjections: sortedCmes.slice(0, 3).map((cme) => ({
      activityID: cme.activityID || null,
      startTime: cme.startTime || null,
      sourceLocation: cme.sourceLocation || null,
      speedKmS: cme.cmeAnalyses?.[0]?.speed ?? null,
    })),
    geomagneticStorms: sortedStorms.slice(0, 3).map((storm) => ({
      startTime: storm.startTime || null,
      maxKpIndex: getMaxKpIndex(storm) || null,
      source: storm.allKpIndex?.find((item) => item.source)?.source || null,
    })),
    source: 'NASA DONKI',
    timestamp,
  };
}

export const telemetryRoutes = Router();

telemetryRoutes.get('/', async (_req: Request, res: Response) => {
  try {
    const redis = getRedis();
    const cached = await redis.get(TELEMETRY_CACHE_KEY);

    if (cached) {
      res.json(JSON.parse(cached) as TelemetryPayload);
      return;
    }

    const [trajectoryResult, spaceWeatherResult] = await Promise.allSettled([
      fetchTrajectoryTelemetry(),
      fetchSpaceWeatherTelemetry(),
    ]);

    const payload: TelemetryPayload = {
      trajectory: trajectoryResult.status === 'fulfilled' ? trajectoryResult.value : null,
      spaceWeather: spaceWeatherResult.status === 'fulfilled' ? spaceWeatherResult.value : null,
    };

    if (!payload.trajectory && !payload.spaceWeather) {
      res.status(503).json({ error: 'Telemetry sources unavailable' });
      return;
    }

    await redis.setex(TELEMETRY_CACHE_KEY, 300, JSON.stringify(payload));
    res.json(payload);
  } catch (error) {
    console.error('Telemetry route failed:', error);
    res.status(500).json({ error: 'Failed to fetch telemetry' });
  }
});
