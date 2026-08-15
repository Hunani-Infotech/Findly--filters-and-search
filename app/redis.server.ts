import IORedis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var redisGlobal: IORedis | undefined;
}

function createRedis() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  return new IORedis(url, {
    maxRetriesPerRequest: null,
  });
}

export function getRedis() {
  if (!global.redisGlobal) {
    global.redisGlobal = createRedis();
  }
  return global.redisGlobal;
}
