/**
 * Seed a Shopify DEVELOPMENT store with dummy catalog data for Findly sync/filter testing.
 * Uses the offline Session from Prisma (same pattern as verify-step2.mjs).
 *
 * Usage:
 *   npm run seed:catalog
 *   node ./scripts/seed-dev-catalog.mjs
 *   node ./scripts/seed-dev-catalog.mjs --shop=findly-test-store.myshopify.com
 */
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";

const API_VERSION = "2026-07";
const TITLE_PREFIX = "[Findly Seed]";
const SEED_TAG = "findly-seed";
const SLEEP_MS = 400;

const prisma = new PrismaClient();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseShopArg(argv) {
  const flag = argv.find((a) => a.startsWith("--shop="));
  return flag ? flag.slice("--shop=".length).trim() : null;
}

function isAccessDenied(payload) {
  const text = JSON.stringify(payload ?? {});
  return (
    /ACCESS_DENIED/i.test(text) ||
    /write_products/i.test(text) ||
    /access denied/i.test(text) ||
    /permission/i.test(text)
  );
}

function printScopeHelp() {
  log.error(`ACCESS DENIED — this script writes products via productSet.
Findly does not request write_products (app runtime is catalog read + webhooks).
npm run seed:catalog cannot use the app's OAuth token.

Fix:
  1. On the development store, create a custom app with write_products
     (productSet is not part of Findly's App Store scopes).
  2. Do not add write_products back to shopify.app.toml.
  3. Seed with that custom-app Admin API token, not the Findly session.`);
}

async function adminGraphql(shop, accessToken, query, variables = {}) {
  const url = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 || res.status === 403 || isAccessDenied(json)) {
      printScopeHelp();
    }
    throw new Error(
      `HTTP ${res.status} from Admin GraphQL: ${JSON.stringify(json)}`,
    );
  }

  if (json.errors?.length) {
    if (isAccessDenied(json)) {
      printScopeHelp();
    }
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

const METAFIELD_DEFINITIONS = [
  {
    name: "Material",
    namespace: "custom",
    key: "material",
    type: "single_line_text_field",
    ownerType: "PRODUCT",
  },
  {
    name: "Waterproof",
    namespace: "custom",
    key: "waterproof",
    type: "boolean",
    ownerType: "PRODUCT",
  },
  {
    name: "Weight (g)",
    namespace: "custom",
    key: "weight_g",
    type: "number_integer",
    ownerType: "PRODUCT",
  },
];

const PRODUCT_SET_MUTATION = `#graphql
mutation SeedProductSet($synchronous: Boolean!, $input: ProductSetInput!) {
  productSet(synchronous: $synchronous, input: $input) {
    product {
      id
      title
      handle
      variants(first: 50) {
        nodes {
          id
          title
          price
        }
      }
    }
    userErrors {
      field
      message
      code
    }
  }
}`;

const METAFIELD_DEFINITION_CREATE = `#graphql
mutation SeedMetafieldDefinition($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    createdDefinition {
      id
      namespace
      key
    }
    userErrors {
      field
      message
      code
    }
  }
}`;

const METAFIELDS_SET = `#graphql
mutation SeedMetafieldsSet($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields {
      id
      namespace
      key
    }
    userErrors {
      field
      message
      code
    }
  }
}`;

const COLLECTION_CREATE = `#graphql
mutation SeedCollectionCreate($input: CollectionInput!) {
  collectionCreate(input: $input) {
    collection {
      id
      title
      handle
    }
    userErrors {
      field
      message
    }
  }
}`;

/** @type {Array<{
 *   title: string;
 *   vendor: string;
 *   productType: string;
 *   tags: string[];
 *   price?: string;
 *   options?: Array<{ name: string; values: string[] }>;
 *   variants?: Array<{ optionValues: Array<{ optionName: string; name: string }>; price: string }>;
 *   metafields: { material: string; waterproof: boolean; weight_g: number };
 *   collections: Array<"apparel" | "outdoor">;
 * }>} */
const CATALOG = [
  {
    title: `${TITLE_PREFIX} Cotton Tee`,
    vendor: "Findly Labs",
    productType: "Apparel",
    tags: [SEED_TAG, "seed", "cotton", "summer"],
    options: [
      { name: "Size", values: ["S", "M", "L"] },
      { name: "Color", values: ["Navy", "White"] },
    ],
    variants: [
      {
        optionValues: [
          { optionName: "Size", name: "S" },
          { optionName: "Color", name: "Navy" },
        ],
        price: "24.99",
      },
      {
        optionValues: [
          { optionName: "Size", name: "M" },
          { optionName: "Color", name: "Navy" },
        ],
        price: "24.99",
      },
      {
        optionValues: [
          { optionName: "Size", name: "L" },
          { optionName: "Color", name: "Navy" },
        ],
        price: "24.99",
      },
      {
        optionValues: [
          { optionName: "Size", name: "S" },
          { optionName: "Color", name: "White" },
        ],
        price: "24.99",
      },
      {
        optionValues: [
          { optionName: "Size", name: "M" },
          { optionName: "Color", name: "White" },
        ],
        price: "24.99",
      },
      {
        optionValues: [
          { optionName: "Size", name: "L" },
          { optionName: "Color", name: "White" },
        ],
        price: "24.99",
      },
    ],
    metafields: { material: "cotton", waterproof: false, weight_g: 180 },
    collections: ["apparel"],
  },
  {
    title: `${TITLE_PREFIX} Summer Hoodie`,
    vendor: "Findly Labs",
    productType: "Apparel",
    tags: [SEED_TAG, "seed", "cotton", "summer", "sale"],
    options: [
      { name: "Size", values: ["S", "M", "L", "XL"] },
      { name: "Color", values: ["Charcoal", "Sand"] },
    ],
    variants: [
      {
        optionValues: [
          { optionName: "Size", name: "S" },
          { optionName: "Color", name: "Charcoal" },
        ],
        price: "59.00",
      },
      {
        optionValues: [
          { optionName: "Size", name: "M" },
          { optionName: "Color", name: "Charcoal" },
        ],
        price: "59.00",
      },
      {
        optionValues: [
          { optionName: "Size", name: "L" },
          { optionName: "Color", name: "Charcoal" },
        ],
        price: "59.00",
      },
      {
        optionValues: [
          { optionName: "Size", name: "XL" },
          { optionName: "Color", name: "Charcoal" },
        ],
        price: "59.00",
      },
      {
        optionValues: [
          { optionName: "Size", name: "S" },
          { optionName: "Color", name: "Sand" },
        ],
        price: "54.00",
      },
      {
        optionValues: [
          { optionName: "Size", name: "M" },
          { optionName: "Color", name: "Sand" },
        ],
        price: "54.00",
      },
      {
        optionValues: [
          { optionName: "Size", name: "L" },
          { optionName: "Color", name: "Sand" },
        ],
        price: "54.00",
      },
      {
        optionValues: [
          { optionName: "Size", name: "XL" },
          { optionName: "Color", name: "Sand" },
        ],
        price: "54.00",
      },
    ],
    metafields: { material: "cotton blend", waterproof: false, weight_g: 420 },
    collections: ["apparel"],
  },
  {
    title: `${TITLE_PREFIX} Trail Jacket`,
    vendor: "Acme Outfitters",
    productType: "Apparel",
    tags: [SEED_TAG, "seed", "outdoor", "limited"],
    options: [
      { name: "Size", values: ["M", "L", "XL"] },
      { name: "Color", values: ["Olive", "Black"] },
    ],
    variants: [
      {
        optionValues: [
          { optionName: "Size", name: "M" },
          { optionName: "Color", name: "Olive" },
        ],
        price: "129.00",
      },
      {
        optionValues: [
          { optionName: "Size", name: "L" },
          { optionName: "Color", name: "Olive" },
        ],
        price: "129.00",
      },
      {
        optionValues: [
          { optionName: "Size", name: "XL" },
          { optionName: "Color", name: "Olive" },
        ],
        price: "129.00",
      },
      {
        optionValues: [
          { optionName: "Size", name: "M" },
          { optionName: "Color", name: "Black" },
        ],
        price: "149.00",
      },
      {
        optionValues: [
          { optionName: "Size", name: "L" },
          { optionName: "Color", name: "Black" },
        ],
        price: "149.00",
      },
      {
        optionValues: [
          { optionName: "Size", name: "XL" },
          { optionName: "Color", name: "Black" },
        ],
        price: "149.00",
      },
    ],
    metafields: { material: "nylon", waterproof: true, weight_g: 680 },
    collections: ["apparel", "outdoor"],
  },
  {
    title: `${TITLE_PREFIX} Canvas Cap`,
    vendor: "Northwind Goods",
    productType: "Accessories",
    tags: [SEED_TAG, "seed", "sale"],
    price: "18.50",
    metafields: { material: "canvas", waterproof: false, weight_g: 95 },
    collections: [],
  },
  {
    title: `${TITLE_PREFIX} Leather Belt`,
    vendor: "Acme Outfitters",
    productType: "Accessories",
    tags: [SEED_TAG, "seed", "limited"],
    price: "39.00",
    metafields: { material: "leather", waterproof: false, weight_g: 220 },
    collections: [],
  },
  {
    title: `${TITLE_PREFIX} Sport Socks 3-Pack`,
    vendor: "Findly Labs",
    productType: "Apparel",
    tags: [SEED_TAG, "seed", "cotton"],
    price: "12.99",
    metafields: { material: "cotton", waterproof: false, weight_g: 110 },
    collections: ["apparel"],
  },
  {
    title: `${TITLE_PREFIX} Desk Lamp`,
    vendor: "Northwind Goods",
    productType: "Home",
    tags: [SEED_TAG, "seed"],
    price: "45.00",
    metafields: { material: "metal", waterproof: false, weight_g: 1100 },
    collections: [],
  },
  {
    title: `${TITLE_PREFIX} Throw Pillow`,
    vendor: "Northwind Goods",
    productType: "Home",
    tags: [SEED_TAG, "seed", "cotton"],
    price: "22.00",
    metafields: { material: "cotton", waterproof: false, weight_g: 350 },
    collections: [],
  },
  {
    title: `${TITLE_PREFIX} Outdoor Blanket`,
    vendor: "Acme Outfitters",
    productType: "Home",
    tags: [SEED_TAG, "seed", "outdoor"],
    price: "79.00",
    metafields: { material: "polyester", waterproof: true, weight_g: 900 },
    collections: ["outdoor"],
  },
  {
    title: `${TITLE_PREFIX} Water Bottle`,
    vendor: "Findly Labs",
    productType: "Accessories",
    tags: [SEED_TAG, "seed", "outdoor", "sale"],
    price: "9.99",
    metafields: { material: "stainless steel", waterproof: true, weight_g: 310 },
    collections: ["outdoor"],
  },
  {
    title: `${TITLE_PREFIX} Limited Cap`,
    vendor: "Acme Outfitters",
    productType: "Accessories",
    tags: [SEED_TAG, "seed", "limited"],
    price: "34.00",
    metafields: { material: "wool blend", waterproof: false, weight_g: 120 },
    collections: [],
  },
  {
    title: `${TITLE_PREFIX} Summer Shorts`,
    vendor: "Northwind Goods",
    productType: "Apparel",
    tags: [SEED_TAG, "seed", "cotton", "summer"],
    price: "29.99",
    metafields: { material: "cotton", waterproof: false, weight_g: 250 },
    collections: ["apparel"],
  },
];

function buildProductSetInput(item) {
  const input = {
    title: item.title,
    vendor: item.vendor,
    productType: item.productType,
    tags: item.tags,
    status: "ACTIVE",
  };

  if (item.options?.length && item.variants?.length) {
    input.productOptions = item.options.map((opt, index) => ({
      name: opt.name,
      position: index + 1,
      values: opt.values.map((name) => ({ name })),
    }));
    input.variants = item.variants.map((v) => ({
      optionValues: v.optionValues,
      price: v.price,
    }));
  } else {
    input.productOptions = [
      {
        name: "Title",
        position: 1,
        values: [{ name: "Default Title" }],
      },
    ];
    input.variants = [
      {
        optionValues: [{ optionName: "Title", name: "Default Title" }],
        price: item.price ?? "19.99",
      },
    ];
  }

  return input;
}

function assertNoUserErrors(label, userErrors) {
  if (!userErrors?.length) return;
  if (isAccessDenied(userErrors)) {
    printScopeHelp();
  }
  throw new Error(`${label} userErrors: ${JSON.stringify(userErrors)}`);
}

async function ensureMetafieldDefinitions(shop, accessToken) {
  for (const definition of METAFIELD_DEFINITIONS) {
    const data = await adminGraphql(shop, accessToken, METAFIELD_DEFINITION_CREATE, {
      definition,
    });
    const payload = data.metafieldDefinitionCreate;
    const errors = payload.userErrors ?? [];
    const alreadyExists = errors.some(
      (e) =>
        /taken/i.test(e.message) ||
        /already exists/i.test(e.message) ||
        e.code === "TAKEN",
    );
    if (errors.length && !alreadyExists) {
      assertNoUserErrors(`metafieldDefinitionCreate(${definition.key})`, errors);
    } else if (payload.createdDefinition) {
      log.success(
        `metafield definition ok: custom.${definition.key} (${payload.createdDefinition.id})`,
      );
    } else {
      log.info(`metafield definition exists: custom.${definition.key}`);
    }
    await sleep(SLEEP_MS);
  }
}

const PRODUCTS_BY_TAG = `#graphql
query SeedProductsByTag($query: String!) {
  products(first: 50, query: $query) {
    edges {
      node {
        id
        title
      }
    }
  }
}`;

async function existingSeedTitles(shop, accessToken) {
  const data = await adminGraphql(shop, accessToken, PRODUCTS_BY_TAG, {
    query: `tag:${SEED_TAG}`,
  });
  return new Map(
    (data.products?.edges ?? []).map((e) => [e.node.title, e.node]),
  );
}

async function createProduct(shop, accessToken, item) {
  const data = await adminGraphql(shop, accessToken, PRODUCT_SET_MUTATION, {
    synchronous: true,
    input: buildProductSetInput(item),
  });
  const payload = data.productSet;
  assertNoUserErrors(`productSet(${item.title})`, payload.userErrors);

  const product = payload.product;
  if (!product?.id) {
    throw new Error(`productSet returned no product for ${item.title}`);
  }

  await sleep(SLEEP_MS);

  const metafields = [
    {
      ownerId: product.id,
      namespace: "custom",
      key: "material",
      type: "single_line_text_field",
      value: item.metafields.material,
    },
    {
      ownerId: product.id,
      namespace: "custom",
      key: "waterproof",
      type: "boolean",
      value: item.metafields.waterproof ? "true" : "false",
    },
    {
      ownerId: product.id,
      namespace: "custom",
      key: "weight_g",
      type: "number_integer",
      value: String(item.metafields.weight_g),
    },
  ];

  const mfData = await adminGraphql(shop, accessToken, METAFIELDS_SET, {
    metafields,
  });
  assertNoUserErrors(`metafieldsSet(${item.title})`, mfData.metafieldsSet.userErrors);

  await sleep(SLEEP_MS);
  return product;
}

async function findCollectionByTitle(shop, accessToken, title) {
  const data = await adminGraphql(
    shop,
    accessToken,
    `#graphql
    query SeedFindCollection($query: String!) {
      collections(first: 10, query: $query) {
        edges {
          node {
            id
            title
            handle
          }
        }
      }
    }`,
    { query: `title:'${title}'` },
  );
  return (
    data.collections?.edges?.find((e) => e.node.title === title)?.node ?? null
  );
}

async function createCollection(shop, accessToken, title, productIds) {
  const data = await adminGraphql(shop, accessToken, COLLECTION_CREATE, {
    input: {
      title,
      products: productIds,
      sortOrder: "MANUAL",
    },
  });
  const payload = data.collectionCreate;
  assertNoUserErrors(`collectionCreate(${title})`, payload.userErrors);
  if (!payload.collection?.id) {
    throw new Error(`collectionCreate returned no collection for ${title}`);
  }
  await sleep(SLEEP_MS);
  return payload.collection;
}

async function main() {
  const shopArg =
    parseShopArg(process.argv.slice(2)) ||
    process.env.SHOPIFY_FLAG_STORE ||
    null;

  const session = await prisma.session.findFirst({
    where: {
      isOnline: false,
      ...(shopArg ? { shop: shopArg } : {}),
    },
    select: { shop: true, accessToken: true, scope: true },
    orderBy: { id: "asc" },
  });

  if (!session) {
    log.error(
      shopArg
        ? `No offline Session found for shop=${shopArg}. Install the app on that store first.`
        : "No offline Session rows. Install the app via `npm run dev` on a dev store first.",
    );
    process.exit(1);
  }

  if (!session.accessToken || session.accessToken.length < 10) {
    log.error(`Session for ${session.shop} is missing accessToken.`);
    process.exit(1);
  }

  log.info(`Using shop=${session.shop} scope=${session.scope || "(none)"}`);
  log.info(`API ${API_VERSION} — seeding ${CATALOG.length} products…`);

  await ensureMetafieldDefinitions(session.shop, session.accessToken);

  const existingByTitle = await existingSeedTitles(
    session.shop,
    session.accessToken,
  );
  log.info(`Already on store: ${existingByTitle.size} ${SEED_TAG} products`);

  const createdProducts = [];
  const apparelIds = [];
  const outdoorIds = [];

  for (const item of CATALOG) {
    const existing = existingByTitle.get(item.title);
    const product = existing
      ? existing
      : await createProduct(session.shop, session.accessToken, item);
    createdProducts.push(product);
    log.info(
      existing
        ? `skip existing ${product.id}  ${item.title}`
        : `product ${product.id}  ${product.title}  variants=${product.variants?.nodes?.length ?? 0}`,
    );
    if (item.collections.includes("apparel")) apparelIds.push(product.id);
    if (item.collections.includes("outdoor")) outdoorIds.push(product.id);
  }

  const collections = [];
  for (const [title, productIds] of [
    ["Findly Seed Apparel", apparelIds],
    ["Findly Seed Outdoor", outdoorIds],
  ]) {
    const existing = await findCollectionByTitle(
      session.shop,
      session.accessToken,
      title,
    );
    const collection = existing
      ? existing
      : await createCollection(
          session.shop,
          session.accessToken,
          title,
          productIds,
        );
    collections.push(collection);
    log.info(
      existing
        ? `skip existing collection ${collection.id}  ${title}`
        : `collection ${collection.id}  ${collection.title}`,
    );
  }

  log.info("\n--- Created product GIDs ---");
  for (const p of createdProducts) {
    log.info(p.id);
  }
  log.info("\n--- Created collection GIDs ---");
  for (const c of collections) {
    log.info(c.id);
  }

  log.success(
    `Done. ${createdProducts.length} products, ${collections.length} collections (tag=${SEED_TAG}).`,
  );
  log.info("Next: open app Sync and Run full sync");
}

try {
  await main();
  process.exit(0);
} catch (error) {
  if (isAccessDenied(error.message)) {
    printScopeHelp();
  }
  log.error(`SEED_FAIL ${error.message}`);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
