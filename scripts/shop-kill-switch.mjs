/**
 * Set the app-installation metafield findly.disabled for one shop or every
 * installed shop. Not a public route. Uses the stored offline Session.
 *
 * Usage:
 *   node ./scripts/shop-kill-switch.mjs --shop <domain> --on
 *   node ./scripts/shop-kill-switch.mjs --shop <domain> --off
 *   node ./scripts/shop-kill-switch.mjs --all --on
 *   node ./scripts/shop-kill-switch.mjs --all --off
 *
 * --all asks for YES on stdin. A shop with no offline session is skipped.
 */
import { createInterface } from "node:readline/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "./prisma-runtime.mjs";

const API_VERSION = "2026-07";
const NAMESPACE = "findly";
const KEY = "disabled";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv() {
  try {
    const raw = readFileSync(join(ROOT, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    /* DATABASE_URL may already be in the environment */
  }
}

function usage() {
  console.error(
    "Usage: node ./scripts/shop-kill-switch.mjs --shop <domain> --on|--off",
  );
  console.error(
    "       node ./scripts/shop-kill-switch.mjs --all --on|--off",
  );
}

function parseArgs(argv) {
  let shop = "";
  let all = false;
  let on = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--shop") {
      shop = String(argv[++i] || "").trim();
    } else if (arg.startsWith("--shop=")) {
      shop = arg.slice("--shop=".length).trim();
    } else if (arg === "--all") {
      all = true;
    } else if (arg === "--on") {
      on = true;
    } else if (arg === "--off") {
      on = false;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (on === null || (all && shop) || (!all && !shop)) {
    usage();
    throw new Error("Pass either --shop <domain> or --all, and exactly one of --on or --off.");
  }
  return { shop, all, on };
}

async function adminGraphql(shop, accessToken, query, variables) {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors?.length) {
    throw new Error(
      `Admin GraphQL failed for ${shop}: ${JSON.stringify(json.errors || json)}`,
    );
  }
  return json.data;
}

const INSTALL_QUERY = `query FindlyKillSwitchRead {
  currentAppInstallation {
    id
    metafield(namespace: "${NAMESPACE}", key: "${KEY}") {
      namespace
      key
      type
      value
    }
  }
}`;

const DEFINITION_CREATE = `mutation FindlyKillSwitchDefine($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    createdDefinition { id namespace key type { name } }
    userErrors { field message code }
  }
}`;

const SET_MUTATION = `mutation FindlyKillSwitchSet($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { namespace key type value }
    userErrors { field message code }
  }
}`;

const DEFINITION_READ = `query FindlyKillSwitchDefinition {
  metafieldDefinitions(first: 5, ownerType: APP, namespace: "${NAMESPACE}", key: "${KEY}") {
    nodes {
      id
      namespace
      key
      name
      ownerType
      access {
        admin
        storefront
      }
    }
  }
}`;

function definitionTaken(errors) {
  const text = JSON.stringify(errors || []).toLowerCase();
  return (
    text.includes("taken") ||
    text.includes("already exists") ||
    text.includes("in use") ||
    text.includes("key is in use")
  );
}

async function ensureDefinition(shop, accessToken) {
  const data = await adminGraphql(shop, accessToken, DEFINITION_CREATE, {
    definition: {
      name: "Findly disabled",
      namespace: NAMESPACE,
      key: KEY,
      type: "boolean",
      ownerType: "APP",
      access: { admin: "MERCHANT_READ", storefront: "PUBLIC_READ" },
    },
  });
  const errors = data?.metafieldDefinitionCreate?.userErrors || [];
  if (errors.length && !definitionTaken(errors)) {
    throw new Error(
      `metafieldDefinitionCreate userErrors for ${shop}: ${JSON.stringify(errors)}`,
    );
  }
}

async function setDisabled(shop, accessToken, on) {
  const current = await adminGraphql(shop, accessToken, INSTALL_QUERY);
  const ownerId = current?.currentAppInstallation?.id;
  if (!ownerId) {
    throw new Error(`currentAppInstallation.id missing for ${shop}`);
  }
  await ensureDefinition(shop, accessToken);
  const written = await adminGraphql(shop, accessToken, SET_MUTATION, {
    metafields: [
      {
        ownerId,
        namespace: NAMESPACE,
        key: KEY,
        type: "boolean",
        value: on ? "true" : "false",
      },
    ],
  });
  const errors = written?.metafieldsSet?.userErrors || [];
  if (errors.length) {
    throw new Error(`metafieldsSet userErrors for ${shop}: ${JSON.stringify(errors)}`);
  }
  const read = await adminGraphql(shop, accessToken, INSTALL_QUERY);
  const metafield = read?.currentAppInstallation?.metafield;
  console.log(
    `${shop} findly.disabled owner=AppInstallation namespace=${NAMESPACE} key=${KEY} type=${metafield?.type || "boolean"} value=${metafield?.value ?? "(missing)"}`,
  );
  const defined = await adminGraphql(shop, accessToken, DEFINITION_READ);
  const nodes = defined?.metafieldDefinitions?.nodes || [];
  console.log(
    `${shop} metafieldDefinitions findly/disabled: ${JSON.stringify(nodes)}`,
  );
  if (String(metafield?.value) !== (on ? "true" : "false")) {
    throw new Error(
      `Read-back for ${shop} was ${JSON.stringify(metafield?.value)}, expected ${on ? "true" : "false"}`,
    );
  }
}

async function confirmAll(count, on) {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(
      `Set findly.disabled=${on ? "true" : "false"} on ${count} installed shop(s). Type YES to continue: `,
    );
    return answer.trim() === "YES";
  } finally {
    rl.close();
  }
}

loadDotEnv();
const prisma = createPrismaClient();

try {
  const args = parseArgs(process.argv.slice(2));
  const shops = args.all
    ? (
        await prisma.shop.findMany({
          where: { uninstalledAt: null },
          select: { domain: true },
          orderBy: { domain: "asc" },
        })
      ).map((row) => row.domain)
    : [args.shop];

  if (args.all) {
    if (!shops.length) {
      console.error("No installed shops (Shop.uninstalledAt is null).");
      process.exit(1);
    }
    const ok = await confirmAll(shops.length, args.on);
    if (!ok) {
      console.error("Aborted. Nothing was written.");
      process.exit(1);
    }
  }

  let failed = 0;
  for (const domain of shops) {
    const session = await prisma.session.findFirst({
      where: { shop: domain, isOnline: false },
      select: { accessToken: true },
    });
    if (!session?.accessToken) {
      failed += 1;
      console.error(
        `NO SESSION ${domain} — skipped. Install the app on that shop so an offline Session exists.`,
      );
      continue;
    }
    try {
      await setDisabled(domain, session.accessToken, args.on);
    } catch (error) {
      failed += 1;
      console.error(error instanceof Error ? error.message : String(error));
    }
  }
  if (failed) process.exit(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
