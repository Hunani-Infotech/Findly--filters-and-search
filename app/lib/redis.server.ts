import IORedis from "ioredis";
import { log } from "./log.server";

declare global {
  // eslint-disable-next-line no-var
  var redisGlobal: IORedis | undefined;
}

function createRedis() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const client = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...(url.startsWith("rediss://") ? { tls: {} } : {}),
  });
  client.on("error", (error) => {
    log.warn("[redis]", error);
  });
  return client;
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
