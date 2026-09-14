/**
 * Local embedded Postgres.
 * Data and downloaded binaries stay in gitignored `.local/`.
 *
 * Started by `npm run dev`. Keep this process running while you develop.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { log } from "./terminal-log.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localDir = path.join(root, ".local");
const pgDataDir = path.join(localDir, "pgdata");

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

await hydratePostgresBinaries();
const pg = await startPostgres();

log.success("INFRA_READY postgres=localhost:5432");
log.info("Keep this window open. Ctrl+C stops local Postgres.");

const shutdown = async () => {
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
