import IORedis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var redisGlobal: IORedis | undefined;
}

function createRedis() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  return new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...(url.startsWith("rediss://") ? { tls: {} } : {}),
  });
}

/** Shared client for Queue / cache. Do not pass this to a BullMQ Worker. */
export function getRedis() {
  if (!global.redisGlobal) {
    global.redisGlobal = createRedis();
  }
  return global.redisGlobal;
}

/** Dedicated connection for BullMQ Worker (blocking commands cannot share Queue's client). */
export function createRedisConnection() {
  return createRedis();
}
