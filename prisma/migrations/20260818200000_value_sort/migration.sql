-- C12: per-facet filter value sort (auto / alphabetical / manual).
ALTER TABLE "FilterConfig" ADD COLUMN "valueSort" JSONB NOT NULL DEFAULT '{}';
