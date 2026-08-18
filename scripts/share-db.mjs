/**
 * Host-only: share THIS machine's local Postgres. Other developers do not run this.
 *
 *   npm run share:db
 *
 * Send them the single DATABASE_URL this prints. They keep REDIS_URL on localhost.
 * Keep this process running. Ctrl+C stops the tunnel.
 * Postgres must already be up (`npm run dev` or `npm run dev:infra`).
 *
 * Uses Windows OpenSSH + Pinggy TCP. Do not download extra tunnel exes —
 * Windows Defender blocks them (spawn UNKNOWN).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./terminal-log.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localDir = path.join(root, ".local");
const knownHosts = path.join(localDir, "pinggy_known_hosts");
const askPass = path.join(localDir, "empty-ssh-pass.cmd");

function isOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port }, () => {
      socket.end();
      resolve(true);
    });
    socket.setTimeout(600, () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(false));
  });
}

function findSsh() {
  const fromWhere = spawnSync(process.platform === "win32" ? "where" : "which", ["ssh"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const found = fromWhere.stdout?.split(/\r?\n/).find(Boolean)?.trim();
  if (found && existsSync(found)) return found;

  const bundled = path.join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "OpenSSH",
    "ssh.exe",
  );
  if (existsSync(bundled)) return bundled;
  return null;
}

function printUrl(url) {
  console.log("");
  log.info("Send this ONE line to the other developer (same Wi-Fi or different Wi-Fi):");
  console.log(`DATABASE_URL=${url}`);
  console.log("");
  log.warn(
    "Anyone with this URL can read your local database. Stop this script when they are done.",
  );
  log.info("Keep this process running. Ctrl+C closes the tunnel. Free tunnels last about 60 minutes.");
}

function parseTcpEndpoint(text) {
  const match =
    text.match(/tcp:\/\/([A-Za-z0-9.-]+):(\d+)/i) ||
    text.match(/\b([A-Za-z0-9.-]+\.pinggy\.(?:link|online|io)):(\d+)\b/i);
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}

const localUp = await isOpen("127.0.0.1", 5432);
if (!localUp) {
  log.error(
    "Postgres is not running on localhost:5432. Start npm run dev:infra or npm run dev first, and keep it running.",
  );
  process.exit(1);
}

const sshExe = findSsh();
if (!sshExe) {
  log.error("OpenSSH was not found. Install the Windows OpenSSH Client optional feature, then retry.");
  process.exit(1);
}

mkdirSync(localDir, { recursive: true });
writeFileSync(askPass, "@echo off\r\necho(\r\n");

log.info("Opening a public TCP tunnel to localhost:5432 (keep this window open)…");

const ssh = spawn(
  sshExe,
  [
    "-4",
    "-T",
    "-p",
    "443",
    "-R",
    "0:127.0.0.1:5432",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    `UserKnownHostsFile=${knownHosts}`,
    "-o",
    "PreferredAuthentications=password",
    "-o",
    "PubkeyAuthentication=no",
    "-o",
    "KbdInteractiveAuthentication=no",
    "-o",
    "NumberOfPasswordPrompts=1",
    "-o",
    "ServerAliveInterval=30",
    "-o",
    "ServerAliveCountMax=3",
    "-o",
    "ExitOnForwardFailure=yes",
    "-o",
    "LogLevel=ERROR",
    "tcp@a.pinggy.io",
  ],
  {
    cwd: root,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY || "localhost:0",
      SSH_ASKPASS: askPass,
      SSH_ASKPASS_REQUIRE: "force",
    },
  },
);

ssh.on("error", (error) => {
  log.error(`Could not start the tunnel (${error.code || error.message}).`);
  process.exit(1);
});

let announced = false;
const onChunk = (buf) => {
  const text = buf.toString();
  process.stdout.write(`[tunnel] ${text}`);
  if (announced) return;
  const hostPort = parseTcpEndpoint(text);
  if (!hostPort) return;
  announced = true;
  printUrl(`postgresql://postgres:postgres@${hostPort}/smart_filter?schema=public`);
};

ssh.stdout.on("data", onChunk);
ssh.stderr.on("data", onChunk);
ssh.on("exit", (code, signal) => {
  if (!announced) {
    log.error(
      "Tunnel closed before a public DATABASE_URL was printed. Check the [tunnel] lines above.",
    );
  }
  process.exit(code || (signal ? 1 : 0));
});
