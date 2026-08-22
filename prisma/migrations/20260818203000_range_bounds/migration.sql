-- C14: per-collection custom min/max for RANGE metafield sliders.

ALTER TABLE "FilterConfig" ADD COLUMN "rangeBounds" JSONB NOT NULL DEFAULT '{}';
