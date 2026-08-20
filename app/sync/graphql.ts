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
            collections(first: 50) {
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
  query CollectionProducts($id: ID!, $cursor: String) {
    collection(id: $id) {
      id
      title
      handle
      products(first: 100, after: $cursor) {
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
    }
  }
`;

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
