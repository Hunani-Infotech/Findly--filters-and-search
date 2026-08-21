-- F2: variants as separate products (per filter tree / collection).

ALTER TABLE "FilterConfig" ADD COLUMN IF NOT EXISTS "enableVariantsAsProducts" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FilterConfig" ADD COLUMN IF NOT EXISTS "variantAsProductOptions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ProductFacet" ADD COLUMN IF NOT EXISTS "variants" JSONB NOT NULL DEFAULT '[]'::jsonb;
