-- Settings toggles (search-page filters, hide single-value facets,
-- matching variant image, Refine by chips).

ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "enableFiltersOnSearch" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "hideSingleValueFacets" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "showMatchingVariantImage" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "showRefineBy" BOOLEAN NOT NULL DEFAULT true;
