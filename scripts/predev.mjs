import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { log } from "./terminal-log.mjs";

const prismaCli = path.join("node_modules", "prisma", "build", "index.js");
const windowsEngine = path.join(
  "node_modules",
  ".prisma",
  "client",
  "query_engine-windows.dll.node",
);

function runPrisma(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    stdio: "inherit",
    env: process.env,
  });
  return result.status ?? 1;
}

const generateStatus = runPrisma(["generate"]);
if (generateStatus !== 0) {
  const engineLocked = process.platform === "win32" && existsSync(windowsEngine);
  if (!engineLocked) {
    process.exit(generateStatus);
  }
  log.warn(
    "[predev] prisma generate skipped — query engine is locked (usually npm run worker). Reusing the existing Prisma client.",
  );
}

process.exit(runPrisma(["migrate", "deploy"]));
