/**
 * F5 — Shopify Markets, presentment currencies, and B2B catalog prices.
 * Price filter matching uses the storefront country / company location, not a
 * hardcoded shop currency.
 */

export type MarketPriceBand = {
  min: number;
  max: number;
  currency: string;
};

export type MarketPriceMap = Record<string, MarketPriceBand>;

export type MarketPriceContext = {
  country?: string | null;
  currency?: string | null;
  companyLocationId?: string | null;
};

const COUNTRY_RE = /^[A-Z]{2}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const MAX_COUNTRIES = 12;
const MAX_LOCATIONS = 8;

export function countryKey(value: string): string {
  return value.trim().toUpperCase();
}

export function catalogKey(companyLocationId: string): string {
  const id = companyLocationId.trim();
  if (!id) return "";
  return id.startsWith("catalog:") ? id : `catalog:${id}`;
}

function asFinitePrice(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseMarketPrices(raw: unknown): MarketPriceMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: MarketPriceMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key || !value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const rec = value as Record<string, unknown>;
    const min = asFinitePrice(rec.min);
    const max = asFinitePrice(rec.max);
    if (min == null || max == null) continue;
    const currency =
      typeof rec.currency === "string" && CURRENCY_RE.test(rec.currency.toUpperCase())
        ? rec.currency.toUpperCase()
        : "";
    out[key] = {
      min,
      max: Math.max(min, max),
      currency,
    };
  }
  return out;
}

export function parseMarketContext(input: {
  country?: string | null;
  currency?: string | null;
  companyLocationId?: string | null;
  company_location?: string | null;
}): MarketPriceContext {
  const countryRaw = String(input.country || "")
    .trim()
    .toUpperCase();
  const currencyRaw = String(input.currency || "")
    .trim()
    .toUpperCase();
  const location =
    String(input.companyLocationId || input.company_location || "").trim() ||
    null;
  return {
    country: COUNTRY_RE.test(countryRaw) ? countryRaw : null,
    currency: CURRENCY_RE.test(currencyRaw) ? currencyRaw : null,
    companyLocationId: location,
  };
}

export function resolveMarketPrice(
  marketPrices: unknown,
  fallback: { min: number; max: number },
  context: MarketPriceContext,
): MarketPriceBand {
  const map = parseMarketPrices(marketPrices);
  const shopBand: MarketPriceBand = {
    min: fallback.min,
    max: fallback.max,
    currency: context.currency || "",
  };

  const locationId = context.companyLocationId;
  if (locationId) {
    const catalog = map[catalogKey(locationId)];
    if (catalog) return catalog;
  }

  if (context.country) {
    const byCountry = map[countryKey(context.country)];
    if (byCountry) return byCountry;
  }

  if (context.currency) {
    const want = context.currency.toUpperCase();
    for (const [key, band] of Object.entries(map)) {
      if (key.startsWith("catalog:")) continue;
      if (band.currency === want) return band;
    }
  }

  return shopBand;
}

export function applyMarketPricesToRow<
  T extends { priceMin: number; priceMax: number },
>(
  row: T,
  marketPrices: unknown,
  context: MarketPriceContext,
  enabled = true,
): T & { currency?: string } {
  if (!enabled) return row;
  const band = resolveMarketPrice(
    marketPrices,
    { min: row.priceMin, max: row.priceMax },
    context,
  );
  return {
    ...row,
    priceMin: band.min,
    priceMax: band.max,
    currency: band.currency || undefined,
  };
}

export const MARKETS_LIST_QUERY = `#graphql
  query FindlyMarkets {
    markets(first: 25) {
      nodes {
        id
        name
        status
        enabled
        primary
        currencySettings {
          baseCurrency {
            currencyCode
          }
        }
        regions(first: 25) {
          nodes {
            name
            ... on MarketRegionCountry {
              code
            }
          }
        }
        conditions {
          regionsCondition {
            regions {
              name
              ... on MarketRegionCountry {
                code
              }
            }
          }
        }
      }
    }
  }
`;

export const COMPANY_LOCATIONS_QUERY = `#graphql
  query FindlyCompanyLocations {
    companies(first: 25) {
      nodes {
        id
        locations(first: 25) {
          nodes {
            id
            name
          }
        }
      }
    }
  }
`;

export function parseMarketCountryCodes(payload: unknown): string[] {
  const root = payload as {
    data?: { markets?: { nodes?: unknown[] } };
    markets?: { nodes?: unknown[] };
  };
  const nodes = root?.data?.markets?.nodes ?? root?.markets?.nodes ?? [];
  const codes = new Set<string>();
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const market = node as {
      enabled?: boolean | null;
      status?: string | null;
      regions?: { nodes?: Array<{ code?: string | null }> };
      conditions?: {
        regionsCondition?: { regions?: Array<{ code?: string | null }> };
      };
    };
    if (market.enabled === false) continue;
    if (market.status && String(market.status).toUpperCase() === "DRAFT") {
      continue;
    }
    const regions = [
      ...(market.regions?.nodes ?? []),
      ...(market.conditions?.regionsCondition?.regions ?? []),
    ];
    for (const region of regions) {
      const code = String(region?.code || "")
        .trim()
        .toUpperCase();
      if (COUNTRY_RE.test(code)) codes.add(code);
    }
  }
  return [...codes].slice(0, MAX_COUNTRIES);
}

export function parseCompanyLocationIds(payload: unknown): string[] {
  const root = payload as {
    data?: { companies?: { nodes?: unknown[] } };
    companies?: { nodes?: unknown[] };
  };
  const companies = root?.data?.companies?.nodes ?? root?.companies?.nodes ?? [];
  const ids: string[] = [];
  for (const company of companies) {
    if (!company || typeof company !== "object") continue;
    const locations =
      (
        company as {
          locations?: { nodes?: Array<{ id?: string | null }> };
        }
      ).locations?.nodes ?? [];
    for (const location of locations) {
      const id = typeof location?.id === "string" ? location.id.trim() : "";
      if (id.startsWith("gid://shopify/CompanyLocation/")) ids.push(id);
    }
  }
  return [...new Set(ids)].slice(0, MAX_LOCATIONS);
}

type MoneyNode = {
  amount?: string | number | null;
  currencyCode?: string | null;
};

type ContextualPricingNode = {
  minVariantPricing?: { price?: MoneyNode | null } | null;
  maxVariantPricing?: { price?: MoneyNode | null } | null;
};

function bandFromContextual(node: ContextualPricingNode | null | undefined): MarketPriceBand | null {
  const minAmt = asFinitePrice(node?.minVariantPricing?.price?.amount);
  const maxAmt = asFinitePrice(node?.maxVariantPricing?.price?.amount);
  if (minAmt == null && maxAmt == null) return null;
  const min = minAmt ?? maxAmt ?? 0;
  const max = maxAmt ?? minAmt ?? 0;
  const currency = String(
    node?.minVariantPricing?.price?.currencyCode ||
      node?.maxVariantPricing?.price?.currencyCode ||
      "",
  )
    .trim()
    .toUpperCase();
  return {
    min,
    max: Math.max(min, max),
    currency: CURRENCY_RE.test(currency) ? currency : "",
  };
}

export function mergeProductMarketPrices(
  productNode: unknown,
  companyLocationIds: string[] = [],
): MarketPriceMap {
  if (!productNode || typeof productNode !== "object") return {};
  const rec = productNode as Record<string, unknown>;
  const out: MarketPriceMap = {};
  for (const [key, value] of Object.entries(rec)) {
    if (key.startsWith("c") && COUNTRY_RE.test(key.slice(1))) {
      const band = bandFromContextual(value as ContextualPricingNode);
      if (band) out[key.slice(1)] = band;
    }
    const locMatch = /^loc(\d+)$/.exec(key);
    if (locMatch) {
      const locId = companyLocationIds[Number(locMatch[1])] || "";
      const band = bandFromContextual(value as ContextualPricingNode);
      if (band && locId) out[catalogKey(locId)] = band;
    }
  }
  return out;
}

const CONTEXTUAL_PRICE_FIELDS = `
  minVariantPricing { price { amount currencyCode } }
  maxVariantPricing { price { amount currencyCode } }
`;

export function buildProductContextualPricesQuery(
  productGids: string[],
  countries: string[],
  companyLocationIds: string[],
): { query: string; aliases: string[] } {
  const gids = productGids.filter((id) => id.startsWith("gid://shopify/Product/"));
  const countryCodes = countries
    .map(countryKey)
    .filter((code) => COUNTRY_RE.test(code))
    .slice(0, MAX_COUNTRIES);
  const locations = companyLocationIds
    .filter((id) => id.startsWith("gid://shopify/CompanyLocation/"))
    .slice(0, MAX_LOCATIONS);

  const aliases: string[] = [];
  const productBlocks = gids.map((gid, index) => {
    const alias = `p${index}`;
    aliases.push(alias);
    const countryFields = countryCodes
      .map(
        (code) =>
          `c${code}: contextualPricing(context: { country: ${code} }) { ${CONTEXTUAL_PRICE_FIELDS} }`,
      )
      .join("\n        ");
    const locFields = locations
      .map(
        (id, locIndex) =>
          `loc${locIndex}: contextualPricing(context: { companyLocationId: "${id}" }) { ${CONTEXTUAL_PRICE_FIELDS} }`,
      )
      .join("\n        ");
    return `    ${alias}: product(id: "${gid}") {
      id
      ${countryFields}
      ${locFields}
    }`;
  });

  return {
    query: `#graphql
  query FindlyProductMarketPrices {
${productBlocks.join("\n")}
  }
`,
    aliases,
  };
}
