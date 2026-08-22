-- C10: per-collection merchant display types for each facet.
ALTER TABLE "FilterConfig" ADD COLUMN "displayTypes" JSONB NOT NULL DEFAULT '{}';
