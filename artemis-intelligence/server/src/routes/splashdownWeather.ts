import { Request, Response, Router } from 'express';
import { getRedis } from '../services/redis';

const SPLASHDOWN_CACHE_KEY = 'weather:splashdown:pacific';
const SPLASHDOWN_LAT = 32.5;
const SPLASHDOWN_LON = -117.1;
const SPLASHDOWN_TIME = '2026-04-10T20:06:00-04:00' as const;
const SPLASHDOWN_HOURLY_SLOT = '2026-04-10T20:00';

type SplashdownStatus = 'GO' | 'MONITOR' | 'NO-GO';

interface MarineHourlyData {
  time: string[];
  wave_height: Array<number | null>;
  wave_direction: Array<number | null>;
  wave_period: Array<number | null>;
  wind_wave_height: Array<number | null>;
  swell_wave_height: Array<number | null>;
  swell_wave_direction: Array<number | null>;
}

interface MarineApiResponse {
  hourly?: MarineHourlyData;
}

interface ForecastHourlyData {
  time: string[];
  wind_speed_10m: Array<number | null>;
  wind_direction_10m: Array<number | null>;
  visibility: Array<number | null>;
  cloud_cover: Array<number | null>;
}

interface ForecastApiResponse {
  hourly?: ForecastHourlyData;
}

interface SplashdownWeatherPayload {
  status: SplashdownStatus;
  splashdownTime: typeof SPLASHDOWN_TIME;
  countdownMs: number;
  conditions: {
    waveHeightM: number;
    wavePeriodS: number;
    swellHeightM: number;
    windSpeedKmh: number;
    windDirectionDeg: number;
    visibilityKm: number;
    cloudCoverPct: number;
  };
  thresholds: {
    waveLimit: 2.4;
    windLimit: 55;
    visibilityMin: 1.6;
  };
  location: 'Pacific Ocean · 32.5°N 117.1°W · off San Diego';
  source: 'Open-Meteo Marine API';
  fetchedAt: string;
}

function getLiveCountdownMs() {
  return Math.max(0, new Date(SPLASHDOWN_TIME).getTime() - Date.now());
}

function withLiveCountdown(payload: SplashdownWeatherPayload): SplashdownWeatherPayload {
  return {
    ...payload,
    countdownMs: getLiveCountdownMs(),
  };
}

function buildUrl(baseUrl: string, params: Record<string, string>) {
  return `${baseUrl}?${new URLSearchParams(params).toString()}`;
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(6000),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function findHourlyIndex(times: string[]) {
  const index = times.findIndex((time) => time === SPLASHDOWN_HOURLY_SLOT);

  if (index === -1) {
    throw new Error(`Unable to find splashdown weather slot ${SPLASHDOWN_HOURLY_SLOT}`);
  }

  return index;
}

function readNumericValue(values: Array<number | null>, index: number, label: string) {
  const value = values[index];

  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Missing ${label} for splashdown time`);
  }

  return value;
}

function getStatus(waveHeightM: number, windSpeedKmh: number, visibilityKm: number): SplashdownStatus {
  const isGo =
    waveHeightM <= 2.4 &&
    windSpeedKmh <= 55 &&
    visibilityKm >= 1.6;

  if (isGo) {
    return 'GO';
  }

  if (waveHeightM > 3.5 || windSpeedKmh > 74) {
    return 'NO-GO';
  }

  return 'MONITOR';
}

async function fetchSplashdownWeather(): Promise<SplashdownWeatherPayload> {
  const marineUrl = buildUrl('https://marine-api.open-meteo.com/v1/marine', {
    latitude: String(SPLASHDOWN_LAT),
    longitude: String(SPLASHDOWN_LON),
    hourly: 'wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height,swell_wave_direction',
    wind_speed_unit: 'kmh',
    timezone: 'America/Los_Angeles',
    forecast_days: '7',
  });

  const weatherUrl = buildUrl('https://api.open-meteo.com/v1/forecast', {
    latitude: String(SPLASHDOWN_LAT),
    longitude: String(SPLASHDOWN_LON),
    hourly: 'wind_speed_10m,wind_direction_10m,visibility,cloud_cover',
    wind_speed_unit: 'kmh',
    timezone: 'America/Los_Angeles',
    forecast_days: '7',
  });

  const [marine, weather] = await Promise.all([
    fetchJson<MarineApiResponse>(marineUrl),
    fetchJson<ForecastApiResponse>(weatherUrl),
  ]);

  if (!marine.hourly || !weather.hourly) {
    throw new Error('Open-Meteo hourly payload missing');
  }

  const marineIndex = findHourlyIndex(marine.hourly.time);
  const weatherIndex = findHourlyIndex(weather.hourly.time);

  const waveHeightM = Number(readNumericValue(marine.hourly.wave_height, marineIndex, 'wave height').toFixed(1));
  const wavePeriodS = Number(readNumericValue(marine.hourly.wave_period, marineIndex, 'wave period').toFixed(1));
  const swellHeightM = Number(readNumericValue(marine.hourly.swell_wave_height, marineIndex, 'swell height').toFixed(1));
  const windSpeedKmh = Number(readNumericValue(weather.hourly.wind_speed_10m, weatherIndex, 'wind speed').toFixed(1));
  const windDirectionDeg = Number(readNumericValue(weather.hourly.wind_direction_10m, weatherIndex, 'wind direction').toFixed(0));
  const visibilityKm = Number((readNumericValue(weather.hourly.visibility, weatherIndex, 'visibility') / 1000).toFixed(1));
  const cloudCoverPct = Number(readNumericValue(weather.hourly.cloud_cover, weatherIndex, 'cloud cover').toFixed(0));

  return {
    status: getStatus(waveHeightM, windSpeedKmh, visibilityKm),
    splashdownTime: SPLASHDOWN_TIME,
    countdownMs: getLiveCountdownMs(),
    conditions: {
      waveHeightM,
      wavePeriodS,
      swellHeightM,
      windSpeedKmh,
      windDirectionDeg,
      visibilityKm,
      cloudCoverPct,
    },
    thresholds: {
      waveLimit: 2.4,
      windLimit: 55,
      visibilityMin: 1.6,
    },
    location: 'Pacific Ocean · 32.5°N 117.1°W · off San Diego',
    source: 'Open-Meteo Marine API',
    fetchedAt: new Date().toISOString(),
  };
}

const splashdownWeatherRoutes = Router();

splashdownWeatherRoutes.get('/', async (_req: Request, res: Response) => {
  try {
    const redis = getRedis();
    const cached = redis ? await redis.get(SPLASHDOWN_CACHE_KEY) : null;

    if (cached) {
      res.json(withLiveCountdown(JSON.parse(cached) as SplashdownWeatherPayload));
      return;
    }

    const payload = await fetchSplashdownWeather();
    if (redis) {
      await redis.setex(SPLASHDOWN_CACHE_KEY, 1800, JSON.stringify(payload));
    }

    res.json(withLiveCountdown(payload));
  } catch (error) {
    console.error('Splashdown weather route failed:', error);
    res.status(500).json({ error: 'Failed to fetch splashdown weather' });
  }
});

export default splashdownWeatherRoutes;
