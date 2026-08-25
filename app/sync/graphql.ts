/** Admin GraphQL documents for product/collection sync (no REST). */

export const PRODUCT_NODE_QUERY = `#graphql
  query ProductNode($id: ID!) {
    product(id: $id) {
      id
      handle
      title
      vendor
      productType
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
