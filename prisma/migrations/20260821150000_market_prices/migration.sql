-- F5: Shopify Markets / multi-currency / B2B catalog prices
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "enableMarkets" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "ProductFacet" ADD COLUMN IF NOT EXISTS "marketPrices" JSONB NOT NULL DEFAULT '{}';
