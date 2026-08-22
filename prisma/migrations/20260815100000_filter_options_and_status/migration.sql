-- Variant option filters + storefront-only ACTIVE products.

ALTER TABLE "FilterConfig" ADD COLUMN "enableOptions" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "FilterConfig" ALTER COLUMN "enableTags" SET DEFAULT true;

UPDATE "FilterConfig"
SET "enableTags" = true
WHERE "collectionGid" = '';

ALTER TABLE "FilterConfig"
ALTER COLUMN "displayOrder"
SET DEFAULT ARRAY['availability', 'price', 'vendor', 'productType', 'tags', 'options']::TEXT[];

UPDATE "FilterConfig"
SET "displayOrder" = array_append("displayOrder", 'options')
WHERE NOT ('options' = ANY ("displayOrder"));

ALTER TABLE "ProductFacet" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
