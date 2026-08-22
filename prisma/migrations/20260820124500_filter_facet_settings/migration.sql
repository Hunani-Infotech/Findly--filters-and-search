-- Nested filter-option editor settings (label, all/manual/prefix values).

ALTER TABLE "FilterConfig" ADD COLUMN IF NOT EXISTS "facetSettings" JSONB NOT NULL DEFAULT '{}';
