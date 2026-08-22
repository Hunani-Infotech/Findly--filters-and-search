-- Merchant-configured searchable fields + variant SKUs on the catalog index.

ALTER TABLE "AppSettings" ADD COLUMN "searchFields" TEXT[] NOT NULL DEFAULT ARRAY['title','vendor','productType','tags']::TEXT[];
ALTER TABLE "ProductFacet" ADD COLUMN "skus" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
