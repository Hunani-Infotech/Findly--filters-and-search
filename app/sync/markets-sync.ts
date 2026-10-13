import prisma from "../db.server";
import { log } from "../lib/log.server";
import {
  COMPANY_LOCATIONS_QUERY,
  MARKETS_LIST_QUERY,
  buildProductContextualPricesQuery,
  mergeProductMarketPrices,
  parseCompanyLocationIds,
  parseMarketCountryCodes,
} from "../services/markets.server";

type GraphqlClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

type GraphqlJson = {
  data?: Record<string, unknown>;
  errors?: Array<{
    message?: string;
    extensions?: { code?: string };
  }>;
};

const PRODUCT_BATCH_SIZE = 4;
const MARKET_CONTEXT_TTL_MS = 10 * 60 * 1000;

type MarketContextCacheEntry = {
  expires: number;
  countries: string[];
  companyLocationIds: string[];
};

const marketContextByShop = new Map<string, MarketContextCacheEntry>();

/**
 * Optional B2B scope probe for FindlyCompanyLocations.
 * - true  → shop granted read_companies (run query)
 * - false → offline session exists without that scope (skip query; prevents ACCESS_DENIED)
 * - null  → unknown (DB/session missing) → keep prior behavior (attempt query)
 */
async function shopMayReadCompanies(shopId: string): Promise<boolean | null> {
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { domain: true },
    });
    if (!shop?.domain) return null;
    const session = await prisma.session.findFirst({
      where: { shop: shop.domain, isOnline: false },
      select: { scope: true },
    });
    if (!session) return null;
    const scopes = String(session.scope || "")
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return scopes.includes("read_companies");
  } catch {
    return null;
  }
}

function shouldSwallowGraphqlErrors(payload: GraphqlJson): boolean {
  const errors = payload.errors;
  if (!Array.isArray(errors) || !errors.length) return false;
  return errors.some((err) => {
    const code = String(err?.extensions?.code || "").toUpperCase();
    const message = String(err?.message || "").toUpperCase();
    return (
      code === "ACCESS_DENIED" ||
      message.includes("ACCESS_DENIED") ||
      message.includes("ACCESS DENIED") ||
      message.includes("DOESN'T EXIST") ||
      message.includes("DOES NOT EXIST") ||
      message.includes("UNKNOWN FIELD")
    );
  });
}

async function graphqlJson(
  admin: GraphqlClient,
  query: string,
): Promise<GraphqlJson> {
  try {
    const res = await admin.graphql(query);
    const json = (await res.json()) as GraphqlJson;
    if (shouldSwallowGraphqlErrors(json)) {
      return json.data ? { data: json.data } : {};
    }
    return json;
  } catch {
    return {};
  }
}

export async function listMarketContexts(
  admin: GraphqlClient,
  opts?: { includeCompanyLocations?: boolean },
): Promise<{
  countries: string[];
  companyLocationIds: string[];
}> {
  const marketsJson = await graphqlJson(admin, MARKETS_LIST_QUERY);
  const countries = parseMarketCountryCodes(marketsJson);

  let companyLocationIds: string[] = [];
  // Default true preserves prior behavior when callers omit the flag.
  if (opts?.includeCompanyLocations !== false) {
    try {
      const companiesJson = await graphqlJson(admin, COMPANY_LOCATIONS_QUERY);
      companyLocationIds = parseCompanyLocationIds(companiesJson);
    } catch {
      companyLocationIds = [];
    }
  }

  return { countries, companyLocationIds };
}

/** Cache markets/company lists per shop — avoids 2 GraphQL calls on every product edit. */
export async function listMarketContextsForShop(
  admin: GraphqlClient,
  shopId: string,
): Promise<{ countries: string[]; companyLocationIds: string[] }> {
  const hit = marketContextByShop.get(shopId);
  if (hit && hit.expires > Date.now()) {
    return {
      countries: hit.countries,
      companyLocationIds: hit.companyLocationIds,
    };
  }
  // Only skip when we positively know read_companies is absent.
  // null/true → same as before (run FindlyCompanyLocations).
  const mayReadCompanies = await shopMayReadCompanies(shopId);
  const includeCompanyLocations = mayReadCompanies !== false;
  const ctx = await listMarketContexts(admin, { includeCompanyLocations });
  marketContextByShop.set(shopId, {
    ...ctx,
    expires: Date.now() + MARKET_CONTEXT_TTL_MS,
  });
  return ctx;
}

async function persistMarketPrices(
  shopId: string,
  productGid: string,
  productNode: unknown,
  companyLocationIds: string[],
) {
  const map = mergeProductMarketPrices(productNode, companyLocationIds);
  if (!Object.keys(map).length) return;
  await prisma.productFacet.updateMany({
    where: { shopId, productGid },
    data: { marketPrices: map },
  });
}

export async function syncProductMarketPrices(
  admin: GraphqlClient,
  shopId: string,
  productGid: string,
): Promise<void> {
  const { countries, companyLocationIds } = await listMarketContextsForShop(
    admin,
    shopId,
  );
  if (!countries.length && !companyLocationIds.length) return;

  const { query, aliases } = buildProductContextualPricesQuery(
    [productGid],
    countries,
    companyLocationIds,
  );
  const json = await graphqlJson(admin, query);
  const alias = aliases[0];
  if (!alias) return;
  const node = json.data?.[alias];
  await persistMarketPrices(shopId, productGid, node, companyLocationIds);
}

export async function syncShopMarketPrices(
  admin: GraphqlClient,
  shopId: string,
): Promise<void> {
  try {
    const { countries, companyLocationIds } = await listMarketContextsForShop(
      admin,
      shopId,
    );
    if (!countries.length && !companyLocationIds.length) return;

    const facets = await prisma.productFacet.findMany({
      where: { shopId },
      select: { productGid: true },
    });
    const gids = facets.map((row) => row.productGid);

    for (let i = 0; i < gids.length; i += PRODUCT_BATCH_SIZE) {
      const batch = gids.slice(i, i + PRODUCT_BATCH_SIZE);
      const { query, aliases } = buildProductContextualPricesQuery(
        batch,
        countries,
        companyLocationIds,
      );
      const json = await graphqlJson(admin, query);
      const data = json.data ?? {};
      for (let index = 0; index < aliases.length; index += 1) {
        const alias = aliases[index];
        const productGid = batch[index];
        if (!alias || !productGid) continue;
        await persistMarketPrices(
          shopId,
          productGid,
          data[alias],
          companyLocationIds,
        );
      }
    }
  } catch (error) {
    log.error("Market prices sync failed", error);
  }
}
