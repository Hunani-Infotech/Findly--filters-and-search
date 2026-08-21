-- D7: custom CSS + optional product-list Liquid on AppSettings.

ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "customCss" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "productListLiquid" TEXT NOT NULL DEFAULT '';
