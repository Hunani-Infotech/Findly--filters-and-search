/**
 * Step 7 gate: admin metafield mapping → filter API payload includes mapped facets.
 * Usage: npm run verify:a7
 */
import "tsx/esm";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

const SHOP_DOMAIN = "a7-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9007001";
const PRODUCT_GID = "gid://shopify/Product/9007001";

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

async function cleanup() {
  await prisma.shop.deleteMany({ where: { domain: SHOP_DOMAIN } });
}

async function seedShopData() {
  const shop = await prisma.shop.upsert({
    where: { domain: SHOP_DOMAIN },
    create: { domain: SHOP_DOMAIN, plan: "standard" },
    update: { uninstalledAt: null, plan: "standard" },
  });
  await prisma.subscription.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      planName: "Findly Standard",
      status: "ACTIVE",
      productLimit: 200,
      filterLimit: 6,
    },
    update: {
      planName: "Findly Standard",
      status: "ACTIVE",
      productLimit: 200,
      filterLimit: 6,
    },
  });

  await seedFilterConfig(prisma, shop.id, {
    collectionGid: COLLECTION_GID,
    enabled: true,
    enablePrice: true,
    enableAvailability: true,
    enableVendor: false,
    enableProductType: false,
    enableTags: false,
    enableOptions: false,
  });

  await prisma.collection.upsert({
    where: {
      shopId_collectionGid: { shopId: shop.id, collectionGid: COLLECTION_GID },
    },
    create: {
      shopId: shop.id,
      collectionGid: COLLECTION_GID,
      title: "A7 Verify Collection",
      handle: "a7-verify",
    },
    update: { title: "A7 Verify Collection" },
  });

  const metafields = {
    "custom.material": "cotton",
    "custom.weight_g": "180",
    "custom.waterproof": "true",
  };

  await prisma.productFacet.upsert({
    where: {
      shopId_productGid: { shopId: shop.id, productGid: PRODUCT_GID },
    },
    create: {
      shopId: shop.id,
      productGid: PRODUCT_GID,
      handle: "a7-cotton-tee",
      title: "A7 Cotton Tee",
      vendor: "A7 Labs",
      productType: "Apparel",
      tags: ["a7-verify"],
      options: {},
      priceMin: 24.99,
      priceMax: 24.99,
      available: true,
      status: "ACTIVE",
      metafields,
    },
    update: { metafields, status: "ACTIVE" },
  });

  await prisma.collectionMembership.upsert({
    where: {
      shopId_collectionGid_productGid: {
        shopId: shop.id,
        collectionGid: COLLECTION_GID,
        productGid: PRODUCT_GID,
      },
    },
    create: {
      shopId: shop.id,
      collectionGid: COLLECTION_GID,
      productGid: PRODUCT_GID,
    },
    update: {},
  });

  for (const [namespace, key, sampleValue] of [
    ["custom", "material", "cotton"],
    ["custom", "weight_g", "180"],
    ["custom", "waterproof", "true"],
  ]) {
    await prisma.discoveredMetafield.upsert({
      where: {
        shopId_namespace_key_ownerType: {
          shopId: shop.id,
          namespace,
          key,
          ownerType: "PRODUCT",
        },
      },
      create: { shopId: shop.id, namespace, key, sampleValue },
      update: { sampleValue },
    });
  }

  const mappingDefs = [
    {
      namespace: "custom",
      key: "material",
      displayLabel: "Material",
      filterType: "LIST",
      enabled: true,
      sortOrder: 0,
    },
    {
      namespace: "custom",
      key: "weight_g",
      displayLabel: "Weight",
      filterType: "RANGE",
      enabled: true,
      sortOrder: 1,
    },
    {
      namespace: "custom",
      key: "waterproof",
      displayLabel: "Waterproof",
      filterType: "BOOLEAN",
      enabled: true,
      sortOrder: 2,
    },
  ];

  for (const mapping of mappingDefs) {
    await prisma.metafieldMapping.upsert({
      where: {
        shopId_namespace_key_ownerType: {
          shopId: shop.id,
          namespace: mapping.namespace,
          key: mapping.key,
          ownerType: "PRODUCT",
        },
      },
      create: { shopId: shop.id, ...mapping },
      update: {
        displayLabel: mapping.displayLabel,
        filterType: mapping.filterType,
        enabled: mapping.enabled,
        sortOrder: mapping.sortOrder,
      },
    });
  }

  return shop;
}

function findMetafieldFacet(facets, keySuffix) {
  return facets.find(
    (facet) =>
      facet.source === "metafield" &&
      (facet.key === `mf_custom_${keySuffix}` ||
        facet.key?.endsWith(`_${keySuffix}`)),
  );
}

try {
  await cleanup();
  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN} (id=${shop.id})`);

  const { getCollectionFilterPayload } = await import("../app/services/proxy.server.ts");
  const result = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: {},
  });

  if (result.error || !result.data?.enabled) {
    fail(
      `getCollectionFilterPayload failed: ${result.error ?? "filters disabled or empty payload"}`,
    );
  }

  const facets = result.data.facets ?? [];
  const materialFacet = findMetafieldFacet(facets, "material");
  const weightFacet = findMetafieldFacet(facets, "weight_g");

  if (!materialFacet) {
    fail("filter payload missing metafield facet for custom.material");
  }
  if (materialFacet.type !== "checkbox") {
    fail(
      `custom.material facet type expected checkbox, got ${materialFacet.type}`,
    );
  }

  if (!weightFacet) {
    fail("filter payload missing metafield facet for custom.weight_g");
  }
  if (weightFacet.type !== "range") {
    fail(`custom.weight_g facet type expected range, got ${weightFacet.type}`);
  }

  const waterproofFacet = findMetafieldFacet(facets, "waterproof");
  if (!waterproofFacet) {
    fail("filter payload missing metafield facet for custom.waterproof");
  }
  if (waterproofFacet.type !== "boolean") {
    fail(
      `custom.waterproof BOOLEAN facet type expected boolean, got ${waterproofFacet.type}`,
    );
  }

  log.info(`metafield facet (LIST/material): ${JSON.stringify(materialFacet)}`);
  log.info(`metafield facet (RANGE/weight_g): ${JSON.stringify(weightFacet)}`);
  log.info(
    `metafield facet (BOOLEAN/waterproof Yes/No): ${JSON.stringify(waterproofFacet)}`,
  );

  const { enforcePlanLimits, PLANS, isDevUnlockLimits } = await import("../app/services/billing.server.ts"
  );

  if (PLANS.standard.filterLimit !== 6) {
    fail(`PLANS.standard.filterLimit expected 6, got ${PLANS.standard.filterLimit}`);
  }
  if (PLANS.pro.filterLimit !== 15) {
    fail(`PLANS.pro.filterLimit expected 15, got ${PLANS.pro.filterLimit}`);
  }

  const limitsWithThree = await enforcePlanLimits(shop.id);
  const devUnlocked = isDevUnlockLimits();

  if (devUnlocked) {
    log.info(
      `DEV_UNLOCK_LIMITS=true — runtime filterLimit=${limitsWithThree.filterLimit} (PLANS.standard.filterLimit still ${PLANS.standard.filterLimit})`,
    );
  } else if (limitsWithThree.filterLimit !== 6) {
    fail(
      `standard plan filterLimit expected 6, got ${limitsWithThree.filterLimit}`,
    );
  }

  if (limitsWithThree.filterCount !== 3) {
    fail(`expected 3 metafield mappings, got ${limitsWithThree.filterCount}`);
  }

  const sevenEnabledWouldExceed = 7 > PLANS.standard.filterLimit;
  if (!sevenEnabledWouldExceed) {
    fail("7 enabled mappings should exceed standard plan cap of 6");
  }
  log.info(
    `plan cap check: 7 enabled mappings > standard filterLimit ${PLANS.standard.filterLimit}`,
  );

  const extraKeys = ["extra_a", "extra_b", "extra_c", "extra_d"];
  await prisma.productFacet.update({
    where: {
      shopId_productGid: { shopId: shop.id, productGid: PRODUCT_GID },
    },
    data: {
      metafields: {
        "custom.material": "cotton",
        "custom.weight_g": "180",
        "custom.waterproof": "true",
        "custom.extra_a": "a",
        "custom.extra_b": "b",
        "custom.extra_c": "c",
        "custom.extra_d": "d",
      },
    },
  });
  for (const [index, key] of extraKeys.entries()) {
    await prisma.metafieldMapping.create({
      data: {
        shopId: shop.id,
        namespace: "custom",
        key,
        displayLabel: `Extra ${key}`,
        filterType: "LIST",
        enabled: true,
        sortOrder: 10 + index,
      },
    });
  }

  const limitsWithSeven = await enforcePlanLimits(shop.id);
  if (limitsWithSeven.filterCount !== 7) {
    fail(`expected 7 metafield mappings after seed, got ${limitsWithSeven.filterCount}`);
  }

  if (devUnlocked) {
    if (limitsWithSeven.overFilterLimit) {
      fail(
        "DEV_UNLOCK_LIMITS should not mark 7 mappings as over development unlock cap",
      );
    }
  } else {
    if (!limitsWithSeven.overFilterLimit) {
      fail("7 enabled mappings should exceed standard plan filterLimit of 6");
    }
    log.info(
      `enforcePlanLimits rejects 7 mappings on standard: filterCount=${limitsWithSeven.filterCount} filterLimit=${limitsWithSeven.filterLimit} overFilterLimit=${limitsWithSeven.overFilterLimit}`,
    );
  }

  const cappedPayload = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: {},
  });
  const cappedFacets = (cappedPayload.data?.facets ?? []).filter(
    (facet) => facet.source === "metafield",
  );
  if (cappedFacets.length > limitsWithSeven.filterLimit) {
    fail(
      `storefront payload returned ${cappedFacets.length} metafield facets; cap is ${limitsWithSeven.filterLimit}`,
    );
  }
  if (!devUnlocked && cappedFacets.length !== PLANS.standard.filterLimit) {
    fail(
      `standard plan payload should include ${PLANS.standard.filterLimit} metafield facets, got ${cappedFacets.length}`,
    );
  }
  log.info(
    `storefront payload capped metafield facets=${cappedFacets.length} (limit=${limitsWithSeven.filterLimit})`,
  );
  if (!devUnlocked) {
    if (findMetafieldFacet(cappedFacets, "extra_d")) {
      fail("standard plan payload should drop the 7th mapping custom.extra_d");
    }
    if (!findMetafieldFacet(cappedFacets, "extra_c")) {
      fail("standard plan payload should still include the 6th mapping custom.extra_c");
    }
  }

  const persisted = await prisma.metafieldMapping.findMany({
    where: {
      shopId: shop.id,
      key: { in: ["material", "weight_g", "waterproof"] },
    },
    orderBy: { sortOrder: "asc" },
  });

  const expected = [
    { key: "material", displayLabel: "Material", filterType: "LIST" },
    { key: "weight_g", displayLabel: "Weight", filterType: "RANGE" },
    { key: "waterproof", displayLabel: "Waterproof", filterType: "BOOLEAN" },
  ];

  for (const exp of expected) {
    const row = persisted.find((item) => item.key === exp.key);
    if (!row) {
      fail(`MetafieldMapping missing after save: custom.${exp.key}`);
    }
    if (row.displayLabel !== exp.displayLabel || row.filterType !== exp.filterType) {
      fail(
        `MetafieldMapping custom.${exp.key} persistence mismatch: got label=${row.displayLabel} type=${row.filterType}`,
      );
    }
  }
  log.info("MetafieldMapping labels and filterTypes persisted correctly");

  log.success(
    "STEP7_OK metafield mappings appear in filter payload; plan caps verified",
  );
} catch (error) {
  log.error(`STEP7_FAIL ${error.message}`);
  if (error.stack) console.error(error.stack);
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
    log.info(`Cleaned up shop ${SHOP_DOMAIN}`);
  } catch (cleanupError) {
    log.warn(`Cleanup failed for ${SHOP_DOMAIN}: ${cleanupError.message}`);
  }
  await prisma.$disconnect();
}
