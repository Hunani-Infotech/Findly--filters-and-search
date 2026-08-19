/**
 * F1 gate: Year / Make / Model vehicle finder.
 * Usage: npm run verify:f1
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import {
  cascadeOptions,
  DEFAULT_YMM_FIELDS,
  fieldAllowsValue,
  parseFitmentLine,
  parseYmmCsv,
  uniqueHandles,
} from "../app/ymm.ts";

const SHOP_DOMAIN = "f1-verify.myshopify.com";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function readRepo(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

function optionValues(options) {
  return (options ?? []).map((item) => item.value);
}

function assertStaticMarkers() {
  const ymm = readRepo("app", "ymm.ts");
  for (const name of ["parseFitmentLine", "cascadeOptions", "uniqueHandles"]) {
    if (!ymm.includes(`function ${name}`) && !ymm.includes(`export function ${name}`)) {
      fail(`app/ymm.ts missing ${name}`);
    }
  }

  const ymmServer = readRepo("app", "ymm.server.ts");
  if (!ymmServer.includes("ymmSearchPayload")) {
    fail("app/ymm.server.ts missing ymmSearchPayload");
  }

  const liquid = readRepo(
    "extensions",
    "smart-filter",
    "blocks",
    "vehicle-finder.liquid",
  );
  if (!liquid.includes("data-proxy-base")) {
    fail("vehicle-finder.liquid missing data-proxy-base");
  }

  const widget = readRepo(
    "extensions",
    "smart-filter",
    "assets",
    "vehicle-finder.js",
  );
  if (!widget.includes('params.set("intent"') && !widget.includes("intent=search")) {
    fail("vehicle-finder.js missing ymm intent query");
  }

  readRepo("app", "routes", "apps.smart-filter.ymm.tsx");
  log.info("F1 static markers present");
}

function assertLogicWithoutShop() {
  const parsed = parseFitmentLine("2020|Toyota|Camry");
  if (parsed.length !== 3 || parsed[0] !== "2020" || parsed[1] !== "Toyota" || parsed[2] !== "Camry") {
    fail(`parseFitmentLine expected ["2020","Toyota","Camry"], got ${JSON.stringify(parsed)}`);
  }

  const handles = uniqueHandles(
    [
      { handle: "camry-filter", values: ["2020", "Toyota", "Camry"] },
      { handle: "civic-filter", values: ["2019", "Honda", "Civic"] },
    ],
    ["2020", "Toyota"],
  );
  if (handles.length !== 1 || handles[0] !== "camry-filter") {
    fail(`uniqueHandles expected only camry-filter, got ${JSON.stringify(handles)}`);
  }

  const fitments = [
    { values: ["2020", "Toyota", "Camry"] },
    { values: ["2020", "Honda", "Civic"] },
    { values: ["2019", "Honda", "Civic"] },
  ];
  const years = optionValues(cascadeOptions(DEFAULT_YMM_FIELDS, fitments, []));
  if (!years.includes("2020") || !years.includes("2019")) {
    fail(`cascade years expected 2020 and 2019, got ${JSON.stringify(years)}`);
  }
  const makes = optionValues(cascadeOptions(DEFAULT_YMM_FIELDS, fitments, ["2020"]));
  if (!makes.includes("Toyota") || !makes.includes("Honda")) {
    fail(`cascade makes for 2020 expected Toyota and Honda, got ${JSON.stringify(makes)}`);
  }
  const models = optionValues(
    cascadeOptions(DEFAULT_YMM_FIELDS, fitments, ["2020", "Toyota"]),
  );
  if (models.length !== 1 || models[0] !== "Camry") {
    fail(`cascade models expected Camry only, got ${JSON.stringify(models)}`);
  }

  const yearPrefixField = {
    ...DEFAULT_YMM_FIELDS[0],
    valueMode: "prefix",
    prefix: "20",
  };
  if (!fieldAllowsValue(yearPrefixField, "2020")) {
    fail('fieldAllowsValue year prefix "20" should allow 2020');
  }
  if (fieldAllowsValue(yearPrefixField, "1999")) {
    fail('fieldAllowsValue year prefix "20" should reject 1999');
  }
  const prefixFields = [yearPrefixField, DEFAULT_YMM_FIELDS[1], DEFAULT_YMM_FIELDS[2]];
  const prefixFitments = [
    ...fitments,
    { values: ["1999", "Ford", "Taurus"] },
  ];
  const prefixYears = optionValues(cascadeOptions(prefixFields, prefixFitments, []));
  if (!prefixYears.includes("2020") || !prefixYears.includes("2019")) {
    fail(`prefix cascade years missing 20xx, got ${JSON.stringify(prefixYears)}`);
  }
  if (prefixYears.includes("1999")) {
    fail("prefix cascade years should exclude 1999");
  }

  const csvRows = parseYmmCsv(
    "Year,Make,Model,Product handle\n2020,Toyota,Camry,camry-filter\n",
  );
  if (
    csvRows.length !== 1 ||
    csvRows[0].handle !== "camry-filter" ||
    csvRows[0].values.join("|") !== "2020|Toyota|Camry"
  ) {
    fail(`parseYmmCsv sample mismatch: ${JSON.stringify(csvRows)}`);
  }

  log.info("F1 logic tests (no shop) passed");
}

async function seedProduct(shopId, { gid, handle, title, metafields }) {
  await prisma.productFacet.create({
    data: {
      shopId,
      productGid: gid,
      handle,
      title,
      vendor: "Findly",
      productType: "Vehicle",
      tags: [],
      options: {},
      priceMin: 10,
      priceMax: 10,
      available: true,
      status: "ACTIVE",
      imageUrl: null,
      metafields,
    },
  });
}

async function cleanup() {
  await prisma.shop.deleteMany({ where: { domain: SHOP_DOMAIN } });
}

try {
  await cleanup();
  assertStaticMarkers();
  assertLogicWithoutShop();

  const shop = await prisma.shop.create({
    data: { domain: SHOP_DOMAIN, plan: "free" },
  });
  await prisma.appSettings.create({
    data: {
      shopId: shop.id,
      adminExtras: {
        ymm: {
          enabled: true,
          metafieldPath: "custom.vehicle_fitment",
          fields: DEFAULT_YMM_FIELDS,
          rows: [{ handle: "f150-filter", values: ["2021", "Ford", "F-150"] }],
        },
      },
    },
  });

  await seedProduct(shop.id, {
    gid: "gid://shopify/Product/f1-camry",
    handle: "camry-filter",
    title: "Camry Filter",
    metafields: { "custom.vehicle_fitment": "2020|Toyota|Camry" },
  });
  await seedProduct(shop.id, {
    gid: "gid://shopify/Product/f1-civic",
    handle: "civic-filter",
    title: "Civic Filter",
    metafields: { "custom.vehicle_fitment": "2019|Honda|Civic" },
  });
  await seedProduct(shop.id, {
    gid: "gid://shopify/Product/f1-f150",
    handle: "f150-filter",
    title: "F-150 Filter",
    metafields: {},
  });

  const { ymmSearchPayload, ymmOptionsPayload } = await import("../app/ymm.server.ts");

  const toyotaSearch = await ymmSearchPayload(SHOP_DOMAIN, ["2020", "Toyota"]);
  if ("error" in toyotaSearch && toyotaSearch.error) fail(toyotaSearch.error);
  const toyotaHandles = toyotaSearch.data?.handles ?? [];
  if (toyotaHandles.length !== 1 || toyotaHandles[0] !== "camry-filter") {
    fail(
      `ymmSearchPayload 2020 Toyota expected ONLY camry-filter, got ${JSON.stringify(toyotaHandles)}`,
    );
  }

  const yearOptions = await ymmOptionsPayload(SHOP_DOMAIN, ["2020"]);
  if ("error" in yearOptions && yearOptions.error) fail(yearOptions.error);
  const makeValues = optionValues(yearOptions.data?.options);
  if (!makeValues.includes("Toyota")) {
    fail(`ymmOptionsPayload 2020 makes missing Toyota, got ${JSON.stringify(makeValues)}`);
  }
  if (makeValues.includes("Honda") || makeValues.includes("Civic") || makeValues.includes("2019")) {
    fail(
      `ymmOptionsPayload 2020 should not include Honda / Civic / year, got ${JSON.stringify(makeValues)}`,
    );
  }

  const fordSearch = await ymmSearchPayload(SHOP_DOMAIN, ["2021", "Ford"]);
  if ("error" in fordSearch && fordSearch.error) fail(fordSearch.error);
  const fordHandles = fordSearch.data?.handles ?? [];
  if (!fordHandles.includes("f150-filter")) {
    fail(`ymmSearchPayload 2021 Ford expected f150-filter, got ${JSON.stringify(fordHandles)}`);
  }

  await cleanup();
  log.info("STEPF1_OK");
} catch (error) {
  await cleanup().catch(() => undefined);
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
