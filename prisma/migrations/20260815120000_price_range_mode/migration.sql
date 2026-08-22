-- Merchant-selectable automatic vs custom storefront price bounds.

ALTER TABLE "FilterConfig" ADD COLUMN "priceRangeMode" TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE "FilterConfig" ADD COLUMN "customPriceMin" DECIMAL(12, 2);
ALTER TABLE "FilterConfig" ADD COLUMN "customPriceMax" DECIMAL(12, 2);
