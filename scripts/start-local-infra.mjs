/**
 * Local Postgres + Redis without Docker.
 * Data and downloaded binaries stay in gitignored `.local/`.
 *
 * Started by `npm run dev`. Keep this process running while you develop.
 */
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { log } from "./terminal-log.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localDir = path.join(root, ".local");
const pgDataDir = path.join(localDir, "pgdata");
const redisDir = path.join(localDir, "redis");
const redisZip = path.join(localDir, "redis.zip");
const redisUrl =
  "https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip";
const isWin = process.platform === "win32";

mkdirSync(localDir, { recursive: true });

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" }, () => {
      socket.end();
      resolve(true);
    });
    socket.setTimeout(400, () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(false));
  });
}

async function hydratePostgresBinaries() {
  const platforms = [
    "windows-x64",
    "darwin-arm64",
    "darwin-x64",
    "linux-x64",
    "linux-arm64",
  ];
  for (const platform of platforms) {
    const script = path.join(
      root,
      "node_modules",
      "@embedded-postgres",
      platform,
      "scripts",
      "hydrate-symlinks.js",
    );
    if (existsSync(script)) {
      await run(process.execPath, [script], path.dirname(path.dirname(script)));
    }
  }
}

function waitForExit(child, name) {
  child.on("exit", (code, signal) => {
    if (code || signal) {
      log.warn(`${name} exited code=${code ?? "null"} signal=${signal || ""}`);
    }
  });
}

async function download(url, dest) {
  if (existsSync(dest)) return;
  log.info(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Download failed ${res.status} ${url}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: "inherit", windowsHide: true });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
  });
}

function findRedisServerOnPath() {
  const cmd = isWin ? "where" : "which";
  const result = spawnSync(cmd, ["redis-server"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).find(Boolean)?.trim() ?? null;
}

async function startPostgres() {
  if (await isPortOpen(5432)) {
    log.success("Postgres already running on localhost:5432");
    return null;
  }

  const pg = new EmbeddedPostgres({
    databaseDir: pgDataDir,
    user: "postgres",
    password: "postgres",
    port: 5432,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: (message) => process.stdout.write(`[postgres] ${message}`),
    onError: (message) => process.stderr.write(`[postgres] ${message}`),
  });

  if (!existsSync(path.join(pgDataDir, "PG_VERSION"))) {
    log.info("Initializing Postgres cluster in .local/pgdata …");
    await pg.initialise();
  }

  log.info("Starting Postgres on localhost:5432 …");
  await pg.start();

  try {
    await pg.createDatabase("smart_filter");
    log.success("Created database smart_filter");
  } catch (error) {
    const text = String(error?.message || error);
    if (!/already exists/i.test(text)) throw error;
    log.info("Database smart_filter already exists");
  }

  return pg;
}

async function startRedis() {
  if (await isPortOpen(6379)) {
    log.success("Redis already running on localhost:6379");
    return null;
  }

  let redisExe = path.join(redisDir, "redis-server.exe");
  if (isWin) {
    mkdirSync(redisDir, { recursive: true });
    if (!existsSync(redisExe)) {
      await download(redisUrl, redisZip);
      await run("tar", ["-xf", redisZip, "-C", redisDir]);
    }
    if (!existsSync(redisExe)) {
      throw new Error("redis-server.exe not found after extract");
    }
  } else {
    redisExe = findRedisServerOnPath();
    if (!redisExe) {
      throw new Error(
        "Redis is not installed. Install it (brew install redis / sudo apt install redis-server) or run docker compose up -d.",
      );
    }
  }

  log.info("Starting Redis on localhost:6379 …");
  const args = isWin
    ? ["--port", "6379"]
    : ["--port", "6379", "--save", "", "--appendonly", "no"];
  const child = spawn(redisExe, args, {
    cwd: isWin ? redisDir : root,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  waitForExit(child, "redis");
  child.stdout.on("data", (buf) => process.stdout.write(`[redis] ${buf}`));
  child.stderr.on("data", (buf) => process.stderr.write(`[redis] ${buf}`));
  return child;
}

await hydratePostgresBinaries();
const pg = await startPostgres();
const redisChild = await startRedis();

log.success("INFRA_READY postgres=localhost:5432 redis=localhost:6379");
log.info("Keep this window open. Ctrl+C stops local Postgres/Redis.");

const shutdown = async () => {
  try {
    redisChild?.kill();
  } catch {
    /* ignore */
  }
  try {
    await pg?.stop();
  } catch {
    /* ignore */
  }
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await new Promise(() => {});
