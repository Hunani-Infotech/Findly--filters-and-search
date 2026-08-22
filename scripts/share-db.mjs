/**
 * Host-only: share THIS machine's local Postgres through Cloudflare Tunnel.
 * Follows the Hunani Cloudflare setup doc (new tunnel, new subdomain, no root DNS change).
 *
 *   npm run share:db
 *
 * Other developers do not run this. They run `npm run share:db:connect`.
 * Postgres must already be up (`npm run dev` or `npm run dev:infra`).
 * Never commit a Cloudflare tunnel token.
 */
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./terminal-log.mjs";
import { findCloudflared, loadDotEnv, queryCloudflaredService } from "./share-db-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotEnv(root);

const hostname =
  process.env.SHARE_DB_HOSTNAME?.trim() || "appdb.hunaniinfotech.com";
const localPort = process.env.SHARE_DB_LOCAL_PORT?.trim() || "15432";
const cloudflared = findCloudflared();

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

if (!(await isOpen("127.0.0.1", 5432))) {
  log.error(
    "Postgres is not running on localhost:5432. Start npm run dev:infra or npm run dev first, and keep it running.",
  );
  process.exit(1);
}

if (!cloudflared) {
  log.error(
    "cloudflared was not found. Install it (your setup doc: C:\\Cloudflared\\bin\\cloudflared.exe) then retry.",
  );
  process.exit(1);
}

const service = queryCloudflaredService();
if (service !== "RUNNING") {
  log.info("Cloudflare Tunnel is not installed as a Windows service yet.");
  log.info("Use the same rules as the Cloudflare Local App Setup doc, with TCP for Postgres:");
  console.log(`
1. Cloudflare dashboard (account that owns hunaniinfotech.com)
   Zero Trust → Networks → Tunnels → Create a NEW tunnel
   Name example: appdb-tunnel
   Do NOT reuse an old computer's tunnel token.

2. Windows connector — copy the install command. Keep the token private
   (never git, chat, or this repo).

3. Public hostname (NEW subdomain only — do not change hunaniinfotech.com root DNS):
   Hostname: ${hostname}
   Type:     TCP
   URL:      tcp://localhost:5432

   Cloudflare will add a CNAME for ${hostname}. Do not delete existing website records.

4. Admin Command Prompt:
   "${cloudflared}" service install <YOUR_TUNNEL_TOKEN>
   net start cloudflared

5. Confirm the tunnel shows Healthy in the dashboard, then run:
   npm run share:db
`);
  log.warn(`cloudflared service state: ${service}. Finish the steps above, then re-run this command.`);
  process.exit(1);
}

log.success(`Postgres is up on localhost:5432. cloudflared service is ${service}.`);
log.info(`Public hostname: ${hostname}`);
console.log("");
log.info("This PC keeps:");
console.log(
  "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_filter?schema=public",
);
console.log("");
log.info("Send the other developer these two things (they run connect on THEIR PC):");
console.log("  npm run share:db:connect");
console.log(`  SHARE_DB_HOSTNAME=${hostname}`);
console.log("");
log.info("Or they run:");
console.log(
  `  cloudflared access tcp --hostname ${hostname} --url 127.0.0.1:${localPort}`,
);
console.log(
  `  DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:${localPort}/smart_filter?schema=public`,
);
console.log("");
log.warn(
  `Do not put ${hostname} itself in DATABASE_URL. Prisma must talk to 127.0.0.1:${localPort} after cloudflared access.`,
);
log.info("Keep this PC on, keep Postgres running, and leave the cloudflared Windows service running.");
