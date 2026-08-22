/**
 * `npm run dev` — one terminal for local development.
 *
 * Starts Postgres + Redis (no Docker required), Prisma migrate,
 * the sync worker, and the Shopify app.
 *
 * Extra Shopify CLI flags pass through:
 *   npm run dev -- --reset
 *
 * Shopify-only (split terminals): npm run dev:shopify
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chalk, log } from "./terminal-log.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const children = [];
let shuttingDown = false;

loadDotEnv();

function loadDotEnv() {
  const envFile = path.join(root, ".env");
  if (!existsSync(envFile)) return;
  for (const raw of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key.includes(" ") || process.env[key]) continue;
    process.env[key] = line.slice(eq + 1).trim();
  }
}

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

async function waitForPort(port, label, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(port)) return;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out waiting for ${label} on localhost:${port}`);
}

function prefixChild(child, tag) {
  const write = (buf, stream) => {
    const text = buf.toString();
    const tagLabel =
      tag === "infra" ? chalk.dim(`[${tag}]`) : chalk.magenta(`[${tag}]`);
    for (const line of text.split(/\r?\n/)) {
      if (line.length) stream.write(`${tagLabel} ${line}\n`);
    }
  };
  child.stdout?.on("data", (buf) => write(buf, process.stdout));
  child.stderr?.on("data", (buf) => write(buf, process.stderr));
}

function spawnTracked(command, args, { tag, inherit = false, cwd = root, shell = false } = {}) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    windowsHide: !inherit,
    shell,
  });
  if (!inherit) prefixChild(child, tag);
  children.push(child);
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    log.warn(`[dev] ${tag} exited code=${code ?? "null"} signal=${signal || ""}`);
    if (tag === "shopify") void shutdown(code ?? 0);
  });
  return child;
}

function killTree(child) {
  if (!child?.pid || child.killed) return;
  if (isWin) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  child.kill("SIGTERM");
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("[dev] Stopping worker and app…");
  for (const child of [...children].reverse()) {
    killTree(child);
  }
  process.exit(code);
}

function runPrisma(args) {
  const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");
  return (
    spawnSync(process.execPath, [prismaCli, ...args], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    }).status ?? 1
  );
}

async function ensureInfra() {
  const pgUp = await isPortOpen(5432);
  const redisUp = await isPortOpen(6379);
  if (pgUp && redisUp) {
    log.success("[dev] Postgres and Redis already running");
    return;
  }

  const localInfra = path.join(root, "scripts", "start-local-infra.mjs");
  if (!existsSync(localInfra)) {
    throw new Error("Missing scripts/start-local-infra.mjs");
  }

  const embeddedPg = path.join(root, "node_modules", "embedded-postgres");
  if (!existsSync(embeddedPg)) {
    throw new Error("Missing embedded-postgres. Run npm install and retry.");
  }

  log.info("[dev] Starting local Postgres + Redis (no Docker)…");
  const infra = spawnTracked(process.execPath, [localInfra], {
    tag: "infra",
  });

  const infraFailed = new Promise((_, reject) => {
    infra.on("exit", (code) => {
      if (shuttingDown) return;
      reject(
        new Error(
          `Local Postgres/Redis exited (code ${code ?? "null"}). Check [infra] logs above.`,
        ),
      );
    });
  });

  const waits = [];
  if (!pgUp) waits.push(waitForPort(5432, "Postgres"));
  if (!redisUp) waits.push(waitForPort(6379, "Redis"));
  await Promise.race([Promise.all(waits), infraFailed]);
}

function preparePrisma() {
  log.info("[dev] Prisma generate + migrate…");
  const generateStatus = runPrisma(["generate"]);
  if (generateStatus !== 0) {
    const engine = path.join(
      root,
      "node_modules",
      ".prisma",
      "client",
      "query_engine-windows.dll.node",
    );
    if (!(isWin && existsSync(engine))) {
      throw new Error("prisma generate failed");
    }
    log.warn("[dev] prisma generate skipped (engine file locked). Reusing existing client.");
  }
  if (runPrisma(["migrate", "deploy"]) !== 0) {
    throw new Error("prisma migrate deploy failed");
  }
}

try {
  log.info("[dev] Starting Findly stack: infra + worker + Shopify app");
  await ensureInfra();
  preparePrisma();

  log.info("[dev] Minifying theme extension JS (100 KB app-block limit)…");
  const minifyScript = path.join(root, "scripts", "minify-theme-extension.mjs");
  const minifyOnce = spawnSync(process.execPath, [minifyScript], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if ((minifyOnce.status ?? 1) !== 0) {
    throw new Error("theme extension minify failed");
  }
  spawnTracked(process.execPath, [minifyScript, "--watch"], { tag: "minify" });
} catch (error) {
  log.error(`[dev] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

log.info("[dev] Starting sync worker…");
spawnTracked(
  process.execPath,
  [
    "--watch",
    "--watch-path=app",
    "--import",
    "tsx",
    "app/workers/index.ts",
  ],
  {
    tag: "worker",
  },
);

log.info("[dev] Starting Shopify app…");
spawnTracked(
  process.execPath,
  [
    path.join(root, "node_modules", "@shopify", "cli", "bin", "run.js"),
    "app",
    "dev",
    ...process.argv.slice(2),
  ],
  {
    tag: "shopify",
    inherit: true,
  },
);

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
