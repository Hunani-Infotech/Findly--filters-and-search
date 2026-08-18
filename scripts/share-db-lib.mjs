import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function loadDotEnv(root) {
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

export function findCloudflared() {
  const fromWhere = spawnSync("where", ["cloudflared"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const found = fromWhere.stdout?.split(/\r?\n/).find(Boolean)?.trim();
  if (found && existsSync(found)) return found;

  const candidates = [
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "cloudflared", "cloudflared.exe"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "cloudflared", "cloudflared.exe"),
    "C:\\Cloudflared\\bin\\cloudflared.exe",
  ];
  return candidates.find((file) => existsSync(file)) ?? null;
}

export function queryCloudflaredService() {
  const result = spawnSync("sc.exe", ["query", "cloudflared"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const text = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (/1060/.test(text) || /does not exist/i.test(text)) return "NOT_INSTALLED";
  const state = text.match(/STATE\s*:\s*\d+\s+(\w+)/i);
  return (state?.[1] || "UNKNOWN").toUpperCase();
}
