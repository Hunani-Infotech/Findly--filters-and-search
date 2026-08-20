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

function runPrisma(args, { capture = false } = {}) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: process.env,
    encoding: "utf8",
  });
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

const generate = runPrisma(["generate"], { capture: true });
if (generate.status !== 0) {
  const engineLocked =
    process.platform === "win32" &&
    existsSync(windowsEngine) &&
    /EPERM|operation not permitted/i.test(generate.output);
  if (!engineLocked) {
    process.stderr.write(generate.output);
    process.exit(generate.status);
  }
  log.warn(
    "[predev] prisma generate skipped — query engine is locked (usually npm run worker). Reusing the existing Prisma client.",
  );
}

process.exit(runPrisma(["migrate", "deploy"]).status);
