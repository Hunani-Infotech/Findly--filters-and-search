-- Shopify source watermarks for out-of-order webhook / sync writes (W-7).
ALTER TABLE "ProductFacet" ADD COLUMN "shopifyUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Collection" ADD COLUMN "shopifyUpdatedAt" TIMESTAMP(3);
