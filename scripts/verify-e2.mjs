/**
 * E2 gate: Search blogs/pages + suggestion dictionary.
 * Instant search app embed was removed; skip instant-search.js UI gates.
 * Usage: npm run verify:e2
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "./prisma-runtime.mjs";
import { log } from "./terminal-log.mjs";

const SHOP_DOMAIN = "e2-verify.myshopify.com";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = createPrismaClient();

function fail(message) {
  throw new Error(message);
}

function readRepo(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

function assertStaticMarkers() {
  const schema = readRepo("prisma", "schema.prisma");
  if (!schema.includes("model ShopPage") || !schema.includes("model ShopArticle")) {
    fail("schema missing ShopPage / ShopArticle");
  }

  const graphql = readRepo("app", "sync", "admin-graphql.ts");
  if (!graphql.includes("PAGES_LIST_QUERY") || !graphql.includes("ARTICLES_LIST_QUERY")) {
    fail("admin-graphql.ts missing pages/articles list queries");
  }

  const sync = readRepo("app", "sync", "sync.server.ts");
  if (!sync.includes("syncShopContent")) {
    fail("sync.server.ts missing syncShopContent");
  }

  const search = readRepo("app", "services", "search.server.ts");
  if (!search.includes("searchPages") || !search.includes("searchArticles")) {
    fail("search.server.ts missing searchPages / searchArticles");
  }

  const proxy = readRepo("app", "services", "proxy.server.ts");
  if (!proxy.includes("searchPages") || !proxy.includes("searchArticles")) {
    fail("proxy.server.ts must search pages and articles for search payloads");
  }

  // Instant search app embed retired — do not require instant-search.js.

  const admin = readRepo("app", "routes", "app.search._index.tsx");
  if (!admin.includes("Suggestion dictionary")) {
    fail("Search admin missing Suggestion dictionary");
  }

  log.info("E2 static markers present");
}

async function cleanup() {
  await prisma.shop.deleteMany({ where: { domain: SHOP_DOMAIN } });
}

try {
  assertStaticMarkers();
  await cleanup();

  const shop = await prisma.shop.create({
    data: { domain: SHOP_DOMAIN, plan: "free" },
  });

  await prisma.appSettings.create({
    data: {
      shopId: shop.id,
      searchExtras: {
        popularSearchTerms: ["Shipping FAQ", "Returns"],
        instant: {
          enabled: true,
          showPages: true,
          showBlogPosts: true,
          showCollections: true,
          showProducts: true,
        },
      },
    },
  });

  await prisma.shopPage.create({
    data: {
      shopId: shop.id,
      pageGid: "gid://shopify/Page/9202001",
      title: "Shipping FAQ",
      handle: "shipping-faq",
      published: true,
    },
  });
  await prisma.shopPage.create({
    data: {
      shopId: shop.id,
      pageGid: "gid://shopify/Page/9202002",
      title: "About us",
      handle: "about",
      published: true,
    },
  });
  await prisma.shopArticle.create({
    data: {
      shopId: shop.id,
      articleGid: "gid://shopify/Article/9202003",
      title: "Winter shipping tips",
      handle: "winter-shipping-tips",
      blogHandle: "news",
      published: true,
    },
  });

  const { getSearchPayload } = await import("../app/services/proxy.server.ts");

  const pageHit = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: "Shipping FAQ",
  });
  const pages = pageHit.data?.pages ?? [];
  if (!pages.some((row) => row.title === "Shipping FAQ" && row.url === "/pages/shipping-faq")) {
    fail(
      `searching a page title should return that page, got ${JSON.stringify(pages)}`,
    );
  }

  const articleHit = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: "Winter shipping",
  });
  const articles = articleHit.data?.articles ?? [];
  if (
    !articles.some(
      (row) =>
        row.title === "Winter shipping tips" &&
        row.url === "/blogs/news/winter-shipping-tips",
    )
  ) {
    fail(`blog search should return the article, got ${JSON.stringify(articles)}`);
  }

  const dictionary = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: "ship",
  });
  const queries = dictionary.data?.queries ?? [];
  if (!queries.some((row) => row.query === "Shipping FAQ")) {
    fail(`suggestion dictionary should match Shipping FAQ, got ${JSON.stringify(queries)}`);
  }

  log.info("Searching a page title returns that page in the widget payload");
  log.info("Blog articles and suggestion dictionary are included");
  log.info("STEPE2_OK");
} catch (error) {
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await cleanup().catch(() => {});
  await prisma.$disconnect();
}
