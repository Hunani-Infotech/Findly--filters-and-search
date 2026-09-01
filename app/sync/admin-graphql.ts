import {
  GRAPHQL_THROTTLE_BASE_MS,
  GRAPHQL_THROTTLE_MAX_MS,
  GRAPHQL_THROTTLE_MAX_RETRIES,
} from "../constants/limits";
import { log } from "../lib/log.server";

/** Admin GraphQL documents for product/collection sync (no REST). */

export const PRODUCT_NODE_QUERY = `#graphql
  query ProductNode($id: ID!) {
    product(id: $id) {
      id
      handle
      title
      vendor
      productType
      category {
        name
        fullName
      }
      tags
      status
      createdAt
      publishedAt
      featuredImage {
        url
      }
      options {
        name
        values
      }
      variants(first: 100) {
        edges {
          node {
            id
            sku
            price
            compareAtPrice
            availableForSale
            inventoryPolicy
            inventoryQuantity
            image {
              url
            }
            selectedOptions {
              name
              value
            }
            metafields(first: 30) {
              edges {
                node {
                  id
                  namespace
                  key
                  value
                }
              }
            }
            inventoryItem {
              id
              tracked
              inventoryLevels(first: 50) {
                edges {
                  node {
                    id
                    quantities(names: ["available"]) {
                      name
                      quantity
                    }
                    location {
                      id
                      name
                      isActive
                    }
                  }
                }
              }
            }
          }
        }
      }
            metafields(first: 50) {
              edges {
                node {
                  id
                  namespace
                  key
                  value
                }
              }
            }
            reviewsRating: metafield(namespace: "reviews", key: "rating") {
              namespace
              key
              value
            }
            looxAvgRating: metafield(namespace: "loox", key: "avg_rating") {
              namespace
              key
              value
            }
            stampedAvgRating: metafield(namespace: "stamped", key: "reviews_average") {
              namespace
              key
              value
            }
            collections(first: 250) {
        edges {
          node {
            id
          }
        }
      }
    }
  }
`;

export const PRODUCT_COLLECTIONS_QUERY = `#graphql
  query ProductCollections($id: ID!, $cursor: String) {
    product(id: $id) {
      id
      collections(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
          }
        }
      }
    }
  }
`;

/** Lean inventory/availability refresh — no metafields or collections. */
export const PRODUCT_AVAILABILITY_QUERY = `#graphql
  query ProductAvailability($id: ID!) {
    product(id: $id) {
      id
      status
      variants(first: 100) {
        edges {
          node {
            id
            availableForSale
            inventoryPolicy
            inventoryQuantity
            inventoryItem {
              id
              tracked
              inventoryLevels(first: 50) {
                edges {
                  node {
                    id
                    quantities(names: ["available"]) {
                      name
                      quantity
                    }
                    location {
                      id
                      name
                      isActive
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const COLLECTION_PRODUCTS_QUERY = `#graphql
  query CollectionProducts($id: ID!, $cursor: String, $sortKey: ProductCollectionSortKeys = COLLECTION_DEFAULT) {
    collection(id: $id) {
      id
      title
      handle
      productsCount {
        count
        precision
      }
      products(first: 250, after: $cursor, sortKey: $sortKey) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
          }
        }
      }
    }
  }
`;

/**
 * Shopify bulkOperationRunQuery allows 5 connections total and 2 nesting
 * levels. This query uses exactly 5:
 *   1. products
 *   2. variants (nested 1)
 *   3. variant metafields (nested 2)
 *   4. product metafields (nested 1)
 *   5. collections (nested 1)
 * Keep inventoryQuantity on the variant (do not add inventoryLevels here).
 */
export const BULK_PRODUCTS_QUERY = `
{
  products {
    edges {
      node {
        id
        handle
        title
        vendor
        productType
        category {
          name
          fullName
        }
        tags
        status
        createdAt
        publishedAt
        featuredImage { url }
        options { name values }
        variants {
          edges {
            node {
              id
              sku
              price
              compareAtPrice
              availableForSale
              inventoryPolicy
              inventoryQuantity
              image { url }
              selectedOptions { name value }
              metafields {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                  }
                }
              }
              inventoryItem {
                id
                tracked
              }
            }
          }
        }
        metafields {
          edges {
            node {
              id
              namespace
              key
              value
            }
          }
        }
        reviewsRating: metafield(namespace: "reviews", key: "rating") {
          namespace
          key
          value
        }
        looxAvgRating: metafield(namespace: "loox", key: "avg_rating") {
          namespace
          key
          value
        }
        stampedAvgRating: metafield(namespace: "stamped", key: "reviews_average") {
          namespace
          key
          value
        }
        collections {
          edges {
            node {
              id
            }
          }
        }
      }
    }
  }
}
`.trim();

/** Shopify counts each `edges {` connection. Max is 5. */
export const SHOPIFY_BULK_MAX_CONNECTIONS = 5;

export function countBulkQueryConnections(query: string): number {
  return query.match(/\bedges\s*\{/g)?.length ?? 0;
}

export const BULK_PRODUCTS_MUTATION = `#graphql
  mutation BulkProductsRun($query: String!) {
    bulkOperationRunQuery(query: $query) {
      bulkOperation {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const CURRENT_BULK_OPERATION_QUERY = `#graphql
  query CurrentBulkOperation {
    currentBulkOperation {
      id
      status
      errorCode
      objectCount
      url
      completedAt
    }
  }
`;

/** Re-ingest a completed bulk only if it just finished (missed finish webhook). */
export const STALE_COMPLETED_BULK_MS = 2 * 60 * 60 * 1000;

export function completedBulkIsFresh(
  op: { completedAt?: string | null } | null | undefined,
  now = Date.now(),
): boolean {
  const raw = op?.completedAt;
  if (!raw) return false;
  const at = Date.parse(raw);
  if (Number.isNaN(at)) return false;
  return now - at <= STALE_COMPLETED_BULK_MS;
}

export const COLLECTIONS_LIST_QUERY = `#graphql
  query CollectionsList($cursor: String) {
    collections(first: 50, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
        }
      }
    }
  }
`;

export const PAGES_LIST_QUERY = `#graphql
  query PagesList($cursor: String) {
    pages(first: 50, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        handle
        isPublished
      }
    }
  }
`;

export const ARTICLES_LIST_QUERY = `#graphql
  query ArticlesList($cursor: String) {
    articles(first: 50, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        handle
        blog {
          handle
        }
      }
    }
  }
`;

export const INVENTORY_LEVEL_PRODUCT_QUERY = `#graphql
  query InventoryLevelProduct($id: ID!) {
    inventoryLevel(id: $id) {
      item {
        id
        variants(first: 1) {
          nodes {
            product { id }
          }
          edges {
            node {
              product { id }
            }
          }
        }
      }
    }
  }
`;

export const INVENTORY_ITEM_PRODUCT_QUERY = `#graphql
  query InventoryItemProduct($id: ID!) {
    inventoryItem(id: $id) {
      id
      variants(first: 1) {
        nodes {
          product { id }
        }
        edges {
          node {
            product { id }
          }
        }
      }
    }
  }
`;

export const VARIANT_PRODUCT_QUERY = `#graphql
  query VariantProduct($id: ID!) {
    productVariant(id: $id) {
      id
      product { id }
    }
  }
`;

export type AdminGraphqlClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

const THROTTLE_CODES = new Set([
  "THROTTLED",
  "MAX_COST_EXCEEDED",
  "COST_LIMIT",
]);

type GraphqlErrorShape = {
  message?: string;
  extensions?: { code?: string };
};

type GraphqlThrottlePayload = {
  errors?: GraphqlErrorShape[];
  extensions?: {
    cost?: {
      requestedQueryCost?: number;
      throttleStatus?: {
        currentlyAvailable?: number;
        restoreRate?: number;
      };
    };
  };
};

function parseJsonObject(body: string): GraphqlThrottlePayload | null {
  const trimmed = body.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    return JSON.parse(trimmed) as GraphqlThrottlePayload;
  } catch {
    return null;
  }
}

function errorLooksThrottled(err: GraphqlErrorShape | undefined): boolean {
  if (!err) return false;
  const code = String(err.extensions?.code || "").toUpperCase();
  if (THROTTLE_CODES.has(code)) return true;
  const message = String(err.message || "");
  return /throttl|too many requests|429|cost limit|exceeds the (single query )?max cost|currently available/i.test(
    message,
  );
}

/** True for HTTP 429 and GraphQL THROTTLED / cost-limit errors. */
export function isAdminGraphqlThrottled(input: {
  status?: number;
  body?: string;
  error?: unknown;
}): boolean {
  if (input.status === 429) return true;
  if (input.body) {
    const json = parseJsonObject(input.body);
    if (json?.errors?.some(errorLooksThrottled)) return true;
  }
  if (input.error == null) return false;
  if (typeof input.error === "object") {
    const err = input.error as {
      status?: number;
      response?: { status?: number };
      message?: string;
      body?: string;
    };
    if (err.status === 429 || err.response?.status === 429) return true;
    if (typeof err.body === "string" && isAdminGraphqlThrottled({ body: err.body })) {
      return true;
    }
    if (errorLooksThrottled({ message: err.message })) return true;
  }
  return errorLooksThrottled({ message: String(input.error) });
}

function retryAfterMs(headers: Headers): number | null {
  const raw = headers.get("Retry-After");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, GRAPHQL_THROTTLE_MAX_MS);
  }
  const at = Date.parse(raw);
  if (Number.isNaN(at)) return null;
  return Math.min(Math.max(0, at - Date.now()), GRAPHQL_THROTTLE_MAX_MS);
}

function costRestoreMs(body: string): number | null {
  const json = parseJsonObject(body);
  const cost = json?.extensions?.cost;
  const requested = Number(cost?.requestedQueryCost);
  const available = Number(cost?.throttleStatus?.currentlyAvailable);
  const restore = Number(cost?.throttleStatus?.restoreRate);
  if (
    !Number.isFinite(requested) ||
    !Number.isFinite(available) ||
    !Number.isFinite(restore) ||
    restore <= 0 ||
    requested <= available
  ) {
    return null;
  }
  const waitSec = (requested - available) / restore;
  return Math.min(Math.ceil(waitSec * 1000) + 100, GRAPHQL_THROTTLE_MAX_MS);
}

/** Exponential backoff, preferring Retry-After and GraphQL cost restore rate. */
export function adminGraphqlThrottleDelayMs(
  attempt: number,
  headers?: Headers,
  body?: string,
): number {
  const exp = Math.min(
    GRAPHQL_THROTTLE_BASE_MS * 2 ** Math.max(0, attempt),
    GRAPHQL_THROTTLE_MAX_MS,
  );
  const hinted =
    (headers ? retryAfterMs(headers) : null) ??
    (body ? costRestoreMs(body) : null);
  const base = Math.max(exp, hinted ?? 0);
  const jitter = 0.85 + Math.random() * 0.3;
  return Math.min(Math.round(base * jitter), GRAPHQL_THROTTLE_MAX_MS);
}

function replayResponse(
  status: number,
  statusText: string,
  headers: Headers,
  body: string,
): Response {
  return new Response(body, { status, statusText, headers });
}

export async function adminGraphqlWithRetry(
  graphql: AdminGraphqlClient["graphql"],
  query: string,
  options?: { variables?: Record<string, unknown> },
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<Response> {
  const maxAttempts = GRAPHQL_THROTTLE_MAX_RETRIES + 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await graphql(query, options);
      const status = Number(response.status) || 200;
      const headers = new Headers(response.headers);
      const body = await response.text();
      const throttled = isAdminGraphqlThrottled({ status, body });
      if (!throttled || attempt === maxAttempts - 1) {
        return replayResponse(status, response.statusText || "", headers, body);
      }
      const delay = adminGraphqlThrottleDelayMs(attempt, headers, body);
      log.warn(
        `[sync] Admin GraphQL THROTTLED / cost-limit; backoff ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`,
      );
      await sleep(delay);
    } catch (error) {
      lastError = error;
      const throttled = isAdminGraphqlThrottled({ error });
      if (!throttled || attempt === maxAttempts - 1) throw error;
      const delay = adminGraphqlThrottleDelayMs(attempt);
      log.warn(
        `[sync] Admin GraphQL THROTTLED throw; backoff ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`,
      );
      await sleep(delay);
    }
  }

  throw lastError ?? new Error("Admin GraphQL throttle retries exhausted");
}

/** Wrap an Admin GraphQL client so every call retries on THROTTLED / 429. */
export function wrapAdminGraphqlWithThrottleRetry(
  admin: AdminGraphqlClient,
): AdminGraphqlClient {
  return {
    graphql: (query, options) =>
      adminGraphqlWithRetry(
        (q, o) => admin.graphql(q, o),
        query,
        options,
      ),
  };
}
