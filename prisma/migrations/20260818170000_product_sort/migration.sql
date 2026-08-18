-- C4: collection manual order, product dates, merchant sort settings.
-- Best-selling and % sale are intentionally omitted (no sales / compare-at data).

ALTER TABLE "ProductFacet" ADD COLUMN "publishedAt" TIMESTAMP(3);

ALTER TABLE "CollectionMembership" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AppSettings" ADD COLUMN "sortOptionsEnabled" TEXT[] NOT NULL DEFAULT ARRAY['manual','title_asc','title_desc','price_asc','price_desc','date_desc','date_asc']::TEXT[];
ALTER TABLE "AppSettings" ADD COLUMN "defaultSort" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "AppSettings" ADD COLUMN "hideSortDropdown" BOOLEAN NOT NULL DEFAULT false;
