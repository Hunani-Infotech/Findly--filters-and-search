-- D10: hide products by tag; hide total product count.

ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "showTotalProductCount" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "hideProductTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
