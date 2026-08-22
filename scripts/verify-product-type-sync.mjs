/**
 * Fast product-type sync check. Does not run full catalog ingest.
 * Usage: node --env-file=.env --import tsx ./scripts/verify-product-type-sync.mjs
 */
import { PrismaClient } from "@prisma/client";
import { mapProductToFacet } from "../app/sync/product-mapper.ts";
import { unauthenticated } from "../app/shopify.server.ts";

const SHOP = "findly-test-store.myshopify.com";
const prisma = new PrismaClient();

const PAGE = `#graphql
  query ProductsPage($cursor: String) {
    products(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes { id handle title productType }
    }
  }
`;

function fail(message) {
  console.error("FAIL", message);
  process.exitCode = 1;
}

try {
  const mapped = mapProductToFacet("shop_test", {
    id: "gid://shopify/Product/1",
    handle: "trail-jacket",
    title: "Trail Jacket",
    productType: "Outerwear",
  });
  if (mapped.facet.productType !== "Outerwear") {
    fail(`mapper productType=${mapped.facet.productType}`);
  } else {
    console.log("OK mapper stores GraphQL productType");
  }

  const snake = mapProductToFacet("shop_test", {
    id: "gid://shopify/Product/2",
    handle: "beanie",
    title: "Beanie",
    product_type: "Accessories",
  });
  if (snake.facet.productType !== "Accessories") {
    fail(`mapper product_type fallback=${snake.facet.productType}`);
  } else {
    console.log("OK mapper stores REST product_type fallback");
  }

  const shopRow = await prisma.shop.findUnique({ where: { domain: SHOP } });
  if (!shopRow) throw new Error(`shop ${SHOP} missing`);

  console.log("Fetching live Shopify products…");
  const { admin } = await unauthenticated.admin(SHOP);
  const live = [];
  let cursor = null;
  do {
    const res = await admin.graphql(PAGE, { variables: { cursor } });
    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    const conn = json.data.products;
    live.push(...conn.nodes);
    cursor = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
  } while (cursor);
  console.log(`OK Shopify live products: ${live.length}`);

  console.log("Loading DB catalog…");
  const dbRows = await prisma.productFacet.findMany({
    where: { shopId: shopRow.id },
    select: { productGid: true, handle: true, productType: true },
  });
  const dbByGid = new Map(dbRows.map((row) => [row.productGid, row]));
  console.log(`OK DB products: ${dbRows.length}`);

  const liveTypeCounts = {};
  const liveGids = [];
  const mismatches = [];
  let missing = 0;
  const missingHandles = [];

  for (const product of live) {
    liveGids.push(product.id);
    const type = product.productType || "(empty)";
    liveTypeCounts[type] = (liveTypeCounts[type] || 0) + 1;
    const row = dbByGid.get(product.id);
    if (!row) {
      missing += 1;
      if (missingHandles.length < 8) missingHandles.push(product.handle);
      continue;
    }
    const shopifyType = product.productType || "";
    if (row.productType !== shopifyType) {
      mismatches.push({
        handle: product.handle,
        db: row.productType || "(empty)",
        shopify: shopifyType || "(empty)",
      });
    }
  }

  const emptyBefore = dbRows.filter((row) => !row.productType).length;
  console.log(
    JSON.stringify(
      {
        shopifyLive: live.length,
        dbBefore: dbRows.length,
        emptyProductTypeBefore: emptyBefore,
        indexedLive: live.length - missing,
        liveNotInDb: missing,
        missingHandles,
        productTypeMismatches: mismatches.length,
        mismatches: mismatches.slice(0, 10),
        shopifyTypeCounts: liveTypeCounts,
      },
      null,
      2,
    ),
  );

  if (mismatches.length) {
    for (const product of live) {
      const row = dbByGid.get(product.id);
      if (!row || row.productType === (product.productType || "")) continue;
      await prisma.productFacet.update({
        where: {
          shopId_productGid: { shopId: shopRow.id, productGid: product.id },
        },
        data: { productType: product.productType || "" },
      });
    }
    console.log(`Updated ${mismatches.length} productType row(s)`);
  }

  const staleGids = dbRows
    .filter((row) => !liveGids.includes(row.productGid))
    .map((row) => row.productGid);
  let pruned = 0;
  if (staleGids.length) {
    console.log(`Pruning ${staleGids.length} stale DB products…`);
    const removed = await prisma.productFacet.deleteMany({
      where: { shopId: shopRow.id, productGid: { in: staleGids } },
    });
    pruned = removed.count;
    await prisma.collectionMembership.deleteMany({
      where: { shopId: shopRow.id, productGid: { in: staleGids } },
    });
    console.log(`OK pruned ${pruned} stale products`);
  }

  await prisma.syncJob.update({
    where: { shopId: shopRow.id },
    data: { status: "READY", errorLog: null },
  });

  const remaining = await prisma.productFacet.groupBy({
    by: ["productType"],
    where: { shopId: shopRow.id },
    _count: { productType: true },
    orderBy: { _count: { productType: "desc" } },
  });
  const dbCount = await prisma.productFacet.count({
    where: { shopId: shopRow.id },
  });
  const empty = await prisma.productFacet.count({
    where: { shopId: shopRow.id, productType: "" },
  });

  console.log(
    JSON.stringify(
      {
        dbAfter: dbCount,
        emptyProductType: empty,
        stalePruned: pruned,
        dbTypeCounts: remaining,
      },
      null,
      2,
    ),
  );

  if (live.length && empty === 0 && missing === 0 && mismatches.length === 0) {
    console.log("OK productType sync matches Shopify for every live product");
  } else if (live.length && mismatches.length === 0 && empty === 0) {
    console.log(
      `OK productType matches for indexed products; ${missing} live products not in DB yet`,
    );
  } else if (!process.exitCode) {
    fail(
      `productType gaps: empty=${empty} missingInDb=${missing} mismatches=${mismatches.length}`,
    );
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await prisma.$disconnect();
  process.exit(process.exitCode ?? 0);
}
