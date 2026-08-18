-- C13: variant metafield discovery + filters (product matches if any variant matches).

CREATE TYPE "MetafieldOwnerType" AS ENUM ('PRODUCT', 'VARIANT');

ALTER TABLE "MetafieldMapping" ADD COLUMN "ownerType" "MetafieldOwnerType" NOT NULL DEFAULT 'PRODUCT';
DROP INDEX IF EXISTS "MetafieldMapping_shopId_namespace_key_key";
CREATE UNIQUE INDEX "MetafieldMapping_shopId_namespace_key_ownerType_key" ON "MetafieldMapping"("shopId", "namespace", "key", "ownerType");

ALTER TABLE "DiscoveredMetafield" ADD COLUMN "ownerType" "MetafieldOwnerType" NOT NULL DEFAULT 'PRODUCT';
DROP INDEX IF EXISTS "DiscoveredMetafield_shopId_namespace_key_key";
CREATE UNIQUE INDEX "DiscoveredMetafield_shopId_namespace_key_ownerType_key" ON "DiscoveredMetafield"("shopId", "namespace", "key", "ownerType");

ALTER TABLE "ProductFacet" ADD COLUMN "variantMetafields" JSONB NOT NULL DEFAULT '{}';
