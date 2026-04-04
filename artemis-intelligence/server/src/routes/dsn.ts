import { Router, Request, Response } from 'express'
import { XMLParser } from 'fast-xml-parser'
import { getRedis } from '../services/redis'

const DSN_FEED_URL = 'https://eyes.nasa.gov/dsn/data/dsn.xml'
const DSN_CACHE_KEY = 'dsn:live'
const SPEED_OF_LIGHT_KM_S = 299792

type StationId = 'gdscc' | 'mdscc' | 'cdscc'

interface StationLocation {
  lat: number
  lng: number
}

interface StationConfig {
  friendlyName: string
  location: StationLocation
}

interface SignalSummary {
  dataRateBps: number
  powerDbm: number
  frequencyMhz: number
}

interface ActiveDishSummary {
  name: string
  friendlyName: string
  downlink: SignalSummary | null
  uplink: SignalSummary | null
  rangeKm: number
  lightTimeSeconds: number
}

interface DSNStation {
  id: StationId
  friendlyName: string
  location: StationLocation
  isActive: boolean
  activeDish: ActiveDishSummary | null
}

interface DSNPayload {
  stations: DSNStation[]
  orionInContact: boolean
  fetchedAt: string
  source: 'NASA DSN Now'
}

interface ParsedStationNode {
  name?: string
  friendlyName?: string
}

interface ParsedTargetNode {
  name?: string
  id?: string | number
  uplegRange?: string | number
  downlegRange?: string | number
}

interface ParsedSignalNode {
  active?: string
  signalType?: string
  dataRate?: string | number
  frequency?: string | number
  power?: string | number
  spacecraft?: string
  spacecraftID?: string | number
}

interface ParsedDishNode {
  name?: string
  friendlyName?: string
  stationName?: string
  target?: ParsedTargetNode | ParsedTargetNode[]
  downSignal?: ParsedSignalNode | ParsedSignalNode[]
  upSignal?: ParsedSignalNode | ParsedSignalNode[]
}

interface ParsedDsnDocument {
  dsn?: {
    station?: ParsedStationNode | ParsedStationNode[]
    dish?: ParsedDishNode | ParsedDishNode[]
    timestamp?: string | number
  }
}

const STATION_CONFIG: Record<StationId, StationConfig> = {
  gdscc: {
    friendlyName: 'Goldstone',
    location: { lat: 35.4267, lng: -116.89 },
  },
  mdscc: {
    friendlyName: 'Madrid',
    location: { lat: 40.4314, lng: -4.2481 },
  },
  cdscc: {
    friendlyName: 'Canberra',
    location: { lat: -35.4014, lng: 148.9817 },
  },
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  trimValues: true,
})

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function parseNumber(value: string | number | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeMissionLabel(value: string | number | undefined) {
  if (value === undefined) return ''
  return String(value).trim().toUpperCase()
}

function matchesOrionMission(value: string | number | undefined) {
  const label = normalizeMissionLabel(value)
  const compact = label.replace(/[^A-Z0-9]/g, '')

  return (
    compact.includes('ARTEM') ||
    compact.includes('ORION') ||
    compact === 'EM2' ||
    compact === 'EMII' ||
    compact === 'EXPLORATIONMISSION2' ||
    compact === 'EXPLORATIONMISSIONII' ||
    label === '-64' ||
    label === '-24'
  )
}

function parseDishNumber(dishName: string | undefined) {
  const match = dishName?.match(/DSS\s*0*(\d+)/i)
  return match ? Number(match[1]) : null
}

function getStationIdForDish(dish: ParsedDishNode): StationId | null {
  const stationName = normalizeMissionLabel(dish.stationName).toLowerCase()

  if (Object.hasOwn(STATION_CONFIG, stationName)) {
    return stationName as StationId
  }

  const dishNumber = parseDishNumber(dish.name)

  if (dishNumber === null) {
    return null
  }

  // The DSN dish numbering scheme is stable enough to infer the complex when
  // the feed omits a direct station identifier.
  if (dishNumber >= 10 && dishNumber < 30) return 'gdscc'
  if (dishNumber >= 30 && dishNumber < 50) return 'cdscc'
  if (dishNumber >= 50 && dishNumber < 70) return 'mdscc'

  return null
}

function dishMatchesOrionMission(dish: ParsedDishNode) {
  const targets = ensureArray(dish.target)

  if (targets.some((target) => matchesOrionMission(target.name) || matchesOrionMission(target.id))) {
    return true
  }

  const signals = [...ensureArray(dish.downSignal), ...ensureArray(dish.upSignal)]

  return signals.some((signal) => matchesOrionMission(signal.spacecraft) || matchesOrionMission(signal.spacecraftID))
}

function getMatchingTarget(dish: ParsedDishNode) {
  const targets = ensureArray(dish.target)

  return (
    targets.find((target) => matchesOrionMission(target.name) || matchesOrionMission(target.id)) ||
    targets[0] ||
    null
  )
}

function getFetchedAt(timestamp: string | number | undefined) {
  const parsed = parseNumber(timestamp)

  if (parsed !== null && parsed > 0) {
    return new Date(parsed).toISOString()
  }

  return new Date().toISOString()
}

function getSignalSummary(signal: ParsedSignalNode | undefined): SignalSummary | null {
  if (!signal) return null

  const dataRateBps = parseNumber(signal.dataRate)
  const powerDbm = parseNumber(signal.power)
  const frequencyMhz = parseNumber(signal.frequency)

  if (dataRateBps === null || powerDbm === null || frequencyMhz === null) {
    return null
  }

  return {
    dataRateBps,
    powerDbm,
    frequencyMhz,
  }
}

function getDataSignal(signals: ParsedSignalNode | ParsedSignalNode[] | undefined) {
  const signalList = ensureArray(signals)
  return signalList.find((signal) => (signal.signalType || '').toLowerCase() === 'data') || signalList[0]
}

function buildActiveDish(dish: ParsedDishNode, target: ParsedTargetNode): ActiveDishSummary {
  const downlink = getSignalSummary(getDataSignal(dish.downSignal))
  const uplink = getSignalSummary(getDataSignal(dish.upSignal))
  const downlegRange = parseNumber(target.downlegRange)
  const uplegRange = parseNumber(target.uplegRange)
  const rangeKm = Math.round(downlegRange ?? uplegRange ?? 0)
  const lightTimeSeconds = Number((((uplegRange ?? rangeKm) || 0) / SPEED_OF_LIGHT_KM_S).toFixed(1))

  return {
    name: dish.name || 'Unknown dish',
    friendlyName: dish.friendlyName || dish.name || 'Unknown dish',
    downlink,
    uplink,
    rangeKm,
    lightTimeSeconds,
  }
}

async function fetchDsnPayload(): Promise<DSNPayload> {
  const response = await fetch(DSN_FEED_URL, {
    signal: AbortSignal.timeout(6000),
  })

  if (!response.ok) {
    throw new Error(`DSN feed request failed with status ${response.status}`)
  }

  const xml = await response.text()
  const parsed = parser.parse(xml) as ParsedDsnDocument
  const stations = ensureArray(parsed.dsn?.station)
  const dishes = ensureArray(parsed.dsn?.dish)
  const fetchedAt = getFetchedAt(parsed.dsn?.timestamp)

  const stationFriendlyNames = new Map(
    stations
      .filter((station): station is ParsedStationNode & { name: string } => Boolean(station.name))
      .map((station) => [station.name!.toLowerCase(), station.friendlyName || station.name!]),
  )

  const activeDishesByStation = new Map<StationId, ActiveDishSummary>()

  for (const dish of dishes) {
    const stationName = getStationIdForDish(dish)

    if (!stationName) {
      continue
    }

    if (!dishMatchesOrionMission(dish)) {
      continue
    }

    const target = getMatchingTarget(dish)

    if (!target) {
      continue
    }

    activeDishesByStation.set(stationName, buildActiveDish(dish, target))
  }

  const stationList = (Object.entries(STATION_CONFIG) as [StationId, StationConfig][]).map(([id, config]) => ({
    id,
    friendlyName: stationFriendlyNames.get(id) || config.friendlyName,
    location: config.location,
    isActive: activeDishesByStation.has(id),
    activeDish: activeDishesByStation.get(id) || null,
  }))

  return {
    stations: stationList,
    orionInContact: stationList.some((station) => station.isActive),
    fetchedAt,
    source: 'NASA DSN Now',
  }
}

const dsnRoutes = Router()

dsnRoutes.get('/', async (_req: Request, res: Response) => {
  try {
    const redis = getRedis()
    const cached = await redis.get(DSN_CACHE_KEY)

    if (cached) {
      res.json(JSON.parse(cached) as DSNPayload)
      return
    }

    const payload = await fetchDsnPayload()

    await redis.setex(DSN_CACHE_KEY, 8, JSON.stringify(payload))
    res.json(payload)
  } catch (error) {
    console.error('DSN route failed:', error)
    res.status(503).json({ error: 'DSN feed unavailable' })
  }
})

export default dsnRoutes
