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
            sku
            price
            availableForSale
          }
        }
      }
      metafields(first: 50) {
        edges {
          node {
            namespace
            key
            value
          }
        }
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

export const BULK_PRODUCTS_MUTATION = `#graphql
  mutation BulkProductsRun {
    bulkOperationRunQuery(
      query: """
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
              featuredImage { url }
              options { name values }
              variants {
                edges {
                  node {
                    sku
                    price
                    availableForSale
                  }
                }
              }
              metafields {
                edges {
                  node {
                    namespace
                    key
                    value
                  }
                }
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
      """
    ) {
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
