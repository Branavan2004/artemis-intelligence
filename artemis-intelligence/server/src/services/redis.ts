import Redis from 'ioredis';

let redis: Redis | null = null;
let redisReady = false;
let redisDisabled = false;
let redisWarningShown = false;

function warnRedisUnavailable(error?: unknown): void {
  if (redisWarningShown) return;

  redisWarningShown = true;
  console.warn('Redis unavailable, continuing without cache.');

  if (process.env.DEBUG_REDIS === 'true' && error) {
    console.warn(error);
  }
}

function isRedisUsable(): boolean {
  return Boolean(redis) && redisReady && !redisDisabled;
}

export async function initRedis(): Promise<void> {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  redis = new Redis(redisUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });

  redis.on('ready', () => {
    redisReady = true;
    redisDisabled = false;
    redisWarningShown = false;
    console.log('📦 Redis connected');
  });

  redis.on('close', () => {
    redisReady = false;
  });

  redis.on('end', () => {
    redisReady = false;
  });

  redis.on('error', (err) => {
    redisReady = false;
    warnRedisUnavailable(err);
  });

  try {
    await redis.connect();
  } catch (error) {
    redisDisabled = true;
    redisReady = false;
    warnRedisUnavailable(error);
    redis.disconnect();
  }
}

export function getRedis(): Redis | null {
  return isRedisUsable() ? redis : null;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;

  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    redisReady = false;
    warnRedisUnavailable(error);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (error) {
    redisReady = false;
    warnRedisUnavailable(error);
  }
}

export async function cacheDel(key: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.del(key);
  } catch (error) {
    redisReady = false;
    warnRedisUnavailable(error);
  }
}
